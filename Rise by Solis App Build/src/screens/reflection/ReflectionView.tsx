/**
 * src/screens/reflection/ReflectionView.tsx
 *
 * Post-session reflection screen.
 * Appears after session completion only.
 * Cannot be accessed without an ExecutionRecord from the current session.
 *
 * Four questions:
 *   1. Accuracy — felt accurate? (1–5 stars)
 *   2. Sequence — followed / adapted / own_way
 *   3. What helped? (optional text)
 *   4. What got in the way? (optional text)
 *
 * On submit: writes Reflection → MemoryEngine.update() → TrustEvaluator.evaluate()
 * On skip: writes minimal Reflection with default values
 *
 * Raw text fields (helpedMost, gotInWay) are device-only. Never sent to server.
 */

import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../design/tokens';
import { reflectionRepository } from '../../repositories/ReflectionRepository';
import { memoryEngine } from '../../engine/MemoryEngine';
import { trustEvaluator } from '../../engine/TrustEvaluator';
import { memoryRepository } from '../../repositories/MemoryRepository';
import { todayKey } from '../../storage/keys';
import type {
  Archetype,
  ExecutionRecord,
  FollowedSequence,
  OnboardingProfile,
  Reflection,
} from '../../../domain/types';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReflectionViewProps {
  executionRecord: ExecutionRecord;
  profile: OnboardingProfile;
  onComplete: () => void;
}

// ─── Archetype subheadings ────────────────────────────────────────────────────

const ARCHETYPE_SUBHEADING: Record<Archetype, string> = {
  Architect: 'A clear read helps the next plan land better.',
  Alchemist: 'What moved? What didn\'t?',
  Sentinel:  'Take a moment. Then tell us.',
  Tide:      'No right answer here.',
};

// ─── Star rating ──────────────────────────────────────────────────────────────

