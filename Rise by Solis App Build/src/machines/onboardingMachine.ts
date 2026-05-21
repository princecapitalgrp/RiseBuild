/**
 * src/machines/onboardingMachine.ts
 *
 * XState v5 machine for the 10-question onboarding flow.
 *
 * State graph (10 states):
 *   sleepWindow → agencyStructure → pressureResponse → complexity
 *   → sensoryRegulation → theWeight → seasonalFocus
 *   → archetypeReveal → authGate → complete (final)
 *
 * Context accumulates Partial<OnboardingProfile> step by step.
 * Guards check event payload — not context — because context is only
 * updated AFTER a guard passes (via the assign action that follows).
 *
 * State restoration (after app purge mid-onboarding):
 *   OnboardingFlow reads getDraftSession() + getCurrentOnboardingStep()
 *   from SessionRepository, creates an actor with the saved context as
 *   input, fast-forwards via synthetic NEXT events to the correct step,
 *   and passes the resulting snapshot to useMachine().
 *
 * MMKV writes happen inside assign actions — synchronous and safe.
 * No async operations live inside the machine.
 */

import { setup, assign } from 'xstate';
import type { SnapshotFrom } from 'xstate';
import type { OnboardingProfile } from '../../domain/types';
import { calculateArchetype } from '../domain/archetypes';
import { profileRepository } from '../repositories/ProfileRepository';
import { sessionRepository } from '../repositories/SessionRepository';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingMachineContext = Partial<OnboardingProfile> & {
  /** Set when an auth attempt fails. Cleared when auth is retried. */
  authError?: string;
};

export type OnboardingMachineEvent =
  | { type: 'NEXT'; payload: Partial<OnboardingProfile> }
  | { type: 'BACK' }
  | { type: 'SKIP' }
  | { type: 'AUTH_COMPLETE'; uid: string }
  | { type: 'AUTH_FAILED'; error: string };

// ─── Step index map ────────────────────────────────────────────────────────────
// Maps machine state name → sequential 0-based index.
// Used by OnboardingFlow to persist and restore position after purge.

export const ONBOARDING_STEP_INDEX: Readonly<Record<string, number>> = {
  sleepWindow:       0,
  agencyStructure:   1,
  pressureResponse:  2,
  complexity:        3,
  sensoryRegulation: 4,
  theWeight:         5,
  seasonalFocus:     6,
  archetypeReveal:   7,
  authGate:          8,
  complete:          9,
} as const;

// ─── Machine ──────────────────────────────────────────────────────────────────

