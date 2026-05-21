/**
 * src/screens/execution/PlanView.tsx
 *
 * Displays the generated morning OperatingPlan and drives block execution.
 *
 * Layout (top → bottom):
 *   - Plan title + operating mode pill
 *   - PlanRationale section (if needsRationale === true)
 *   - Morning intention card (if present)
 *   - Block list — only first incomplete block shows Start button
 *   - Uncertainty section (collapsed by default)
 *   - Complete session button
 *
 * Haptics:
 *   - Start block:    medium impact
 *   - Complete block: success notification
 *   - Skip block:     light impact
 *   - Complete session: success notification
 *
 * No streak counters. No session comparisons. No optimization language.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../design/tokens';
import { ExecutionTracker } from '../../engine/ExecutionTracker';
import { profileRepository } from '../../repositories/ProfileRepository';
import type { OperatingMode, OperatingPlan, PlanStep } from '../../../domain/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface PlanViewProps {
  plan: OperatingPlan;
  intention: string | null;
  onSessionComplete: (tracker: ExecutionTracker) => void;
  onAbandon: () => void;
}

// ─── Operating mode labels ────────────────────────────────────────────────────

const MODE_LABELS: Record<OperatingMode, string> = {
  RECOVERY:               'Recovery morning',
  FOCUS_REBUILD:          'Rebuilding focus',
  STEADY_EXECUTION:       'Clear execution',
  HIGH_STAKES_DAY:        'High-stakes morning',
  OVERWHELM_CONTAINMENT:  'Containing the load',
};

// ─── Block state ──────────────────────────────────────────────────────────────

type BlockStatus = 'pending' | 'active' | 'completed' | 'skipped';

// ─── Sub-components ───────────────────────────────────────────────────────────

function OperatingModePill({ mode }: { mode: OperatingMode }) {
  return (
    <View style={styles.modePill}>
      <Text style={styles.modePillText}>{MODE_LABELS[mode]}</Text>
    </View>
  );
}

function RationaleSection({ plan }: { plan: OperatingPlan }) {
  return (
    <View style={styles.rationaleSection}>
      {plan.rationale.noticed.length > 0 && (
        <View style={styles.rationaleNoticed}>
          {plan.rationale.noticed.map((item, i) => (
            <View key={i} style={styles.noticedRow}>
              <View style={styles.noticedDot} />
              <Text style={styles.noticedText}>{item}</Text>
            </View>
          ))}
        </View>
      )}
      {plan.rationale.planLogic ? (
        <Text style={styles.rationaleLogic}>{plan.rationale.planLogic}</Text>
      ) : null}
    </View>
  );
}

function IntentionCard({ intention }: { intention: string }) {
  return (
    <View style={styles.intentionCard}>
      <Text style={styles.intentionLabel}>Your intention</Text>
      <Text style={styles.intentionText}>{intention}</Text>
    </View>
  );
}

function UncertaintySection({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (items.length === 0) return null;

  return (
    <View style={styles.uncertaintySection}>
      <TouchableOpacity
        style={styles.uncertaintyToggle}
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
      >
        <Text style={styles.uncertaintyToggleText}>
          {expanded ? 'Hide' : 'What the system wasn\'t sure about'}
        </Text>
        <Text style={styles.uncertaintyChevron}>{expanded ? '↑' : '↓'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={styles.uncertaintyList}>
          {items.map((item, i) => (
            <Text key={i} style={styles.uncertaintyItem}>· {item}</Text>
          ))}
        </View>
      )}
    </View>
  );
}

interface BlockCardProps {
  step: PlanStep;
  status: BlockStatus;
  isNextUp: boolean;
  onStart: () => void;
  onComplete: () => void;
  onSkip: () => void;
}

function BlockCard({ step, status, isNextUp, onStart, onComplete, onSkip }: BlockCardProps) {
  const isCompleted = status === 'completed';
  const isSkipped = status === 'skipped';
  const isActive = status === 'active';

  return (
    <View style={[
      styles.blockCard,
      isActive && styles.blockCardActive,
      isCompleted && styles.blockCardCompleted,
      isSkipped && styles.blockCardSkipped,
    ]}>
      <View style={styles.blockHeader}>
        <Text style={styles.blockNumber}>{step.order}</Text>
        <View style={styles.blockMeta}>
          <Text style={[styles.blockTitle, (isCompleted || isSkipped) && styles.blockTitleMuted]}>
            {step.title}
          </Text>
          <Text style={styles.blockDuration}>{step.durationMinutes} min</Text>
        </View>
        {isCompleted && <Text style={styles.blockStatusIcon}>✓</Text>}
        {isSkipped  && <Text style={styles.blockStatusIconSkip}>—</Text>}
      </View>

      {!isCompleted && !isSkipped && (
        <Text style={styles.blockAction}>{step.action}</Text>
      )}

      {isActive && (
        <View style={styles.blockActions}>
          <TouchableOpacity
            style={styles.doneButton}
            onPress={onComplete}
            activeOpacity={0.8}
          >
            <Text style={styles.doneButtonText}>Done</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={onSkip}
            activeOpacity={0.8}
          >
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      {isNextUp && status === 'pending' && (
        <TouchableOpacity
          style={styles.startButton}
          onPress={onStart}
          activeOpacity={0.8}
        >
          <Text style={styles.startButtonText}>Start</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function PlanView({ plan, intention, onSessionComplete, onAbandon }: PlanViewProps) {
  // Determine needsRationale from profile
  const profile = useMemo(() => profileRepository.getOnboardingProfile(), []);
  const needsRationale = profile?.needsRationale ?? true;

  // Block state
  const [blockStatuses, setBlockStatuses] = useState<Record<string, BlockStatus>>(() => {
    const initial: Record<string, BlockStatus> = {};
    plan.mainSequence.forEach(s => { initial[String(s.order)] = 'pending'; });
    return initial;
  });

  // ExecutionTracker — one per session, stable reference
  const [tracker] = useState(() => new ExecutionTracker(plan, intention));

  // Derived: which block is next up (first pending or active)
  const firstIncompleteOrder = useMemo(() => {
    for (const step of plan.mainSequence) {
      const status = blockStatuses[String(step.order)];
      if (status === 'pending' || status === 'active') return step.order;
    }
    return null;
  }, [blockStatuses, plan.mainSequence]);

  // Derived: are all blocks terminal (completed or skipped)?
  const allBlocksDone = useMemo(
    () => plan.mainSequence.every(s => {
      const st = blockStatuses[String(s.order)];
      return st === 'completed' || st === 'skipped';
    }),
    [blockStatuses, plan.mainSequence]
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleStart = useCallback((step: PlanStep) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    tracker.startBlock(String(step.order));
    setBlockStatuses(prev => ({ ...prev, [String(step.order)]: 'active' }));
  }, [tracker]);

  const handleComplete = useCallback((step: PlanStep) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    tracker.completeBlock(String(step.order));
    setBlockStatuses(prev => ({ ...prev, [String(step.order)]: 'completed' }));
  }, [tracker]);

  const handleSkip = useCallback((step: PlanStep) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    tracker.skipBlock(String(step.order));
    setBlockStatuses(prev => ({ ...prev, [String(step.order)]: 'skipped' }));
  }, [tracker]);

  const handleCompleteSession = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    tracker.completeSession();
    onSessionComplete(tracker);
  }, [tracker, onSessionComplete]);

  const handleAbandon = useCallback(() => {
    tracker.abandonSession();
    onAbandon();
  }, [tracker, onAbandon]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.abandonButton}
          onPress={handleAbandon}
          activeOpacity={0.7}
        >
          <Text style={styles.abandonText}>←</Text>
        </TouchableOpacity>
        <OperatingModePill mode={plan.operatingMode} />
      </View>

      <Text style={styles.planTitle}>{plan.planTitle}</Text>
      <Text style={styles.openingLine}>{plan.openingLine}</Text>

      {/* PlanRationale */}
      {needsRationale && <RationaleSection plan={plan} />}

      {/* Morning intention */}
      {intention ? <IntentionCard intention={intention} /> : null}

      {/* Blocks */}
      <View style={styles.blockList}>
        {plan.mainSequence.map(step => (
          <BlockCard
            key={step.order}
            step={step}
            status={blockStatuses[String(step.order)]}
            isNextUp={step.order === firstIncompleteOrder}
            onStart={() => handleStart(step)}
            onComplete={() => handleComplete(step)}
            onSkip={() => handleSkip(step)}
          />
        ))}
      </View>

      {/* Uncertainty */}
      {plan.rationale.uncertainty.length > 0 && (
        <UncertaintySection items={plan.rationale.uncertainty} />
      )}

      {/* Complete session */}
      <TouchableOpacity
        style={[styles.completeButton, !allBlocksDone && styles.completeButtonDisabled]}
        onPress={handleCompleteSession}
        disabled={!allBlocksDone}
        activeOpacity={0.85}
      >
        <Text style={styles.completeButtonText}>Complete session</Text>
      </TouchableOpacity>

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

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  abandonButton: {
    padding: 4,
  },
  abandonText: {
    color: Colors.textMuted,
    fontSize: 20,
  },
  modePill: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  modePillText: {
    color: Colors.textSecondary,
    fontSize: 12,
    letterSpacing: 0.3,
  },

  // Title
  planTitle: {
    fontSize: 26,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  openingLine: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 28,
  },

  // Rationale
  rationaleSection: {
    marginBottom: 28,
    borderLeftWidth: 2,
    borderLeftColor: Colors.accent,
    paddingLeft: 16,
  },
  rationaleNoticed: {
    marginBottom: 10,
  },
  noticedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  noticedDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.accent,
    marginTop: 7,
    marginRight: 8,
  },
  noticedText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    flex: 1,
  },
  rationaleLogic: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    fontStyle: 'italic',
  },

  // Intention
  intentionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  intentionLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  intentionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Block list
  blockList: {
    gap: 12,
    marginBottom: 28,
  },

  // Block card
  blockCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockCardActive: {
    borderColor: Colors.accent,
  },
  blockCardCompleted: {
    opacity: 0.6,
  },
  blockCardSkipped: {
    opacity: 0.4,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  blockNumber: {
    fontSize: 11,
    color: Colors.textMuted,
    marginRight: 10,
    marginTop: 2,
    width: 16,
  },
  blockMeta: {
    flex: 1,
  },
  blockTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  blockTitleMuted: {
    color: Colors.textMuted,
  },
  blockDuration: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  blockStatusIcon: {
    fontSize: 16,
    color: Colors.accent,
    marginLeft: 8,
  },
  blockStatusIconSkip: {
    fontSize: 16,
    color: Colors.textMuted,
    marginLeft: 8,
  },
  blockAction: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginLeft: 26,
    marginBottom: 12,
  },
  blockActions: {
    flexDirection: 'row',
    gap: 10,
    marginLeft: 26,
  },
  doneButton: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  doneButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '600',
  },
  skipButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  skipButtonText: {
    color: Colors.textMuted,
    fontSize: 14,
  },
  startButton: {
    marginLeft: 26,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  startButtonText: {
    color: Colors.background,
    fontSize: 14,
    fontWeight: '600',
  },

  // Uncertainty
  uncertaintySection: {
    marginBottom: 28,
    padding: 14,
    backgroundColor: Colors.surface,
    borderRadius: 12,
  },
  uncertaintyToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  uncertaintyToggleText: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  uncertaintyChevron: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  uncertaintyList: {
    marginTop: 12,
    gap: 6,
  },
  uncertaintyItem: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
  },

  // Complete button
  completeButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  completeButtonDisabled: {
    opacity: 0.35,
  },
  completeButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  bottomSpacer: {
    height: 40,
  },
});
