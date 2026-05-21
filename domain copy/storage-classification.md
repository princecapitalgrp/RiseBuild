# Rise by Solis — Storage Classification Table

**Purpose:** Every field from every domain type is classified here.
This is the authoritative source for where data lives, how sensitive it is, and whether it can leave the device.

**Canonical vocabulary (four terms — applied to MMKV-resident application data):**

| Term | Meaning |
|---|---|
| `device-only` | Sensitive. Lives in encrypted MMKV. Never leaves the device under any circumstances — not in backup, not in analytics, not in error reports. |
| `backup-eligible` | Non-sensitive. Lives in encrypted MMKV. May be included in encrypted cross-device backup with explicit user consent. Cannot be synced without consent. |
| `aggregate-syncable` | Non-PII summary statistics only. May appear in anonymised aggregate Firestore analytics with explicit opt-in. Never individual records. |
| `transient` | In-memory only. Never written to MMKV, Keychain, or Firestore. Exists only for the duration of the operation that produces it. |

**Separate storage systems (not classified by the four terms above):**

- **Keychain** (iOS Keychain via `expo-secure-store`) — OS-level protection for credentials and encryption keys only. Not application data.
- **Firestore** — Cloud. Restricted to subscription/entitlement state and explicitly approved non-personal infrastructure data. Never personal data, never health-sensitive inferences.

**Non-negotiable rules:**
- Raw user text → `device-only`. No exceptions.
- Voice transcripts → `transient`. Never written to MMKV, Keychain, or Firestore.
- Every new field must be classified here before implementation.
- `@react-native-firebase` import is allowed only in `FirestoreRepository.ts`.
- The Zod schema on `generate-protocol+api.ts` rejects any payload containing raw user text fields.

---

## Layer 1 — RawCheckIn
**MMKV key:** `checkin:{YYYY-MM-DD}` | **TTL:** 90 days

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management metadata |
| `sessionType` | SessionType | backup-eligible | No | Routing metadata, not personal |
| `uid` | string | backup-eligible | No | Scopes record to user — not PII itself |
| `date` | string | backup-eligible | No | Date key, not personal |
| `energy` | number | backup-eligible | No | Numeric slider (1–5) — not text |
| `stress` | number | backup-eligible | No | Numeric slider (1–5) — not text |
| `sleepQuality` | number | backup-eligible | No | Numeric slider (1–5) — not text |
| `availableMinutes` | number | backup-eligible | No | Today's available window in minutes — not personal |
| `mood` | string | **device-only** | **Yes** | **Raw user text — never leaves device** |
| `pressurePoint` | string? | **device-only** | **Yes** | **Raw user text — never leaves device** |
| `firstCommitment.time` | string | backup-eligible | No | Time value (HH:MM) — not text |
| `firstCommitment.type` | CommitmentType | backup-eligible | No | Enum — not verbatim user text. Safe for AI server. |
| `firstCommitment.leadTimeMinutes` | number | backup-eligible | No | Computed from time — safe for AI server |
| `firstCommitment.stakes` | enum? | backup-eligible | No | Explicit user override — safe for AI server |
| `updatedWeight` | string | **device-only** | **Yes** | **Raw user text — the named weight. See theWeight operational rules.** |
| `voiceTranscriptPresent` | boolean | backup-eligible | No | Boolean flag only — transcript itself is transient (see below) |
| `createdAt` | string | backup-eligible | No | Timestamp, not personal |

**Voice transcript** (retention distinction — not a stored field):
- During check-in: exists in XState context only while InterpretationService is active.
- After interpretation: explicitly nulled. Never written to MMKV, never passed downstream.
- `voiceTranscriptPresent`: the boolean flag is the only persistent record that voice was used — it carries no content.
- Distinction: `mood`, `updatedWeight`, etc. are written to MMKV intentionally (user-authored context). Transcripts are discarded intentionally (they are input, not storage).

---

