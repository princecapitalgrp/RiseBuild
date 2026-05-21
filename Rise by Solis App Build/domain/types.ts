/**
 * domain/types.ts
 * Rise by Solis — Personal Operating System
 *
 * Pure domain types. No Firebase types. No React types.
 * Every entity that persists carries schemaVersion.
 * Every entity in the personalization loop carries sessionType.
 *
 * PRIVACY CONTRACT:
 *   Fields annotated "raw user text" → device-only, never sent to any server.
 *   Voice transcripts → transient only (XState context), never written anywhere.
 *   Interpreted/structured fields → safe to send to AI server.
 *   Firestore → SubscriptionState only.
 *
 * SCHEMA VERSIONING:
 *   schemaVersion follows semver major.minor (e.g. "1.0").
 *   Increment minor for additive changes, major for breaking changes.
 *   Repositories must handle version mismatches gracefully (return null,
 *   trigger re-generation).
 *
 * SESSION TYPE:
 *   Only 'morning' is implemented in Block 1.
 *   All loop entities carry sessionType from day one.
 *   Future windows: 'midday' | 'evening' | 'longevity'
 *
 * STORAGE CLASSIFICATION:
 *   domain/storage-classification.md is the single authoritative source.
 *   Canonical vocabulary: device-only | backup-eligible | aggregate-syncable | transient
 *   Do not duplicate field-level classification here.
 */

// ─────────────────────────────────────────────────────────────
// ENUMS & UNION TYPES
// ─────────────────────────────────────────────────────────────

/** Operating windows. Only 'morning' implemented in Block 1. */
export type SessionType = 'morning' | 'midday' | 'evening' | 'longevity';

/** The four core archetypes derived from the deterministic 2×2 model. */
export type Archetype = 'Architect' | 'Alchemist' | 'Sentinel' | 'Tide';

/**
 * The five operating modes that drive plan shape.
 * Produced by InterpretationService from DailyContext.
 */
export type OperatingMode =
  | 'RECOVERY'
  | 'FOCUS_REBUILD'
  | 'STEADY_EXECUTION'
  | 'HIGH_STAKES_DAY'
  | 'OVERWHELM_CONTAINMENT';

export type Urgency = 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';

/** Long-term self-trust trajectory. */
export type TrustTrend = 'BUILDING' | 'STABLE' | 'ERODING';

export type EnergyLevel   = 'LOW' | 'MODERATE' | 'HIGH';
export type StressLevel   = 'LOW' | 'MODERATE' | 'HIGH';
export type SleepQuality  = 'POOR' | 'ADEQUATE' | 'GOOD';
export type Readiness     = 'CHALLENGED' | 'MODERATE' | 'READY';
export type EmotionalTone = 'CLEAR' | 'SCATTERED' | 'HEAVY' | 'TENSE' | 'CALM' | 'FRAGILE' | 'NUMB';
export type CognitiveLoad = 'LOW' | 'MODERATE' | 'HIGH';

/**
 * Derived in-session from check-in fields by InterpretationService.
 * Stored on OperatingState for engine use.
 * Classification: device-only
 */
export type PulseState = 'RUSHED' | 'HEAVY' | 'SCATTERED' | 'NORMAL';

/** First axis of the archetype 2×2. */
export type AgencyStructure = 'Author' | 'Protagonist';

/** Second axis of the archetype 2×2. */
export type PressureResponse = 'Push' | 'Pull';

/**
 * Season of life context. Semi-stable — updated monthly/quarterly via Settings.
 * Canonical values locked. No other values permitted.
 * Classification: backup-eligible
 */
export type SeasonalFocus = 'Building' | 'Stabilising' | 'Recovering' | 'Preparing';

/** Stable trait — habitual morning movement. Classification: backup-eligible */
export type MovementBaseline = 'regular' | 'occasional' | 'rare';

