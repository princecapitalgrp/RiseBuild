/**
 * src/engine/ExecutionTracker.ts
 *
 * Tracks block-level execution during an active morning session.
 * Instantiated once per session — not a singleton.
 *
 * Responsibilities:
 *   - Record when a block is started, completed, or skipped
 *   - Record session abandonment with timestamp
 *   - Assemble ExecutionRecord on session completion
 *   - Write ExecutionRecord to ExecutionRepository
 *
 * Architecture constraints:
 *   - Synchronous only. No async paths. Never throws.
 *   - Accumulates events in memory during the session.
 *   - ExecutionRecord is written once: on completeSession() or abandonSession().
 *   - blockEvents is append-only — startBlock / completeBlock / skipBlock never modify past entries.
 */

import { todayKey } from '../storage/keys';
import type {
  BlockExecutionEvent,
  BlockType,
  ExecutionEvent,
  ExecutionRecord,
  OperatingPlan,
} from '../../domain/types';

// ExecutionRepository is imported lazily to avoid circular deps at module init
import { executionRepository } from '../repositories/ExecutionRepository';

// ─── ExecutionTracker ─────────────────────────────────────────────────────────

export class ExecutionTracker {
  private readonly plan: OperatingPlan;
  private readonly intention: string | null;
  private readonly startedAt: string;

  private blockEvents: BlockExecutionEvent[] = [];
  private sessionEvents: ExecutionEvent[] = [];
  private abandoned = false;
  private abandonedAt: string | undefined;
  private completed = false;

  constructor(plan: OperatingPlan, intention: string | null) {
    this.plan = plan;
    this.intention = intention;
    this.startedAt = new Date().toISOString();

    // Record session start
    this.sessionEvents.push({
      eventType: 'session_started',
      timestamp: this.startedAt,
    });
  }

  // ── Block lifecycle ─────────────────────────────────────────────────────────

  startBlock(blockId: string): void {
    const block = this._findBlock(blockId);
    if (!block) return;

    this.blockEvents.push({
      blockId,
      blockType: block.blockType,
      event: 'started',
      timestamp: new Date().toISOString(),
    });

    this.sessionEvents.push({
      eventType: 'step_started',
      stepOrder: block.order,
      timestamp: new Date().toISOString(),
    });
  }

  completeBlock(blockId: string, durationActual?: number): void {
    const block = this._findBlock(blockId);
    if (!block) return;

    const now = new Date().toISOString();

    this.blockEvents.push({
      blockId,
      blockType: block.blockType,
      event: 'completed',
      timestamp: now,
      ...(durationActual !== undefined ? { durationActual } : {}),
    });

    this.sessionEvents.push({
      eventType: 'step_completed',
      stepOrder: block.order,
      timestamp: now,
      ...(durationActual !== undefined ? { durationMs: durationActual * 60 * 1000 } : {}),
    });
  }

  skipBlock(blockId: string): void {
    const block = this._findBlock(blockId);
    if (!block) return;

    const now = new Date().toISOString();

    this.blockEvents.push({
      blockId,
      blockType: block.blockType,
      event: 'skipped',
      timestamp: now,
    });

    this.sessionEvents.push({
      eventType: 'step_skipped',
      stepOrder: block.order,
      timestamp: now,
    });
  }

  // ── Session termination ─────────────────────────────────────────────────────

  /**
   * Marks session as abandoned. Writes partial record to ExecutionRepository.
   * TrustEvaluator will use sessionAbandonedAt to compute abandonmentRate.
   */
  abandonSession(): void {
    if (this.completed || this.abandoned) return;

    this.abandoned = true;
    this.abandonedAt = new Date().toISOString();

    this.sessionEvents.push({
      eventType: 'plan_abandoned',
      timestamp: this.abandonedAt,
    });

    const record = this._buildRecord(false);
    executionRepository.saveExecution(record);
  }

  /**
   * Marks session as complete. Writes full record to ExecutionRepository.
   * Returns the record so the reflection flow can reference it.
   */
  completeSession(): ExecutionRecord {
    if (this.abandoned) {
      // Return what we have — abandon already wrote; caller should not call this after abandon
      return this._buildRecord(false);
    }

    this.completed = true;

    this.sessionEvents.push({
      eventType: 'plan_completed',
      timestamp: new Date().toISOString(),
    });

    const record = this._buildRecord(true);
    executionRepository.saveExecution(record);
    return record;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  private _findBlock(blockId: string) {
    return this.plan.mainSequence.find(s => s.timeLabel === blockId || String(s.order) === blockId) ?? null;
  }

  private _buildRecord(sessionCompleted: boolean): ExecutionRecord {
    const completedIds = new Set(
      this.blockEvents.filter(e => e.event === 'completed').map(e => e.blockId)
    );
    const skippedIds = new Set(
      this.blockEvents.filter(e => e.event === 'skipped').map(e => e.blockId)
    );

    return {
      schemaVersion: '1.0',
      sessionType: 'morning',
      date: todayKey(),
      planId: this.plan.planId,
      morning_intention: this.intention,
      blocksCompleted: completedIds.size,
      blocksSkipped: skippedIds.size,
      totalBlocks: this.plan.mainSequence.length,
      sessionCompleted,
      ...(this.abandonedAt ? { sessionAbandonedAt: this.abandonedAt } : {}),
      events: [...this.sessionEvents],
      blockEvents: [...this.blockEvents],
    };
  }
}
