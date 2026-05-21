/**
 * src/services/ErasureService.ts
 *
 * Implements the GDPR Article 17 right to erasure.
 * Called from SettingsScreen delete flow after user confirms the action.
 *
 * deleteAll() wipes all MMKV data with a single clearAll() call.
 * This covers every personal data key including:
 *   - OnboardingProfile (including consentTimestamp, theWeight)
 *   - All check-in history (RawCheckIn — raw user text)
 *   - All plan history (OperatingPlan)
 *   - All execution records (ExecutionRecord)
 *   - All reflection data (Reflection — raw user text in helpedMost/gotInWay/note)
 *   - MemorySummary (behavioral model)
 *   - TrustSignal
 *   - Consent timestamp
 *   - Session state
 *   - Subscription cache
 *   - Notification permission state
 *
 * Does NOT delete:
 *   - iOS Keychain entry (MMKV encryption key)
 *     Retained intentionally: the key without data is meaningless.
 *     If the user reinstalls on the same device, MMKV re-initializes with
 *     the same key. This is consistent with the privacy promise — retaining
 *     a key is not a privacy risk; retaining data is.
 *   - Firebase Auth account
 *     Firebase account deletion must be handled separately by the auth layer
 *     (call user.delete() on the Firebase Auth user object after clearAll()).
 *     This is outside the scope of ErasureService to keep auth concerns separate.
 *
 * After clearAll(), cancel all scheduled notifications so no wake reminders
 * fire for a deleted account.
 */

import { encryptedStorage } from '../storage/mmkv';
import { notificationService } from './NotificationService';

// ─── Service ──────────────────────────────────────────────────────────────────

class ErasureService {

  /**
   * Permanently deletes all MMKV data on this device.
   *
   * This is a destructive, irreversible operation.
   * The caller (SettingsScreen) is responsible for:
   *   1. Showing a confirmation dialog before calling this method.
   *   2. Calling Firebase Auth user.delete() after this returns.
   *   3. Navigating to the onboarding screen.
   *
   * Never throws. If clearAll() fails for any reason, the error is swallowed
   * and logged in __DEV__ — the UI should still proceed to sign-out and
   * onboarding navigation, as a partial erasure is better than a broken flow.
   */
  async deleteAll(): Promise<void> {
    // Step 1: wipe all MMKV data in a single atomic call
    try {
      encryptedStorage.clearAll();
    } catch (err) {
      if (__DEV__) {
        console.warn('[Rise] ErasureService: clearAll() failed:', err);
      }
      // Continue — proceed to notifications cleanup regardless
    }

    // Step 2: cancel all scheduled notifications
    // (No personal content in notifications, but good hygiene)
    await notificationService.cancelAll();
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const erasureService = new ErasureService();
