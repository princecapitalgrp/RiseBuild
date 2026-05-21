/**
 * app/api/generate-protocol+api.ts
 *
 * Expo API route — server boundary between device and Anthropic.
 *
 * Privacy contract (enforced here):
 *   - Input is Zod-validated — any payload with raw text fields is rejected 400
 *   - ANTHROPIC_API_KEY lives here only (server-side, process.env — never EXPO_PUBLIC_)
 *   - Raw user text (mood, theWeight, updatedWeight, priorities, reflection notes)
 *     must never appear in this file, the request body, or the system prompt
 *   - weightCategory is the categorised enum from InterpretationService — not weightText
 *
 * Flow:
 *   POST { archetype, operatingMode, ... } (no raw text)
 *     → Zod validation → 400 if invalid
 *     → Anthropic claude-sonnet-4-6 call
 *     → Zod validate AI response against OperatingPlanSchema
 *     → 200 { plan } | 500 { error, fallback: true }
 */

import { z } from 'zod';
import { OperatingPlanSchema } from '@/storage/validators';

// ─── Request schema ───────────────────────────────────────────────────────────
// Mirrors what PersonalizationEngine sends. Contains zero raw user text.

const MemorySummaryForRequestSchema = z.object({
  stabilizers:         z.array(z.string()),
  derailers:           z.array(z.string()),
  tractionBuilders:    z.array(z.string()),
  reliableFirstMoves:  z.array(z.string()),
  highAccuracyPatterns: z.array(z.string()),
  lowAccuracyPatterns:  z.array(z.string()),
  averageFollowThrough:  z.number(),
  averageExecutionDepth: z.number(),
}).nullable();

const GenerateProtocolRequestSchema = z.object({
  archetype:            z.enum(['Architect', 'Alchemist', 'Sentinel', 'Tide']),
  operatingMode:        z.enum(['RECOVERY', 'FOCUS_REBUILD', 'STEADY_EXECUTION', 'HIGH_STAKES_DAY', 'OVERWHELM_CONTAINMENT']),
  pulseState:           z.enum(['RUSHED', 'HEAVY', 'SCATTERED', 'NORMAL']),
  capacity:             z.number().min(0).max(1),
  availableWindow:      z.number().min(5),
  complexityTolerance:  z.enum(['layered', 'simple']),
  needsRationale:       z.boolean(),
  guidanceStyle:        z.enum(['directive', 'invitational']),
  sensoryStyle:         z.enum(['quiet', 'ambient', 'variable']),
  overwhelmStyle:       z.enum(['reduction', 'familiarity', 'connection']),
  seasonalFocus:        z.enum(['Building', 'Stabilising', 'Recovering', 'Preparing']),
  hasTimeSpecificWeight: z.boolean(),
  weightCategory:       z.string().nullable(),
  memorySummary:        MemorySummaryForRequestSchema,
  wakeTarget:           z.string(),
  preferredDuration:    z.number(),
  archetypeTranslation: z.string(),
});

type GenerateProtocolRequest = z.infer<typeof GenerateProtocolRequestSchema>;

// ─── System prompt builder ────────────────────────────────────────────────────

