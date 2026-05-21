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
import { PaletteB } from '../../design/tokens';
import { todayKey } from '../../storage/keys';
import type { OnboardingProfile, RawCheckIn } from '../../../domain/types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CheckInFlowProps {
  profile: OnboardingProfile | null;
  onComplete: (checkIn: RawCheckIn) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_PRESETS = [15, 30, 45, 60] as const;
type TimePreset = typeof TIME_PRESETS[number];

function nearestPreset(minutes: number): TimePreset {
  return TIME_PRESETS.reduce((prev, curr) =>
    Math.abs(curr - minutes) < Math.abs(prev - minutes) ? curr : prev
  );
}

// ─── Step selector (1–5 integer "slider") ────────────────────────────────────

function StepSelector({
  label,
  value,
  onChange,
  leftLabel,
  rightLabel,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  leftLabel: string;
  rightLabel: string;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.stepRow}>
        {[1, 2, 3, 4, 5].map(n => (
          <TouchableOpacity
            key={n}
            style={[styles.stepDot, value === n && styles.stepDotSelected]}
            onPress={() => onChange(n)}
            activeOpacity={0.75}
          >
            <Text style={[styles.stepDotText, value === n && styles.stepDotTextSelected]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.stepEndLabels}>
        <Text style={styles.stepEndLabel}>{leftLabel}</Text>
        <Text style={styles.stepEndLabel}>{rightLabel}</Text>
      </View>
    </View>
  );
}

// ─── Time preset buttons ──────────────────────────────────────────────────────

function TimePresetRow({
  value,
  onChange,
}: {
  value: TimePreset;
  onChange: (v: TimePreset) => void;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>Time available</Text>
      <View style={styles.presetRow}>
        {TIME_PRESETS.map(preset => (
          <TouchableOpacity
            key={preset}
            style={[styles.presetButton, value === preset && styles.presetButtonSelected]}
            onPress={() => onChange(preset)}
            activeOpacity={0.8}
          >
            <Text style={[styles.presetText, value === preset && styles.presetTextSelected]}>
              {preset} min
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function CheckInFlow({ profile, onComplete }: CheckInFlowProps) {
  const [energy, setEnergy]       = useState(3);
  const [stress, setStress]       = useState(3);
  const [sleep, setSleep]         = useState(3);
  const [weight, setWeight]       = useState('');
  const [weightSkipped, setWeightSkipped] = useState(false);

  const defaultMinutes = useMemo(
    () => nearestPreset(profile?.preferredDuration ?? 30),
    [profile]
  );
  const [availableMinutes, setAvailableMinutes] = useState<TimePreset>(defaultMinutes);

  const handleBegin = useCallback(() => {
    const now = new Date().toISOString();
    const checkIn: RawCheckIn = {
      schemaVersion: '1.0',
      sessionType: 'morning',
      uid: profile?.uid ?? '',
      date: todayKey(),
      energy,
      stress,
      sleepQuality: sleep,
      availableMinutes,
      mood: '',
      firstCommitment: {
        time: '09:00',
        type: 'SOLO_DEEP_WORK',
        leadTimeMinutes: 60,
      },
      updatedWeight: weightSkipped ? '' : weight.trim(),
      voiceTranscriptPresent: false,
      createdAt: now,
    };
    onComplete(checkIn);
  }, [energy, stress, sleep, availableMinutes, weight, weightSkipped, profile, onComplete]);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>How are you this morning?</Text>

        <StepSelector
          label="Energy"
          value={energy}
          onChange={setEnergy}
          leftLabel="Low"
          rightLabel="High"
        />

        <StepSelector
          label="Stress"
          value={stress}
          onChange={setStress}
          leftLabel="Low"
          rightLabel="High"
        />

        <StepSelector
          label="Sleep quality"
          value={sleep}
          onChange={setSleep}
          leftLabel="Poor"
          rightLabel="Good"
        />

        <TimePresetRow value={availableMinutes} onChange={setAvailableMinutes} />

        {/* Weight field — optional, device-only */}
        {!weightSkipped && (
          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>Anything on your mind?</Text>
            <TextInput
              style={styles.weightInput}
              value={weight}
              onChangeText={setWeight}
              placeholder="Optional"
              placeholderTextColor={PaletteB.amberMist}
              multiline
              numberOfLines={2}
              maxLength={300}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.skipLink}
              onPress={() => setWeightSkipped(true)}
              activeOpacity={0.7}
            >
              <Text style={styles.skipLinkText}>Skip this</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={styles.beginButton}
          onPress={handleBegin}
          activeOpacity={0.85}
        >
          <Text style={styles.beginButtonText}>Begin my morning →</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  container: {
    flex: 1,
    backgroundColor: PaletteB.warmCream,
  },
  content: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 64 : 40,
    paddingBottom: 40,
  },

  heading: {
    fontSize: 26,
    fontWeight: '600',
    color: PaletteB.deepBrown,
    letterSpacing: -0.3,
    marginBottom: 36,
  },

  // Field blocks
  fieldBlock: {
    marginBottom: 32,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: PaletteB.warmWalnut,
    marginBottom: 12,
    letterSpacing: 0.1,
  },

  // Step selector
  stepRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  stepDot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 100,
    backgroundColor: PaletteB.warmStone,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotSelected: {
    backgroundColor: PaletteB.deepBrown,
    borderColor: PaletteB.deepBrown,
  },
  stepDotText: {
    fontSize: 15,
    fontWeight: '500',
    color: PaletteB.warmWalnut,
  },
  stepDotTextSelected: {
    color: PaletteB.warmCream,
  },
  stepEndLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  stepEndLabel: {
    fontSize: 11,
    color: PaletteB.amberMist,
    letterSpacing: 0.2,
  },

  // Time presets
  presetRow: {
    flexDirection: 'row',
    gap: 10,
  },
  presetButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: PaletteB.warmStone,
    borderWidth: 1.5,
    borderColor: PaletteB.dustyLinen,
    alignItems: 'center',
  },
  presetButtonSelected: {
    backgroundColor: PaletteB.deepBrown,
    borderColor: PaletteB.deepBrown,
  },
  presetText: {
    fontSize: 13,
    fontWeight: '500',
    color: PaletteB.warmWalnut,
  },
  presetTextSelected: {
    color: PaletteB.warmCream,
  },

  // Weight field
  weightInput: {
    backgroundColor: PaletteB.warmStone,
    borderRadius: 12,
    padding: 14,
    color: PaletteB.deepBrown,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: PaletteB.dustyLinen,
  },
  skipLink: {
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  skipLinkText: {
    fontSize: 13,
    color: PaletteB.amberMist,
  },

  // Begin button
  beginButton: {
    backgroundColor: PaletteB.deepBrown,
    borderRadius: 14,
    paddingVertical: 17,
    alignItems: 'center',
    marginTop: 8,
  },
  beginButtonText: {
    color: PaletteB.warmCream,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.2,
  },

  bottomSpacer: { height: 40 },
});
