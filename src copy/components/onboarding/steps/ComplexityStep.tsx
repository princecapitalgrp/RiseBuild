/**
 * src/components/onboarding/steps/ComplexityStep.tsx
 *
 * Step 4 of 7 — Complexity Tolerance + Needs Rationale.
 * Collects: complexityTolerance ('layered' | 'simple'), needsRationale (boolean)
 *
 * Two separate two-option selections on the same screen.
 * Explicit Continue button activates when both fields are chosen.
 *
 * Design: Palette B. Smaller option cards for each field (2 per row).
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
import type { ComplexityTolerance } from '../../../../domain/types';

// ─── Option data ──────────────────────────────────────────────────────────────

const COMPLEXITY_OPTIONS: Array<{ value: ComplexityTolerance; label: string; sub: string }> = [
  {
    value: 'layered',
    label: 'Layered',
    sub: "I can hold multiple threads at once — I prefer a plan that reflects the complexity.",
  },
  {
    value: 'simple',
    label: 'Simple',
    sub: "When the morning gets complex, I lose traction. I do better with one clear thread at a time.",
  },
];

const RATIONALE_OPTIONS: Array<{ value: boolean; label: string; sub: string }> = [
  {
    value: true,
    label: 'Yes, explain the logic',
    sub: "Knowing why a plan was built this way helps me trust it and follow through.",
  },
  {
    value: false,
    label: 'No, just the steps',
    sub: "I prefer a clean action list. The reasoning can get in the way.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function ComplexityStep({ context, onNext, onBack }: StepProps) {
  const [complexityTolerance, setComplexityTolerance] = useState<ComplexityTolerance | undefined>(
    context.complexityTolerance
  );
  const [needsRationale, setNeedsRationale] = useState<boolean | undefined>(
    context.needsRationale
  );

  const canContinue = complexityTolerance !== undefined && needsRationale !== undefined;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    onNext({ complexityTolerance: complexityTolerance!, needsRationale: needsRationale! });
  }, [canContinue, complexityTolerance, needsRationale, onNext]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepLabel}>How your mind works best</Text>
          <Text style={styles.question}>
            Two quick questions about how you process a plan.
          </Text>
        </View>

        {/* Complexity tolerance */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>How do you hold complexity?</Text>
          <View style={styles.optionPair}>
            {COMPLEXITY_OPTIONS.map(({ value, label, sub }) => {
              const isSelected = complexityTolerance === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => setComplexityTolerance(value)}
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
        </View>

        {/* Needs rationale */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>When you see a plan, do you want to know why it was built that way?</Text>
          <View style={styles.optionPair}>
            {RATIONALE_OPTIONS.map(({ value, label, sub }) => {
              const isSelected = needsRationale === value;
              return (
                <TouchableOpacity
                  key={String(value)}
                  style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                  onPress={() => setNeedsRationale(value)}
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
        </View>
      </ScrollView>

      {/* Navigation */}
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
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: PaletteB.deepBrown,
    marginBottom: 14,
    lineHeight: 22,
  },
  optionPair: {
    gap: 12,
  },
  optionCard: {
    padding: 18,
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
    fontSize: 16,
    fontWeight: '600',
    color: PaletteB.warmWalnut,
    marginBottom: 6,
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
