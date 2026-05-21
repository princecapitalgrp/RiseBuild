/**
 * src/components/onboarding/steps/AgencyStructureStep.tsx
 *
 * Step 2 of 7 — Agency Structure.
 * Collects: agencyStructure ('Author' | 'Protagonist')
 *
 * Two large selection cards. Single-tap confirms and auto-advances.
 * No explicit Continue button — selection is the action.
 *
 * Design: Palette B. Two equal-height cards with short descriptors.
 * dawnGold border on selected state.
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
import type { AgencyStructure } from '../../../../domain/types';

// ─── Option data ──────────────────────────────────────────────────────────────

const OPTIONS: Array<{
  value: AgencyStructure;
  title: string;
  description: string;
}> = [
  {
    value: 'Author',
    title: 'I author it',
    description:
      "I feel most settled when I've designed the morning myself — I know what's coming and why.",
  },
  {
    value: 'Protagonist',
    title: 'I move through it',
    description:
      "I feel most settled when I'm responding to the day as it arrives — moving through it, not scripting it in advance.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AgencyStructureStep({ context, onNext, onBack }: StepProps) {
  const [selected, setSelected] = useState<AgencyStructure | undefined>(
    context.agencyStructure
  );

  // Auto-advance a short moment after tap so the user sees their selection
  useEffect(() => {
    if (selected === undefined) return;
    const timer = setTimeout(() => {
      onNext({ agencyStructure: selected });
    }, 260);
    return () => clearTimeout(timer);
  }, [selected, onNext]);

  const handleSelect = useCallback((value: AgencyStructure) => {
    setSelected(value);
  }, []);

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.stepLabel}>How you relate to your morning</Text>
        <Text style={styles.question}>
          When you imagine a good morning, which feels more true?
        </Text>
      </View>

      {/* Option cards */}
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

      {/* Back navigation */}
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
