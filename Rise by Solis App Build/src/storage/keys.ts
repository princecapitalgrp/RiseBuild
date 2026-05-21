/**
 * src/storage/keys.ts
 *
 * Every MMKV key used in the application, defined once.
 * No magic strings anywhere in the codebase — always import from here.
 *
 * Naming convention: solis.[domain].[field]
 *
 * PREFIX keys (CHECKIN_HISTORY_PREFIX, PLAN_HISTORY_PREFIX, REFLECTION_PREFIX)
 * are used as the base for date-keyed records:
 *   e.g. CHECKIN_HISTORY_PREFIX + '2025-06-01'
 *        → 'solis.checkin.history.2025-06-01'
 *
 * Use the helper dateKey() to construct these safely.
 */

// ─── Master key object ────────────────────────────────────────────────────────

export const MMKV_KEYS = {

  // ── Onboarding draft ───────────────────────────────────────────────────────
  // Ephemeral drafts during onboarding. Migrated to profile on completion.
  ONBOARDING_DRAFT_THE_WEIGHT:  'solis.onboarding.draft.the_weight',
  ONBOARDING_DRAFT_SESSION:     'solis.onboarding.draft.session',
  ONBOARDING_DRAFT_STEP_INDEX:  'solis.onboarding.draft.step_index',

  // ── Consent ────────────────────────────────────────────────────────────────
  // Temporary key written by ConsentScreen on "I understand and agree".
  // Migrated into OnboardingProfile.consentTimestamp on auth complete.
  // Cleared with the rest of the onboarding draft.
  CONSENT_TIMESTAMP:            'solis.consent.timestamp',

  // ── Profile ────────────────────────────────────────────────────────────────
  PROFILE_ONBOARDING:           'solis.profile.onboarding',
  PROFILE_USER:                 'solis.profile.user',

  // ── Check-in ───────────────────────────────────────────────────────────────
  // CHECKIN_LATEST: most recent check-in (for same-session recovery)
  // CHECKIN_HISTORY_PREFIX: base for date-keyed history records
  CHECKIN_LATEST:               'solis.checkin.latest',
  CHECKIN_HISTORY_PREFIX:       'solis.checkin.history.',

  // ── Plan ───────────────────────────────────────────────────────────────────
  PLAN_LATEST:                  'solis.plan.latest',
  PLAN_HISTORY_PREFIX:          'solis.plan.history.',

  // ── Execution ──────────────────────────────────────────────────────────────
  EXECUTION_LATEST:             'solis.execution.latest',
  EXECUTION_HISTORY_PREFIX:     'solis.execution.history.',

  // ── Reflection ─────────────────────────────────────────────────────────────
  REFLECTION_PREFIX:            'solis.reflection.',

  // ── Memory ─────────────────────────────────────────────────────────────────
  MEMORY_SUMMARY:               'solis.memory.summary',

  // ── Metrics ────────────────────────────────────────────────────────────────
  METRICS_MODE_LOG:              'solis.metrics.mode_log',

  // ── Trust ──────────────────────────────────────────────────────────────────
  TRUST_SIGNAL:                 'solis.trust.signal',

  // ── Subscription ───────────────────────────────────────────────────────────
  // SUBSCRIPTION_CACHE: local MMKV mirror of Firestore subscription state
  // SUBSCRIPTION_FIRST_SESSION_DATE: ISO date of session 1 (paywall clock)
  // SUBSCRIPTION_GRACE_USED: boolean — grace session already consumed
  SUBSCRIPTION_CACHE:           'solis.subscription.cache',
  SUBSCRIPTION_FIRST_SESSION_DATE: 'solis.subscription.first_session_date',
  SUBSCRIPTION_GRACE_USED:      'solis.subscription.grace_used',

  // ── Notifications ──────────────────────────────────────────────────────────
  NOTIFICATION_PERMISSION:      'solis.notification.permission',

  // ── Session ────────────────────────────────────────────────────────────────
  // Populated by MemoryEngine after three sessions of observation.
  SESSION_WAKE_STATE_INFERRED:  'solis.session.wake_state_inferred',

  // ── Cohort ─────────────────────────────────────────────────────────────────
  // Set externally before onboarding by TestFlight invite type / deep link.
  // Read once at auth completion by resolveCohortId().
  COHORT_SOURCE:                'solis.onboarding.cohort_source',

} as const;

// ─── Type of the key object ───────────────────────────────────────────────────

export type MmkvKeys = typeof MMKV_KEYS;
export type MmkvKeyName = keyof MmkvKeys;
export type MmkvKeyValue = MmkvKeys[MmkvKeyName];

// ─── Individual named exports ─────────────────────────────────────────────────
// Import individually for direct use:
//   import { PROFILE_ONBOARDING } from '@/storage/keys'

export const {
  ONBOARDING_DRAFT_THE_WEIGHT,
  ONBOARDING_DRAFT_SESSION,
  ONBOARDING_DRAFT_STEP_INDEX,
  CONSENT_TIMESTAMP,
  PROFILE_ONBOARDING,
  PROFILE_USER,
  CHECKIN_LATEST,
  CHECKIN_HISTORY_PREFIX,
  PLAN_LATEST,
  PLAN_HISTORY_PREFIX,
  EXECUTION_LATEST,
  EXECUTION_HISTORY_PREFIX,
  REFLECTION_PREFIX,
  MEMORY_SUMMARY,
  METRICS_MODE_LOG,
  TRUST_SIGNAL,
  SUBSCRIPTION_CACHE,
  SUBSCRIPTION_FIRST_SESSION_DATE,
  SUBSCRIPTION_GRACE_USED,
  NOTIFICATION_PERMISSION,
  SESSION_WAKE_STATE_INFERRED,
  COHORT_SOURCE,
} = MMKV_KEYS;

// ─── Date-key helpers ─────────────────────────────────────────────────────────

/**
 * Constructs a date-keyed MMKV key from a prefix.
 *
 * @example
 * dateKey(CHECKIN_HISTORY_PREFIX, '2025-06-01')
 * // → 'solis.checkin.history.2025-06-01'
 */
export function dateKey(prefix: string, date: string): string {
  return prefix + date;
}

/**
 * Returns today's date as a YYYY-MM-DD string (device local time).
 * Used for constructing date keys throughout repositories.
 */
export function todayKey(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