## Layer 2A — DailyContext
**MMKV key:** `context:{YYYY-MM-DD}` | **TTL:** 90 days

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management |
| `modelVersion` | string | backup-eligible | No | Engine version tracking |
| `sessionType` | SessionType | backup-eligible | No | Routing metadata |
| `interpretedAt` | string | backup-eligible | No | Timestamp |
| `physiologicalState.energy` | EnergyLevel | device-only | No | Derived/categorized from numeric slider — sensitive state signal |
| `physiologicalState.stress` | StressLevel | device-only | No | Derived/categorized — sensitive state signal |
| `physiologicalState.sleepQuality` | SleepQuality | device-only | No | Derived/categorized — sensitive state signal |
| `physiologicalState.overallReadiness` | Readiness | device-only | No | Computed from above — sensitive state signal |
| `emotionalTone` | EmotionalTone | device-only | No | Categorized interpretation — sensitive. Not verbatim user text but characterizes emotional state. |
| `cognitiveLoad` | CognitiveLoad | device-only | No | Sensitive state inference |
| `commitmentProfile.time` | string | backup-eligible | No | Time value (HH:MM) |
| `commitmentProfile.type` | CommitmentType | backup-eligible | No | Categorized — not verbatim user text |
| `commitmentProfile.leadTime` | number | backup-eligible | No | Computed value (minutes), not raw text |
| `commitmentProfile.stakes` | enum | backup-eligible | No | Computed from type + leadTime |
| `weightCategory` | WeightCategory | device-only | No | Categorized label — never verbatim user text, but sensitive behavioral inference |
| `availableMinutes` | number | backup-eligible | No | Passed through for plan timing — not sensitive |
| `flags` | string[] | device-only | No | Structured behavioral tags — sensitive inferences |

**Safe for AI server:** This entire entity. No raw user-authored text — all fields are structured interpretations.

---

## Layer 2B — OperatingState
**MMKV key:** `operatingState:{YYYY-MM-DD}` | **TTL:** 90 days

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management |
| `modelVersion` | string | backup-eligible | No | Engine version tracking |
| `sessionType` | SessionType | backup-eligible | No | Routing metadata |
| `mode` | OperatingMode | device-only | No | Sensitive state assessment (e.g. RECOVERY, OVERWHELM_CONTAINMENT) |
| `urgency` | Urgency | device-only | No | Sensitive computed assessment |
| `capacity` | number | device-only | No | Sensitive (0–1 capacity score) |
| `confidence` | number | backup-eligible | No | Engine confidence (0–1) — not personally sensitive |
| `pulseState` | PulseState | device-only | No | In-session timing/behavioral signal (RUSHED/HEAVY/SCATTERED/NORMAL) — sensitive |
| `availableWindow` | number | backup-eligible | No | Minutes available for plan — not personally sensitive |
| `firstBlockOverride` | BlockType? | backup-eligible | No | Rule-derived enum, not personally sensitive |
| `producedAt` | string | backup-eligible | No | Timestamp |

**Safe for AI server:** This entire entity.

---

## Layer 3 — OperatingPlan
**MMKV key:** `plan:{YYYY-MM-DD}` | **TTL:** 1 year

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management |
| `promptVersion` | string | backup-eligible | No | Calibration tracking — no personal data |
| `sessionType` | SessionType | backup-eligible | No | Routing metadata |
| `uid` | string | backup-eligible | No | Scopes to user |
| `date` | string | backup-eligible | No | Date key |
| `planId` | string | backup-eligible | No | Composite key: `{date}:{sessionType}` |
| `planTitle` | string | backup-eligible | No | AI-generated — no user text |
| `openingLine` | string | backup-eligible | No | AI-generated |
| `planObjective` | string | backup-eligible | No | AI-generated |
| `rationale.noticed` | string[] | backup-eligible | No | System observations — no user-authored text |
| `rationale.planLogic` | string | backup-eligible | No | AI-generated explanation |
| `rationale.firstBlockReason` | string | backup-eligible | No | AI-generated one-sentence rationale for first block — shown pre-paywall |
| `rationale.protecting` | string? | backup-eligible | No | AI-generated |
| `rationale.creating` | string? | backup-eligible | No | AI-generated |
| `rationale.uncertainty` | string[] | backup-eligible | No | Required (never undefined or null). Empty array [] = full confidence. Must be populated when uncertainty exists. |
| `rationale.operatingMode` | OperatingMode | device-only | No | Sensitive mode classification embedded in rationale |
| `mainSequence` | PlanStep[] | backup-eligible | No | AI-generated plan steps — no user text |
| `mainSequence[].order` | number | backup-eligible | No | Step index |
| `mainSequence[].timeLabel` | string | backup-eligible | No | AI-generated |
| `mainSequence[].blockType` | BlockType | backup-eligible | No | Classification |
| `mainSequence[].title` | string | backup-eligible | No | AI-generated |
| `mainSequence[].action` | string | backup-eligible | No | AI-generated |
| `mainSequence[].rationale` | string? | backup-eligible | No | AI-generated |
| `mainSequence[].durationMinutes` | number | backup-eligible | No | Prescribed time |
| `fallbackSequence` | PlanStep[] | backup-eligible | No | AI-generated fallback steps (same fields as mainSequence) |
| `nonNegotiableAction` | string | backup-eligible | No | AI-generated |
| `sensoryCue` | string | backup-eligible | No | AI-generated |
| `antiPatternWarning` | string | backup-eligible | No | AI-generated |
| `summaryInsight` | string | backup-eligible | No | AI-generated |
| `confidenceNote` | ConfidenceNote | backup-eligible | No | Computed confidence level |
| `internalArchetype` | Archetype | backup-eligible | No | Deterministic computation from onboarding |
| `operatingMode` | OperatingMode | device-only | No | Sensitive mode classification |
| `source` | PlanSource | backup-eligible | No | 'ai' or 'rule-based' — triggers FallbackBadge |
| `generatedAt` | string | backup-eligible | No | Timestamp |

