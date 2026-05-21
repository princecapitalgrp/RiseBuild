/**
 * src/engine/PersonalizationEngine.ts
 *
 * Orchestrator for the morning personalization loop.
 * The single public entry point for generating a morning plan.
 *
 * Flow:
 *   1. InterpretationService.interpret() — RawCheckIn → DailyContext + OperatingState (on-device)
 *   2. Build MemorySummary request payload from MemoryRepository
 *   3. Attempt AI plan generation via POST /api/generate-protocol
 *      - Zod-validated request — no raw user text ever sent
 *      - On success: validate response → stamp uid → write to PlanRepository
 *   4. On any failure: fallback to PlanGenerationService.generatePlan() (rule-based)
 *      - Fallback always succeeds — user always receives a plan
 *   5. Write plan to PlanRepository
 *   6. Return OperatingPlan to caller
 *
 * Privacy contract (enforced at step 3):
 *   - Only sends: archetype, operatingMode, pulseState, capacity,
 *     availableWindow, complexityTolerance, needsRationale, guidanceStyle,
 *     sensoryStyle, overwhelmStyle, seasonalFocus, hasTimeSpecificWeight,
 *     weightCategory, memorySummary (categorized labels only), wakeTarget,
 *     preferredDuration, archetypeTranslation
 *   - Never sends: mood text, updatedWeight text, reflection notes,
 *     any user-authored text
 *
 * Architecture constraints:
 *   - No React imports. No UI imports.
 *   - PlanRepository is the only write side effect.
 *   - Fallback path must always produce a valid OperatingPlan.
 */

import { interpret } from '../domain/InterpretationService';
import { generatePlan, type PlanGenerationInput } from './PlanGenerationService';
import { planRepository } from '../repositories/PlanRepository';
import { OperatingPlanSchema } from '../storage/validators';
import { todayKey } from '../storage/keys';
import type {
  RawCheckIn,
  OnboardingProfile,
  MemorySummary,
  OperatingPlan,
  DailyContext,
  OperatingState,
} from '../../domain/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MorningPlanResult {
  plan: OperatingPlan;
  context: DailyContext;
  state: OperatingState;
  source: 'ai' | 'rule-based';
}

// ─── API base URL ─────────────────────────────────────────────────────────────
// In Expo managed workflow the API route is served from the same origin.
// The EXPO_PUBLIC_ prefix is safe — this is a path, not a secret.

function getApiBase(): string {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }
  // Default for local dev (Expo Router default port)
  return 'http://localhost:8081';
}

// ─── MemorySummary serializer ─────────────────────────────────────────────────
// Transforms a MemorySummary into the shape the API route expects.
// Only sends category labels — never verbatim user text.

function serializeMemorySummary(memory: MemorySummary | null): object | null {
  if (!memory) return null;

  return {
    stabilizers:           memory.stabilizers,
    derailers:             memory.derailers,
    tractionBuilders:      memory.tractionBuilders,
    reliableFirstMoves:    memory.reliableFirstMoves,
    highAccuracyPatterns:  memory.highAccuracyPatterns  ?? [],
    lowAccuracyPatterns:   memory.lowAccuracyPatterns   ?? [],
    averageFollowThrough:  memory.averageFollowThrough  ?? 0,
    averageExecutionDepth: memory.averageExecutionDepth ?? 0,
  };
}

// ─── AI plan generation ───────────────────────────────────────────────────────

// Derive guidanceStyle from pressureResponse.
// 'Push' users respond well to directive framing; 'Pull' users to invitational.
function deriveGuidanceStyle(pressureResponse: OnboardingProfile['pressureResponse']): 'directive' | 'invitational' {
  return pressureResponse === 'Push' ? 'directive' : 'invitational';
}

