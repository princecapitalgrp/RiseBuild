/**
 * src/repositories/SessionRepository.ts
 *
 * Session state management: pending onboarding detection, subscription
 * session tracking, and wake-state inference persistence.
 *
 * Responsibilities:
 *   - Pending onboarding: detect, save step-by-step draft, clear on auth complete
 *   - Subscription clock: record first session date, compute days elapsed
 *   - Paywall state: free-period check, grace session tracking
 *   - Wake state inference: read/write the inferred WakeState after observation
 *
 * Architecture constraints:
 *   - Never imports @react-native-firebase. No Firestore access.
 *   - Collaborates with profileRepository for profile existence checks.
 *   - encryptedStorage accessed only via the singleton from src/storage/mmkv.ts.
 *   - All methods are synchronous — no async, no promises.
 *   - Never throws. Returns sensible defaults on missing keys.
 */

import { encryptedStorage } from '../storage/mmkv';
import {
  CONSENT_TIMESTAMP,
  ONBOARDING_DRAFT_SESSION,
  ONBOARDING_DRAFT_STEP_INDEX,
  ONBOARDING_DRAFT_THE_WEIGHT,
  SESSION_WAKE_STATE_INFERRED,
  SUBSCRIPTION_FIRST_SESSION_DATE,
  SUBSCRIPTION_GRACE_USED,
} from '../storage/keys';
import { wakeStateSchema } from '../storage/validators';
import { profileRepository } from './ProfileRepository';
import type { OnboardingProfile, WakeState } from '../../domain/types';

// ─── Repository ───────────────────────────────────────────────────────────────

class SessionRepository {

  // ── Pending onboarding ──────────────────────────────────────────────────────

  /**
   * Returns true if an in-progress onboarding session exists on this device
   * and the full OnboardingProfile has not yet been committed.
   *
   * "Pending" means: a draft session key is present AND no completed
   * OnboardingProfile with an assigned archetype exists yet.
   * Used in app/index.tsx to route returning users to the auth gate.
   */
  hasPendingOnboarding(): boolean {
    const hasDraft = encryptedStorage.contains(ONBOARDING_DRAFT_SESSION);
    if (!hasDraft) return false;

    // If a completed profile with an archetype already exists, onboarding is done
    const profile = profileRepository.getOnboardingProfile();
    if (profile !== null && profile.archetype !== undefined) return false;

    return true;
  }

