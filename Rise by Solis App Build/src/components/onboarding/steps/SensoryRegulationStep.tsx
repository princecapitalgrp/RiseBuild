/**
 * src/components/onboarding/steps/SensoryRegulationStep.tsx
 *
 * Step 5 of 7 — Sensory Regulation + Overwhelm Style.
 * Collects: sensoryStyle ('quiet' | 'ambient' | 'variable'),
 *           overwhelmStyle ('reduction' | 'familiarity' | 'connection')
 *
 * Two separate three-option selections. Explicit Continue button.
 * Design: Palette B. Three compact option cards per row, stacked vertically.
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
import type { SensoryStyle, OverwhelmStyle } from '../../../../domain/types';

// ─── Option data ──────────────────────────────────────────────────────────────

const SENSORY_OPTIONS: Array<{ value: SensoryStyle; label: string; sub: string }> = [
  {
    value: 'quiet',
    label: 'Quiet',
    sub: "I work best in low-stimulus environments. Noise or visual clutter pulls me off track.",
  },
  {
    value: 'ambient',
    label: 'Ambient',
    sub: "Some background sound or movement actually helps me focus. Total silence can feel too stark.",
  },
  {
    value: 'variable',
    label: 'Variable',
    sub: "It depends on the morning. Some days I need quiet; others, stimulus helps.",
  },
];

const OVERWHELM_OPTIONS: Array<{ value: OverwhelmStyle; label: string; sub: string }> = [
  {
    value: 'reduction',
    label: 'Reduce the load',
    sub: "When overwhelmed, I need things simplified — fewer tasks, less to hold.",
  },
  {
    value: 'familiarity',
    label: 'Return to familiar ground',
    sub: "When overwhelmed, I need something I already know how to do. Novelty makes it worse.",
  },
  {
    value: 'connection',
    label: 'Feel connected to purpose',
    sub: "When overwhelmed, I need to reconnect with why it matters. Context steadies me.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function SensoryRegulationStep({ context, onNext, onBack }: StepProps) {
  const [sensoryStyle, setSensoryStyle] = useState<SensoryStyle | undefined>(
    context.sensoryStyle
  );
  const [overwhelmStyle, setOverwhelmStyle] = useState<OverwhelmStyle | undefined>(
    context.overwhelmStyle
  );

  const canContinue = sensoryStyle !== undefined && overwhelmStyle !== undefined;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    onNext({ sensoryStyle: sensoryStyle!, overwhelmStyle: overwhelmStyle! });
  }, [canContinue, sensoryStyle, overwhelmStyle, onNext]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Text style={styles.stepLabel}>Your environment and regulation</Text>
          <Text style={styles.question}>
            How you work best, and what grounds you when things get heavy.
          </Text>
        </View>

        {/* Sensory style */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>What kind of environment helps you focus?</Text>
          {SENSORY_OPTIONS.map(({ value, label, sub }) => {
            const isSelected = sensoryStyle === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setSensoryStyle(value)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={label}
              >
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {label}
                </Text>
                <Text style={[styles.optionSub, isSelected && styles.optionSubSelected]}>
                  {sub}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Overwhelm style */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>When things feel overwhelming, what helps most?</Text>
          {OVERWHELM_OPTIONS.map(({ value, label, sub }) => {
            const isSelected = overwhelmStyle === value;
            return (
              <TouchableOpacity
                key={value}
                style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                onPress={() => setOverwhelmStyle(value)}
                activeOpacity={0.85}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={label}
              >
                <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                  {label}
                </Text>
                <Text style={[styles.optionSub, isSelected && styles.optionSubSelected]}>
                  {sub}
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
          accessibilityLabel="Continue to next step"
        >
          <Text style={[styles.continueLabel, !canContinue && styles.continueLabelDisabled]}>
            Continue
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
    gap: 10,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: PaletteB.deepBrown,
    lineHeight: 22,
    marginBottom: 4,
  },
  optionCard: {
    padding: 16,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    borderRadius: 12,
    backgroundColor: PaletteB.warmStone,
  },
  optionCardSelected: {
    borderColor: PaletteB.dawnGold,
    backgroundColor: PaletteB.warmCream,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: PaletteB.warmWalnut,
    marginBottom: 5,
  },
  optionLabelSelected: {
    color: PaletteB.deepBrown,
  },
  optionSub: {
    fontSize: 13,
    color: PaletteB.amberMist,
    lineHeight: 19,
  },
  optionSubSelected: {
    color: PaletteB.warmWalnut,
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
    paddingHorizontal: 32,
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
