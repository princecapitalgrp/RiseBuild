/**
 * src/storage/validators.ts
 *
 * Zod schemas for every MMKV-persisted entity.
 * All schemas are strict — unknown fields cause validation failure.
 * This enforces schema versioning: a field added to types.ts without a
 * corresponding schema update will fail at read time, not silently.
 *
 * Every MMKV read must pass through validateAndParse().
 * On failure it returns null (not throws) — callers treat null as
 * a missing or corrupted record and re-generate/re-onboard as appropriate.
 *
 * Import from domain/types.ts only. No inline type definitions here.
 */

import { z } from 'zod';

// ─── Primitive enum schemas ───────────────────────────────────────────────────
// Defined once, composed into entity schemas below.

const sessionTypeSchema = z.enum(['morning', 'midday', 'evening', 'longevity']);
const archetypeSchema = z.enum(['Architect', 'Alchemist', 'Sentinel', 'Tide']);
const operatingModeSchema = z.enum([
  'RECOVERY',
  'FOCUS_REBUILD',
  'STEADY_EXECUTION',
  'HIGH_STAKES_DAY',
  'OVERWHELM_CONTAINMENT',
]);
const urgencySchema = z.enum(['LOW', 'MODERATE', 'HIGH', 'CRITICAL']);
const trustTrendSchema = z.enum(['BUILDING', 'STABLE', 'ERODING']);
const energyLevelSchema = z.enum(['LOW', 'MODERATE', 'HIGH']);
const stressLevelSchema = z.enum(['LOW', 'MODERATE', 'HIGH']);
const sleepQualitySchema = z.enum(['POOR', 'ADEQUATE', 'GOOD']);
const readinessSchema = z.enum(['CHALLENGED', 'MODERATE', 'READY']);
const emotionalToneSchema = z.enum([
  'CLEAR', 'SCATTERED', 'HEAVY', 'TENSE', 'CALM', 'FRAGILE', 'NUMB',
]);
const cognitiveLoadSchema = z.enum(['LOW', 'MODERATE', 'HIGH']);
const pulseStateSchema = z.enum(['RUSHED', 'HEAVY', 'SCATTERED', 'NORMAL']);
const agencyStructureSchema = z.enum(['Author', 'Protagonist']);
const pressureResponseSchema = z.enum(['Push', 'Pull']);
const seasonalFocusSchema = z.enum(['Building', 'Stabilising', 'Recovering', 'Preparing']);
const movementBaselineSchema = z.enum(['regular', 'occasional', 'rare']);
const complexityToleranceSchema = z.enum(['layered', 'simple']);
const overwhelmStyleSchema = z.enum(['reduction', 'familiarity', 'connection']);
const sensoryStyleSchema = z.enum(['quiet', 'ambient', 'variable']);
export const wakeStateSchema = z.enum(['fast', 'slow', 'variable']);
const commitmentTypeSchema = z.enum([
  'SOLO_DEEP_WORK',
  'PRESENTATION',
  'EVALUATION',
  'DECISION',
  'COLLABORATIVE',
  'ADMINISTRATIVE',
  'TRANSITIONAL',
]);
const weightCategorySchema = z.enum([
  'SELF_DOUBT',
  'EXTERNAL_PRESSURE',
  'RELATIONSHIP',
  'PROFESSIONAL',
  'HEALTH',
  'FINANCIAL',
  'EXISTENTIAL',
  'NONE',
  'UNKNOWN',
]);
const blockTypeSchema = z.enum(['ground', 'ignite', 'cognition', 'reset', 'anchor']);
const confidenceNoteSchema = z.enum(['high', 'medium', 'low']);
const followedSequenceSchema = z.enum(['followed', 'adapted', 'own_way']);
const planSourceSchema = z.enum(['ai', 'rule-based']);
const executionEventTypeSchema = z.enum([
  'session_started',
  'step_started',
  'step_completed',
  'step_skipped',
  'step_partial',
  'plan_paused',
  'plan_resumed',
  'plan_abandoned',
  'plan_completed',
]);
export const subscriptionTierSchema = z.enum(['free', 'premium']);


// ─── Internal reusable sub-schemas ───────────────────────────────────────────

const physiologicalStateSchema = z.object({
  energy: energyLevelSchema,
  stress: stressLevelSchema,
  sleepQuality: sleepQualitySchema,
  overallReadiness: readinessSchema,
}).strict();

const commitmentProfileSchema = z.object({
  time: z.string(),
  type: commitmentTypeSchema,
  leadTime: z.number(),
  stakes: z.enum(['LOW', 'MODERATE', 'HIGH']),
}).strict();

const planStepSchema = z.object({
  order: z.number(),
  timeLabel: z.string(),
  blockType: blockTypeSchema,
  title: z.string(),
  action: z.string(),
  rationale: z.string().optional(),
  durationMinutes: z.number(),
}).strict();

