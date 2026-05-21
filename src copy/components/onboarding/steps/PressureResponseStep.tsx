/**
 * src/components/onboarding/steps/PressureResponseStep.tsx
 *
 * Step 3 of 7 — Pressure Response.
 * Collects: pressureResponse ('Push' | 'Pull')
 *
 * Two large selection cards. Single-tap auto-advances (same pattern as Agency).
 * Design: Palette B.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import type { StepProps } from '../OnboardingFlow';
import { PaletteB } from '../../../design/tokens';
import type { PressureResponse } from '../../../../domain/types';

// ─── Option data ──────────────────────────────────────────────────────────────

const OPTIONS: Array<{
  value: PressureResponse;
  title: string;
  description: string;
}> = [
  {
    value: 'Push',
    title: 'I tighten up',
    description:
      "When pressure arrives, I tend to get more controlled — I organise, I secure, I clear the decks before I can move.",
  },
  {
    value: 'Pull',
    title: 'I pull back',
    description:
      "When pressure arrives, I tend to stall or delay — I circle the task, need more time to feel ready, or look for a different angle first.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function PressureResponseStep({ context, onNext, onBack }: StepProps) {
  const [selected, setSelected] = useState<PressureResponse | undefined>(
    context.pressureResponse
  );

  useEffect(() => {
    if (selected === undefined) return;
    const timer = setTimeout(() => {
      onNext({ pressureResponse: selected });
    }, 260);
    return () => clearTimeout(timer);
  }, [selected, onNext]);

  const handleSelect = useCallback((value: PressureResponse) => {
    setSelected(value);
  }, []);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.stepLabel}>How you respond to pressure</Text>
        <Text style={styles.question}>
          When something important is coming, how do you tend to respond?
        </Text>
      </View>

      <View style={styles.cards}>
        {OPTIONS.map(({ value, title, description }) => {
          const isSelected = selected === value;
          return (
            <TouchableOpacity
              key={value}
              style={[styles.card, isSelected && styles.cardSelected]}
              onPress={() => handleSelect(value)}
              activeOpacity={0.85}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
              accessibilityLabel={title}
            >
              <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                {title}
              </Text>
              <Text style={[styles.cardDescription, isSelected && styles.cardDescriptionSelected]}>
                {description}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

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
  header: {
    paddingHorizontal: 24,
    paddingTop: 32,
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
  cards: {
    flex: 1,
    paddingHorizontal: 24,
    gap: 14,
  },
  card: {
    flex: 1,
    padding: 22,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    borderRadius: 14,
    backgroundColor: PaletteB.warmStone,
    justifyContent: 'center',
  },
  cardSelected: {
    borderColor: PaletteB.dawnGold,
    backgroundColor: PaletteB.warmCream,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: PaletteB.warmWalnut,
    marginBottom: 10,
  },
  cardTitleSelected: {
    color: PaletteB.deepBrown,
  },
  cardDescription: {
    fontSize: 15,
    color: PaletteB.amberMist,
    lineHeight: 22,
  },
  cardDescriptionSelected: {
    color: PaletteB.warmWalnut,
  },
  nav: {
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
});
