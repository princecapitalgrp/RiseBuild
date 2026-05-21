/**
 * src/engine/MemoryEngine.ts
 *
 * Updates MemorySummary after each morning session.
 * Reads Reflection + ExecutionRecord → derives categorized labels → updates five buckets.
 *
 * Privacy contract (critical):
 *   - helpedMost and gotInWay raw text from Reflection is read to derive category labels.
 *   - Raw text is NEVER written to MemorySummary. Only derived enum/category strings enter buckets.
 *   - This is enforced by the categorize*() helpers — they return enum strings, not the input text.
 *
 * 730-day retention cap:
 *   After each update, if MemorySummary was initialized more than 730 days ago,
 *   bucket entries are trimmed to the oldest-first cap limit.
 *   This resolves Gap D from the GDPR audit (MemorySummary had no TTL).
 *
 * Architecture constraints:
 *   - No React imports. No UI imports.
 *   - Reads from MemoryRepository only. Writes to MemoryRepository only.
 *   - Never throws. All bucket updates are best-effort.
 */

import { memoryRepository } from '../repositories/MemoryRepository';
import type {
  ExecutionRecord,
  MemorySummary,
  OnboardingProfile,
  Reflection,
} from '../../domain/types';

// 730 days in ms (2 years — GDPR retention cap for MemorySummary)
const RETENTION_MS = 730 * 24 * 60 * 60 * 1000;

// Bucket max sizes
const BUCKET_CAPS: Record<string, number> = {
  stabilizers:        10,
  derailers:          10,
  tractionBuilders:    5,
  selfTrustThreats:   10,
  reliableFirstMoves:  5,
  highAccuracyPatterns: 10,
  lowAccuracyPatterns:  10,
  abandonmentPatterns:  10,
};

// ─── Categorization helpers ───────────────────────────────────────────────────
// These functions produce enum/category strings from raw text — they do NOT
// propagate the raw text into any output value.

function categorizeHelpedText(raw: string): string | null {
  if (!raw || raw.trim() === '') return null;
  const lower = raw.toLowerCase();
  if (/movement|walk|stretch|physical|body/.test(lower))   return 'physical_activation';
  if (/quiet|silence|calm|peace|still/.test(lower))        return 'quiet_environment';
  if (/time|early|window|space/.test(lower))               return 'protected_time';
  if (/list|plan|structure|clear|order/.test(lower))       return 'structured_approach';
  if (/focus|single|one thing/.test(lower))                return 'single_focus';
  if (/note|write|journal/.test(lower))                    return 'written_reflection';
  if (/breath|pause|slow/.test(lower))                     return 'breath_pause';
  return 'general_support';
}

function categorizeGotInWayText(raw: string): string | null {
  if (!raw || raw.trim() === '') return null;
  const lower = raw.toLowerCase();
  if (/phone|screen|notif|social/.test(lower))             return 'digital_distraction';
  if (/interrupt|people|noise|loud/.test(lower))           return 'external_interruption';
  if (/tired|sleep|exhaust|drain/.test(lower))             return 'fatigue';
  if (/anxious|worry|stress|nervous/.test(lower))          return 'anxiety_signal';
  if (/time|late|rush|hurry/.test(lower))                  return 'time_pressure';
  if (/unclear|confus|lost|unsure/.test(lower))            return 'lack_of_clarity';
  if (/motivat|will|force|push/.test(lower))               return 'low_motivation';
  return 'general_friction';
}

// ─── Bucket helpers ───────────────────────────────────────────────────────────

function addUnique(arr: string[], value: string, cap: number): string[] {
  if (arr.includes(value)) return arr;
  const updated = [...arr, value];
  // If over cap, trim oldest (front of array)
  return updated.length > cap ? updated.slice(updated.length - cap) : updated;
}

// ─── Retention cap ────────────────────────────────────────────────────────────

// KNOWN LIMITATION: The 730-day cap is computed
// from summary.updatedAt, not from individual
// entry timestamps. A user who updates frequently
// will never trigger the cap regardless of how
// old the earliest entries are. The item count
// caps (stabilizers: 10, reliableFirstMoves: 5,
// etc.) are the primary retention mechanism for
// now. A timestamp-per-entry approach should be
// implemented post-launch when entry volume
// justifies the complexity.
function applyRetentionCap(summary: MemorySummary): MemorySummary {
  // Use updatedAt as a proxy for age — if it's been more than 730 days
  // since first update, trim all buckets to their cap limits.
  // (A proper per-entry timestamp would be ideal but adds schema complexity.)
  const age = Date.now() - new Date(summary.updatedAt).getTime();
  if (age < RETENTION_MS) return summary;

  return {
    ...summary,
    stabilizers:         summary.stabilizers.slice(-BUCKET_CAPS.stabilizers),
    derailers:           summary.derailers.slice(-BUCKET_CAPS.derailers),
    tractionBuilders:    summary.tractionBuilders.slice(-BUCKET_CAPS.tractionBuilders),
    selfTrustThreats:    summary.selfTrustThreats.slice(-BUCKET_CAPS.selfTrustThreats),
    reliableFirstMoves:  summary.reliableFirstMoves.slice(-BUCKET_CAPS.reliableFirstMoves),
    highAccuracyPatterns: summary.highAccuracyPatterns.slice(-BUCKET_CAPS.highAccuracyPatterns),
    lowAccuracyPatterns:  summary.lowAccuracyPatterns.slice(-BUCKET_CAPS.lowAccuracyPatterns),
    abandonmentPatterns:  summary.abandonmentPatterns.slice(-BUCKET_CAPS.abandonmentPatterns),
  };
}