---

## Layer 4 — ExecutionRecord
**MMKV key:** `execution:{YYYY-MM-DD}` | **TTL:** 1 year
**Constraint:** Append-only. Events are never deleted or overwritten.

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management |
| `sessionType` | SessionType | backup-eligible | No | Routing metadata |
| `date` | string | backup-eligible | No | Date key |
| `planId` | string | backup-eligible | No | References OperatingPlan |
| `morning_intention` | string\|null | **device-only** | **Yes** | **Raw user text — stated intention before execution. Never sent to server.** |
| `blocksCompleted` | number | backup-eligible | No | Count — no user text |
| `blocksSkipped` | number | backup-eligible | No | Count — no user text |
| `totalBlocks` | number | backup-eligible | No | Count — no user text |
| `sessionCompleted` | boolean | backup-eligible | No | Completion flag |
| `sessionAbandonedAt` | string? | backup-eligible | No | ISO timestamp — no user text |
| `events[].eventType` | ExecutionEventType | backup-eligible | No | Structured event classification — no user text |
| `events[].stepOrder` | number? | backup-eligible | No | Which step — no text |
| `events[].timestamp` | string | backup-eligible | No | Wall time |
| `events[].durationMs` | number? | backup-eligible | No | Timing data |
| `events[].metadata` | Record? | backup-eligible | No | Structured metadata — no user text |
| `blockEvents[].blockId` | string | backup-eligible | No | Block identifier — no user text |
| `blockEvents[].blockType` | BlockType | backup-eligible | No | Enum — no user text |
| `blockEvents[].event` | enum | backup-eligible | No | started/completed/skipped |
| `blockEvents[].timestamp` | string | backup-eligible | No | Wall time |
| `blockEvents[].durationActual` | number? | backup-eligible | No | Minutes — no user text |

**Derived values (transient — computed from blockEvents[], never stored):**
- `completionDepth` — blocksCompleted / totalBlocks (0–1)
- `totalDurationMs` — sum of durationActual for completed blocks
- `abandonmentPoint` — blockId of last block before abandonment

---

## Layer 5 — Reflection
**MMKV key:** `reflection:{YYYY-MM-DD}` | **TTL:** 1 year

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management |
| `sessionType` | SessionType | backup-eligible | No | Routing metadata |
| `uid` | string | backup-eligible | No | Scopes to user |
| `planId` | string | backup-eligible | No | References OperatingPlan |
| `date` | string | backup-eligible | No | Date key |
| `feltAccurate` | number | backup-eligible | No | Numeric rating (1–5) — not text |
| `followedSequence` | FollowedSequence | backup-eligible | No | Structured option (followed/adapted/own_way) — not text |
| `helpedMost` | string? | **device-only** | **Yes** | **Raw user text — processed into category labels by MemoryEngine. Raw text stays here permanently.** |
| `gotInWay` | string? | **device-only** | **Yes** | **Raw user text — processed into category labels by MemoryEngine. Raw text stays here permanently.** |
| `note` | string? | **device-only** | **Yes** | **Raw user text — never processed. Stored for user reference only.** |
| `createdAt` | string | backup-eligible | No | Timestamp |