/** Stable trait — preferred plan complexity. Classification: backup-eligible */
export type ComplexityTolerance = 'layered' | 'simple';

/** Stable trait — how the user responds to overwhelm. Classification: device-only */
export type OverwhelmStyle = 'reduction' | 'familiarity' | 'connection';

/** Stable trait — morning sensory environment preference. Classification: device-only */
export type SensoryStyle = 'quiet' | 'ambient' | 'variable';

/**
 * Derived post-onboarding via session observation — not directly asked.
 * Defaults to 'variable' until populated after three sessions.
 * Classification: device-only
 */
export type WakeState = 'fast' | 'slow' | 'variable';

/**
 * Categorized commitment type — never verbatim user text.
 * Classification: device-only (as part of RawCheckIn)
 */
export type CommitmentType =
  | 'SOLO_DEEP_WORK'
  | 'PRESENTATION'
  | 'EVALUATION'
  | 'DECISION'
  | 'COLLABORATIVE'
  | 'ADMINISTRATIVE'
  | 'TRANSITIONAL';

/** Categorized weight category — never verbatim user text. Classification: device-only */
export type WeightCategory =
  | 'SELF_DOUBT'
  | 'EXTERNAL_PRESSURE'
  | 'RELATIONSHIP'
  | 'PROFESSIONAL'
  | 'HEALTH'
  | 'FINANCIAL'
  | 'EXISTENTIAL'
  | 'NONE'
  | 'UNKNOWN';

export type BlockType = 'ground' | 'ignite' | 'cognition' | 'reset' | 'anchor';

export type ConfidenceNote = 'high' | 'medium' | 'low';

export type FollowedSequence = 'followed' | 'adapted' | 'own_way';

/** Whether the OperatingPlan was AI-generated or produced by the rule-based fallback. */
export type PlanSource = 'ai' | 'rule-based';

export type ExecutionEventType =
  | 'session_started'
  | 'step_started'
  | 'step_completed'
  | 'step_skipped'
  | 'step_partial'
  | 'plan_paused'
  | 'plan_resumed'
  | 'plan_abandoned'
  | 'plan_completed';

export type SessionStateValue = 'pending_onboarding' | 'authenticated' | 'none';

export type SubscriptionTier = 'free' | 'premium';

export type AuthProvider = 'apple' | 'google' | 'email';

/** TestFlight / acquisition cohort. Set once at auth completion. aggregate-syncable. */
export type CohortId = 'A' | 'B' | 'C' | 'internal';


// ─────────────────────────────────────────────────────────────
// LAYER 1 — RAW CHECK-IN
// The user's raw morning input. Never sent to any server.
// Storage: device-only
// MMKV key: checkin:{YYYY-MM-DD}   TTL: 90 days
// ─────────────────────────────────────────────────────────────

export interface FirstCommitment {
  time: string;                      // HH:MM — for display
  type: CommitmentType;              // categorized — safe for AI server
  leadTimeMinutes: number;           // computed from time — safe for AI server
  stakes?: 'HIGH' | 'STANDARD';     // explicit user override — safe for AI server
}

export interface RawCheckIn {
  schemaVersion: string;
  sessionType: SessionType;
  uid: string;
  date: string;                      // YYYY-MM-DD
  energy: number;                    // 1–5
  stress: number;                    // 1–5
  sleepQuality: number;              // 1–5
  availableMinutes: number;          // today's available window
  mood: string;                      // raw user text — device-only
  pressurePoint?: string;            // raw user text — device-only
  firstCommitment: FirstCommitment;
  updatedWeight: string;             // raw user text — device-only
  voiceTranscriptPresent: boolean;   // flag only — transcript is transient
  createdAt: string;                 // ISO 8601
}


// ─────────────────────────────────────────────────────────────
// LAYER 2A — DAILY CONTEXT
// Structured interpretation of RawCheckIn. No raw user text.
// Safe to send to AI server.
// Storage: device-only
// MMKV key: context:{YYYY-MM-DD}   TTL: 90 days
// ─────────────────────────────────────────────────────────────

