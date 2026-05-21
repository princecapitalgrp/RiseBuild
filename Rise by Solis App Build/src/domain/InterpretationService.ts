/**
 * src/domain/InterpretationService.ts
 *
 * Pure interpretation layer. No side effects, no MMKV access, no repository calls.
 * Transforms RawCheckIn + profile context into DailyContext + OperatingState.
 *
 * All functions are pure: same inputs always produce same outputs.
 * Safe to call multiple times, in any order, from any context.
 *
 * Keyword → EmotionalTone mapping uses the canonical EmotionalTone enum.
 * Conceptual intermediaries (e.g. "depleted") are mapped at the return site:
 *   anxious/worried/scared/nervous/dread → TENSE
 *   tired/exhausted/drained/heavy/flat   → HEAVY
 *   scattered/unfocused/distracted       → SCATTERED
 *   angry/frustrated/annoyed/irritated   → FRAGILE
 *   numb/empty/hollow                    → NUMB
 *   good/clear/ready/calm/solid/grounded → CLEAR
 *   null / default                       → CALM
 */

import type {
  RawCheckIn,
  OnboardingProfile,
  MemorySummary,
  OperatingPlan,
  DailyContext,
  OperatingState,
  EmotionalTone,
  PulseState,
  OperatingMode,
  EnergyLevel,
  StressLevel,
  SleepQuality,
  Readiness,
  CognitiveLoad,
  WeightCategory,
  CommitmentProfile,
  BlockType,
  TrustTrend,
  Urgency,
} from '../../domain/types';

// ─── Input type ───────────────────────────────────────────────────────────────

export interface InterpretationInput {
  checkIn: RawCheckIn;
  profile: OnboardingProfile;
  memorySummary: MemorySummary | null;
  previousPlan: OperatingPlan | null;
}

// ─── Step 1 — Derive pulse state ──────────────────────────────────────────────

function derivePulseState(
  energy: number,
  stress: number,
  sleepQuality: number,
  leadTimeMinutes: number | null,
  emotionalTone: EmotionalTone
): PulseState {
  // 1. Imminent high-stakes commitment with elevated stress
  if (leadTimeMinutes !== null && leadTimeMinutes <= 30 && stress >= 3) {
    return 'RUSHED';
  }
  // 2. Low energy = depleted state regardless of stress level
  if (energy <= 2) {
    return 'HEAVY';
  }
  // 3. Scattered cognition — by derived tone or moderate energy + high stress + poor sleep
  if (emotionalTone === 'SCATTERED' || (energy === 3 && stress >= 3 && sleepQuality <= 2)) {
    return 'SCATTERED';
  }
  return 'NORMAL';
}

// ─── Step 2 — Derive emotional tone from mood text ───────────────────────────

function deriveEmotionalTone(moodText: string | null): EmotionalTone {
  if (!moodText || moodText.trim() === '') return 'CALM';
  const lower = moodText.toLowerCase();

  if (/anxious|worried|scared|nervous|dread/.test(lower)) return 'TENSE';
  if (/\btired\b|exhausted|drained|heavy|flat/.test(lower)) return 'HEAVY';
  if (/scattered|all over|unfocused|distracted/.test(lower)) return 'SCATTERED';
  if (/angry|frustrated|annoyed|irritated/.test(lower)) return 'FRAGILE';
  if (/numb|disconnected|empty|hollow/.test(lower)) return 'NUMB';
  if (/\bgood\b|clear|ready|\bcalm\b|solid|grounded/.test(lower)) return 'CLEAR';

  return 'CALM';
}

// ─── Step 3 — Derive operating mode ──────────────────────────────────────────
//
// Precedence order:
//   1. OVERWHELM_CONTAINMENT — stress at ceiling, RUSHED pulse
//   2. HIGH_STAKES_DAY       — time-specific weight present (before recovery check)
//   3. RECOVERY              — energy depleted
//   4. FOCUS_REBUILD         — scattered or eroding trust with capacity available
//   5. STEADY_EXECUTION      — default

function deriveOperatingMode(
  pulseState: PulseState,
  energy: number,
  stress: number,
  sleepQuality: number,
  hasTimeSpecificWeight: boolean,
  trustSignalTrend: TrustTrend | null
): OperatingMode {
  if (pulseState === 'RUSHED' && stress >= 4) {
    return 'OVERWHELM_CONTAINMENT';
  }
  // High-stakes overrides recovery — a meeting at 9am must be acknowledged
  // even when the user is depleted. Plan generation will calibrate for low capacity.
  if (hasTimeSpecificWeight) {
    return 'HIGH_STAKES_DAY';
  }
  if (energy <= 2 || (pulseState === 'HEAVY' && sleepQuality <= 2)) {
    return 'RECOVERY';
  }
  if (pulseState === 'SCATTERED' || (trustSignalTrend === 'ERODING' && energy >= 3)) {
    return 'FOCUS_REBUILD';
  }
  return 'STEADY_EXECUTION';
}

