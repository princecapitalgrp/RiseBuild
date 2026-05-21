/**
 * src/repositories/PlanRepository.ts
 *
 * Reads and writes OperatingPlan to encrypted MMKV.
 *
 * Storage keys:
 *   PLAN_LATEST           — most recent plan (same-session recovery)
 *   PLAN_HISTORY_PREFIX + YYYY-MM-DD — date-keyed history record
 *
 * TTL: 1 year (enforced on every read via createdAt field pattern).
 *
 * Architecture constraints:
 *   - Never imports @react-native-firebase. No Firestore access.
 *   - All reads go through validateAndParse — never raw JSON.cast.
 *   - Never throws. Returns null on read failure. Logs in __DEV__ on write failure.
 */

import { encryptedStorage } from '../storage/mmkv';
import {
  PLAN_HISTORY_PREFIX,
  PLAN_LATEST,
  dateKey,
  todayKey,
} from '../storage/keys';
import { OperatingPlanSchema, validateAndParse } from '../storage/validators';
import type { OperatingPlan } from '../../domain/types';

// TTL: 1 year in milliseconds
const TTL_MS = 365 * 24 * 60 * 60 * 1000;

// ─── Repository ───────────────────────────────────────────────────────────────

class PlanRepository {

  /**
   * Validates and writes an OperatingPlan to both the date-keyed history slot
   * and PLAN_LATEST for same-session recovery.
   * If validation fails: logs in development, does not write, does not throw.
   */
  savePlan(plan: OperatingPlan): void {
    const result = OperatingPlanSchema.safeParse(plan);
    if (!result.success) {
      if (__DEV__) {
        console.warn('[Rise] PlanRepository: savePlan validation failed — not written:', result.error.flatten());
      }
      return;
    }

    const data = JSON.stringify(result.data);
    const historyKey = dateKey(PLAN_HISTORY_PREFIX, plan.date);
    encryptedStorage.set(historyKey, data);
    encryptedStorage.set(PLAN_LATEST, data);
  }

  /**
   * Returns the most recent plan regardless of date, or null.
   * Used for same-session recovery and by today screen.
   */
  getLatestPlan(): OperatingPlan | null {
    return this._readAndValidate(PLAN_LATEST);
  }

  /**
   * Returns the plan for a specific date string (YYYY-MM-DD), or null.
   * Returns null if the record is expired (> 1 year old).
   */
  getPlan(dateString: string): OperatingPlan | null {
    const key = dateKey(PLAN_HISTORY_PREFIX, dateString);
    const record = this._readAndValidate(key);
    if (!record) return null;

    // TTL check: generatedAt is ISO 8601
    const generated = new Date(record.generatedAt).getTime();
    if (!isNaN(generated) && Date.now() - generated > TTL_MS) {
      encryptedStorage.delete(key);
      return null;
    }

    return record;
  }

  /**
   * Returns plans for the last N days, newest first.
   * Skips missing dates silently. Used by HistoryView.
   */
  getPlanHistory(days: number): OperatingPlan[] {
    const results: OperatingPlan[] = [];
    const now = new Date();

    for (let i = 0; i < days; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const year  = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day   = String(d.getDate()).padStart(2, '0');
      const dateString = `${year}-${month}-${day}`;

      const plan = this.getPlan(dateString);
      if (plan) results.push(plan);
    }

    return results; // newest first (i=0 is today)
  }

  /**
   * Returns true if a plan exists for today's date.
   * Used by TodayScreen to decide whether to show the plan or the "Begin" CTA.
   */
  hasPlanForToday(): boolean {
    return encryptedStorage.contains(dateKey(PLAN_HISTORY_PREFIX, todayKey()));
  }

  /**
   * Returns the plan for today's date, or null.
   * Convenience wrapper used by TodayScreen.
   */
  getTodayPlan(): OperatingPlan | null {
    return this.getPlan(todayKey());
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _readAndValidate(key: string): OperatingPlan | null {
    const raw = encryptedStorage.getString(key);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn(`[Rise] PlanRepository: failed to JSON.parse key "${key}"`);
      }
      return null;
    }

    return validateAndParse(OperatingPlanSchema, parsed, key);
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const planRepository = new PlanRepository();