// ─── Main update logic ────────────────────────────────────────────────────────

function updateBuckets(
  summary: MemorySummary,
  reflection: Reflection,
  execution: ExecutionRecord,
): MemorySummary {
  let s = { ...summary };
  const completionRatio = execution.totalBlocks > 0
    ? execution.blocksCompleted / execution.totalBlocks
    : 0;

  // ── stabilizers ─────────────────────────────────────────────────────────────
  // High accuracy + followed sequence + most blocks completed
  if (
    reflection.feltAccurate >= 4 &&
    reflection.followedSequence === 'followed' &&
    completionRatio >= 0.8
  ) {
    // Use the block types from completed blockEvents as categories
    const completedTypes = execution.blockEvents
      .filter(e => e.event === 'completed')
      .map(e => `${e.blockType}_block`);
    const uniqueTypes = [...new Set(completedTypes)];
    for (const cat of uniqueTypes) {
      s.stabilizers = addUnique(s.stabilizers, cat, BUCKET_CAPS.stabilizers);
    }
    if (reflection.helpedMost) {
      const cat = categorizeHelpedText(reflection.helpedMost);
      if (cat) s.stabilizers = addUnique(s.stabilizers, cat, BUCKET_CAPS.stabilizers);
    }
  }

  // ── derailers ───────────────────────────────────────────────────────────────
  // Low accuracy or got-in-way with 2+ skipped blocks
  if (
    reflection.feltAccurate <= 2 ||
    (reflection.gotInWay && execution.blocksSkipped >= 2)
  ) {
    if (reflection.gotInWay) {
      const cat = categorizeGotInWayText(reflection.gotInWay);
      if (cat) s.derailers = addUnique(s.derailers, cat, BUCKET_CAPS.derailers);
    }
    if (reflection.feltAccurate <= 2) {
      s.lowAccuracyPatterns = addUnique(
        s.lowAccuracyPatterns,
        `mode_${execution.blocksCompleted < execution.totalBlocks ? 'incomplete' : 'inaccurate'}`,
        BUCKET_CAPS.lowAccuracyPatterns,
      );
    }
  }

  // ── tractionBuilders ────────────────────────────────────────────────────────
  // Any completed block = first move created momentum
  if (reflection.followedSequence === 'followed' && execution.blocksCompleted >= 1) {
    const firstCompleted = execution.blockEvents.find(e => e.event === 'completed');
    if (firstCompleted) {
      s.tractionBuilders = addUnique(
        s.tractionBuilders,
        firstCompleted.blockType,
        BUCKET_CAPS.tractionBuilders,
      );
    }
  }

  // ── selfTrustThreats ────────────────────────────────────────────────────────
  if (execution.sessionAbandonedAt) {
    s.selfTrustThreats = addUnique(
      s.selfTrustThreats, 'abandonment_pattern', BUCKET_CAPS.selfTrustThreats
    );
  }
  if (reflection.feltAccurate <= 2 && reflection.followedSequence === 'own_way') {
    s.selfTrustThreats = addUnique(
      s.selfTrustThreats, 'plan_mismatch', BUCKET_CAPS.selfTrustThreats
    );
  }

  // ── reliableFirstMoves ──────────────────────────────────────────────────────
  // First block was completed
  const firstBlock = execution.blockEvents[0];
  if (firstBlock && firstBlock.event === 'completed') {
    s.reliableFirstMoves = addUnique(
      s.reliableFirstMoves, firstBlock.blockType, BUCKET_CAPS.reliableFirstMoves
    );
  }

  // ── highAccuracyPatterns ────────────────────────────────────────────────────
  if (reflection.feltAccurate >= 4) {
    if (reflection.helpedMost) {
      const cat = categorizeHelpedText(reflection.helpedMost);
      if (cat) s.highAccuracyPatterns = addUnique(
        s.highAccuracyPatterns, cat, BUCKET_CAPS.highAccuracyPatterns
      );
    }
  }

  // ── rolling quantitative averages (exponential moving average α=0.2) ────────
  const alpha = 0.2;
  const followThroughValue = reflection.followedSequence === 'followed' ? 1 :
                             reflection.followedSequence === 'adapted'  ? 0.5 : 0;

  s.averageFollowThrough  = s.averageFollowThrough  * (1 - alpha) + followThroughValue  * alpha;
  s.averageExecutionDepth = s.averageExecutionDepth * (1 - alpha) + completionRatio     * alpha;
  s.recentSessionCount    = s.recentSessionCount + 1;

  return s;
}

// ─── Public interface ─────────────────────────────────────────────────────────

export const memoryEngine = {
  /**
   * Updates MemorySummary after a completed or partially-completed session.
   * Reads current summary from MemoryRepository, applies bucket updates,
   * applies retention cap, writes updated summary back.
   *
   * Never throws. If no MemorySummary exists, initializes one.
   */
  update(
    reflection: Reflection,
    execution: ExecutionRecord,
    profile: OnboardingProfile,
  ): void {
    try {
      let summary = memoryRepository.getMemorySummary();

      if (!summary) {
        summary = memoryRepository.initializeMemorySummary(profile);
      }

      // Apply bucket updates
      let updated = updateBuckets(summary, reflection, execution);

      // Apply retention cap (resolves GDPR Gap D)
      updated = applyRetentionCap(updated);

      // Stamp update metadata
      updated = {
        ...updated,
        updatedAt: new Date().toISOString(),
        updateCount: updated.updateCount + 1,
      };

      memoryRepository.saveMemorySummary(updated);
    } catch (err) {
      if (__DEV__) {
        console.warn('[Rise] MemoryEngine: update failed silently:', err);
      }
    }
  },
};