export interface PhysiologicalState {
  energy: EnergyLevel;
  stress: StressLevel;
  sleepQuality: SleepQuality;
  overallReadiness: Readiness;
}

export interface CommitmentProfile {
  time: string;                      // HH:MM
  type: CommitmentType;              // categorized — not verbatim user text
  leadTime: number;                  // minutes from now to commitment
  stakes: 'LOW' | 'MODERATE' | 'HIGH';
}

export interface DailyContext {
  schemaVersion: string;
  modelVersion: string;
  sessionType: SessionType;
  interpretedAt: string;             // ISO 8601
  physiologicalState: PhysiologicalState;
  emotionalTone: EmotionalTone;
  cognitiveLoad: CognitiveLoad;
  commitmentProfile: CommitmentProfile;
  weightCategory: WeightCategory;    // categorized — never verbatim user text
  availableMinutes: number;          // passed through for plan timing
  flags: string[];                   // structured tags — not user text
}


// ─────────────────────────────────────────────────────────────
// LAYER 2B — OPERATING STATE
// High-level assessment of what kind of morning this is.
// Produced alongside DailyContext by InterpretationService.
// Storage: device-only
// MMKV key: operatingState:{YYYY-MM-DD}   TTL: 90 days
// ─────────────────────────────────────────────────────────────

export interface OperatingState {
  schemaVersion: string;
  modelVersion: string;
  sessionType: SessionType;
  mode: OperatingMode;
  urgency: Urgency;
  capacity: number;                  // 0–1, derived from energy + stress + sleepQuality
  confidence: number;                // 0–1, derived from memory accuracy history
  pulseState: PulseState;            // derived in-session, stored for engine use
  availableWindow: number;           // minutes available for plan (computed per A3 logic)
  firstBlockOverride?: BlockType;    // set by pulse override rules (A2) — null if no override
  producedAt: string;                // ISO 8601
}


// ─────────────────────────────────────────────────────────────
// LAYER 3 — OPERATING PLAN
// The personalized morning plan. Includes embedded PlanRationale.
// Storage: device-only (plan content) / backup-eligible (title, operatingMode)
// MMKV key: plan:{YYYY-MM-DD}   TTL: 1 year
// ─────────────────────────────────────────────────────────────

export interface PlanStep {
  order: number;
  timeLabel: string;
  blockType: BlockType;
  title: string;
  action: string;
  rationale?: string;
  durationMinutes: number;
}

/**
 * The understanding artifact embedded in every OperatingPlan.
 * Visible to the user. Explains what the system noticed and why.
 *
 * uncertainty[] is required (never undefined or null).
 * An empty array [] signals complete confidence — not a missing value.
 * Both the AI path and the rule-based fallback must populate it when
 * uncertainty exists. An empty uncertainty[] with low confidence is a bug.
 */
export interface PlanRationale {
  noticed: string[];                 // system observations — no user-authored text
  planLogic: string;                 // why this plan shape was chosen
  firstBlockReason: string;          // one sentence: why this first block — shown pre-paywall
  protecting?: string;               // what this plan preserves
  creating?: string;                 // what this plan builds toward
  uncertainty: string[];             // required — may be [] only when system is fully confident
  operatingMode: OperatingMode;
}

export interface OperatingPlan {
  schemaVersion: string;
  promptVersion: string;
  sessionType: SessionType;
  uid: string;
  date: string;                      // YYYY-MM-DD
  planId: string;                    // `${date}:${sessionType}`
  planTitle: string;
  openingLine: string;
  planObjective: string;
  rationale: PlanRationale;
  mainSequence: PlanStep[];
  fallbackSequence: PlanStep[];
  nonNegotiableAction: string;
  sensoryCue: string;
  antiPatternWarning: string;
  summaryInsight: string;
  confidenceNote: ConfidenceNote;
  internalArchetype: Archetype;
  operatingMode: OperatingMode;
  source: PlanSource;
  generatedAt: string;               // ISO 8601
}