**Important:** `helpedMost` and `gotInWay` raw text never enters `MemorySummary`. MemoryEngine reads these fields, writes categorized labels to the five behavioral buckets only, and never propagates the raw text.

---

## FitScore (Computed — Transient)

FitScore is not persisted. Computed on demand by FitEvaluator from OperatingPlan + ExecutionRecord + Reflection. Input to TrustEvaluator.

| Field | Type | Classification | Rationale |
|---|---|---|---|
| `date` | string | transient | Computed value |
| `sessionType` | SessionType | transient | Computed value |
| `composite` | number | transient | Computed value |
| `components.userRated` | number | transient | Computed from feltAccurate |
| `components.executionDepth` | number | transient | Computed from events[] |
| `components.followThrough` | number | transient | Computed from followedSequence |
| `components.timingAccuracy` | number | transient | Computed from events[] vs plan |
| `trend` | TrustTrend | transient | Computed from history |
| `sampleSize` | number | transient | Computed |

---

## TrustSignal
**Embedded in MemorySummary — not stored separately.**

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | device-only (via memory) | No | Schema management |
| `computedAt` | string | device-only (via memory) | No | Timestamp |
| `sampleSize` | number | device-only (via memory) | No | Session count |
| `accuracyTrend` | number | device-only (via memory) | No | Sensitive behavioral signal |
| `followThroughConsistency` | number | device-only (via memory) | No | Sensitive behavioral signal |
| `abandonmentRate` | number | device-only (via memory) | No | Sensitive behavioral signal |
| `correctionFrequency` | number | device-only (via memory) | No | Sensitive behavioral signal |
| `beginWillingness` | number | device-only (via memory) | No | Sensitive behavioral signal |
| `composite` | number | device-only (via memory) | No | Sensitive composite score |
| `trend` | TrustTrend | device-only (via memory) | No | BUILDING \| STABLE \| ERODING — sensitive |

---

## Layer 6 — MemorySummary
**MMKV key:** `memory` | **TTL:** None (single rolling document)

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | device-only | No | Schema management |
| `engineVersion` | string | device-only | No | Which MemoryEngine produced this |
| `uid` | string | device-only | No | Scopes to user |
| `updatedAt` | string | device-only | No | Timestamp |
| `updateCount` | number | device-only | No | Update counter |
| `stabilizers` | string[] | device-only | No | Categorized labels only — not verbatim user text |
| `derailers` | string[] | device-only | No | Categorized labels only |
| `tractionBuilders` | string[] | device-only | No | Categorized labels only |
| `selfTrustThreats` | string[] | device-only | No | Categorized labels only |
| `reliableFirstMoves` | string[] | device-only | No | Categorized labels only |
| `lowAccuracyPatterns` | string[] | device-only | No | Archetype + context combos — no user text, but sensitive pattern data |
| `highAccuracyPatterns` | string[] | device-only | No | Archetype + context combos — no user text, but sensitive pattern data |
| `abandonmentPatterns` | string[] | device-only | No | Step types + contexts — sensitive |
| `averageFollowThrough` | number | device-only | No | Rolling weighted average |
| `averageExecutionDepth` | number | device-only | No | Rolling weighted average |
| `recentSessionCount` | number | device-only | No | Session counter |
| `trustSignal` | TrustSignal | device-only | No | Embedded — see TrustSignal section above |

**What the AI server receives from MemorySummary** (via `GeneratePlanRequest.memorySummary`):
- `stabilizers`, `derailers`, `tractionBuilders`, `reliableFirstMoves` — categorized labels only
- `highAccuracyPatterns`, `lowAccuracyPatterns` — pattern descriptors, no user text
- `averageFollowThrough`, `averageExecutionDepth` — numeric values

**Never sent to AI:** `uid`, `updatedAt`, `updateCount`, `engineVersion`, `selfTrustThreats`, `abandonmentPatterns`, `recentSessionCount`, `trustSignal`