function buildSystemPrompt(req: GenerateProtocolRequest): string {
  const memorySection = req.memorySummary
    ? `
User behavioral memory (categorised labels only — not verbatim):
  Stabilisers:        ${req.memorySummary.stabilizers.join(', ') || 'none yet'}
  Derailers:          ${req.memorySummary.derailers.join(', ') || 'none yet'}
  Traction builders:  ${req.memorySummary.tractionBuilders.join(', ') || 'none yet'}
  Reliable first moves: ${req.memorySummary.reliableFirstMoves.join(', ') || 'none yet'}
  High accuracy patterns: ${req.memorySummary.highAccuracyPatterns.join(', ') || 'none yet'}
  Low accuracy patterns:  ${req.memorySummary.lowAccuracyPatterns.join(', ') || 'none yet'}
  Average follow-through: ${(req.memorySummary.averageFollowThrough * 100).toFixed(0)}%
  Average execution depth: ${(req.memorySummary.averageExecutionDepth * 100).toFixed(0)}%`
    : 'No session history yet — this is an early session.';

  const archetypeRules: Record<string, string> = {
    Architect: 'Optimise for structural command before the first external demand. First block: ground. Risk: preparation becomes procrastination. Anti-pattern: letting setup consume the morning.',
    Alchemist: 'Optimise for a protected fluid transmutation period. First block: ignite (physical movement). Risk: over-planning before physical arrival. Anti-pattern: planning before arriving in the body.',
    Sentinel: 'Optimise for environment secured and role clearly defined. First block: ground (physical grounding, 2-3 min max, must precede any weight-processing). Risk: amplifying pressure via premature self-assessment.',
    Tide: 'Optimise for directional movement that honours real energy. First block: ignite (sensory contact). Risk: digital drift before directional clarity. Anti-pattern: screens before direction.',
  };

  const circuitBreakers: Record<string, string> = {
    Architect: req.operatingMode === 'HIGH_STAKES_DAY' || req.operatingMode === 'OVERWHELM_CONTAINMENT'
      ? 'CIRCUIT BREAKER ACTIVE: First block must be physical movement (ignite). Reduce total blocks by 50% of complexity ceiling. Prevent cognitive overload.'
      : '',
    Alchemist: req.operatingMode === 'HIGH_STAKES_DAY' || req.operatingMode === 'OVERWHELM_CONTAINMENT'
      ? 'CIRCUIT BREAKER ACTIVE: First block must be object completion (anchor). Maximum 3 blocks. Each block must have a defined completion condition.'
      : '',
    Sentinel: 'CIRCUIT BREAKER ACTIVE (all modes): First block is always physical grounding (ground), 2-3 minutes maximum. Must precede any weight-processing block.',
    Tide: req.operatingMode === 'HIGH_STAKES_DAY' || req.operatingMode === 'OVERWHELM_CONTAINMENT'
      ? 'CIRCUIT BREAKER ACTIVE: First block must be sensory arrival (ignite). No timestamps in block titles. No completion pressure language.'
      : '',
  };

  const activeCircuitBreaker = circuitBreakers[req.archetype] ?? '';

  return `You are Rise, a Personal Operating System that generates precise, personalised morning plans.

ARCHETYPE: ${req.archetype}
Translation: "${req.archetypeTranslation}"
Archetype rules: ${archetypeRules[req.archetype]}
${activeCircuitBreaker ? `\n${activeCircuitBreaker}` : ''}

CURRENT STATE (structured interpretation — no raw user text):
  Operating mode:    ${req.operatingMode}
  Pulse state:       ${req.pulseState}
  Capacity:          ${(req.capacity * 100).toFixed(0)}%
  Available window:  ${req.availableWindow} minutes
  Complexity:        ${req.complexityTolerance}
  Guidance style:    ${req.guidanceStyle}
  Sensory style:     ${req.sensoryStyle}
  Overwhelm style:   ${req.overwhelmStyle}
  Seasonal focus:    ${req.seasonalFocus}
  Time-specific weight present: ${req.hasTimeSpecificWeight}
  Weight category:   ${req.weightCategory ?? 'none'}

${memorySection}

BLOCK TYPES (use exactly these values):
  ground    — containment, stillness, environment setup, physical grounding
  ignite    — physical movement, kinetic activation, sensory contact
  cognition — strategic thinking, review, assessment, planning
  reset     — pattern break, stepping back, pressure release
  anchor    — commitment, locking intention, first concrete action

BLOCK COUNT RULES:
  complexityTolerance === 'layered': maximum 6 blocks
  complexityTolerance === 'simple': maximum 3 blocks
  Total duration must not exceed availableWindow (${req.availableWindow} minutes)

RESPONSE RULES:
1. Return valid JSON only — no markdown, no commentary, no explanation outside the JSON.
2. Match the exact OperatingPlan schema described below.
3. PlanRationale.uncertainty[] must contain at least one item.
4. PlanRationale.noticed[] must contain at least two items.
5. PlanRationale.firstBlockReason is required — one sentence explaining the first block choice.
6. Never include raw user language — use only the structured fields provided.
7. PlanStep.rationale is optional but recommended for needsRationale=true users.

SCHEMA: Return exactly this structure:
{
  "schemaVersion": "1.0",
  "promptVersion": "1.0",
  "sessionType": "morning",
  "uid": "__DEVICE_WILL_SET__",
  "date": "${new Date().toISOString().split('T')[0]}",
  "planId": "${new Date().toISOString().split('T')[0]}:morning",
  "planTitle": string,
  "openingLine": string,
  "planObjective": string,
  "rationale": {
    "noticed": string[],
    "planLogic": string,
    "firstBlockReason": string,
    "protecting": string,
    "creating": string,
    "uncertainty": string[],
    "operatingMode": "${req.operatingMode}"
  },
  "mainSequence": [
    {
      "order": number,
      "timeLabel": string,
      "blockType": "ground"|"ignite"|"cognition"|"reset"|"anchor",
      "title": string,
      "action": string,
      "rationale": string,
      "durationMinutes": number
    }
  ],
  "fallbackSequence": [
    { same structure, 2 blocks maximum }
  ],
  "nonNegotiableAction": string,
  "sensoryCue": string,
  "antiPatternWarning": string,
  "summaryInsight": string,
  "confidenceNote": "high"|"medium"|"low",
  "internalArchetype": "${req.archetype}",
  "operatingMode": "${req.operatingMode}",
  "source": "ai",
  "generatedAt": "${new Date().toISOString()}"
}`;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(request: Request): Promise<Response> {
  // Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate input — rejects any raw user text fields by schema design
  const parsed = GenerateProtocolRequestSchema.safeParse(body);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Rise API] generate-protocol: validation failed', parsed.error.flatten());
    }
    return Response.json(
      { error: 'Request validation failed', details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const req = parsed.data;

  // API key — server-side only, never EXPO_PUBLIC_
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: 'Server configuration error', fallback: true },
      { status: 500 }
    );
  }

  // Build system prompt from validated, non-raw-text fields only
  const systemPrompt = buildSystemPrompt(req);
  const userMessage = `Generate a morning plan for this ${req.archetype} in ${req.operatingMode} mode with ${req.availableWindow} minutes available. Return only valid JSON matching the schema.`;

  // Call Anthropic Messages API
  let aiResponseText: string;
  try {
    const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1200,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!anthropicResponse.ok) {
      const errorText = await anthropicResponse.text();
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[Rise API] Anthropic error:', anthropicResponse.status, errorText);
      }
      return Response.json(
        { error: 'AI generation failed', fallback: true },
        { status: 500 }
      );
    }

    const anthropicData = await anthropicResponse.json() as {
      content?: Array<{ type: string; text: string }>;
    };

    const textContent = anthropicData.content?.find(c => c.type === 'text');
    if (!textContent?.text) {
      return Response.json(
        { error: 'Empty AI response', fallback: true },
        { status: 500 }
      );
    }

    aiResponseText = textContent.text;
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Rise API] Anthropic fetch error:', err);
    }
    return Response.json(
      { error: 'Network error reaching AI service', fallback: true },
      { status: 500 }
    );
  }

  // Parse AI response JSON
  let planCandidate: unknown;
  try {
    // Strip markdown code fences if the model wrapped the JSON
    const cleaned = aiResponseText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
    planCandidate = JSON.parse(cleaned);
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Rise API] Failed to parse AI JSON response:', aiResponseText.slice(0, 200));
    }
    return Response.json(
      { error: 'AI response was not valid JSON', fallback: true },
      { status: 500 }
    );
  }

  // Validate against OperatingPlan schema (uid will be set by device)
  const planSchema = OperatingPlanSchema.omit({ uid: true });
  const planResult = planSchema.safeParse(planCandidate);

  if (!planResult.success) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Rise API] AI response failed schema validation:', planResult.error.flatten());
    }
    return Response.json(
      { error: 'AI response failed schema validation', fallback: true },
      { status: 500 }
    );
  }

  return Response.json({ plan: planResult.data }, { status: 200 });
}
