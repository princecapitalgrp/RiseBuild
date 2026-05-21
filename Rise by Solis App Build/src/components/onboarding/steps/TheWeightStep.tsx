/**
 * src/components/onboarding/steps/TheWeightStep.tsx
 *
 * Step 6 of 7 — The Weight.
 * Collects: theWeight (string | null)
 *
 * PRIVACY NOTE: This is the most sensitive field in the product.
 *   theWeight text stays on-device in encrypted MMKV. It is NEVER sent
 *   to any server, never included in DailyContext, never passed to the AI.
 *   The UI explicitly communicates this. Do not change this behavior.
 *
 * The user can:
 *   - Type something and tap Continue (theWeight: string)
 *   - Tap Skip to proceed with theWeight: null
 *   - The field is never required
 *
 * Draft saving: profileRepository.saveDraftWeight() is called with 800ms
 * debounce on every keystroke so mid-entry state survives app purge.
 *
 * Design: Palette B. Full-screen TextInput. Prominent privacy note.
 * No character counter (counter adds measurement anxiety to this field).
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
  Keyboard,
} from 'react-native';
import type { TheWeightStepProps } from '../OnboardingFlow';
import { PaletteB } from '../../../design/tokens';
import { profileRepository } from '../../../repositories/ProfileRepository';

// ─── Component ────────────────────────────────────────────────────────────────

export function TheWeightStep({ context, onNext, onBack, onSkip }: TheWeightStepProps) {
  const [text, setText] = useState<string>(
    // Restore from draft weight (persisted by profileRepository) or from context
    () => profileRepository.getDraftWeight() ?? context.theWeight ?? ''
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persist draft weight on every keystroke (debounced 800ms)
  const handleChange = useCallback((value: string) => {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      profileRepository.saveDraftWeight(value);
    }, 800);
  }, []);

  // Flush any pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleContinue = useCallback(() => {
    Keyboard.dismiss();
    // Clear the transient draft — it migrates to theWeight in the machine context
    profileRepository.clearDraftWeight();
    onNext({ theWeight: text.trim() || null });
  }, [text, onNext]);

  const handleSkip = useCallback(() => {
    Keyboard.dismiss();
    profileRepository.clearDraftWeight();
    onSkip();
  }, [onSkip]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.stepLabel}>What you're carrying</Text>
          <Text style={styles.question}>
            Is there something weighing on you right now?
          </Text>
          <Text style={styles.subtext}>
            Something at work, in a relationship, inside yourself — anything that has
            a background presence in your life. Not a task. What you're carrying.
          </Text>
        </View>

        {/* Text input */}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChange}
          placeholder="You can name it here, or skip — either is fine."
          placeholderTextColor={PaletteB.amberMist}
          multiline
          textAlignVertical="top"
          autoCapitalize="sentences"
          returnKeyType="default"
          accessibilityLabel="What you are carrying"
          accessibilityHint="Optional. This stays on your device and is never shared."
        />

        {/* Privacy note — always visible */}
        <View style={styles.privacyNote}>
          <Text style={styles.privacyText}>
            This stays on your device only. It is never sent anywhere, never seen by anyone, never included in any plan.
            It informs the tone of your morning — that is all.
          </Text>
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
        <View style={styles.rightNav}>
          <TouchableOpacity
            style={styles.skipButton}
            onPress={handleSkip}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Skip this question"
          >
            <Text style={styles.skipLabel}>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Continue to next step"
          >
            <Text style={styles.continueLabel}>Continue</Text>
          </TouchableOpacity>
        </View>
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
    marginBottom: 24,
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
    marginBottom: 14,
  },
  subtext: {
    fontSize: 15,
    color: PaletteB.warmWalnut,
    lineHeight: 23,
  },
  input: {
    minHeight: 140,
    maxHeight: 240,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 17,
    color: PaletteB.deepBrown,
    backgroundColor: PaletteB.warmStone,
    lineHeight: 26,
    marginBottom: 20,
  },
  privacyNote: {
    paddingHorizontal: 4,
    paddingVertical: 12,
    borderLeftWidth: 2,
    borderLeftColor: PaletteB.dustyLinen,
    paddingLeft: 14,
  },
  privacyText: {
    fontSize: 13,
    color: PaletteB.amberMist,
    lineHeight: 20,
    fontStyle: 'italic',
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
  rightNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  skipButton: {
    paddingVertical: 12,
    paddingHorizontal: 8,
  },
  skipLabel: {
    fontSize: 16,
    color: PaletteB.amberMist,
  },
  continueButton: {
    paddingVertical: 14,
    paddingHorizontal: 28,
    backgroundColor: PaletteB.dawnGold,
    borderRadius: 12,
  },
  continueLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: PaletteB.warmCream,
  },
});
