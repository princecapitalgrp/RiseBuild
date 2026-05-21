/**
 * src/repositories/ProfileRepository.ts
 *
 * Single source of truth for all profile reads and writes.
 *
 * Responsibilities:
 *   - OnboardingProfile: read, write, validate
 *   - UserProfile: read, write, validate
 *   - TheWeight draft: read, write, clear (synchronous fast path)
 *
 * Architecture constraints:
 *   - Never imports @react-native-firebase. No Firestore access.
 *   - All reads go through validateAndParse — never raw JSON.cast.
 *   - All writes validate before persisting — corrupt data never enters MMKV.
 *   - Never throws. Returns null on read failure. Logs in __DEV__ on write failure.
 *   - encryptedStorage accessed only via the singleton from src/storage/mmkv.ts.
 */

import { encryptedStorage } from '../storage/mmkv';
import {
  ONBOARDING_DRAFT_THE_WEIGHT,
  PROFILE_ONBOARDING,
  PROFILE_USER,
} from '../storage/keys';
import { z } from 'zod';
import {
  OnboardingProfileSchema,
  UserProfileSchema,
  validateAndParse,
} from '../storage/validators';
import type { OnboardingProfile, UserProfile } from '../../domain/types';

// ─── Repository ───────────────────────────────────────────────────────────────

class ProfileRepository {

  // ── OnboardingProfile ───────────────────────────────────────────────────────

  /**
   * Returns the stored OnboardingProfile, or null if missing or invalid.
   * A null return means onboarding has not been completed on this device,
   * or the stored data failed schema validation (treat as not onboarded).
   */
  getOnboardingProfile(): OnboardingProfile | null {
    const raw = encryptedStorage.getString(PROFILE_ONBOARDING);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn(`[Rise] ProfileRepository: failed to JSON.parse key "${PROFILE_ONBOARDING}"`);
      }
      return null;
    }

    return validateAndParse(OnboardingProfileSchema, parsed, PROFILE_ONBOARDING);
  }

  /**
   * Validates and writes OnboardingProfile to MMKV.
   * If validation fails: logs in development, does not write, does not throw.
   * Use this for the final write at onboarding completion and for Settings updates.
   */
  saveOnboardingProfile(profile: OnboardingProfile): void {
    const result = OnboardingProfileSchema.safeParse(profile);
    if (!result.success) {
      if (__DEV__) {
        console.warn(
          `[Rise] ProfileRepository: saveOnboardingProfile validation failed — not written:`,
          result.error.flatten()
        );
      }
      return;
    }

    encryptedStorage.set(PROFILE_ONBOARDING, JSON.stringify(result.data));
  }

  // ── TheWeight draft ─────────────────────────────────────────────────────────
  // Called on every keystroke during onboarding. Must be synchronous and fast.
  // No validation — raw string, device-only. The draft is migrated to
  // OnboardingProfile.theWeight on onboarding completion, then cleared.

  /**
   * Returns the in-progress TheWeight draft text, or null if none exists.
   * Called on TheWeight step mount to restore mid-entry state.
   */
  getDraftWeight(): string | null {
    return encryptedStorage.getString(ONBOARDING_DRAFT_THE_WEIGHT) ?? null;
  }

  /**
   * Persists the in-progress TheWeight draft text.
   * Synchronous. Called with debounce (800ms) on every keystroke.
   * No validation — raw user text is stored as-is.
   */
  saveDraftWeight(text: string): void {
    encryptedStorage.set(ONBOARDING_DRAFT_THE_WEIGHT, text);
  }

  /**
   * Removes the TheWeight draft key.
   * Called after draft is migrated to OnboardingProfile on completion.
   */
  clearDraftWeight(): void {
    encryptedStorage.delete(ONBOARDING_DRAFT_THE_WEIGHT);
  }

  // ── UserProfile ─────────────────────────────────────────────────────────────

  /**
   * Returns the stored UserProfile, or null if missing or invalid.
   * UserProfile is written at auth completion and updated on subscription change.
   */
  getUserProfile(): UserProfile | null {
    const raw = encryptedStorage.getString(PROFILE_USER);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn(`[Rise] ProfileRepository: failed to JSON.parse key "${PROFILE_USER}"`);
      }
      return null;
    }

    return validateAndParse(UserProfileSchema as z.ZodType<UserProfile>, parsed, PROFILE_USER);
  }

  /**
   * Validates and writes UserProfile to MMKV.
   * If validation fails: logs in development, does not write, does not throw.
   */
  saveUserProfile(profile: UserProfile): void {
    const result = UserProfileSchema.safeParse(profile);
    if (!result.success) {
      if (__DEV__) {
        console.warn(
          `[Rise] ProfileRepository: saveUserProfile validation failed — not written:`,
          result.error.flatten()
        );
      }
      return;
    }

    encryptedStorage.set(PROFILE_USER, JSON.stringify(result.data));
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const profileRepository = new ProfileRepository();
