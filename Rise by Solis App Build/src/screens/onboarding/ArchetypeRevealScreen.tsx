/**
 * src/screens/onboarding/ArchetypeRevealScreen.tsx
 *
 * Full-screen hero moment — the user sees their archetype for the first time.
 * Rendered by OnboardingFlow when the machine is in the 'archetypeReveal' state.
 *
 * Design: Palette C (dark, deepCharcoal background). Hero moment.
 * Content:
 *   - Archetype name (large, gold)
 *   - Tagline (italic, warm)
 *   - Translation paragraph (the approved verbatim copy from archetypes.ts)
 *   - "Continue to create your account" button
 *
 * The archetype was computed and saved to MMKV by the machine's
 * 'computeAndSaveArchetype' entry action. This screen just displays it.
 *
 * No back button — the user cannot return to onboarding questions from here.
 * The archetype is the commitment point.
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import type { OnboardingMachineContext } from '../../machines/onboardingMachine';
import { ARCHETYPE_DESCRIPTIONS } from '../../domain/archetypes';
import { PaletteC } from '../../design/tokens';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ArchetypeRevealScreenProps {
  context: OnboardingMachineContext;
  onContinue: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ArchetypeRevealScreen({ context, onContinue }: ArchetypeRevealScreenProps) {
  const archetype = context.archetype;
  const translation = context.archetypeTranslation;

  if (!archetype) {
    // Should never happen — machine entry action runs before this renders
    return null;
  }

  const { tagline, description } = ARCHETYPE_DESCRIPTIONS[archetype];

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* Pre-title label */}
        <Text style={styles.preLabel}>Your archetype</Text>

        {/* Archetype name */}
        <Text style={styles.archetypeName}>{archetype}</Text>

        {/* Tagline */}
        <Text style={styles.tagline}>{tagline}</Text>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Translation paragraph */}
        <Text style={styles.translation}>{translation}</Text>

        {/* Description */}
        <Text style={styles.description}>{description}</Text>
      </ScrollView>

      {/* Continue CTA */}
      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          Your plan will be shaped around this every morning.
        </Text>
        <TouchableOpacity
          style={styles.continueButton}
          onPress={onContinue}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Continue to create your account"
        >
          <Text style={styles.continueLabel}>Continue to create your account</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaletteC.deepCharcoal,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === 'ios' ? 72 : 48,
    paddingBottom: 32,
  },
  preLabel: {
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 1.8,
    color: PaletteC.dustyMocha,
    textTransform: 'uppercase',
    marginBottom: 20,
  },
  archetypeName: {
    fontSize: 52,
    fontWeight: '700',
    color: PaletteC.dawnGold,
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  tagline: {
    fontSize: 18,
    fontWeight: '400',
    color: PaletteC.softCream,
    lineHeight: 26,
    fontStyle: 'italic',
    marginBottom: 32,
  },
  divider: {
    height: 1,
    backgroundColor: PaletteC.warmGraphite,
    marginBottom: 32,
  },
  translation: {
    fontSize: 17,
    color: PaletteC.warmSand,
    lineHeight: 28,
    marginBottom: 24,
  },
  description: {
    fontSize: 15,
    color: PaletteC.dustyMocha,
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    paddingTop: 20,
    backgroundColor: PaletteC.deepCharcoal,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: PaletteC.warmGraphite,
  },
  footerNote: {
    fontSize: 13,
    color: PaletteC.dustyMocha,
    textAlign: 'center',
    marginBottom: 14,
  },
  continueButton: {
    paddingVertical: 16,
    backgroundColor: PaletteC.dawnGold,
    borderRadius: 14,
    alignItems: 'center',
  },
  continueLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: PaletteC.deepCharcoal,
  },
});