// ─── Step 4 — Compute available window ───────────────────────────────────────

function computeAvailableWindow(
  checkIn: RawCheckIn,
  profile: OnboardingProfile
): number {
  const raw = checkIn.availableMinutes > 0 ? checkIn.availableMinutes : profile.preferredDuration;
  const capped = Math.min(raw, profile.preferredDuration);
  return Math.max(5, capped);
}

// ─── Step 5 — Detect time-specific weight ────────────────────────────────────

export function hasTimeSpecificWeightText(weightText: string | null): boolean {
  if (!weightText || weightText.trim() === '') return false;
  const lower = weightText.toLowerCase();
  // Clock times: 9am, 9:00, 14:00, 3pm
  if (/\b\d{1,2}(:\d{2})?\s*(am|pm)\b|\b\d{2}:\d{2}\b/.test(lower)) return true;
  // Relative time references
  if (/this morning|tonight|in an hour|later today|this afternoon|this evening/.test(lower)) return true;
  // Named time-pressure events
  if (/\bmeeting\b|\bcall\b|presentation|interview|\bdeadline\b|\breview\b/.test(lower)) return true;
  return false;
}

// ─── Scalar conversion helpers ────────────────────────────────────────────────

function toEnergyLevel(energy: number): EnergyLevel {
  if (energy <= 2) return 'LOW';
  if (energy <= 3) return 'MODERATE';
  return 'HIGH';
}

function toStressLevel(stress: number): StressLevel {
  if (stress <= 2) return 'LOW';
  if (stress <= 3) return 'MODERATE';
  return 'HIGH';
}

function toSleepQuality(sq: number): SleepQuality {
  if (sq <= 2) return 'POOR';
  if (sq <= 3) return 'ADEQUATE';
  return 'GOOD';
}

function toReadiness(energy: number, stress: number, sleepQuality: number): Readiness {
  // Higher is better: energy + inverse stress + sleepQuality, averaged to 1–5
  const score = (energy + (6 - stress) + sleepQuality) / 3;
  if (score <= 2.5) return 'CHALLENGED';
  if (score <= 3.5) return 'MODERATE';
  return 'READY';
}

function toCognitiveLoad(stress: number, emotionalTone: EmotionalTone): CognitiveLoad {
  if (stress >= 4 || emotionalTone === 'TENSE' || emotionalTone === 'SCATTERED' || emotionalTone === 'FRAGILE') {
    return 'HIGH';
  }
  if (stress >= 3 || emotionalTone === 'HEAVY') {
    return 'MODERATE';
  }
  return 'LOW';
}

function deriveWeightCategory(weightText: string): WeightCategory {
  if (!weightText || weightText.trim() === '') return 'NONE';
  const lower = weightText.toLowerCase();
  if (/\bhealth\b|sick|ill|pain|body|doctor/.test(lower)) return 'HEALTH';
  if (/financial|money|debt|bills|afford|cost/.test(lower)) return 'FINANCIAL';
  if (/relationship|family|partner|friend|spouse|parents|kids/.test(lower)) return 'RELATIONSHIP';
  if (/doubt|confidence|failure|not good|imposter|worth/.test(lower)) return 'SELF_DOUBT';
  if (/meeting|presentation|deadline|review|interview|boss|client|project|work/.test(lower)) return 'PROFESSIONAL';
  if (/pressure|external|expectations|judgment|eyes/.test(lower)) return 'EXTERNAL_PRESSURE';
  if (/purpose|meaning|direction|future|why/.test(lower)) return 'EXISTENTIAL';
  return 'UNKNOWN';
}

function deriveCommitmentProfile(checkIn: RawCheckIn): CommitmentProfile {
  const c = checkIn.firstCommitment;
  let stakes: 'LOW' | 'MODERATE' | 'HIGH';

  if (c.stakes === 'HIGH') {
    stakes = 'HIGH';
  } else if (['PRESENTATION', 'EVALUATION', 'DECISION'].includes(c.type)) {
    stakes = c.leadTimeMinutes < 120 ? 'HIGH' : 'MODERATE';
  } else if (['COLLABORATIVE', 'ADMINISTRATIVE'].includes(c.type)) {
    stakes = 'MODERATE';
  } else {
    stakes = 'LOW';
  }

  return {
    time: c.time,
    type: c.type,
    leadTime: c.leadTimeMinutes,
    stakes,
  };
}