// ─────────────────────────────────────────────────────────────
// LAYER 4 — EXECUTION RECORD (append-only event log)
// Events are never deleted or overwritten.
// Storage: device-only
// MMKV key: execution:{YYYY-MM-DD}   TTL: 1 year
// ─────────────────────────────────────────────────────────────

export interface ExecutionEvent {
  eventType: ExecutionEventType;
  stepOrder?: number;
  timestamp: string;                 // ISO 8601
  durationMs?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Block-level event — richer than ExecutionEvent for block-specific tracking.
 * Used by ExecutionTracker. Stored in ExecutionRecord.blockEvents[].
 */
export interface BlockExecutionEvent {
  blockId: string;
  blockType: BlockType;
  event: 'started' | 'completed' | 'skipped';
  timestamp: string;                 // ISO 8601
  durationActual?: number;           // minutes
}

/**
 * Append-only log of everything that happened during a plan session.
 *
 * morning_intention: the user's stated intention before execution begins.
 *   Raw user text — device-only. Optional.
 *
 * Derived values (computed on read from blockEvents[], never stored):
 *   completionDepth   — blocksCompleted / totalBlocks (0–1)
 *   totalDurationMs   — sum of durationMs for completed steps
 *   abandonmentPoint  — blockId of last block before abandonment
 */
export interface ExecutionRecord {
  schemaVersion: string;
  sessionType: SessionType;
  date: string;                      // YYYY-MM-DD
  planId: string;
  morning_intention: string | null;  // raw user text — device-only
  blocksCompleted: number;
  blocksSkipped: number;
  totalBlocks: number;
  sessionCompleted: boolean;
  sessionAbandonedAt?: string;       // ISO 8601 — set if abandonSession() called
  events: ExecutionEvent[];          // coarse session-level events (append-only)
  blockEvents: BlockExecutionEvent[];// block-level detail (append-only)
}


// ─────────────────────────────────────────────────────────────
// LAYER 5 — REFLECTION
// Post-plan feedback. Raw text fields stay on-device permanently.
// Storage: device-only
// MMKV key: reflection:{YYYY-MM-DD}   TTL: 1 year
// ─────────────────────────────────────────────────────────────

export interface Reflection {
  schemaVersion: string;
  sessionType: SessionType;
  uid: string;
  planId: string;
  date: string;                      // YYYY-MM-DD
  feltAccurate: number;              // 1–5
  followedSequence: FollowedSequence;
  helpedMost?: string;               // raw user text — device-only
  gotInWay?: string;                 // raw user text — device-only
  note?: string;                     // raw user text — device-only
  createdAt: string;                 // ISO 8601
}


// ─────────────────────────────────────────────────────────────
// FIT SCORE — transient
// Session-level quality signal. Computed by FitEvaluator.
// Never persisted. Input to TrustEvaluator.
// ─────────────────────────────────────────────────────────────

export interface FitScoreComponents {
  userRated: number;                 // feltAccurate normalized to 0–1
  executionDepth: number;            // steps completed / steps prescribed (0–1)
  followThrough: number;             // yes=1, partially=0.5, no=0
  timingAccuracy: number;            // 0–1
}

export interface FitScore {
  date: string;                      // YYYY-MM-DD
  sessionType: SessionType;
  composite: number;                 // 0–1
  components: FitScoreComponents;
  trend: TrustTrend;
  sampleSize: number;
}


// ─────────────────────────────────────────────────────────────
// TRUST SIGNAL
// Long-term self-trust trajectory. Embedded in MemorySummary.
// Storage: device-only (via MemorySummary)
// ─────────────────────────────────────────────────────────────

export interface TrustSignal {
  schemaVersion: string;
  computedAt: string;                // ISO 8601
  sampleSize: number;
  accuracyTrend: number;             // 0–1
  followThroughConsistency: number;  // 0–1
  abandonmentRate: number;           // 0–1 — lower is better (inverted in composite)
  correctionFrequency: number;       // 0–1 — lower is better
  beginWillingness: number;          // 0–1 — higher is better
  composite: number;                 // 0–1
  trend: TrustTrend;
}


// ─────────────────────────────────────────────────────────────
// LAYER 6 — MEMORY SUMMARY
// Long-term behavioral model. Categorized strings only — no raw text.
// Storage: device-only
// MMKV key: memory   TTL: none
// ─────────────────────────────────────────────────────────────

/**
 * Models how this person functions under different conditions.
 * All bucket strings are categorized labels — never verbatim user text.
 * Raw text from Reflection is processed into category labels by MemoryEngine
 * before being stored here.
 */
export interface MemorySummary {
  schemaVersion: string;
  engineVersion: string;
  uid: string;
  updatedAt: string;                 // ISO 8601
  updateCount: number;

