/**
 * src/components/onboarding/OnboardingFlow.tsx
 *
 * Root coordinator for the onboarding experience. Mounts inside
 * app/onboarding/index.tsx.
 *
 * Responsibilities:
 *   - Detects and restores a mid-onboarding draft after app purge
 *   - Manages the XState onboarding machine lifecycle
 *   - Persists step index to MMKV on every state transition
 *   - Routes to the correct step component based on machine state
 *   - Notifies parent when onboarding is complete (via onComplete prop)
 *
 * State restoration strategy (after purge on same device):
 *   1. Read savedDraft and savedStepIndex from SessionRepository
 *   2. Create a temporary actor with savedDraft as input
 *   3. Fast-forward actor synchronously to savedStepIndex via synthetic events
 *   4. Capture snapshot, stop temp actor, pass snapshot to useMachine
 *   All of the above happens in useMemo — zero flash, no intermediate renders.
 *
 * Step rendering: each step is rendered conditionally from `stateValue`.
 * As step components are built (FILES 3–9), their inline stubs below are
 * replaced with the imported component. The props interface stays constant.
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useMachine } from '@xstate/react';
import { createActor } from 'xstate';

import {
  onboardingMachine,
  ONBOARDING_STEP_INDEX,
  type OnboardingMachineContext,
  type OnboardingMachineEvent,
} from '../../machines/onboardingMachine';
import { SleepWindowStep } from './steps/SleepWindowStep';
import { AgencyStructureStep } from './steps/AgencyStructureStep';
import { PressureResponseStep } from './steps/PressureResponseStep';
import { ComplexityStep } from './steps/ComplexityStep';
import { SensoryRegulationStep } from './steps/SensoryRegulationStep';
import { TheWeightStep } from './steps/TheWeightStep';
import { SeasonalFocusStep } from './steps/SeasonalFocusStep';
import { ArchetypeRevealScreen } from '../../screens/onboarding/ArchetypeRevealScreen';
import { AuthGateScreen } from '../../screens/onboarding/AuthGateScreen';
import { sessionRepository } from '../../repositories/SessionRepository';
import type { OnboardingProfile } from '../../../domain/types';
import { PaletteB } from '../../design/tokens';

// ─── Step component props interface ───────────────────────────────────────────
// Shared by every question-step component. TheWeightStep extends with onSkip.

export interface StepProps {
  context: OnboardingMachineContext;
  onNext: (payload: Partial<OnboardingProfile>) => void;
  onBack: () => void;
}

export interface TheWeightStepProps extends StepProps {
  onSkip: () => void;
}

// ─── Fast-forward transition map ──────────────────────────────────────────────
// Index i = the event to send to advance FROM step[i] TO step[i+1].
// Used during state restoration to replay completed steps synchronously.

type ForwardEvent = OnboardingMachineEvent & { type: 'NEXT' | 'SKIP' };

const STEP_TRANSITIONS: ReadonlyArray<(ctx: Partial<OnboardingProfile>) => ForwardEvent> = [
  // [0] sleepWindow → agencyStructure
  (ctx) => ({ type: 'NEXT', payload: { wakeTarget: ctx.wakeTarget, preferredDuration: ctx.preferredDuration } }),
  // [1] agencyStructure → pressureResponse
  (ctx) => ({ type: 'NEXT', payload: { agencyStructure: ctx.agencyStructure } }),
  // [2] pressureResponse → complexity
  (ctx) => ({ type: 'NEXT', payload: { pressureResponse: ctx.pressureResponse } }),
  // [3] complexity → sensoryRegulation
  (ctx) => ({ type: 'NEXT', payload: { complexityTolerance: ctx.complexityTolerance, needsRationale: ctx.needsRationale } }),
  // [4] sensoryRegulation → theWeight
  (ctx) => ({ type: 'NEXT', payload: { sensoryStyle: ctx.sensoryStyle, overwhelmStyle: ctx.overwhelmStyle } }),
  // [5] theWeight → seasonalFocus  (SKIP if theWeight was explicitly null)
  (ctx) => ctx.theWeight === null
    ? { type: 'SKIP' }
    : { type: 'NEXT', payload: { theWeight: ctx.theWeight } },
  // [6] seasonalFocus → archetypeReveal
  (ctx) => ({ type: 'NEXT', payload: { seasonalFocus: ctx.seasonalFocus, movementBaseline: ctx.movementBaseline } }),
  // [7] archetypeReveal → authGate
  (_ctx) => ({ type: 'NEXT', payload: {} }),
];

// ─── Simple progress bar ───────────────────────────────────────────────────────
// Inline — will be extracted to src/components/shared/ProgressBar.tsx in Phase 4 polish.

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.min(1, Math.max(0, current / total));
  return (
    <View style={progressStyles.track}>
      <View style={[progressStyles.fill, { flex: pct }]} />
      <View style={{ flex: 1 - pct }} />
    </View>
  );
}

const progressStyles = StyleSheet.create({
  track: {
    height: 2,
    flexDirection: 'row',
    backgroundColor: PaletteB.dustyLinen,
    marginHorizontal: 24,
    marginTop: 12,
  },
  fill: {
    backgroundColor: PaletteB.dawnGold,
  },
});

// ─── Component ────────────────────────────────────────────────────────────────

interface OnboardingFlowProps {
  onComplete?: () => void;
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {

  // ── State restoration ────────────────────────────────────────────────────
  // Runs synchronously before the first render via useMemo.
  // If no draft exists, restoredSnapshot is undefined and the machine starts fresh.

  const { restoredSnapshot, initialInput } = useMemo(() => {
    const hasPending = sessionRepository.hasPendingOnboarding();
    if (!hasPending) {
      return { restoredSnapshot: undefined, initialInput: {} as Partial<OnboardingProfile> };
    }

    const savedDraft = sessionRepository.getDraftSession() ?? {};
    const savedStepIndex = sessionRepository.getCurrentOnboardingStep();

    if (savedStepIndex === 0) {
      return { restoredSnapshot: undefined, initialInput: savedDraft };
    }

    // Fast-forward a temporary actor to the saved step.
    const tempActor = createActor(onboardingMachine, { input: savedDraft });
    tempActor.start();

    const transitionCount = Math.min(savedStepIndex, STEP_TRANSITIONS.length);
    for (let i = 0; i < transitionCount; i++) {
      tempActor.send(STEP_TRANSITIONS[i](savedDraft));
    }

    const snapshot = tempActor.getSnapshot();
    tempActor.stop();

    return { restoredSnapshot: snapshot, initialInput: savedDraft };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — intentionally mount-only

  // ── Machine ──────────────────────────────────────────────────────────────

  // When snapshot is provided, XState restores from it and ignores input.
  // But @xstate/react requires input in the options type, so we always pass it.
  const [state, send] = useMachine(onboardingMachine, {
    input: initialInput,
    ...(restoredSnapshot ? { snapshot: restoredSnapshot } : {}),
  });

  // ── Persist step index on state change ───────────────────────────────────

  useEffect(() => {
    const stateName = typeof state.value === 'string' ? state.value : String(state.value);
    const index = ONBOARDING_STEP_INDEX[stateName];
    if (index !== undefined) {
      sessionRepository.setCurrentOnboardingStep(index);
    }
  }, [state.value]);

  // ── Complete callback ────────────────────────────────────────────────────

  useEffect(() => {
    if (state.matches('complete')) {
      onComplete?.();
    }
  }, [state, onComplete]);

  // ── Routing ──────────────────────────────────────────────────────────────

  const stateValue = typeof state.value === 'string' ? state.value : '';

  // ArchetypeReveal — no progress bar, full-screen dark surface
  if (stateValue === 'archetypeReveal') {
    return (
      <ArchetypeRevealScreen
        context={state.context}
        onContinue={() => send({ type: 'NEXT', payload: {} })}
      />
    );
  }

  // AuthGate — no progress bar, full-screen
  if (stateValue === 'authGate') {
    return (
      <AuthGateScreen
        context={state.context}
        authError={state.context.authError}
        onAuthComplete={(uid: string) => send({ type: 'AUTH_COMPLETE', uid })}
        onAuthFailed={(error: string) => send({ type: 'AUTH_FAILED', error })}
      />
    );
  }

  // Complete — navigation handled by useEffect above
  if (stateValue === 'complete') {
    return null;
  }

  // Question steps — shown with progress bar
  const TOTAL_QUESTION_STEPS = 7;
  const currentStepIndex = ONBOARDING_STEP_INDEX[stateValue] ?? 0;

  const stepProps: StepProps = {
    context: state.context,
    onNext: (payload) => send({ type: 'NEXT', payload }),
    onBack: () => send({ type: 'BACK' }),
  };

  return (
    <View style={styles.root}>
      <ProgressBar current={currentStepIndex + 1} total={TOTAL_QUESTION_STEPS} />
      <View style={styles.stepContainer}>
        {stateValue === 'sleepWindow' && <SleepWindowStep {...stepProps} />}
        {stateValue === 'agencyStructure' && <AgencyStructureStep {...stepProps} />}
        {stateValue === 'pressureResponse' && <PressureResponseStep {...stepProps} />}
        {stateValue === 'complexity' && <ComplexityStep {...stepProps} />}
        {stateValue === 'sensoryRegulation' && <SensoryRegulationStep {...stepProps} />}
        {stateValue === 'theWeight' && (
          <TheWeightStep
            {...stepProps}
            onSkip={() => send({ type: 'SKIP' })}
          />
        )}
        {stateValue === 'seasonalFocus' && <SeasonalFocusStep {...stepProps} />}
      </View>
    </View>
  );
}

// ─── Placeholders ──────────────────────────────────────────────────────────────
// Replaced one-by-one as FILES 3–11 are built.
// Each placeholder receives the correct props so TypeScript validates the interface.

function StepPlaceholder({ label, onNext, onBack }: StepProps & { label: string }) {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.label}>{label}</Text>
      <Text style={placeholderStyles.action} onPress={onBack}>← Back</Text>
      <Text style={placeholderStyles.action} onPress={() => onNext({})}>Next →</Text>
    </View>
  );
}

function SleepWindowPlaceholder(props: StepProps) {
  return <StepPlaceholder {...props} label="Sleep Window" />;
}
function AgencyStructurePlaceholder(props: StepProps) {
  return <StepPlaceholder {...props} label="Agency Structure" />;
}
function PressureResponsePlaceholder(props: StepProps) {
  return <StepPlaceholder {...props} label="Pressure Response" />;
}
function ComplexityPlaceholder(props: StepProps) {
  return <StepPlaceholder {...props} label="Complexity" />;
}
function SensoryRegulationPlaceholder(props: StepProps) {
  return <StepPlaceholder {...props} label="Sensory Regulation" />;
}
function TheWeightPlaceholder(props: TheWeightStepProps) {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.label}>The Weight</Text>
      <Text style={placeholderStyles.action} onPress={props.onBack}>← Back</Text>
      <Text style={placeholderStyles.action} onPress={props.onSkip}>Skip</Text>
      <Text style={placeholderStyles.action} onPress={() => props.onNext({})}>Next →</Text>
    </View>
  );
}
function SeasonalFocusPlaceholder(props: StepProps) {
  return <StepPlaceholder {...props} label="Seasonal Focus" />;
}

interface ArchetypeRevealPlaceholderProps {
  context: OnboardingMachineContext;
  onContinue: () => void;
}
function ArchetypeRevealPlaceholder({ context, onContinue }: ArchetypeRevealPlaceholderProps) {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.label}>Archetype Reveal</Text>
      <Text style={placeholderStyles.label}>{context.archetype ?? '—'}</Text>
      <Text style={placeholderStyles.action} onPress={onContinue}>Continue →</Text>
    </View>
  );
}

interface AuthGatePlaceholderProps {
  context: OnboardingMachineContext;
  authError?: string;
  onAuthComplete: (uid: string) => void;
  onAuthFailed: (error: string) => void;
}
function AuthGatePlaceholder({ authError, onAuthComplete }: AuthGatePlaceholderProps) {
  return (
    <View style={placeholderStyles.container}>
      <Text style={placeholderStyles.label}>Auth Gate</Text>
      {authError ? <Text style={placeholderStyles.error}>{authError}</Text> : null}
      <Text
        style={placeholderStyles.action}
        onPress={() => onAuthComplete('stub-uid-replace-with-firebase')}
      >
        Sign in (stub)
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: PaletteB.warmCream,
  },
  stepContainer: {
    flex: 1,
  },
});

const placeholderStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 24,
  },
  label: {
    fontSize: 20,
    fontWeight: '600',
    color: PaletteB.deepBrown,
  },
  action: {
    fontSize: 16,
    color: PaletteB.dawnGold,
    paddingVertical: 8,
  },
  error: {
    fontSize: 14,
    color: '#C0392B',
  },
});
