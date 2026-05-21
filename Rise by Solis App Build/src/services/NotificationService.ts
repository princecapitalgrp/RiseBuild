/**
 * src/services/NotificationService.ts
 *
 * Morning wake and adaptive reset notifications via Expo Notifications.
 *
 * MANUAL INSTALL REQUIRED before this service is functional:
 *   npx expo install expo-notifications
 *   Then add to app.json plugins:
 *   { "plugins": ["expo-notifications"] }
 *
 * Until the package is installed, all methods return safe defaults and
 * log warnings in __DEV__. The runtime check (_getNotifications) prevents crashes.
 *
 * Privacy:
 *   - Morning notification body is intentionally empty — no personal content
 *     visible on lock screen. Only the title "Your morning is ready." is shown.
 *     This is a deliberate privacy choice: the lock screen is a shared surface.
 *   - intentionText passed to scheduleAdaptiveReset is NEVER used in notification
 *     content. It is accepted only to maintain API symmetry; it is discarded.
 *
 * Notification identifiers:
 *   'solis.morning.wake'   — daily repeating, cancelled and rescheduled on wake time change
 *   'solis.adaptive.reset' — one-time, cancelled by cancelAdaptiveReset()
 */

import { encryptedStorage } from '../storage/mmkv';
import { NOTIFICATION_PERMISSION } from '../storage/keys';

// ─── Minimal types mirroring expo-notifications API ───────────────────────────
// Allows TypeScript to compile cleanly before the package is installed.
// Remove these and import from 'expo-notifications' once installed.

interface NotificationPermissionResponse {
  granted: boolean;
}

interface ScheduledNotificationTrigger {
  hour?: number;
  minute?: number;
  repeats?: boolean;
  seconds?: number;
  type?: string;
}

// ─── Runtime package loader ───────────────────────────────────────────────────

function _getNotifications(): {
  requestPermissionsAsync: () => Promise<NotificationPermissionResponse>;
  scheduleNotificationAsync: (opts: {
    identifier?: string;
    content: { title: string; body: string; sound?: boolean };
    trigger: ScheduledNotificationTrigger | null;
  }) => Promise<string>;
  cancelScheduledNotificationAsync: (id: string) => Promise<void>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  AndroidImportance?: Record<string, number>;
  setNotificationChannelAsync?: (id: string, opts: unknown) => Promise<void>;
} | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-notifications');
  } catch {
    return null;
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

class NotificationService {

  /**
   * Request notification permissions from the OS.
   * Stores the granted/denied state in MMKV (NOTIFICATION_PERMISSION key).
   * Returns true if granted.
   */
  async requestPermissions(): Promise<boolean> {
    const Notifications = _getNotifications();
    if (!Notifications) {
      if (__DEV__) console.warn('[Rise] NotificationService: expo-notifications not installed');
      return false;
    }

    try {
      const { granted } = await Notifications.requestPermissionsAsync();
      encryptedStorage.set(NOTIFICATION_PERMISSION, granted);
      return granted;
    } catch (err) {
      if (__DEV__) console.warn('[Rise] NotificationService: requestPermissions failed:', err);
      return false;
    }
  }

  /**
   * Returns the stored notification permission state, or false if unknown.
   * Synchronous — safe to call in render context.
   */
  getStoredPermissionState(): boolean {
    return encryptedStorage.getBoolean(NOTIFICATION_PERMISSION) ?? false;
  }

  /**
   * Schedules a daily repeating morning wake notification.
   * Cancels any previously scheduled morning notification before scheduling the new one.
   *
   * Title: "Your morning is ready."
   * Body: "" (empty — no personal content visible on lock screen)
   *
   * @param wakeTarget — HH:MM string from OnboardingProfile.wakeTarget
   */
  async scheduleMorningNotification(wakeTarget: string): Promise<void> {
    const Notifications = _getNotifications();
    if (!Notifications) return;

    const [hourStr, minuteStr] = wakeTarget.split(':');
    const hour   = parseInt(hourStr,   10);
    const minute = parseInt(minuteStr, 10);

    if (isNaN(hour) || isNaN(minute)) {
      if (__DEV__) console.warn('[Rise] NotificationService: invalid wakeTarget format:', wakeTarget);
      return;
    }

    // Cancel existing morning notification before rescheduling
    await this._cancelIdentifier('solis.morning.wake');

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'solis.morning.wake',
        content: {
          title: 'Your morning is ready.',
          body:  '',  // intentionally empty — no content on lock screen
          sound: false,
        },
        trigger: {
          hour,
          minute,
          repeats: true,
        },
      });
    } catch (err) {
      if (__DEV__) console.warn('[Rise] NotificationService: scheduleMorningNotification failed:', err);
    }
  }

  /**
   * Schedules a one-time adaptive reset notification.
   *
   * Title: "Life happened."
   * Body: "We've adjusted. Start with 5 minutes of ease."
   *
   * intentionText is accepted for API symmetry but is NEVER used in notification content.
   *
   * @param minutesFromNow — delay before notification fires
   * @param intentionText  — discarded; never referenced in notification body
   */
  async scheduleAdaptiveReset(minutesFromNow: number, intentionText: string | null): Promise<void> {
    void intentionText; // explicitly discarded — never used in notification content

    const Notifications = _getNotifications();
    if (!Notifications) return;

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'solis.adaptive.reset',
        content: {
          title: 'Life happened.',
          body:  "We've adjusted. Start with 5 minutes of ease.",
          sound: false,
        },
        trigger: {
          seconds: minutesFromNow * 60,
          type: 'timeInterval',
        },
      });
    } catch (err) {
      if (__DEV__) console.warn('[Rise] NotificationService: scheduleAdaptiveReset failed:', err);
    }
  }

  /**
   * Cancels the adaptive reset notification if scheduled.
   */
  async cancelAdaptiveReset(): Promise<void> {
    await this._cancelIdentifier('solis.adaptive.reset');
  }

  /**
   * Cancels all scheduled notifications.
   * Called by ErasureService on account deletion.
   */
  async cancelAll(): Promise<void> {
    const Notifications = _getNotifications();
    if (!Notifications) return;

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (err) {
      if (__DEV__) console.warn('[Rise] NotificationService: cancelAll failed:', err);
    }
  }

  // ── Private ─────────────────────────────────────────────────────────────────

  private async _cancelIdentifier(id: string): Promise<void> {
    const Notifications = _getNotifications();
    if (!Notifications) return;

    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // Safe to ignore — notification may not have been scheduled
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const notificationService = new NotificationService();