  // Five named behavioral buckets — categorized, not verbatim
  stabilizers: string[];
  derailers: string[];
  tractionBuilders: string[];
  selfTrustThreats: string[];
  reliableFirstMoves: string[];

  // Accuracy patterns
  lowAccuracyPatterns: string[];
  highAccuracyPatterns: string[];
  abandonmentPatterns: string[];

  // Quantitative (rolling weighted averages — recent sessions weighted more)
  averageFollowThrough: number;      // 0–1
  averageExecutionDepth: number;     // 0–1
  recentSessionCount: number;

  trustSignal: TrustSignal;
}


// ─────────────────────────────────────────────────────────────
// ONBOARDING PROFILE
// Stable identity layer. Set once, updated rarely via Settings.
// Storage: mixed — see domain/storage-classification.md
// MMKV key: profile:onboarding
// ─────────────────────────────────────────────────────────────

/**
 * Stable orientation data collected during onboarding.
 * Field-level storage classification: domain/storage-classification.md
 */
export interface OnboardingProfile {
  schemaVersion: string;
  uid: string;
  createdAt: string;                 // ISO 8601
  updatedAt: string;                 // ISO 8601
  consentTimestamp: string;          // ISO 8601 — when user tapped "I understand and agree"

  // Morning window — backup-eligible
  wakeTarget: string;                // HH:MM
  preferredDuration: number;         // minutes

  // Physical baseline — backup-eligible
  movementBaseline: MovementBaseline;

  // Archetype determinants — backup-eligible
  agencyStructure: AgencyStructure;  // 'Author' | 'Protagonist'
  pressureResponse: PressureResponse;// 'Push' | 'Pull'
  archetype: Archetype;              // computed from agencyStructure × pressureResponse
  archetypeTranslation: string;      // system-generated reveal copy
  archetypeConfidence: number;       // 0–1

  // Plan calibration — backup-eligible
  complexityTolerance: ComplexityTolerance;
  needsRationale: boolean;           // controls rationale visibility — not whether it exists

  // Sensory and overwhelm — device-only
  overwhelmStyle: OverwhelmStyle;
  sensoryStyle: SensoryStyle;

  // Background weight — device-only, raw user text
  theWeight: string | null;

  // Season context — backup-eligible
  seasonalFocus: SeasonalFocus;

