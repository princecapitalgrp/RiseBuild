/**
 * src/repositories/ReflectionRepository.ts
 *
 * Reads and writes Reflection to encrypted MMKV.
 *
 * Storage keys:
 *   REFLECTION_PREFIX + YYYY-MM-DD — date-keyed record
 *
 * TTL: 1 year (enforced on every read via createdAt field).
 *
 * Architecture constraints:
 *   - Never imports @react-native-firebase. No Firestore access.
 *   - Raw user text fields (helpedMost, gotInWay, note) are never sent anywhere.
 *   - All reads go through validateAndParse — never raw JSON.cast.
 *   - Never throws. Returns null on read failure. Logs in __DEV__ on write failure.
 */

import { encryptedStorage } from '../storage/mmkv';
import {
  REFLECTION_PREFIX,
  dateKey,
  todayKey,
} from '../storage/keys';
import { ReflectionSchema, validateAndParse } from '../storage/validators';
import type { Reflection } from '../../domain/types';

// TTL: 1 year in milliseconds
const TTL_MS = 365 * 24 * 60 * 60 * 1000;

// ─── Repository ───────────────────────────────────────────────────────────────

class ReflectionRepository {

  /**
   * Validates and writes a Reflection to the date-keyed slot.
   * If validation fails: logs in development, does not write, does not throw.
   */
  saveReflection(reflection: Reflection): void {
    const result = ReflectionSchema.safeParse(reflection);
    if (!result.success) {
      if (__DEV__) {
        console.warn('[Rise] ReflectionRepository: saveReflection validation failed — not written:', result.error.flatten());
      }
      return;
    }

    const data = JSON.stringify(result.data);
    const key = dateKey(REFLECTION_PREFIX, reflection.date);
    encryptedStorage.set(key, data);
  }

  /**
   * Returns the reflection for a specific date string (YYYY-MM-DD), or null.
   * Returns null if expired (> 1 year old).
   */
  getReflection(dateString: string): Reflection | null {
    const key = dateKey(REFLECTION_PREFIX, dateString);
    const record = this._readAndValidate(key);
    if (!record) return null;

    const created = new Date(record.createdAt).getTime();
    if (!isNaN(created) && Date.now() - created > TTL_MS) {
      encryptedStorage.delete(key);
      return null;
    }

    return record;
  }

  /**
   * Returns reflections for the last N days, oldest first.
   * Skips missing dates silently.
   *
   * @param days — number of calendar days to look back (including today)
   */
  getRecentReflections(days: number): Reflection[] {
    const results: Reflection[] = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year  = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day   = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      const record = this.getReflection(dateString);
      if (record) results.push(record);
    }

    return results;
  }

  /**
   * Returns true if a reflection exists for today.
   */
  hasReflectionToday(): boolean {
    return encryptedStorage.contains(dateKey(REFLECTION_PREFIX, todayKey()));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _readAndValidate(key: string): Reflection | null {
    const raw = encryptedStorage.getString(key);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn(`[Rise] ReflectionRepository: failed to JSON.parse key "${key}"`);
      }
      return null;
    }

    return validateAndParse(ReflectionSchema, parsed, key);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const reflectionRepository = new ReflectionRepository();
