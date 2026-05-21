/**
 * src/repositories/ExecutionRepository.ts
 *
 * Reads and writes ExecutionRecord to encrypted MMKV.
 *
 * Storage keys:
 *   EXECUTION_LATEST                          — most recent record (same-session access)
 *   EXECUTION_HISTORY_PREFIX + YYYY-MM-DD     — date-keyed history
 *
 * TTL: 1 year (enforced on every read via date field).
 *
 * Architecture constraints:
 *   - Never imports @react-native-firebase. No Firestore access.
 *   - All reads go through validateAndParse — never raw JSON.cast.
 *   - Never throws. Returns null on read failure. Logs in __DEV__ on write failure.
 */

import { encryptedStorage } from '../storage/mmkv';
import {
  EXECUTION_HISTORY_PREFIX,
  EXECUTION_LATEST,
  dateKey,
  todayKey,
} from '../storage/keys';
import { ExecutionRecordSchema, validateAndParse } from '../storage/validators';
import type { ExecutionRecord } from '../../domain/types';

// TTL: 1 year in milliseconds
const TTL_MS = 365 * 24 * 60 * 60 * 1000;

// ─── Repository ───────────────────────────────────────────────────────────────

class ExecutionRepository {

  /**
   * Validates and writes an ExecutionRecord to both the date-keyed history slot
   * and EXECUTION_LATEST.
   * If validation fails: logs in development, does not write, does not throw.
   */
  saveExecution(record: ExecutionRecord): void {
    const result = ExecutionRecordSchema.safeParse(record);
    if (!result.success) {
      if (__DEV__) {
        console.warn('[Rise] ExecutionRepository: saveExecution validation failed — not written:', result.error.flatten());
      }
      return;
    }

    const data = JSON.stringify(result.data);
    const historyKey = dateKey(EXECUTION_HISTORY_PREFIX, record.date);
    encryptedStorage.set(historyKey, data);
    encryptedStorage.set(EXECUTION_LATEST, data);
  }

  /**
   * Returns the most recent execution record regardless of date, or null.
   */
  getLatestExecution(): ExecutionRecord | null {
    return this._readAndValidate(EXECUTION_LATEST);
  }

  /**
   * Returns the execution record for a specific date string (YYYY-MM-DD), or null.
   * Returns null if the record is expired (> 1 year old).
   */
  getExecution(dateString: string): ExecutionRecord | null {
    const key = dateKey(EXECUTION_HISTORY_PREFIX, dateString);
    const record = this._readAndValidate(key);
    if (!record) return null;

    // TTL check via date field (date is YYYY-MM-DD — parse as start of day)
    const recorded = new Date(record.date + 'T00:00:00').getTime();
    if (!isNaN(recorded) && Date.now() - recorded > TTL_MS) {
      encryptedStorage.delete(key);
      return null;
    }

    return record;
  }

  /**
   * Returns true if an execution record exists for today.
   */
  hasExecutionToday(): boolean {
    return encryptedStorage.contains(dateKey(EXECUTION_HISTORY_PREFIX, todayKey()));
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _readAndValidate(key: string): ExecutionRecord | null {
    const raw = encryptedStorage.getString(key);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn(`[Rise] ExecutionRepository: failed to JSON.parse key "${key}"`);
      }
      return null;
    }

    return validateAndParse(ExecutionRecordSchema, parsed, key);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const executionRepository = new ExecutionRepository();
