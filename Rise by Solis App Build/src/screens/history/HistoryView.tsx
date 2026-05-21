/**
 * src/screens/history/HistoryView.tsx
 *
 * Read-only view of past morning sessions. MMKV only — no Firestore reads.
 * Shows last 30 days, newest first.
 *
 * Each card shows:
 *   - Date (formatted: "Monday, 14 April")
 *   - Operating mode (human label)
 *   - Plan title
 *   - Completion indicator from ExecutionRecord
 *   - TrustSignal trend dot (current signal, shown only on days with a Reflection)
 *
 * No streak counters. No deletion from this screen.
 */

import React, { useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Colors } from '../../design/tokens';
import { planRepository } from '../../repositories/PlanRepository';
import { executionRepository } from '../../repositories/ExecutionRepository';
import { reflectionRepository } from '../../repositories/ReflectionRepository';
import { memoryRepository } from '../../repositories/MemoryRepository';
import type { ExecutionRecord, OperatingMode, OperatingPlan, TrustTrend } from '../../../domain/types';

// ─── Mode labels ──────────────────────────────────────────────────────────────

const MODE_LABELS: Record<OperatingMode, string> = {
  RECOVERY:              'Recovery morning',
  FOCUS_REBUILD:         'Rebuilding focus',
  STEADY_EXECUTION:      'Clear execution',
  HIGH_STAKES_DAY:       'High-stakes morning',
  OVERWHELM_CONTAINMENT: 'Containing the load',
};

// ─── Trust dot ────────────────────────────────────────────────────────────────

const TRUST_COLORS: Record<TrustTrend, string> = {
  BUILDING: Colors.trustBuilding,
  STABLE:   Colors.trustStable,
  ERODING:  Colors.trustEroding,
};

function TrustDot({ trend }: { trend: TrustTrend }) {
  return <View style={[styles.trustDot, { backgroundColor: TRUST_COLORS[trend] }]} />;
}

// ─── Date formatting ──────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  // isoDate: YYYY-MM-DD
  const [year, month, day] = isoDate.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

// ─── Completion indicator ─────────────────────────────────────────────────────

function completionText(execution: ExecutionRecord | null): string {
  if (!execution) return '—';
  if (execution.sessionAbandonedAt) return 'Session ended early';
  if (execution.sessionCompleted) return ''; // checkmark shown separately
  if (execution.blocksCompleted === 0 && execution.blocksSkipped === 0) return '—';
  return `${execution.blocksCompleted} of ${execution.totalBlocks} completed`;
}

// ─── Session card ─────────────────────────────────────────────────────────────

interface SessionCardProps {
  plan: OperatingPlan;
  execution: ExecutionRecord | null;
  hasTrustDot: boolean;
  trustTrend: TrustTrend | null;
}

function SessionCard({ plan, execution, hasTrustDot, trustTrend }: SessionCardProps) {
  const allDone = execution?.sessionCompleted === true;
  const abandoned = Boolean(execution?.sessionAbandonedAt);
  const partial = execution && !allDone && !abandoned &&
    (execution.blocksCompleted > 0 || execution.blocksSkipped > 0);
  const noData = !execution;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardDate}>{formatDate(plan.date)}</Text>
        <View style={styles.cardHeaderRight}>
          {hasTrustDot && trustTrend && <TrustDot trend={trustTrend} />}
        </View>
      </View>

      <Text style={styles.cardMode}>{MODE_LABELS[plan.operatingMode]}</Text>
      <Text style={styles.cardTitle} numberOfLines={1}>{plan.planTitle}</Text>

      <View style={styles.cardFooter}>
        {allDone && <Text style={styles.completionCheck}>✓</Text>}
        {abandoned && (
          <Text style={styles.completionAbandoned}>Session ended early</Text>
        )}
        {partial && (
          <Text style={styles.completionPartial}>
            {execution!.blocksCompleted} of {execution!.totalBlocks} completed
          </Text>
        )}
        {noData && <Text style={styles.completionNone}>—</Text>}
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function HistoryView() {
  // All data sourced from MMKV — no Firestore reads anywhere in this file
  const { plans, executionMap, reflectionDates, currentTrustTrend } = useMemo(() => {
    const historyPlans = planRepository.getPlanHistory(30);

    // Build execution map: date → ExecutionRecord
    const execMap: Record<string, ExecutionRecord> = {};
    for (const plan of historyPlans) {
      const exec = executionRepository.getExecution(plan.date);
      if (exec) execMap[plan.date] = exec;
    }

    // Dates that have a reflection (trust dot appears on these)
    const reflDates = new Set<string>();
    for (const plan of historyPlans) {
      const refl = reflectionRepository.getReflection(plan.date);
      if (refl) reflDates.add(plan.date);
    }

    // Current TrustSignal — single rolling doc; shown as proxy for recent sessions
    const trust = memoryRepository.getTrustSignal();
    const trendValue = trust?.trend ?? null;

    return {
      plans: historyPlans,
      executionMap: execMap,
      reflectionDates: reflDates,
      currentTrustTrend: trendValue,
    };
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.heading}>Your mornings</Text>
      <Text style={styles.subheading}>Last 30 days</Text>

      {plans.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>Your first morning is waiting.</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {plans.map(plan => (
            <SessionCard
              key={plan.date}
              plan={plan}
              execution={executionMap[plan.date] ?? null}
              hasTrustDot={reflectionDates.has(plan.date)}
              trustTrend={reflectionDates.has(plan.date) ? currentTrustTrend : null}
            />
          ))}
        </View>
      )}

      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 56 : 32,
    paddingBottom: 40,
  },

  heading: {
    fontSize: 26,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  subheading: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 28,
  },

  list: {
    gap: 12,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderRight: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 12,
    height: 12,
  },
  cardDate: {
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  cardMode: {
    fontSize: 11,
    color: Colors.accent,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completionCheck: {
    fontSize: 14,
    color: Colors.accent,
  },
  completionPartial: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  completionAbandoned: {
    fontSize: 13,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  completionNone: {
    fontSize: 13,
    color: Colors.textMuted,
  },

  // Trust dot
  trustDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Empty state
  emptyState: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: Colors.textMuted,
  },

  bottomSpacer: {
    height: 40,
  },
});