---

## OnboardingProfile
**MMKV key:** `profile:onboarding`

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management |
| `uid` | string | backup-eligible | No | Scopes to user |
| `createdAt` | string | backup-eligible | No | Timestamp |
| `updatedAt` | string | backup-eligible | No | Timestamp |
| `consentTimestamp` | string | backup-eligible | No | Legal record of when user consented to data collection. This IS the consent record — it does not itself require consent. Must survive device restore. |
| `wakeTarget` | string | backup-eligible | No | HH:MM — morning window preference, not sensitive |
| `preferredDuration` | number | backup-eligible | No | Minutes — plan length preference |
| `movementBaseline` | MovementBaseline | backup-eligible | No | Habitual movement pattern (regular/occasional/rare) — not sensitive |
| `agencyStructure` | AgencyStructure | backup-eligible | No | 'Author' \| 'Protagonist' — archetype determinant, not sensitive |
| `pressureResponse` | PressureResponse | backup-eligible | No | 'Push' \| 'Pull' — archetype determinant, not sensitive |
| `archetype` | Archetype | backup-eligible | No | Deterministic computation — not sensitive |
| `archetypeTranslation` | string | backup-eligible | No | System-generated reveal copy |
| `archetypeConfidence` | number | backup-eligible | No | Computed (0–1) |
| `complexityTolerance` | ComplexityTolerance | backup-eligible | No | 'layered' \| 'simple' — plan calibration, not sensitive |
| `needsRationale` | boolean | backup-eligible | No | Controls rationale visibility — not sensitive |
| `overwhelmStyle` | OverwhelmStyle | **device-only** | **Yes** | How the user responds to overwhelm — sensitive trait |
| `sensoryStyle` | SensoryStyle | **device-only** | **Yes** | Morning sensory preference — sensitive trait |
| `theWeight` | string \| null | **device-only** | **Yes** | **Raw user text — the named weight. See theWeight operational rules below.** |
| `seasonalFocus` | SeasonalFocus | backup-eligible | No | Season of life context — enum, no personal content. Safe for AI server. |
| `wakeState` | WakeState? | **device-only** | **Yes** | Derived post-onboarding via session observation — sensitive behavioral inference. Absent until populated after three sessions. |

**What the AI server receives from OnboardingProfile** (via `GeneratePlanRequest`):
- `archetype`, `archetypeTranslation` — computed values, not sensitive
- `seasonalFocus` — enum, no personal content
- `preferredDuration`, `wakeTarget` — structural preferences

**Never sent to AI:** `theWeight`, `overwhelmStyle`, `sensoryStyle`, `wakeState`, `uid`, `agencyStructure`, `pressureResponse`, `movementBaseline`

### theWeight — Operational Protection Rules

`theWeight` is the most sensitive field in the product.

1. **Never transmitted.** Not in GeneratePlanRequest, not in any analytics payload, not in any error report, not in any crash log.
2. **Never logged.** No `console.log`, no debug output, no Sentry/Crashlytics payload may include this field or the contents of `profile:onboarding`.
3. **Never displayed verbatim by the system.** The app may acknowledge its presence (e.g. "We noted what you're carrying") but never echoes it back in system-generated text, notifications, or plan content.
4. **Processed into `weightCategory` only.** `InterpretationService` reads `theWeight` to produce a `WeightCategory` enum value. Only the enum value enters the AI layer — not the text.
5. **Deleted with the user.** On account deletion, MMKV is wiped. `theWeight` is gone before any other cleanup step.
6. **Never migrated without explicit consent.** If a future feature proposes syncing `profile:onboarding`, `theWeight` must be excluded by field-level exclusion — not reliance on a blanket "no personal data" policy.

---

## Onboarding Draft — TheWeight
**MMKV key:** `onboarding_draft_theWeight` | **TTL:** Migrated to `profile:onboarding` at onboarding completion, then deleted

Ephemeral draft persistence for the TheWeight step during onboarding.

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `text` | string | **device-only** | **Yes** | **Raw user text — same protection rules as `theWeight` in OnboardingProfile** |
| `savedAt` | string | device-only | No | Timestamp |

