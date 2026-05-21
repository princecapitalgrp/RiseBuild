/**
 * src/components/onboarding/steps/SleepWindowStep.tsx
 *
 * Step 1 of 7 — Sleep Window.
 * Collects: wakeTarget (HH:MM string), preferredDuration (minutes as number).
 *
 * Design:
 *   - Palette B (warmCream background)
 *   - Wake time: text input with HH:MM format hint
 *   - Session duration: horizontal option cards (15 / 20 / 30 / 45 / 60 min)
 *   - Continue button activates only when both fields are set
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import type { StepProps } from '../OnboardingFlow';
import { PaletteB } from '../../../design/tokens';

// ─── Duration options ─────────────────────────────────────────────────────────

const DURATION_OPTIONS: Array<{ label: string; value: number }> = [
  { label: '15 min', value: 15 },
  { label: '20 min', value: 20 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '60 min', value: 60 },
];

// ─── Validation ────────────────────────────────────────────────────────────────

function isValidTime(value: string): boolean {
  // Accept HH:MM — 00:00 through 23:59
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return false;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SleepWindowStep({ context, onNext, onBack }: StepProps) {
  const [wakeTarget, setWakeTarget] = useState<string>(context.wakeTarget ?? '');
  const [preferredDuration, setPreferredDuration] = useState<number | undefined>(
    context.preferredDuration
  );

  const canContinue = isValidTime(wakeTarget) && preferredDuration !== undefined;

  const handleContinue = useCallback(() => {
    if (!canContinue) return;
    onNext({ wakeTarget: wakeTarget.trim(), preferredDuration: preferredDuration! });
  }, [canContinue, wakeTarget, preferredDuration, onNext]);

  const handleTimeChange = useCallback((text: string) => {
    // Auto-insert colon after two digits
    let cleaned = text.replace(/[^0-9:]/g, '');
    if (cleaned.length === 2 && !cleaned.includes(':') && wakeTarget.length === 1) {
      cleaned = cleaned + ':';
    }
    setWakeTarget(cleaned);
  }, [wakeTarget]);

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepLabel}>Your morning window</Text>
          <Text style={styles.question}>
            What time do you typically want to wake up?
          </Text>
          <Text style={styles.subtext}>
            This sets the start of your operating window — not a mandate, a reference point.
          </Text>
        </View>

        {/* Wake time input */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>Target wake time</Text>
          <TextInput
            style={[styles.timeInput, isValidTime(wakeTarget) && styles.timeInputValid]}
            value={wakeTarget}
            onChangeText={handleTimeChange}
            placeholder="07:00"
            placeholderTextColor={PaletteB.amberMist}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            returnKeyType="done"
            accessibilityLabel="Target wake time, format HH:MM"
          />
          <Text style={styles.fieldHint}>Format: HH:MM (24-hour)</Text>
        </View>

        {/* Duration selector */}
        <View style={styles.section}>
          <Text style={styles.fieldLabel}>How long is your morning window?</Text>
          <Text style={styles.fieldSubtext}>
            The time available before your first commitment of the day.
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.durationRow}
          >
            {DURATION_OPTIONS.map(({ label, value }) => {
              const selected = preferredDuration === value;
              return (
                <TouchableOpacity
                  key={value}
                  style={[styles.durationCard, selected && styles.durationCardSelected]}
                  onPress={() => setPreferredDuration(value)}
                  activeOpacity={0.8}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={label}
                >
                  <Text style={[styles.durationLabel, selected && styles.durationLabelSelected]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
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
    </KeyboardAvoidingView>
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
    marginBottom: 36,
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
    marginBottom: 12,
  },
  subtext: {
    fontSize: 15,
    color: PaletteB.warmWalnut,
    lineHeight: 22,
  },
  section: {
    marginBottom: 32,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: PaletteB.deepBrown,
    marginBottom: 6,
  },
  fieldSubtext: {
    fontSize: 13,
    color: PaletteB.warmWalnut,
    lineHeight: 18,
    marginBottom: 14,
  },
  fieldHint: {
    fontSize: 12,
    color: PaletteB.amberMist,
    marginTop: 6,
  },
  timeInput: {
    height: 52,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 24,
    fontWeight: '300',
    color: PaletteB.deepBrown,
    backgroundColor: PaletteB.warmStone,
    letterSpacing: 2,
  },
  timeInputValid: {
    borderColor: PaletteB.dawnGold,
  },
  durationRow: {
    gap: 10,
    paddingRight: 24,
  },
  durationCard: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    borderRadius: 10,
    backgroundColor: PaletteB.warmStone,
  },
  durationCardSelected: {
    borderColor: PaletteB.dawnGold,
    backgroundColor: PaletteB.warmCream,
  },
  durationLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: PaletteB.warmWalnut,
  },
  durationLabelSelected: {
    color: PaletteB.deepBrown,
    fontWeight: '600',
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