async function generatePlanViaAI(
  profile: OnboardingProfile,
  context: DailyContext,
  state: OperatingState,
  memory: MemorySummary | null,
  uid: string,
): Promise<OperatingPlan | null> {
  const requestBody = {
    archetype:            profile.archetype,
    operatingMode:        state.mode,
    pulseState:           state.pulseState,
    capacity:             state.capacity,
    availableWindow:      state.availableWindow,
    complexityTolerance:  profile.complexityTolerance,
    needsRationale:       profile.needsRationale ?? true,
    guidanceStyle:        deriveGuidanceStyle(profile.pressureResponse),
    sensoryStyle:         profile.sensoryStyle,
    overwhelmStyle:       profile.overwhelmStyle,
    seasonalFocus:        profile.seasonalFocus,
    hasTimeSpecificWeight: context.flags.includes('HAS_TIME_SPECIFIC_WEIGHT'),
    weightCategory:       context.weightCategory !== 'NONE' ? context.weightCategory : null,
    memorySummary:        serializeMemorySummary(memory),
    wakeTarget:           profile.wakeTarget ?? '07:00',
    preferredDuration:    profile.preferredDuration,
    archetypeTranslation: profile.archetypeTranslation ?? '',
  };

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}/api/generate-protocol`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  } catch {
    if (__DEV__) {
      console.warn('[Rise] PersonalizationEngine: network error reaching AI route — using fallback');
    }
    return null;
  }

  if (!response.ok) {
    if (__DEV__) {
      console.warn(`[Rise] PersonalizationEngine: AI route returned ${response.status} — using fallback`);
    }
    return null;
  }

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    if (__DEV__) {
      console.warn('[Rise] PersonalizationEngine: AI route response was not valid JSON — using fallback');
    }
    return null;
  }

  // Extract plan from { plan: ... } envelope
  const envelope = json as { plan?: unknown };
  if (!envelope?.plan) {
    if (__DEV__) {
      console.warn('[Rise] PersonalizationEngine: AI route response missing plan field — using fallback');
    }
    return null;
  }

  // Validate and stamp uid (device owns uid — never trusted from server)
  const validated = OperatingPlanSchema.omit({ uid: true }).safeParse(envelope.plan);
  if (!validated.success) {
    if (__DEV__) {
      console.warn('[Rise] PersonalizationEngine: AI plan failed schema validation — using fallback:', validated.error.flatten());
    }
    return null;
  }

  return { ...validated.data, uid };
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Generates a morning plan for the given profile and check-in.
 *
 * Attempts AI generation first. Falls back to rule-based if the AI call
 * fails for any reason. Always returns a valid OperatingPlan.
 *
 * Writes the plan to PlanRepository before returning.
 */
export async function generateMorningPlan(
  profile: OnboardingProfile,
  checkIn: RawCheckIn,
  memory: MemorySummary | null = null,
): Promise<MorningPlanResult> {
  // Step 1 — interpret on-device (synchronous, no side effects)
  const { context, state } = interpret({
    checkIn,
    profile,
    memorySummary: memory,
    previousPlan: null,
  });

  const uid = checkIn.uid;

  // Step 2 — attempt AI generation
  let plan = await generatePlanViaAI(profile, context, state, memory, uid);
  let source: 'ai' | 'rule-based' = 'ai';

  // Step 3 — fallback to rule-based if AI failed
  if (!plan) {
    source = 'rule-based';
    const fallbackInput: PlanGenerationInput = { context, state, profile, memorySummary: memory };
    plan = generatePlan(fallbackInput);

    if (__DEV__) {
      console.log('[Rise] PersonalizationEngine: using rule-based fallback plan');
    }
  } else {
    if (__DEV__) {
      console.log('[Rise] PersonalizationEngine: AI plan generated successfully');
    }
  }

  // Step 4 — persist to MMKV
  planRepository.savePlan(plan);

  return { plan, context, state, source };
}

/**
 * Returns an existing plan for today from MMKV, or null.
 * Used by TodayScreen to avoid re-generating a plan that already exists.
 */
export function getTodayPlan(): OperatingPlan | null {
  return planRepository.getPlan(todayKey());
}

/**
 * Returns true if a plan has already been generated for today.
 * Used by TodayScreen routing logic.
 */
export function hasPlanForToday(): boolean {
  return planRepository.hasPlanForToday();
}