function deriveFirstBlockOverride(
  archetype: OnboardingProfile['archetype'],
  mode: OperatingMode
): BlockType {
  // Circuit breakers for high-pressure scenarios
  if (archetype === 'Architect' && (mode === 'HIGH_STAKES_DAY' || mode === 'OVERWHELM_CONTAINMENT')) {
    return 'ignite'; // Physical movement before cognitive load
  }
  if (archetype === 'Alchemist' && (mode === 'HIGH_STAKES_DAY' || mode === 'OVERWHELM_CONTAINMENT')) {
    return 'anchor'; // Object completion before creative flow
  }
  if (archetype === 'Tide' && (mode === 'HIGH_STAKES_DAY' || mode === 'OVERWHELM_CONTAINMENT')) {
    return 'ignite'; // Sensory arrival before directional pressure
  }
  // Sentinel always grounds first, every mode
  if (archetype === 'Sentinel') return 'ground';
  // Standard archetype defaults (no circuit breaker conditions met)
  if (archetype === 'Architect') return 'ground';
  if (archetype === 'Alchemist') return 'ignite';
  // Tide
  return 'ignite';
}

function deriveUrgency(mode: OperatingMode, stress: number): Urgency {
  if (mode === 'OVERWHELM_CONTAINMENT') return 'CRITICAL';
  if (mode === 'HIGH_STAKES_DAY' || stress >= 4) return 'HIGH';
  if (mode === 'FOCUS_REBUILD' || mode === 'RECOVERY') return 'MODERATE';
  return 'LOW';
}

// ─── Step 6 — Assemble final output ──────────────────────────────────────────

export function interpret(
  input: InterpretationInput
): { context: DailyContext; state: OperatingState } {
  const { checkIn, profile, memorySummary } = input;
  const now = new Date().toISOString();

  const emotionalTone = deriveEmotionalTone(checkIn.mood);

  const leadTimeMinutes = checkIn.firstCommitment.leadTimeMinutes;
  const pulseState = derivePulseState(
    checkIn.energy,
    checkIn.stress,
    checkIn.sleepQuality,
    leadTimeMinutes,
    emotionalTone
  );

  const timeSpecific = hasTimeSpecificWeightText(checkIn.updatedWeight);
  const trustTrend: TrustTrend | null = memorySummary?.trustSignal?.trend ?? null;

  const mode = deriveOperatingMode(
    pulseState,
    checkIn.energy,
    checkIn.stress,
    checkIn.sleepQuality,
    timeSpecific,
    trustTrend
  );

  const availableWindow = computeAvailableWindow(checkIn, profile);
  const commitmentProfile = deriveCommitmentProfile(checkIn);
  const weightCategory = deriveWeightCategory(checkIn.updatedWeight);

  const physiologicalState = {
    energy: toEnergyLevel(checkIn.energy),
    stress: toStressLevel(checkIn.stress),
    sleepQuality: toSleepQuality(checkIn.sleepQuality),
    overallReadiness: toReadiness(checkIn.energy, checkIn.stress, checkIn.sleepQuality),
  };

  const cognitiveLoad = toCognitiveLoad(checkIn.stress, emotionalTone);

  const flags: string[] = [];
  if (timeSpecific) flags.push('HAS_TIME_SPECIFIC_WEIGHT');
  if (checkIn.energy <= 2) flags.push('LOW_ENERGY');
  if (checkIn.sleepQuality <= 2) flags.push('POOR_SLEEP');
  if (checkIn.stress >= 4) flags.push('HIGH_STRESS');
  if (trustTrend === 'ERODING') flags.push('TRUST_ERODING');

  const firstBlockOverride = deriveFirstBlockOverride(profile.archetype, mode);
  const urgency = deriveUrgency(mode, checkIn.stress);

  // Capacity: energy/5, penalised 0.1 per stress point above neutral (3)
  const rawCapacity = checkIn.energy / 5;
  const stressPenalty = Math.max(0, (checkIn.stress - 3) * 0.1);
  const capacity = Math.max(0, Math.min(1, rawCapacity - stressPenalty));

  const confidence = profile.archetypeConfidence ?? 0.5;

  const context: DailyContext = {
    schemaVersion: '1.0',
    modelVersion: '1.0',
    sessionType: 'morning',
    interpretedAt: now,
    physiologicalState,
    emotionalTone,
    cognitiveLoad,
    commitmentProfile,
    weightCategory,
    availableMinutes: availableWindow,
    flags,
  };

  const state: OperatingState = {
    schemaVersion: '1.0',
    modelVersion: '1.0',
    sessionType: 'morning',
    mode,
    urgency,
    capacity,
    confidence,
    pulseState,
    availableWindow,
    firstBlockOverride,
    producedAt: now,
  };

  return { context, state };
}