const planRationaleSchema = z.object({
  noticed: z.array(z.string()),
  planLogic: z.string(),
  firstBlockReason: z.string(),
  protecting: z.string().optional(),
  creating: z.string().optional(),
  uncertainty: z.array(z.string()),
  operatingMode: operatingModeSchema,
}).strict();

const executionEventSchema = z.object({
  eventType: executionEventTypeSchema,
  stepOrder: z.number().optional(),
  timestamp: z.string(),
  durationMs: z.number().optional(),
  metadata: z.record(z.unknown()).optional(),
}).strict();


// ─── Exported entity schemas ─────────────────────────────────────────────────

/**
 * FirstCommitment — embedded in RawCheckIn.
 * Exported separately so repositories can validate sub-objects independently.
 */
export const FirstCommitmentSchema = z.object({
  time: z.string(),
  type: commitmentTypeSchema,
  leadTimeMinutes: z.number(),
  stakes: z.enum(['HIGH', 'STANDARD']).optional(),
}).strict();

/**
 * Layer 1 — RawCheckIn
 * Contains raw user text fields. device-only.
 */
export const RawCheckInSchema = z.object({
  schemaVersion: z.string(),
  sessionType: sessionTypeSchema,
  uid: z.string(),
  date: z.string(),
  energy: z.number(),
  stress: z.number(),
  sleepQuality: z.number(),
  availableMinutes: z.number(),
  mood: z.string(),
  pressurePoint: z.string().optional(),
  firstCommitment: FirstCommitmentSchema,
  updatedWeight: z.string(),
  voiceTranscriptPresent: z.boolean(),
  createdAt: z.string(),
}).strict();

/**
 * Layer 2A — DailyContext
 * Structured interpretation. No raw user text. Safe for AI server.
 */
export const DailyContextSchema = z.object({
  schemaVersion: z.string(),
  modelVersion: z.string(),
  sessionType: sessionTypeSchema,
  interpretedAt: z.string(),
  physiologicalState: physiologicalStateSchema,
  emotionalTone: emotionalToneSchema,
  cognitiveLoad: cognitiveLoadSchema,
  commitmentProfile: commitmentProfileSchema,
  weightCategory: weightCategorySchema,
  availableMinutes: z.number(),
  flags: z.array(z.string()),
}).strict();

/**
 * Layer 2B — OperatingState
 * Operating mode assessment for the session.
 */
export const OperatingStateSchema = z.object({
  schemaVersion: z.string(),
  modelVersion: z.string(),
  sessionType: sessionTypeSchema,
  mode: operatingModeSchema,
  urgency: urgencySchema,
  capacity: z.number(),
  confidence: z.number(),
  pulseState: pulseStateSchema,
  availableWindow: z.number(),
  firstBlockOverride: blockTypeSchema.optional(),
  producedAt: z.string(),
}).strict();

/**
 * Layer 3 — OperatingPlan
 * The personalized morning plan with embedded PlanRationale.
 */
export const OperatingPlanSchema = z.object({
  schemaVersion: z.string(),
  promptVersion: z.string(),
  sessionType: sessionTypeSchema,
  uid: z.string(),
  date: z.string(),
  planId: z.string(),
  planTitle: z.string(),
  openingLine: z.string(),
  planObjective: z.string(),
  rationale: planRationaleSchema,
  mainSequence: z.array(planStepSchema),
  fallbackSequence: z.array(planStepSchema),
  nonNegotiableAction: z.string(),
  sensoryCue: z.string(),
  antiPatternWarning: z.string(),
  summaryInsight: z.string(),
  confidenceNote: confidenceNoteSchema,
  internalArchetype: archetypeSchema,
  operatingMode: operatingModeSchema,
  source: planSourceSchema,
  generatedAt: z.string(),
}).strict();

const blockExecutionEventSchema = z.object({
  blockId: z.string(),
  blockType: blockTypeSchema,
  event: z.enum(['started', 'completed', 'skipped']),
  timestamp: z.string(),
  durationActual: z.number().optional(),
}).strict();

/**
 * Layer 4 — ExecutionRecord
 * Append-only event log. Contains morning_intention (raw user text).
 */
export const ExecutionRecordSchema = z.object({
  schemaVersion: z.string(),
  sessionType: sessionTypeSchema,
  date: z.string(),
  planId: z.string(),
  morning_intention: z.string().nullable(),
  blocksCompleted: z.number(),
  blocksSkipped: z.number(),
  totalBlocks: z.number(),
  sessionCompleted: z.boolean(),
  sessionAbandonedAt: z.string().optional(),
  events: z.array(executionEventSchema),
  blockEvents: z.array(blockExecutionEventSchema),
}).strict();

/**
 * Layer 5 — Reflection
 * Post-plan feedback. Contains raw user text fields.
 */