function StarRating({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map(n => (
        <TouchableOpacity
          key={n}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(n);
          }}
          activeOpacity={0.7}
          style={styles.starButton}
        >
          <Text style={[styles.star, n <= value && styles.starFilled]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Sequence picker ──────────────────────────────────────────────────────────

const SEQUENCE_OPTIONS: { value: FollowedSequence; label: string }[] = [
  { value: 'followed', label: 'Followed it' },
  { value: 'adapted',  label: 'Adapted it' },
  { value: 'own_way',  label: 'Went my own way' },
];

function SequencePicker({
  value,
  onChange,
}: {
  value: FollowedSequence | null;
  onChange: (v: FollowedSequence) => void;
}) {
  return (
    <View style={styles.sequenceRow}>
      {SEQUENCE_OPTIONS.map(opt => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.sequenceOption, value === opt.value && styles.sequenceOptionSelected]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onChange(opt.value);
          }}
          activeOpacity={0.8}
        >
          <Text style={[styles.sequenceOptionText, value === opt.value && styles.sequenceOptionTextSelected]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// ─── Optional text field ──────────────────────────────────────────────────────

function OptionalTextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.textFieldWrap}>
      <Text style={styles.questionLabel}>{label}</Text>
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        multiline
        numberOfLines={3}
        maxLength={500}
        returnKeyType="done"
      />
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ReflectionView({ executionRecord, profile, onComplete }: ReflectionViewProps) {
  const [feltAccurate, setFeltAccurate]     = useState(0);
  const [followedSequence, setFollowedSequence] = useState<FollowedSequence | null>(null);
  const [helpedMost, setHelpedMost]         = useState('');
  const [gotInWay, setGotInWay]             = useState('');
  const [submitting, setSubmitting]         = useState(false);

  const subheading = useMemo(
    () => ARCHETYPE_SUBHEADING[profile.archetype],
    [profile.archetype]
  );

  const canSubmit = feltAccurate > 0 && followedSequence !== null && !submitting;

  // ── Handlers ───────────────────────────────────────────────────────────────

  const buildReflection = useCallback((
    accurate: number,
    sequence: FollowedSequence,
    helped: string | null,
    inWay: string | null,
  ): Reflection => {
    const now = new Date().toISOString();
    return {
      schemaVersion: '1.0',
      sessionType: 'morning',
      uid: profile.uid,
      planId: executionRecord.planId,
      date: todayKey(),
      feltAccurate: accurate,
      followedSequence: sequence,
      ...(helped ? { helpedMost: helped } : {}),
      ...(inWay  ? { gotInWay: inWay }    : {}),
      createdAt: now,
    };
  }, [profile.uid, executionRecord.planId]);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit || followedSequence === null) return;

    setSubmitting(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const reflection = buildReflection(
      feltAccurate,
      followedSequence,
      helpedMost.trim() || null,
      gotInWay.trim() || null,
    );

    reflectionRepository.saveReflection(reflection);
    memoryEngine.update(reflection, executionRecord, profile);

    const currentTrust = memoryRepository.getTrustSignal();
    const newTrust = trustEvaluator.evaluate(reflection, executionRecord, currentTrust);
    memoryRepository.saveTrustSignal(newTrust);

    setSubmitting(false);
    onComplete();
  }, [
    canSubmit, followedSequence, feltAccurate, helpedMost, gotInWay,
    buildReflection, executionRecord, profile, onComplete,
  ]);

  const handleSkip = useCallback(() => {
    // Write minimal reflection — all optional fields absent
    const reflection = buildReflection(3, 'followed', null, null);
    reflectionRepository.saveReflection(reflection);
    onComplete();
  }, [buildReflection, onComplete]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Heading */}
        <Text style={styles.heading}>How did that land?</Text>
        <Text style={styles.subheading}>{subheading}</Text>

        {/* Q1 — Accuracy */}
        <View style={styles.questionBlock}>
          <Text style={styles.questionLabel}>
            Did this plan feel right for where you actually were?
          </Text>
          <StarRating value={feltAccurate} onChange={setFeltAccurate} />
        </View>

        {/* Q2 — Sequence */}
        <View style={styles.questionBlock}>
          <Text style={styles.questionLabel}>
            Did you follow the sequence, adapt it, or go your own way?
          </Text>
          <SequencePicker value={followedSequence} onChange={setFollowedSequence} />
        </View>

        {/* Q3 — What helped */}
        <OptionalTextField
          label="What helped most?"
          value={helpedMost}
          onChange={setHelpedMost}
          placeholder="Optional — skip if nothing comes to mind"
        />

        {/* Q4 — What got in the way */}
        <OptionalTextField
          label="What got in the way?"
          value={gotInWay}
          onChange={setGotInWay}
          placeholder="Optional — skip if nothing comes to mind"
        />

        {/* Actions */}
        <TouchableOpacity
          style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          <Text style={styles.submitButtonText}>Done</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.skipLink}
          onPress={handleSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.skipLinkText}>Skip reflection</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 36,
    paddingBottom: 40,
  },

  // Heading
  heading: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subheading: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 36,
    lineHeight: 22,
  },

  // Question blocks
  questionBlock: {
    marginBottom: 32,
  },
  questionLabel: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 14,
    lineHeight: 22,
  },

  // Stars
  starRow: {
    flexDirection: 'row',
    gap: 8,
  },
  starButton: {
    padding: 4,
  },
  star: {
    fontSize: 30,
    color: Colors.border,
  },
  starFilled: {
    color: Colors.accent,
  },

  // Sequence
  sequenceRow: {
    gap: 10,
  },
  sequenceOption: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sequenceOptionSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.surfaceElevated,
  },
  sequenceOptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  sequenceOptionTextSelected: {
    color: Colors.textPrimary,
    fontWeight: '500',
  },

  // Text field
  textFieldWrap: {
    marginBottom: 28,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 80,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Submit
  submitButton: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.35,
  },
  submitButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  // Skip
  skipLink: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  skipLinkText: {
    color: Colors.textMuted,
    fontSize: 14,
  },

  bottomSpacer: {
    height: 40,
  },
});