export const onboardingMachine = setup({
  types: {
    context: {} as OnboardingMachineContext,
    events: {} as OnboardingMachineEvent,
    input: {} as Partial<OnboardingProfile> | undefined,
  },

  // ── Actions ─────────────────────────────────────────────────────────────────

  actions: {
    /**
     * Merges NEXT event payload into context and persists the updated draft.
     * Used on every NEXT transition for question steps.
     */
    mergeAndSavePayload: assign(({ context, event }) => {
      if (event.type !== 'NEXT') return {};
      const updates = event.payload ?? {};
      sessionRepository.saveDraftSession({ ...context, ...updates });
      return updates;
    }),

    /**
     * Sets theWeight to null (explicit skip) and persists the draft.
     * Called when the user sends SKIP on the theWeight step.
     */
    skipTheWeightAndSave: assign(({ context }) => {
      const updates = { theWeight: null as string | null };
      sessionRepository.saveDraftSession({ ...context, ...updates });
      return updates;
    }),

    /**
     * Runs on entry to archetypeReveal.
     * Computes the archetype from agencyStructure × pressureResponse,
     * updates context with the result, and persists the draft
     * (uid is still empty — the real uid is set at AUTH_COMPLETE).
     */
    computeAndSaveArchetype: assign(({ context }) => {
      const result = calculateArchetype(context);
      const now = new Date().toISOString();
      const updates = {
        archetype: result.archetype,
        archetypeTranslation: result.translation,
        archetypeConfidence: result.confidence,
        schemaVersion: '1.0',
        createdAt: context.createdAt ?? now,
        updatedAt: now,
      };
      sessionRepository.saveDraftSession({ ...context, ...updates });
      return updates;
    }),

    /**
     * Runs on AUTH_COMPLETE.
     * Assembles the full OnboardingProfile with the real uid,
     * saves it via profileRepository, and clears the draft session.
     * Also records the first session date (idempotent).
     */
    saveOnboardingComplete: assign(({ context, event }) => {
      if (event.type !== 'AUTH_COMPLETE') return {};
      const now = new Date().toISOString();
      const profile: OnboardingProfile = {
        schemaVersion: context.schemaVersion ?? '1.0',
        uid: event.uid,
        createdAt: context.createdAt ?? now,
        updatedAt: now,
        consentTimestamp: sessionRepository.getConsentTimestamp() ?? now,
        wakeTarget: context.wakeTarget!,
        preferredDuration: context.preferredDuration!,
        movementBaseline: context.movementBaseline!,
        agencyStructure: context.agencyStructure!,
        pressureResponse: context.pressureResponse!,
        archetype: context.archetype!,
        archetypeTranslation: context.archetypeTranslation!,
        archetypeConfidence: context.archetypeConfidence!,
        complexityTolerance: context.complexityTolerance!,
        needsRationale: context.needsRationale!,
        overwhelmStyle: context.overwhelmStyle!,
        sensoryStyle: context.sensoryStyle!,
        theWeight: context.theWeight ?? null,
        seasonalFocus: context.seasonalFocus!,
        wakeState: context.wakeState,
      };
      profileRepository.saveOnboardingProfile(profile);
      sessionRepository.clearDraftSession();
      sessionRepository.recordFirstSessionIfNeeded();
      return { uid: event.uid, updatedAt: now };
    }),

    /** Records the auth error message into context so the UI can display it. */
    recordAuthError: assign(({ event }) => {
      if (event.type !== 'AUTH_FAILED') return {};
      return { authError: event.error };
    }),

    /** Clears any stale auth error from context before a retry. */
    clearAuthError: assign(() => ({ authError: undefined as string | undefined })),
  },

  // ── Guards ──────────────────────────────────────────────────────────────────
  // Guards inspect the EVENT PAYLOAD, not context.
  // Context is only updated AFTER the guard passes (via the assign action).

  guards: {
    hasWakeTarget: ({ event }) =>
      event.type === 'NEXT' &&
      typeof event.payload?.wakeTarget === 'string' &&
      event.payload.wakeTarget.trim().length > 0 &&
      typeof event.payload?.preferredDuration === 'number',

    hasAgencyStructure: ({ event }) =>
      event.type === 'NEXT' &&
      (event.payload?.agencyStructure === 'Author' ||
        event.payload?.agencyStructure === 'Protagonist'),

    hasPressureResponse: ({ event }) =>
      event.type === 'NEXT' &&
      (event.payload?.pressureResponse === 'Push' ||
        event.payload?.pressureResponse === 'Pull'),

    hasComplexity: ({ event }) =>
      event.type === 'NEXT' &&
      event.payload?.complexityTolerance !== undefined &&
      event.payload?.needsRationale !== undefined,

    hasSensoryRegulation: ({ event }) =>
      event.type === 'NEXT' &&
      event.payload?.sensoryStyle !== undefined &&
      event.payload?.overwhelmStyle !== undefined,

    hasSeasonalFocus: ({ event }) =>
      event.type === 'NEXT' &&
      event.payload?.seasonalFocus !== undefined &&
      event.payload?.movementBaseline !== undefined,
  },
}).createMachine({
  id: 'onboarding',
  initial: 'sleepWindow',

  /** Input populates initial context — used for draft restoration after purge. */
  context: ({ input }) => ({ ...(input ?? {}) }),

  states: {

    // ── Question steps ─────────────────────────────────────────────────────

    sleepWindow: {
      on: {
        NEXT: {
          guard: 'hasWakeTarget',
          actions: 'mergeAndSavePayload',
          target: 'agencyStructure',
        },
      },
    },

    agencyStructure: {
      on: {
        NEXT: {
          guard: 'hasAgencyStructure',
          actions: 'mergeAndSavePayload',
          target: 'pressureResponse',
        },
        BACK: { target: 'sleepWindow' },
      },
    },

    pressureResponse: {
      on: {
        NEXT: {
          guard: 'hasPressureResponse',
          actions: 'mergeAndSavePayload',
          target: 'complexity',
        },
        BACK: { target: 'agencyStructure' },
      },
    },

    complexity: {
      on: {
        NEXT: {
          guard: 'hasComplexity',
          actions: 'mergeAndSavePayload',
          target: 'sensoryRegulation',
        },
        BACK: { target: 'pressureResponse' },
      },
    },

    sensoryRegulation: {
      on: {
        NEXT: {
          guard: 'hasSensoryRegulation',
          actions: 'mergeAndSavePayload',
          target: 'theWeight',
        },
        BACK: { target: 'complexity' },
      },
    },

    theWeight: {
      // No guard on NEXT — theWeight text is optional. UI sends payload
      // with { theWeight: string } if text was entered, or no payload.
      // SKIP sends null explicitly.
      on: {
        NEXT: {
          actions: 'mergeAndSavePayload',
          target: 'seasonalFocus',
        },
        SKIP: {
          actions: 'skipTheWeightAndSave',
          target: 'seasonalFocus',
        },
        BACK: { target: 'sensoryRegulation' },
      },
    },

    seasonalFocus: {
      on: {
        NEXT: {
          guard: 'hasSeasonalFocus',
          actions: 'mergeAndSavePayload',
          target: 'archetypeReveal',
        },
        BACK: { target: 'theWeight' },
      },
    },

    // ── Result screens ─────────────────────────────────────────────────────

    archetypeReveal: {
      /**
       * On entry: compute archetype from the two primary signals and write
       * the draft to MMKV. This is the point of no return for data collection.
       * The user sees their archetype name, tagline, and translation here.
       */
      entry: 'computeAndSaveArchetype',
      on: {
        NEXT: { target: 'authGate' },
      },
    },

    authGate: {
      /**
       * The app presents Firebase auth (Email / Google / Apple).
       * AUTH_COMPLETE fires when the auth provider returns a uid.
       * AUTH_FAILED fires on provider error — user stays on authGate.
       */
      on: {
        AUTH_COMPLETE: {
          actions: 'saveOnboardingComplete',
          target: 'complete',
        },
        AUTH_FAILED: {
          actions: 'recordAuthError',
          // No target — machine stays in authGate so the user can retry.
        },
        NEXT: {
          // Retry after clearing error (e.g. user taps "Try again").
          actions: 'clearAuthError',
        },
      },
    },

    complete: {
      type: 'final',
    },
  },
});

// ─── Snapshot type ─────────────────────────────────────────────────────────────
// Exported for use in OnboardingFlow when restoring machine state after purge.

export type OnboardingSnapshot = SnapshotFrom<typeof onboardingMachine>;