  // Derived post-onboarding via session observation — device-only
  wakeState?: WakeState;             // absent until populated after three sessions
}


// ─────────────────────────────────────────────────────────────
// USER PROFILE
// Authentication and account state.
// Storage: device-only
// MMKV key: profile:user
// ─────────────────────────────────────────────────────────────

export interface UserProfile {
  schemaVersion: string;
  uid: string;
  email?: string;
  displayName?: string;
  providers: AuthProvider[];
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string;    // ISO 8601
  subscriptionTier: SubscriptionTier;
  cohortId: CohortId;                // resolved once at auth completion — aggregate-syncable
  createdAt: string;                 // ISO 8601
}


// ─────────────────────────────────────────────────────────────
// PENDING ONBOARDING SESSION
// Written to MMKV synchronously before the auth gate renders.
// Enables same-device session recovery after app purge.
// Storage: device-only
// MMKV key: session:pending_onboarding
// ─────────────────────────────────────────────────────────────

export interface PendingOnboardingSession {
  schemaVersion: string;
  savedAt: string;                   // ISO 8601
  profile: Partial<OnboardingProfile>;
  calculatedArchetype: Archetype;
  archetypeTranslation: string;
  archetypeConfidence: number;
  completedSteps: string[];
  deviceOrigin: string;
}


// ─────────────────────────────────────────────────────────────
// SUBSCRIPTION STATE
// Firestore only. No personal data.
// Firestore path: subscriptions/{uid}
// ─────────────────────────────────────────────────────────────

export interface SubscriptionState {
  uid: string;
  tier: SubscriptionTier;
  expiresAt?: string;                // ISO 8601
  provider?: AuthProvider | 'revenuecat';
  updatedAt: string;                 // ISO 8601
}

/**
 * Local MMKV cache of subscription state for offline resilience.
 * Trusted for 7 days past lastVerifiedAt regardless of network state.
 * Storage: device-only
 * MMKV key: subscription:cache
 */
export interface SubscriptionCache {
  tier: SubscriptionTier;
  expiresAt?: string;                // ISO 8601
  lastVerifiedAt: string;            // ISO 8601
}


// ─────────────────────────────────────────────────────────────
// PERSONALIZATION METRICS — transient
// All seven on-device metrics. Computed from MMKV. Never stored.
// ─────────────────────────────────────────────────────────────

export interface OperatingModeDistribution {
  steady: number;      // % sessions in STEADY_EXECUTION or HIGH_STAKES_DAY
  rebuilding: number;  // % sessions in FOCUS_REBUILD
  recovery: number;    // % sessions in RECOVERY or OVERWHELM_CONTAINMENT
}

export interface PersonalizationMetrics {
  computedAt: string;                // ISO 8601
  sampleSize: number;
  rollingFitScore: number;           // 0–1
  executionDepthTrend: number;       // 0–1
  followThroughRate: number;         // 0–1
  userRatedAccuracy: number;         // 0–1
  highAccuracyDensity: number;       // 0–1
  selfTrustTrend: TrustTrend;
  operatingModeDistribution: OperatingModeDistribution;
}


// ─────────────────────────────────────────────────────────────
// API CONTRACTS
// Types for the server boundary (app/api/generate-protocol+api.ts).
// Only structured data — no raw user text, no device-only fields.
// ─────────────────────────────────────────────────────────────

/**
 * Sent from device to server. Contains no raw user text.
 * overwhelmStyle and sensoryStyle are device-only — not included.
 * seasonalFocus is backup-eligible (enum, no personal content) — safe for server.
 */
export interface GeneratePlanRequest {
  archetype: Archetype;
  archetypeTranslation: string;
  seasonalFocus: SeasonalFocus;      // enum — no personal content
  preferredDuration: number;
  wakeTarget: string;
  dailyContext: DailyContext;
  operatingState: OperatingState;
  memorySummary: Pick<
    MemorySummary,
    | 'stabilizers'
    | 'derailers'
    | 'tractionBuilders'
    | 'reliableFirstMoves'
    | 'highAccuracyPatterns'
    | 'lowAccuracyPatterns'
    | 'averageFollowThrough'
    | 'averageExecutionDepth'
  >;
  promptVersion: string;
}

/** Returned from server. Full OperatingPlan minus uid (added client-side). */
export type GeneratePlanResponse = Omit<OperatingPlan, 'uid'>;