export const ReflectionSchema = z.object({
  schemaVersion: z.string(),
  sessionType: sessionTypeSchema,
  uid: z.string(),
  planId: z.string(),
  date: z.string(),
  feltAccurate: z.number(),
  followedSequence: followedSequenceSchema,
  helpedMost: z.string().optional(),
  gotInWay: z.string().optional(),
  note: z.string().optional(),
  createdAt: z.string(),
}).strict();

/**
 * TrustSignal — embedded in MemorySummary.
 * Exported separately so TrustEvaluator can validate independently.
 */
export const TrustSignalSchema = z.object({
  schemaVersion: z.string(),
  computedAt: z.string(),
  sampleSize: z.number(),
  accuracyTrend: z.number(),
  followThroughConsistency: z.number(),
  abandonmentRate: z.number(),
  correctionFrequency: z.number(),
  beginWillingness: z.number(),
  composite: z.number(),
  trend: trustTrendSchema,
}).strict();

/**
 * Layer 6 — MemorySummary
 * Rolling behavioral model. Categorized labels only — no raw user text.
 */
export const MemorySummarySchema = z.object({
  schemaVersion: z.string(),
  engineVersion: z.string(),
  uid: z.string(),
  updatedAt: z.string(),
  updateCount: z.number(),
  stabilizers: z.array(z.string()),
  derailers: z.array(z.string()),
  tractionBuilders: z.array(z.string()),
  selfTrustThreats: z.array(z.string()),
  reliableFirstMoves: z.array(z.string()),
  lowAccuracyPatterns: z.array(z.string()),
  highAccuracyPatterns: z.array(z.string()),
  abandonmentPatterns: z.array(z.string()),
  averageFollowThrough: z.number(),
  averageExecutionDepth: z.number(),
  recentSessionCount: z.number(),
  trustSignal: TrustSignalSchema,
}).strict();

/**
 * OnboardingProfile — stable identity layer.
 * Mixed classification: contains device-only fields (theWeight, overwhelmStyle,
 * sensoryStyle, wakeState) and backup-eligible fields.
 */
export const OnboardingProfileSchema = z.object({
  schemaVersion: z.string(),
  uid: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  consentTimestamp: z.string(),
  wakeTarget: z.string(),
  preferredDuration: z.number(),
  movementBaseline: movementBaselineSchema,
  agencyStructure: agencyStructureSchema,
  pressureResponse: pressureResponseSchema,
  archetype: archetypeSchema,
  archetypeTranslation: z.string(),
  archetypeConfidence: z.number(),
  complexityTolerance: complexityToleranceSchema,
  needsRationale: z.boolean(),
  overwhelmStyle: overwhelmStyleSchema,
  sensoryStyle: sensoryStyleSchema,
  theWeight: z.string().nullable(),
  seasonalFocus: seasonalFocusSchema,
  wakeState: wakeStateSchema.optional(),
}).strict();

/**
 * SubscriptionCache — local MMKV mirror of Firestore subscription state.
 * Trusted for 7 days past lastVerifiedAt regardless of network state.
 */
export const SubscriptionCacheSchema = z.object({
  tier: subscriptionTierSchema,
  expiresAt: z.string().optional(),
  lastVerifiedAt: z.string(),
}).strict();

/**
 * UserProfile — authentication and account state.
 * device-only. MMKV key: solis.profile.user
 */
export const UserProfileSchema = z.object({
  schemaVersion: z.string(),
  uid: z.string(),
  email: z.string().optional(),
  displayName: z.string().optional(),
  providers: z.array(z.enum(['apple', 'google', 'email'])),
  onboardingCompleted: z.boolean(),
  onboardingCompletedAt: z.string().optional(),
  subscriptionTier: subscriptionTierSchema,
  cohortId: z.enum(['A', 'B', 'C', 'internal']).default('B'),
  createdAt: z.string(),
}).strict();


// ─── Runtime validation helper ────────────────────────────────────────────────

/**
 * Parses raw data from MMKV against a schema.
 *
 * Returns the typed value on success.
 * Returns null on failure — callers must handle null as a missing/corrupted record.
 * Never throws in production.
 * In development, logs the key and structured error to the console.
 *
 * @param schema  The Zod schema to validate against
 * @param data    The raw value from MMKV (typically the result of JSON.parse)
 * @param key     The MMKV key string — included in dev warnings for traceability
 *
 * @example
 * const raw = encryptedStorage.getString(PROFILE_ONBOARDING);
 * const profile = validateAndParse(OnboardingProfileSchema, JSON.parse(raw ?? 'null'), PROFILE_ONBOARDING);
 * if (!profile) { ... handle missing or corrupted profile ... }
 */
export function validateAndParse<T>(
  schema: z.ZodType<T>,
  data: unknown,
  key: string
): T | null {
  const result = schema.safeParse(data);

  if (!result.success) {
    if (__DEV__) {
      console.warn(
        `[Rise] Storage validation failed for key "${key}":`,
        result.error.flatten()
      );
    }
    return null;
  }

  return result.data;
}
