/**
 * src/engine/MetricsEngine.ts
 *
 * Small on-device metrics engine for the personalization loop.
 * Persists only the rolling sequence of OperatingMode enum values.
 */

import type { OperatingMode } from '../../domain/types';
import { encryptedStorage } from '../storage/mmkv';
import { METRICS_MODE_LOG } from '../storage/keys';
import { MetricsModeLogSchema, validateAndParse } from '../storage/validators';

export type ModeShift = 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA';

const MAX_MODE_LOG_ENTRIES = 30;
const MIN_MODE_SHIFT_ENTRIES = 4;
const MODE_SHIFT_THRESHOLD = 0.5;

const OPERATING_MODES: OperatingMode[] = [
  'RECOVERY',
  'FOCUS_REBUILD',
  'STEADY_EXECUTION',
  'HIGH_STAKES_DAY',
  'OVERWHELM_CONTAINMENT',
];

const MODE_STRAIN_SCORE: Record<OperatingMode, number> = {
  STEADY_EXECUTION: 0,
  HIGH_STAKES_DAY: 0,
  FOCUS_REBUILD: 1,
  RECOVERY: 2,
  OVERWHELM_CONTAINMENT: 3,
};

function emptyDistribution(): Record<OperatingMode, number> {
  return {
    RECOVERY: 0,
    FOCUS_REBUILD: 0,
    STEADY_EXECUTION: 0,
    HIGH_STAKES_DAY: 0,
    OVERWHELM_CONTAINMENT: 0,
  };
}

function isOperatingMode(value: unknown): value is OperatingMode {
  return typeof value === 'string' && OPERATING_MODES.includes(value as OperatingMode);
}

function readModeLog(): OperatingMode[] {
  const raw = encryptedStorage.getString(METRICS_MODE_LOG);
  if (raw === undefined) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    if (__DEV__) {
      console.warn(`[Rise] MetricsEngine: failed to JSON.parse key "${METRICS_MODE_LOG}"`);
    }
    return [];
  }

  return validateAndParse(MetricsModeLogSchema, parsed, METRICS_MODE_LOG) ?? [];
}

function writeModeLog(log: OperatingMode[]): void {
  encryptedStorage.set(METRICS_MODE_LOG, JSON.stringify(log));
}

function averageStrainScore(log: OperatingMode[]): number {
  if (log.length === 0) return 0;

  const total = log.reduce((sum, mode) => sum + MODE_STRAIN_SCORE[mode], 0);
  return total / log.length;
}

export function recordSession(mode: OperatingMode): void {
  if (!isOperatingMode(mode)) return;

  const existingLog = readModeLog();
  const nextLog = [...existingLog, mode].slice(-MAX_MODE_LOG_ENTRIES);
  writeModeLog(nextLog);
}

export function getDistribution(): Record<OperatingMode, number> {
  const distribution = emptyDistribution();

  for (const mode of readModeLog()) {
    distribution[mode] += 1;
  }

  return distribution;
}

export function getModeShift(): ModeShift {
  const log = readModeLog();
  if (log.length < MIN_MODE_SHIFT_ENTRIES) return 'INSUFFICIENT_DATA';

  const splitIndex = Math.floor(log.length / 2);
  const earlier = log.slice(0, splitIndex);
  const recent = log.slice(splitIndex);
  const delta = averageStrainScore(recent) - averageStrainScore(earlier);

  if (delta <= -MODE_SHIFT_THRESHOLD) return 'IMPROVING';
  if (delta >= MODE_SHIFT_THRESHOLD) return 'DECLINING';
  return 'STABLE';
}