**Lifecycle:**
- Written: debounced 800ms after user keystroke on TheWeight step
- Migrated: on onboarding completion, content moves to `OnboardingProfile.theWeight`
- Deleted: `onboarding_draft_theWeight` key is removed after successful migration
- Purpose: prevents data loss if user backgrounds the app mid-entry

---

## UserProfile
**MMKV key:** `profile:user`

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management |
| `uid` | string | backup-eligible | No | Device copy of Firebase UID |
| `email` | string? | backup-eligible | No | Cached from auth — scoped to device |
| `displayName` | string? | backup-eligible | No | Cached from auth |
| `providers` | AuthProvider[] | backup-eligible | No | Which auth methods used |
| `onboardingCompleted` | boolean | backup-eligible | No | Session routing flag |
| `onboardingCompletedAt` | string? | backup-eligible | No | Timestamp |
| `subscriptionTier` | SubscriptionTier | backup-eligible | No | Cached from Firestore — source of truth is Firestore |
| `createdAt` | string | backup-eligible | No | Timestamp |

---

## PendingOnboardingSession
**MMKV key:** `session:pending_onboarding`

Written synchronously at archetype reveal, before auth gate renders. Enables same-device session recovery after app purge.

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `schemaVersion` | string | backup-eligible | No | Schema management |
| `savedAt` | string | backup-eligible | No | Timestamp |
| `profile` | Partial\<OnboardingProfile\> | Mixed | Mixed | Contains `device-only` fields (overwhelmStyle, sensoryStyle, theWeight, wakeState) — same rules apply |
| `calculatedArchetype` | Archetype | backup-eligible | No | Deterministic computation |
| `archetypeTranslation` | string | backup-eligible | No | System label |
| `archetypeConfidence` | number | backup-eligible | No | Computed (0–1) |
| `completedSteps` | string[] | backup-eligible | No | Step names — not user text |
| `deviceOrigin` | string | backup-eligible | No | Device identifier for same-device recovery validation |

**Write order (critical — must be synchronous and sequential):**
1. Calculate archetype
2. Write `session:pending_onboarding` SYNCHRONOUSLY (this key)
3. Write `profile:onboarding` SYNCHRONOUSLY
4. Route to auth gate

---

## SubscriptionState
**Firestore path:** `subscriptions/{uid}` | **System:** Firestore (not MMKV)

| Field | Type | Storage System | Consent Required | Rationale |
|---|---|---|---|---|
| `uid` | string | Firestore | No | Document key |
| `tier` | SubscriptionTier | Firestore | No | Entitlement state — cloud source of truth |
| `expiresAt` | string? | Firestore | No | Timestamp |
| `provider` | string? | Firestore | No | Which payment system |
| `updatedAt` | string | Firestore | No | Timestamp |

The only Firestore document that contains user-linked data beyond the auth record itself.

---

## SubscriptionCache
**MMKV key:** `subscription:cache` | **TTL:** 7 days from `lastVerifiedAt`

Local MMKV cache of subscription state for offline resilience. Trusted for 7 days past `lastVerifiedAt`.

| Field | Type | Classification | Consent Required | Rationale |
|---|---|---|---|---|
| `tier` | SubscriptionTier | backup-eligible | No | Cached entitlement — not personally sensitive |
| `expiresAt` | string? | backup-eligible | No | Expiry timestamp |
| `lastVerifiedAt` | string | backup-eligible | No | When cache was last confirmed against Firestore |

---

## Auth Tokens
**System:** Keychain via `expo-secure-store` (not MMKV)

| Item | Storage System | Rationale |
|---|---|---|
| Firebase auth token | Keychain | OS-level security for credentials |
| MMKV encryption key | Keychain | Must be OS-protected — used on every MMKV open |
| Apple Sign In credential | Keychain | Required by Apple — must survive app reinstall |

---

## PersonalizationMetrics (Computed — Transient)

All seven metrics are computed on demand from MMKV data. Never stored as a document.