  /**
   * Returns the partially-completed onboarding profile draft, or null if none.
   *
   * Validation is deliberately lenient here — unknown fields are allowed because
   * the session may be mid-completion (some steps done, others not yet reached).
   * We only verify it is a non-null object before returning.
   */
  getDraftSession(): Partial<OnboardingProfile> | null {
    const raw = encryptedStorage.getString(ONBOARDING_DRAFT_SESSION);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn(`[Rise] SessionRepository: failed to JSON.parse key "${ONBOARDING_DRAFT_SESSION}"`);
      }
      return null;
    }

    if (typeof parsed !== 'object' || parsed === null) {
      if (__DEV__) {
        console.warn(`[Rise] SessionRepository: draft session is not an object — ignoring`);
      }
      return null;
    }

    return parsed as Partial<OnboardingProfile>;
  }

  /**
   * Persists a partial OnboardingProfile after each onboarding step completes.
   * Called after every step — synchronous and fast.
   */
  saveDraftSession(partial: Partial<OnboardingProfile>): void {
    encryptedStorage.set(ONBOARDING_DRAFT_SESSION, JSON.stringify(partial));
  }

  /**
   * Removes both draft keys on successful auth completion.
   * Called once the full OnboardingProfile has been committed and the user
   * is authenticated. Clears ONBOARDING_DRAFT_SESSION,
   * ONBOARDING_DRAFT_THE_WEIGHT, and ONBOARDING_DRAFT_STEP_INDEX together
   * — they must always be cleared atomically.
   */
  clearDraftSession(): void {
    encryptedStorage.delete(ONBOARDING_DRAFT_SESSION);
    encryptedStorage.delete(ONBOARDING_DRAFT_THE_WEIGHT);
    encryptedStorage.delete(ONBOARDING_DRAFT_STEP_INDEX);
    encryptedStorage.delete(CONSENT_TIMESTAMP);
  }

  // ── Consent timestamp ───────────────────────────────────────────────────────

  /**
   * Returns the ISO 8601 timestamp written by ConsentScreen when the user
   * tapped "I understand and agree", or null if not yet recorded.
   *
   * Used by onboardingMachine.saveOnboardingComplete to populate
   * OnboardingProfile.consentTimestamp before saving the profile.
   */
  getConsentTimestamp(): string | null {
    return encryptedStorage.getString(CONSENT_TIMESTAMP) ?? null;
  }

  /**
   * Persists the consent timestamp. Called by ConsentScreen on agree tap.
   * Idempotent — safe to call more than once (e.g. on retry).
   */
  setConsentTimestamp(isoTimestamp: string): void {
    encryptedStorage.set(CONSENT_TIMESTAMP, isoTimestamp);
  }

  // ── Onboarding step index ───────────────────────────────────────────────────

  /**
   * Returns the saved onboarding step index (0-based), or 0 if none recorded.
   * Used by OnboardingFlow to resume at the correct step after an app purge.
   * Index corresponds to the ONBOARDING_STEP_INDEX map in onboardingMachine.ts.
   */
  getCurrentOnboardingStep(): number {
    return encryptedStorage.getNumber(ONBOARDING_DRAFT_STEP_INDEX) ?? 0;
  }

  /**
   * Persists the current onboarding step index.
   * Called by OnboardingFlow whenever the machine transitions to a new state.
   * Synchronous — safe to call on every state change.
   */
  setCurrentOnboardingStep(index: number): void {
    encryptedStorage.set(ONBOARDING_DRAFT_STEP_INDEX, index);
  }

  // ── Subscription session clock ──────────────────────────────────────────────

  /**
   * Returns the ISO date string (YYYY-MM-DD) of the first session, or null.
   * This is the paywall clock origin.
   */
  getFirstSessionDate(): string | null {
    return encryptedStorage.getString(SUBSCRIPTION_FIRST_SESSION_DATE) ?? null;
  }

  /**
   * Records today as the first session date, if none has been recorded yet.
   * Idempotent — safe to call on every app launch before the session starts.
   */
  recordFirstSessionIfNeeded(): void {
    if (encryptedStorage.contains(SUBSCRIPTION_FIRST_SESSION_DATE)) return;

    const today = this._todayISODate();
    encryptedStorage.set(SUBSCRIPTION_FIRST_SESSION_DATE, today);
  }

  /**
   * Returns the number of full calendar days elapsed since the first session.
   * Returns 0 if no first session has been recorded (pre-first-launch state).
   *
   * Uses calendar-day difference (midnight-to-midnight), not 24-hour periods,
   * so a user who first opened at 11pm and returns at 1am the next day is on day 1.
   */
  getDaysSinceFirstSession(): number {
    const firstDate = this.getFirstSessionDate();
    if (firstDate === null) return 0;

    const first = this._midnightUTC(firstDate);
    const today = this._midnightUTC(this._todayISODate());
    const diffMs = today.getTime() - first.getTime();

    // Guard against clock skew producing negative values
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  }

  /**
   * Returns true while the user is within the 14-day free period.
   * Day 0 through day 13 inclusive = free. Day 14+ = paywall applies.
   */
  isInFreePeriod(): boolean {
    return this.getDaysSinceFirstSession() < 14;
  }

  // ── Grace session ───────────────────────────────────────────────────────────

  /**
   * Returns true if the one-time grace session has already been consumed.
   * The grace session is the first decline of the paywall — the user gets
   * one full plan view before the preview-only wall applies on the next session.
   */
  hasUsedGraceSession(): boolean {
    return encryptedStorage.getBoolean(SUBSCRIPTION_GRACE_USED) ?? false;
  }

  /**
   * Marks the grace session as consumed. Idempotent.
   * Called when the user dismisses the paywall for the first time.
   */
  markGraceSessionUsed(): void {
    encryptedStorage.set(SUBSCRIPTION_GRACE_USED, true);
  }

  // ── Wake state inference ────────────────────────────────────────────────────

  /**
   * Returns the inferred WakeState after three sessions of observation,
   * or null if insufficient sessions have been observed.
   */
  getInferredWakeState(): WakeState | null {
    const raw = encryptedStorage.getString(SESSION_WAKE_STATE_INFERRED);
    if (raw === undefined) return null;

    const result = wakeStateSchema.safeParse(raw);
    if (!result.success) {
      if (__DEV__) {
        console.warn(`[Rise] SessionRepository: invalid WakeState value "${raw}" — ignoring`);
      }
      return null;
    }

    return result.data;
  }

  /**
   * Persists the inferred WakeState.
   * Called by MemoryEngine after three sessions confirm a stable pattern.
   * Also updates OnboardingProfile.wakeState via profileRepository.
   */
  setInferredWakeState(state: WakeState): void {
    encryptedStorage.set(SESSION_WAKE_STATE_INFERRED, state);
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /** Returns today's date as a YYYY-MM-DD string (device local time). */
  private _todayISODate(): string {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Returns a Date object representing midnight UTC for a YYYY-MM-DD string.
   * Used for calendar-day arithmetic that is immune to timezone offsets.
   */
  private _midnightUTC(isoDate: string): Date {
    return new Date(`${isoDate}T00:00:00.000Z`);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const sessionRepository = new SessionRepository();
