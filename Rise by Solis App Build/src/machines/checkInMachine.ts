/**
 * src/machines/checkInMachine.ts
 *
 * XState v5 morning check-in machine. Linear 5-step flow.
 *
 * States: energy → stress → sleepQuality → theWeight → availableMinutes → complete
 *
 * Defaults (applied at machine init from input):
 *   energy:           3
 *   stress:           3
 *   sleepQuality:     3
 *   theWeight:        null   (SKIP advances without writing)
 *   availableMinutes: profile.preferredDuration (passed as input)
 *
 * On complete entry:
 *   Assembles RawCheckIn from context and saves via checkInRepository.
 *   firstCommitment is a default value — Phase 1 does not collect it.
 *   mood defaults to '' — Phase 1 uses theWeight for InterpretationService input.
 *
 * No guards — every field has a default so NEXT always advances.
 *
 * theWeight maps to RawCheckIn.updatedWeight (same semantics, same protections).
 * Raw user text — device-only. Never sent to any server.
 */

import { setup, assign } from 'xstate';
import { checkInRepository } from '../repositories/CheckInRepository';
import { todayKey } from '../storage/keys';
import type { RawCheckIn } from '../../domain/types';

// ─── Context ──────────────────────────────────────────────────────────────────

export interface CheckInContext {
  uid: string;
  preferredDuration: number;
  energy: number;
  stress: number;
  sleepQuality: number;
  theWeight: string | null;  // maps to RawCheckIn.updatedWeight
  availableMinutes: number;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export type CheckInMachineEvent =
  | { type: 'NEXT'; payload: Partial<CheckInContext> }
  | { type: 'BACK' }
  | { type: 'SKIP' };

// ─── Machine ──────────────────────────────────────────────────────────────────

export const checkInMachine = setup({
  types: {
    context: {} as CheckInContext,
    events: {} as CheckInMachineEvent,
    input: {} as { uid: string; preferredDuration: number },
  },

  actions: {
    /**
     * Merges NEXT payload into context.
     * Called on every NEXT transition to accumulate step answers.
     */
    mergePayload: assign(({ context, event }) => {
      if (event.type !== 'NEXT') return {};
      return { ...event.payload };
    }),

    /**
     * Assembles and saves RawCheckIn to MMKV on entering the complete state.
     * Default firstCommitment covers Phase 1 — no commitment step yet.
     * mood defaults to '' — InterpretationService reads updatedWeight for tone.
     */
    saveCheckIn: assign(({ context }) => {
      const today = todayKey();
      const now = new Date().toISOString();

      const checkIn: RawCheckIn = {
        schemaVersion: '1.0',
        sessionType: 'morning',
        uid: context.uid,
        date: today,
        energy: context.energy,
        stress: context.stress,
        sleepQuality: context.sleepQuality,
        availableMinutes: context.availableMinutes,
        mood: '',
        firstCommitment: {
          time: '09:00',
          type: 'SOLO_DEEP_WORK',
          leadTimeMinutes: 60,
        },
        updatedWeight: context.theWeight ?? '',
        voiceTranscriptPresent: false,
        createdAt: now,
      };

      checkInRepository.saveCheckIn(checkIn);
      return {};
    }),
  },
}).createMachine({
  id: 'checkIn',
  initial: 'energy',

  context: ({ input }) => ({
    uid: input.uid,
    preferredDuration: input.preferredDuration,
    energy: 3,
    stress: 3,
    sleepQuality: 3,
    theWeight: null,
    availableMinutes: input.preferredDuration,
  }),

  states: {
    energy: {
      on: {
        NEXT: {
          target: 'stress',
          actions: 'mergePayload',
        },
      },
    },

    stress: {
      on: {
        NEXT: {
          target: 'sleepQuality',
          actions: 'mergePayload',
        },
        BACK: { target: 'energy' },
      },
    },

    sleepQuality: {
      on: {
        NEXT: {
          target: 'theWeight',
          actions: 'mergePayload',
        },
        BACK: { target: 'stress' },
      },
    },

    theWeight: {
      on: {
        NEXT: {
          target: 'availableMinutes',
          actions: 'mergePayload',
        },
        SKIP: {
          target: 'availableMinutes',
          // theWeight stays null — not entered
        },
        BACK: { target: 'sleepQuality' },
      },
    },

    availableMinutes: {
      on: {
        NEXT: {
          target: 'complete',
          actions: 'mergePayload',
        },
        BACK: { target: 'theWeight' },
      },
    },

    complete: {
      type: 'final',
      entry: 'saveCheckIn',
    },
  },
});
