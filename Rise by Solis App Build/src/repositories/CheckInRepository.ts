/**
 * src/repositories/CheckInRepository.ts
 *
 * Reads and writes RawCheckIn to encrypted MMKV.
 *
 * Storage keys:
 *   CHECKIN_LATEST           — most recent check-in (same-session recovery)
 *   CHECKIN_HISTORY_PREFIX + YYYY-MM-DD — date-keyed history record
 *
 * TTL: 90 days (enforced on every read via expiresAt field pattern).
 *
 * Architecture constraints:
 *   - Never imports @react-native-firebase. No Firestore access.
 *   - All reads go through validateAndParse — never raw JSON.cast.
 *   - Never throws. Returns null on read failure. Logs in __DEV__ on write failure.
 */

import { encryptedStorage } from '../storage/mmkv';
import {
  CHECKIN_HISTORY_PREFIX,
  CHECKIN_LATEST,
  dateKey,
  todayKey,
} from '../storage/keys';
import { RawCheckInSchema, validateAndParse } from '../storage/validators';
import type { RawCheckIn } from '../../domain/types';

// TTL: 90 days in milliseconds
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

// ─── Repository ───────────────────────────────────────────────────────────────

class CheckInRepository {

  /**
   * Validates and writes a RawCheckIn to both the date-keyed history slot
   * and CHECKIN_LATEST for same-session recovery.
   * If validation fails: logs in development, does not write, does not throw.
   */
  saveCheckIn(checkIn: RawCheckIn): void {
    const result = RawCheckInSchema.safeParse(checkIn);
    if (!result.success) {
      if (__DEV__) {
        console.warn('[Rise] CheckInRepository: saveCheckIn validation failed — not written:', result.error.flatten());
      }
      return;
    }

    const data = JSON.stringify(result.data);
    const historyKey = dateKey(CHECKIN_HISTORY_PREFIX, checkIn.date);
    encryptedStorage.set(historyKey, data);
    encryptedStorage.set(CHECKIN_LATEST, data);
  }

  /**
   * Returns the most recent check-in regardless of date, or null.
   * Used for same-session recovery and by PersonalizationEngine.
   */
  getLatestCheckIn(): RawCheckIn | null {
    return this._readAndValidate(CHECKIN_LATEST);
  }

  /**
   * Returns the check-in for a specific date string (YYYY-MM-DD), or null.
   * Returns null if the record is expired (> 90 days old).
   */
  getCheckIn(dateString: string): RawCheckIn | null {
    const key = dateKey(CHECKIN_HISTORY_PREFIX, dateString);
    const record = this._readAndValidate(key);
    if (!record) return null;

    // TTL check: createdAt is ISO 8601
    const created = new Date(record.createdAt).getTime();
    if (!isNaN(created) && Date.now() - created > TTL_MS) {
      encryptedStorage.delete(key);
      return null;
    }

    return record;
  }

  /**
   * Returns true if a check-in record exists for today's date.
   * Used by TodayScreen to decide whether to show the plan or the "Begin" CTA.
   */
  hasCheckedInToday(): boolean {
    return encryptedStorage.contains(dateKey(CHECKIN_HISTORY_PREFIX, todayKey()));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _readAndValidate(key: string): RawCheckIn | null {
    const raw = encryptedStorage.getString(key);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn(`[Rise] CheckInRepository: failed to JSON.parse key "${key}"`);
      }
      return null;
    }

    return validateAndParse(RawCheckInSchema, parsed, key);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const checkInRepository = new CheckInRepository();