| Field | Type | Classification | Rationale |
|---|---|---|---|
| `computedAt` | string | transient | Computed value |
| `sampleSize` | number | transient | Computed from MMKV records |
| `rollingFitScore` | number | transient | Computed from FitEvaluator over last 7 sessions |
| `executionDepthTrend` | number | transient | Computed from ExecutionRecord history |
| `followThroughRate` | number | transient | Computed from Reflection history |
| `userRatedAccuracy` | number | transient | Computed from Reflection.feltAccurate history |
| `highAccuracyDensity` | number | transient | Computed from Reflection history |
| `selfTrustTrend` | TrustTrend | transient | Sourced from MemorySummary.trustSignal.trend |
| `operatingModeDistribution` | OperatingModeDistribution | transient | Computed from OperatingState history |

---

## GeneratePlanRequest / GeneratePlanResponse (Transient)

API contract types — constructed in memory, sent over network, not persisted.

| Field | Type | Classification | Rationale |
|---|---|---|---|
| `GeneratePlanRequest.*` | various | transient | Constructed from MMKV data, sent to server — no raw user text, no device-only fields |
| `GeneratePlanResponse.*` | OperatingPlan fields | transient | Received from server, then persisted as OperatingPlan to MMKV |

**Validation:** Every `GeneratePlanRequest` is Zod-validated server-side. Any payload containing raw user text fields is rejected with 400. Fields excluded from request: `theWeight`, `overwhelmStyle`, `sensoryStyle`, `wakeState`, `mood`, `pressurePoint`, `updatedWeight`, `morning_intention`, `helpedMost`, `gotInWay`, `note`.

---

## Summary — Raw User Text Fields (complete list)

All `device-only`. No exceptions. Never transmitted, never logged, never echoed verbatim by the system.

| Field | Entity | MMKV Key | Notes |
|---|---|---|---|
| `mood` | RawCheckIn | `checkin:{date}` | Free text |
| `pressurePoint` | RawCheckIn | `checkin:{date}` | Free text, optional |
| `updatedWeight` | RawCheckIn | `checkin:{date}` | Free text — the named weight mid-session update |
| `morning_intention` | ExecutionRecord | `execution:{date}` | Free text, optional — stated intention before execution |
| `theWeight` | OnboardingProfile | `profile:onboarding` | Free text — see theWeight operational protection rules |
| `text` | Onboarding Draft | `onboarding_draft_theWeight` | Draft only — migrated or discarded |
| `helpedMost` | Reflection | `reflection:{date}` | Free text, optional |
| `gotInWay` | Reflection | `reflection:{date}` | Free text, optional |
| `note` | Reflection | `reflection:{date}` | Free text, optional |

**Voice transcript** — not stored anywhere. Transient only. Distinct from "stored raw text."

**Removed fields (no longer in any type — do not re-add):**
- `priorities` — removed from OnboardingProfile (raw text unusable by engine, violates AI privacy contract)
- `morningImprint` — removed from OnboardingProfile (redundant with archetype + seasonalFocus)
- `sensoryRegulation` — removed from OnboardingProfile (replaced by `sensoryStyle` and `overwhelmStyle`)
- `firstCommitment.description` — removed from RawCheckIn (replaced by `firstCommitment.type` enum + `firstCommitment.stakes`)
- `physicalEnergy` — removed from OnboardingProfile (inferable from movementBaseline + check-in energy)
- `morningCapacity` — removed from OnboardingProfile (see above)

---

## Enforcement Protocol

1. **Before adding any new field to types.ts:** Classify it in this document first. No exceptions.
2. **Firestore import isolation:** `FirestoreRepository.ts` is the only file permitted to import `@react-native-firebase`. Enforced with ESLint `no-restricted-imports`.
3. **API gate:** Zod schema on `generate-protocol+api.ts` rejects payloads containing raw user text fields. Maintained as the technical enforcement of the privacy contract.
4. **Test gate:** Every repository has a test asserting that raw text fields from the "Summary" table above do not appear in any Firestore document after a full simulated session.
5. **theWeight gate:** Any PR touching `InterpretationService` must include a test verifying that `theWeight` is consumed to produce `weightCategory` and is not present in any downstream object, log, or network call.
6. **uncertainty[] gate:** Any `PlanGenerationService` output with `uncertainty` as `undefined` or `null` is a bug. An empty array `[]` is valid. A missing field is not.
7. **device-only gate:** Any PR adding a new `device-only` field must add a test asserting that field does not appear in `GeneratePlanRequest` payload.
