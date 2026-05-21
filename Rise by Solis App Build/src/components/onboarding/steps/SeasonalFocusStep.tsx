/**
 * src/components/onboarding/steps/SeasonalFocusStep.tsx
 *
 * Step 7 of 7 — Seasonal Focus + Movement Baseline.
 * Collects: seasonalFocus ('Building' | 'Stabilising' | 'Recovering' | 'Preparing'),
 *           movementBaseline ('regular' | 'occasional' | 'rare')
 *
 * Four seasonal cards (grid 2×2) + three movement option rows.
 * Explicit Continue button. Last question step before archetype reveal.
 * Design: Palette B. Continue button copy: "See my archetype" to signal what comes next.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import type { StepProps } from '../OnboardingFlow';
import { PaletteB } from '../../../design/tokens';
import type { SeasonalFocus, MovementBaseline } from '../../../../domain/types';

// ─── Option data ──────────────────────────────────────────────────────────────

const SEASONAL_OPTIONS: Array<{ value: SeasonalFocus; label: string; sub: string }> = [
  {
    value: 'Building',
    label: 'Building',
    sub: "Adding something new — growing a project, a habit, a capability.",
  },
  {
    value: 'Stabilising',
    label: 'Stabilising',
    sub: "Holding ground — protecting what matters, reducing drift.",
  },
  {
    value: 'Recovering',
    label: 'Recovering',
    sub: "Coming back — rebuilding after a period of depletion.",
  },
  {
    value: 'Preparing',
    label: 'Preparing',
    sub: "Getting ready — building toward something not yet in motion.",
  },
];

const MOVEMENT_OPTIONS: Array<{ value: MovementBaseline; label: string }> = [
  { value: 'regular', label: 'Most days — movement is part of my rhythm' },
  { value: 'occasional', label: 'A few times a week — inconsistent but present' },
  { value: 'rare', label: 'Rarely — physical movement is not a current anchor' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function SeasonalFocusStep({ context, onNext, onBack }: StepProps) {
  const [seasonalFocus, setSeasonalFocus] = useState<SeasonalFocus | undefined>(
    context.seasonalFocus
  );
  const [movementBaseline, setMovementBaseline] = useState<MovementBaseline | undefined>(
    context.movementBaseline
  );

  const canContinue = seasonalFocus !== undefined && movementBaseline !== undefined;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    onNext({ seasonalFocus: seasonalFocus!, movementBaseline: movementBaseline! });
  }, [canContinue, seasonalFocus, movementBaseline, onNext]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.stepLabel}>Where you are right now</Text>
          <Text style={styles.question}>
            Two final questions — then your archetype.
          </Text>
        </View>

        {/* Seasonal focus — 2×2 grid */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>What season best describes where you are in life right now?</Text>
          <View style={styles.seasonalGrid}>
            {SEASONAL_OPTIONS.map(({ value, label, sub }) => {
              const isSelected = seasonalFocus === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.seasonalCard, isSelected && styles.seasonalCardSelected]}
                  onPress={() => setSeasonalFocus(value)}
                  activeOpacity={0.85}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.seasonalLabel, isSelected && styles.seasonalLabelSelected]}>
                    {label}
                  </Text>
                  <Text style={[styles.seasonalSub, isSelected && styles.seasonalSubSelected]}>
                    {sub}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Movement baseline */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>How much physical movement is currently part of your life?</Text>
          {MOVEMENT_OPTIONS.map(({ value, label }) => {
            const isSelected = movementBaseline === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.movementRow, isSelected && styles.movementRowSelected]}
                onPress={() => setMovementBaseline(value)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={label}
              >
                <View style={[styles.movementDot, isSelected && styles.movementDotSelected]} />
                <Text style={[styles.movementLabel, isSelected && styles.movementLabelSelected]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.nav}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Text style={styles.backLabel}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={handleContinue}
          activeOpacity={canContinue ? 0.8 : 1}
          disabled={!canContinue}
          accessibilityRole="button"
          accessibilityLabel="See my archetype"
        >
          <Text style={[styles.continueLabel, !canContinue && styles.continueLabelDisabled]}>
            See my archetype
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaletteB.warmCream,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 28,
  },
  stepLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.2,
    color: PaletteB.dustyOchre,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  question: {
    fontSize: 26,
    fontWeight: '600',
    color: PaletteB.deepBrown,
    lineHeight: 34,
  },
  section: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: PaletteB.deepBrown,
    lineHeight: 22,
    marginBottom: 14,
  },
  seasonalGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  seasonalCard: {
    width: '47%',
    padding: 16,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    borderRadius: 12,
    backgroundColor: PaletteB.warmStone,
    minHeight: 100,
    justifyContent: 'flex-start',
  },
  seasonalCardSelected: {
    borderColor: PaletteB.dawnGold,
    backgroundColor: PaletteB.warmCream,
  },
  seasonalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: PaletteB.warmWalnut,
    marginBottom: 6,
  },
  seasonalLabelSelected: {
    color: PaletteB.deepBrown,
  },
  seasonalSub: {
    fontSize: 12,
    color: PaletteB.amberMist,
    lineHeight: 17,
  },
  seasonalSubSelected: {
    color: PaletteB.warmWalnut,
  },
  movementRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    borderRadius: 12,
    backgroundColor: PaletteB.warmStone,
    marginBottom: 10,
    gap: 12,
  },
  movementRowSelected: {
    borderColor: PaletteB.dawnGold,
    backgroundColor: PaletteB.warmCream,
  },
  movementDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: PaletteB.dustyLinen,
    marginTop: 2,
    flexShrink: 0,
  },
  movementDotSelected: {
    borderColor: PaletteB.dawnGold,
    backgroundColor: PaletteB.dawnGold,
  },
  movementLabel: {
    fontSize: 15,
    color: PaletteB.warmWalnut,
    lineHeight: 22,
    flex: 1,
  },
  movementLabelSelected: {
    color: PaletteB.deepBrown,
    fontWeight: '500',
  },
  nav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PaletteB.dustyLinen,
    backgroundColor: PaletteB.warmCream,
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  backLabel: {
    fontSize: 16,
    color: PaletteB.warmWalnut,
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: PaletteB.dawnGold,
    borderRadius: 12,
  },
  continueButtonDisabled: {
    backgroundColor: PaletteB.dustyLinen,
  },
  continueLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: PaletteB.warmCream,
  },
  continueLabelDisabled: {
    color: PaletteB.amberMist,
  },
});
