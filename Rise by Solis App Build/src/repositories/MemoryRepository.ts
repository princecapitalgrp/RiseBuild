/**
 * src/repositories/MemoryRepository.ts
 *
 * Reads and writes MemorySummary and TrustSignal to encrypted MMKV.
 *
 * Storage keys:
 *   MEMORY_SUMMARY  — single rolling MemorySummary document (no TTL — managed by MemoryEngine)
 *   TRUST_SIGNAL    — standalone TrustSignal (also embedded in MemorySummary.trustSignal)
 *
 * Architecture constraints:
 *   - Never imports @react-native-firebase. No Firestore access.
 *   - All reads go through validateAndParse — never raw JSON.cast.
 *   - Never throws. Returns null on read failure. Logs in __DEV__ on write failure.
 *   - TrustSignal is stored both standalone (TRUST_SIGNAL) and embedded
 *     in MemorySummary.trustSignal. saveTrustSignal() keeps both in sync.
 */

import { encryptedStorage } from '../storage/mmkv';
import { MEMORY_SUMMARY, TRUST_SIGNAL } from '../storage/keys';
import {
  MemorySummarySchema,
  TrustSignalSchema,
  validateAndParse,
} from '../storage/validators';
import type { MemorySummary, OnboardingProfile, TrustSignal } from '../../domain/types';

// ─── Default trust signal ─────────────────────────────────────────────────────

function defaultTrustSignal(): TrustSignal {
  return {
    schemaVersion: '1.0',
    computedAt: new Date().toISOString(),
    sampleSize: 0,
    accuracyTrend: 0.5,
    followThroughConsistency: 0.5,
    abandonmentRate: 0,
    correctionFrequency: 0.5,
    beginWillingness: 0.5,
    composite: 0.5,
    trend: 'STABLE',
  };
}

// ─── Repository ───────────────────────────────────────────────────────────────

class MemoryRepository {

  // ── MemorySummary ───────────────────────────────────────────────────────────

  /**
   * Returns the current MemorySummary, or null if it hasn't been initialized yet.
   */
  getMemorySummary(): MemorySummary | null {
    const raw = encryptedStorage.getString(MEMORY_SUMMARY);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn('[Rise] MemoryRepository: failed to JSON.parse MEMORY_SUMMARY');
      }
      return null;
    }

    return validateAndParse(MemorySummarySchema, parsed, MEMORY_SUMMARY);
  }

  /**
   * Validates and writes a MemorySummary.
   * If validation fails: logs in development, does not write, does not throw.
   */
  saveMemorySummary(summary: MemorySummary): void {
    const result = MemorySummarySchema.safeParse(summary);
    if (!result.success) {
      if (__DEV__) {
        console.warn('[Rise] MemoryRepository: saveMemorySummary validation failed:', result.error.flatten());
      }
      return;
    }
    encryptedStorage.set(MEMORY_SUMMARY, JSON.stringify(result.data));
  }

  /**
   * Creates a fresh MemorySummary for a new user.
   * Writes to MMKV immediately and returns the initialized summary.
   */
  initializeMemorySummary(profile: OnboardingProfile): MemorySummary {
    const now = new Date().toISOString();
    const summary: MemorySummary = {
      schemaVersion: '1.0',
      engineVersion: '1.0',
      uid: profile.uid,
      updatedAt: now,
      updateCount: 0,
      stabilizers:         [],
      derailers:           [],
      tractionBuilders:    [],
      selfTrustThreats:    [],
      reliableFirstMoves:  [],
      lowAccuracyPatterns:  [],
      highAccuracyPatterns: [],
      abandonmentPatterns:  [],
      averageFollowThrough:  0.5,
      averageExecutionDepth: 0.5,
      recentSessionCount:    0,
      trustSignal: defaultTrustSignal(),
    };
    this.saveMemorySummary(summary);
    return summary;
  }

  // ── TrustSignal ─────────────────────────────────────────────────────────────

  /**
   * Returns the standalone TrustSignal, or null if not yet computed.
   */
  getTrustSignal(): TrustSignal | null {
    const raw = encryptedStorage.getString(TRUST_SIGNAL);
    if (raw === undefined) return null;

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      if (__DEV__) {
        console.warn('[Rise] MemoryRepository: failed to JSON.parse TRUST_SIGNAL');
      }
      return null;
    }

    return validateAndParse(TrustSignalSchema, parsed, TRUST_SIGNAL);
  }

  /**
   * Saves TrustSignal to TRUST_SIGNAL key and syncs it into MemorySummary.trustSignal.
   */
  saveTrustSignal(signal: TrustSignal): void {
    const result = TrustSignalSchema.safeParse(signal);
    if (!result.success) {
      if (__DEV__) {
        console.warn('[Rise] MemoryRepository: saveTrustSignal validation failed:', result.error.flatten());
      }
      return;
    }

    encryptedStorage.set(TRUST_SIGNAL, JSON.stringify(result.data));

    // Sync into embedded MemorySummary.trustSignal
    const summary = this.getMemorySummary();
    if (summary) {
      this.saveMemorySummary({ ...summary, trustSignal: result.data });
    }
  }
}

// ─── Singleton export ─────────────────────────────────────────────────────────

export const memoryRepository = new MemoryRepository();
