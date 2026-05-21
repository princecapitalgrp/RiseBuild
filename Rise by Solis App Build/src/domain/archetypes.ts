/**
 * src/domain/archetypes.ts
 * Deterministic 2×2 archetype calculation.
 * Pure TypeScript — no side effects, no storage, no React.
 *
 * AXIS 1 — AgencyStructure: 'Author' | 'Protagonist'
 * AXIS 2 — PressureResponse: 'Push' | 'Pull'
 *
 * Matrix:
 *   Author   × Push → Architect
 *   Author   × Pull → Alchemist
 *   Protagonist × Push → Sentinel
 *   Protagonist × Pull → Tide
 *
 * Translation strings: non-essentialising. Always "tends to" not "is/always".
 * Never: "you are wired", "you are a [archetype]".
 * Approved copy only — do not paraphrase.
 */
import type { Archetype, OnboardingProfile } from '../../domain/types';

export function calculateArchetype(profile: Partial<OnboardingProfile>): {
  archetype: Archetype;
  confidence: number;
  translation: string;
} {
  const { agencyStructure, pressureResponse } = profile;

  // Step 1: Deterministic 2×2
  let archetype: Archetype = 'Tide'; // Default fallback

  if (agencyStructure === 'Author' && pressureResponse === 'Push') {
    archetype = 'Architect';
  } else if (agencyStructure === 'Author' && pressureResponse === 'Pull') {
    archetype = 'Alchemist';
  } else if (agencyStructure === 'Protagonist' && pressureResponse === 'Push') {
    archetype = 'Sentinel';
  } else if (agencyStructure === 'Protagonist' && pressureResponse === 'Pull') {
    archetype = 'Tide';
  }

  // Step 2: Confidence scoring
  // Both primary signals present → high confidence.
  // One signal missing → partial data.
  const confidence = agencyStructure && pressureResponse ? 0.85 : 0.6;

  // Step 3: Translation — approved verbatim copy only.
  const translations: Record<Archetype, string> = {
    Architect:
      "You tend to move better when the morning has a clear shape before the day's demands arrive. Not rigidity — structure as a form of freedom. Today's plan is built around that.",
    Alchemist:
      'Your momentum tends to come through doing, not through preparing to do. A finished thing early creates the conditions for everything else. That\'s where today opens.',
    Sentinel:
      "You tend to give the day your best attention once the environment feels settled and your footing is clear. Today starts there — before anything else asks something of you.",
    Tide:
      "Your energy tends to move in natural rhythms rather than schedule lines. Mornings that honor that tend to go better than mornings that push against it. Today's plan follows that.",
  };

  return { archetype, confidence, translation: translations[archetype] };
}

export const ARCHETYPE_DESCRIPTIONS: Record<Archetype, { tagline: string; description: string }> = {
  Architect: {
    tagline: 'Designer of the Morning Domain',
    description:
      "You tend to move better when the morning has a clear shape before the day's demands arrive. Not rigidity — structure as a form of freedom.",
  },
  Alchemist: {
    tagline: 'Transformer of Creative Flow',
    description:
      'Your momentum tends to come through doing, not through preparing to do. A finished thing early creates the conditions for everything else.',
  },
  Sentinel: {
    tagline: 'Guardian of the Secured Start',
    description:
      "You tend to give the day your best attention once the environment feels settled and your footing is clear.",
  },
  Tide: {
    tagline: 'Voyager of Natural Momentum',
    description:
      "Your energy tends to move in natural rhythms rather than schedule lines. Mornings that honor that tend to go better than mornings that push against it.",
  },
};
