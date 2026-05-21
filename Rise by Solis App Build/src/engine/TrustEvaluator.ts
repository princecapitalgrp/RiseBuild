/**
 * src/engine/TrustEvaluator.ts
 *
 * Computes TrustSignal after each session from five weighted components.
 *
 * Component signals (each 0–1):
 *   accuracyTrend:            rolling average of feltAccurate/5 over last 7 reflections
 *   followThroughConsistency: blocksCompleted / totalBlocks for current session
 *   abandonmentRate:          exponential moving average (α=0.2) — lower is better
 *   correctionFrequency:      followed=0.0, adapted=0.5, own_way=1.0 (rolling avg 7)
 *   beginWillingness:         time from plan generation to first block start
 *
 * Composite (weighted, 0–1):
 *   accuracyTrend          × 0.30
 *   followThroughConsistency × 0.25
 *   (1 - abandonmentRate)  × 0.20   ← inverted: lower abandonment = higher score
 *   (1 - correctionFreq)   × 0.15   ← inverted: lower correction = higher score
 *   beginWillingness       × 0.10
 *
 * TrustTrend:
 *   composite >= 0.7 → 'BUILDING'
 *   composite >= 0.4 → 'STABLE'
 *   composite <  0.4 → 'ERODING'
 *
 * Architecture constraints:
 *   - Pure function core. No React imports. No MMKV imports.
 *   - Reads ReflectionRepository for rolling averages (last 7 sessions).
 *   - Returns TrustSignal — caller (ReflectionView) writes it via MemoryRepository.
 */

import { reflectionRepository } from '../repositories/ReflectionRepository';
import type {
  ExecutionRecord,
  Reflection,
  TrustSignal,
  TrustTrend,
} from '../../domain/types';

// ─── Component calculations ───────────────────────────────────────────────────

/** Rolling average of feltAccurate / 5 over the last 7 sessions (including current). */
function computeAccuracyTrend(current: Reflection): number {
  const recent = reflectionRepository.getRecentReflections(7);
  // Include current session (not yet persisted at time of evaluation — inject manually)
  const all = [...recent.filter(r => r.date !== current.date), current];
  if (all.length === 0) return 0.5;
  const avg = all.reduce((sum, r) => sum + r.feltAccurate / 5, 0) / all.length;
  return Math.max(0, Math.min(1, avg));
}

/** blocksCompleted / totalBlocks for the current session. */
function computeFollowThrough(execution: ExecutionRecord): number {
  if (execution.totalBlocks === 0) return 0;
  return Math.max(0, Math.min(1, execution.blocksCompleted / execution.totalBlocks));
}

/**
 * Exponential moving average abandonmentRate (α=0.2).
 * If abandoned: new = old * 0.8 + 1 * 0.2
 * If completed: new = old * 0.8 + 0 * 0.2
 */
function computeAbandonmentRate(
  execution: ExecutionRecord,
  currentTrust: TrustSignal | null,
): number {
  const prev = currentTrust?.abandonmentRate ?? 0;
  const signal = execution.sessionAbandonedAt ? 1 : 0;
  return prev * 0.8 + signal * 0.2;
}

/**
 * Rolling average of correction frequency over last 7 sessions.
 * followed = 0.0, adapted = 0.5, own_way = 1.0
 */
function computeCorrectionFrequency(current: Reflection): number {
  const recent = reflectionRepository.getRecentReflections(7);
  const all = [...recent.filter(r => r.date !== current.date), current];
  if (all.length === 0) return 0.5;

  const correctionValues: Record<string, number> = {
    followed: 0.0,
    adapted:  0.5,
    own_way:  1.0,
  };

  const avg = all.reduce((sum, r) => sum + (correctionValues[r.followedSequence] ?? 0.5), 0) / all.length;
  return Math.max(0, Math.min(1, avg));
}

/**
 * Begin willingness: how quickly did the user start the first block after plan generation?
 * Uses blockEvents[first started] vs plan generatedAt timestamp from execution planId context.
 *
 * Approximation: we compare the first 'started' event timestamp against session start.
 * 1.0 if started within 5 minutes, 0.5 if within 15 minutes, 0.0 if never started.
 */
function computeBeginWillingness(execution: ExecutionRecord): number {
  const firstStart = execution.blockEvents.find(e => e.event === 'started');
  if (!firstStart) return 0.0;

  // Use first session_started event as reference
  const sessionStartEvent = execution.events.find(e => e.eventType === 'session_started');
  if (!sessionStartEvent) return 0.5;

  const startMs = new Date(sessionStartEvent.timestamp).getTime();
  const firstBlockMs = new Date(firstStart.timestamp).getTime();
  const delayMinutes = (firstBlockMs - startMs) / 60000;

  if (delayMinutes <= 5)  return 1.0;
  if (delayMinutes <= 15) return 0.5;
  return 0.25;
}

// ─── Trend classification ─────────────────────────────────────────────────────

function classifyTrend(composite: number): TrustTrend {
  if (composite >= 0.7) return 'BUILDING';
  if (composite >= 0.4) return 'STABLE';
  return 'ERODING';
}

// ─── Public interface ─────────────────────────────────────────────────────────

export const trustEvaluator = {
  /**
   * Computes a new TrustSignal from the current session's reflection and execution record.
   * Uses currentTrust for the running abandonmentRate EMA seed.
   * Returns the new TrustSignal — caller writes it via MemoryRepository.saveTrustSignal().
   */
  evaluate(
    reflection: Reflection,
    execution: ExecutionRecord,
    currentTrust: TrustSignal | null,
  ): TrustSignal {
    const accuracyTrend            = computeAccuracyTrend(reflection);
    const followThroughConsistency = computeFollowThrough(execution);
    const abandonmentRate          = computeAbandonmentRate(execution, currentTrust);
    const correctionFrequency      = computeCorrectionFrequency(reflection);
    const beginWillingness         = computeBeginWillingness(execution);

    // Weighted composite
    // accuracyTrend × 0.30  + followThrough × 0.25 + (1 - abandonment) × 0.20
    // + (1 - correction) × 0.15 + beginWillingness × 0.10
    const composite =
      accuracyTrend            * 0.30 +
      followThroughConsistency * 0.25 +
      (1 - abandonmentRate)    * 0.20 +
      (1 - correctionFrequency)* 0.15 +
      beginWillingness         * 0.10;

    const clampedComposite = Math.max(0, Math.min(1, composite));

    return {
      schemaVersion: '1.0',
      computedAt: new Date().toISOString(),
      sampleSize: (currentTrust?.sampleSize ?? 0) + 1,
      accuracyTrend,
      followThroughConsistency,
      abandonmentRate,
      correctionFrequency,
      beginWillingness,
      composite: clampedComposite,
      trend: classifyTrend(clampedComposite),
    };
  },
};
