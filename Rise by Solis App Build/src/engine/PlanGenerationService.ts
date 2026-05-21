/**
 * src/engine/PlanGenerationService.ts
 *
 * Rule-based fallback plan generator.
 * Runs when the AI call fails, returns 501, or has not yet been implemented.
 * Must produce a valid OperatingPlan for every Archetype × OperatingMode combination.
 *
 * Block sequences are defined per Archetype × OperatingMode.
 * Circuit breakers are applied before block generation — they may override the
 * firstBlock defined in the sequence and reduce block count.
 *
 * Plan duration is calibrated to state.availableWindow.
 * Blocks are trimmed from the end (lower priority) to fit the window.
 * If after trimming only one block remains and its duration still exceeds
 * the available window, its duration is clamped to Math.max(3, availableWindow).
 * Minimum block duration: 3 minutes.
 *
 * Block action copy varies by mode category (default / containment / recovery)
 * so that the copy reflects the user's actual operating state, not just their archetype.
 *
 * PlanRationale.uncertainty[] is always populated — content varies by mode.
 */

import type {
  Archetype,
  BlockType,
  ComplexityTolerance,
  DailyContext,
  MemorySummary,
  OnboardingProfile,
  OperatingMode,
  OperatingPlan,
  OperatingState,
  PlanRationale,
  PlanSource,
  PlanStep,
} from '../../domain/types';
import { todayKey } from '../storage/keys';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PlanGenerationInput {
  context: DailyContext;
  state: OperatingState;
  profile: OnboardingProfile;
  memorySummary: MemorySummary | null;
}

/**
 * Mode category — maps the 5 operating modes to 3 copy registers.
 * STEADY_EXECUTION + FOCUS_REBUILD → 'default'
 * HIGH_STAKES_DAY + OVERWHELM_CONTAINMENT → 'containment'
 * RECOVERY → 'recovery'
 */
type ModeCategory = 'default' | 'containment' | 'recovery';

const MODE_CATEGORY: Record<OperatingMode, ModeCategory> = {
  STEADY_EXECUTION:      'default',
  FOCUS_REBUILD:         'default',
  HIGH_STAKES_DAY:       'containment',
  OVERWHELM_CONTAINMENT: 'containment',
  RECOVERY:              'recovery',
};

// ─── Human-readable mode labels (FIX 2) ──────────────────────────────────────

const MODE_TITLE_PREFIX: Record<OperatingMode, string> = {
  RECOVERY:              'A recovery morning',
  FOCUS_REBUILD:         'Rebuilding focus',
  STEADY_EXECUTION:      'A clear morning',
  HIGH_STAKES_DAY:       'A high-stakes morning',
  OVERWHELM_CONTAINMENT: 'Containing the load',
};

const MODE_OPENING_LINE: Record<OperatingMode, Record<Archetype, string>> = {
  RECOVERY: {
    Architect: 'Ease into it. Today asks only what is essential.',
    Alchemist: 'Arrive first. The work will find you when you are ready.',
    Sentinel:  'No pressure yet. One settled moment is the entire plan.',
    Tide:      'Gentle contact with the morning. Nothing more is required.',
  },
  FOCUS_REBUILD: {
    Architect: 'Clarity before complexity. Build from the ground.',
    Alchemist: 'Movement before thinking. Arrival before output.',
    Sentinel:  'Anchor first, then assess. Security before clarity.',
    Tide:      'Direction before drift. Arrive before the day defines you.',
  },
  STEADY_EXECUTION: {
    Architect: 'Your morning is clear. Command it from the first moment.',
    Alchemist: 'You are ready to move. Begin with arrival.',
    Sentinel:  'The environment is yours to shape. Build from here.',
    Tide:      'The morning is open. Follow where the current runs.',
  },
  HIGH_STAKES_DAY: {
    Architect: 'Before the pressure arrives, claim this time.',
    Alchemist: 'Ground yourself before the demand. Arrive first.',
    Sentinel:  'Secure your foundation before the stakes become visible.',
    Tide:      'Make contact with the day before the current shifts.',
  },
  OVERWHELM_CONTAINMENT: {
    Architect: 'One thing only. The rest can wait.',
    Alchemist: 'Arrive before anything else. One move, clearly defined.',
    Sentinel:  'The load is real. Begin here — before the weight of it.',
    Tide:      'One direction. One step. Nothing more is needed right now.',
  },
};

// ─── Block template library ───────────────────────────────────────────────────
// One template per Archetype × BlockType.
// actionVariants provides three copy registers: default, containment, recovery.
// durationMinutes is the base — may be clamped to availableWindow at generation time.

interface BlockTemplate {
  blockType: BlockType;
  title: string;
  actionVariants: Record<ModeCategory, string>;
  rationale: string;
  durationMinutes: number;
}

const BLOCK_TEMPLATES: Record<Archetype, Record<BlockType, BlockTemplate>> = {
  Architect: {
    ground: {
      blockType: 'ground',
      title: 'Domain Setup',
      actionVariants: {
        default:     'Before any digital input: write down your three most important outcomes for today. Define what success looks like by end of morning.',
        containment: 'Before planning anything: three outcomes, written. Define the boundary of today before the pressure does it for you.',
        recovery:    'One outcome only. Write what today actually needs — not what you think it should need.',
      },
      rationale: 'Architect rhythm requires structural command before the first external demand.',
      durationMinutes: 8,
    },
    cognition: {
      blockType: 'cognition',
      title: 'Strategic Review',
      actionVariants: {
        default:     'Review your priorities. Identify the one action that creates the most forward movement today. Clarify your first 90-minute work block.',
        containment: 'From your grounded position: identify the one thing that must happen today. Everything else is optional.',
        recovery:    'A lighter review. What actually matters today? Name one thing and let the rest wait.',
      },
      rationale: 'Strategic clarity before execution prevents preparation from becoming its own procrastination.',
      durationMinutes: 12,
    },
    anchor: {
      blockType: 'anchor',
      title: 'Commitment Lock',
      actionVariants: {
        default:     'State your primary intention for this session — out loud or in writing. This is your anchor before the day\'s demands arrive.',
        containment: 'One sentence, written or spoken: what are you here to do today? Lock it before the pressure reframes it.',
        recovery:    'Name one small, completable intention. Not the full day — just the first real move.',
      },
      rationale: 'A defined commitment point prevents the Architect from indefinitely refining instead of beginning.',
      durationMinutes: 5,
    },
    ignite: {
      blockType: 'ignite',
      title: 'Physical Reset',
      actionVariants: {
        default:     'Five minutes of movement: walk, stretch, or any physical activity. No thinking, no planning — just movement.',
        containment: 'Three minutes of movement — enough to break the planning spiral before it consumes your preparation window.',
        recovery:    'Gentle movement only. A short walk or stretch. This is not about activation — it is about arriving in your body.',
      },
      rationale: 'Physical movement breaks the planning spiral before it consumes the time it was meant to protect.',
      durationMinutes: 6,
    },
    reset: {
      blockType: 'reset',
      title: 'Circuit Breaker',
      actionVariants: {
        default:     'Step away from all planning and preparation. Two minutes of stillness — no problem-solving, no lists.',
        containment: 'Stop. Two minutes of stillness — no assessment, no problem-solving. You cannot plan your way out of this.',
        recovery:    'Nothing required. Two minutes of complete stillness — no tasks, no output, no assessment.',
      },
      rationale: 'Prevents preparation from consuming the morning it was meant to protect.',
      durationMinutes: 4,
    },
  },

  Alchemist: {
    ignite: {
      blockType: 'ignite',
      title: 'Body Arrival',
      actionVariants: {
        default:     'Physical movement before any mental engagement. Move without a plan — run, stretch, dance. The destination is presence, not fitness.',
        containment: 'Short, deliberate movement before anything else. Three to five minutes — enough to arrive in your body before the day\'s demands do.',
        recovery:    'Gentle movement only. Not to achieve — to arrive. Slow is fine. Your body knows what it needs.',
      },
      rationale: 'Alchemist rhythm requires physical arrival before creative flow can open.',
      durationMinutes: 10,
    },
    cognition: {
      blockType: 'cognition',
      title: 'Flow Entry',
      actionVariants: {
        default:     'Open your primary creative or analytical work directly. No preparation required — begin in the middle. The work itself is the plan.',
        containment: 'Enter your most important work directly. One defined task — not the full project. Begin from arrival, not from readiness.',
        recovery:    'A lighter engagement. Open one piece of work — not to finish it, just to make contact. Presence before output.',
      },
      rationale: 'Over-planning before physical arrival blocks the Alchemist\'s transmutation process.',
      durationMinutes: 15,
    },
    anchor: {
      blockType: 'anchor',
      title: 'Object Completion',
      actionVariants: {
        default:     'Identify one small, completable task. Define what "done" looks like before you begin. Complete only that one thing — fully.',
        containment: 'Name the one thing that creates the most forward movement today. Define what "done" looks like — then do only that.',
        recovery:    'One thing. The smallest version of it. Define done before you begin.',
      },
      rationale: 'A defined completion condition creates the Alchemist\'s first win and builds forward momentum.',
      durationMinutes: 8,
    },
    ground: {
      blockType: 'ground',
      title: 'State Check',
      actionVariants: {
        default:     'Notice your current state without trying to change it. Name what you\'re feeling in one word. That\'s all — no analysis.',
        containment: 'Before anything else: one word for your current state. No analysis — just recognition. The Alchemist needs ground before flight.',
        recovery:    'Name what you\'re feeling. One word. No agenda — just honest recognition of where you are right now.',
      },
      rationale: 'Brief grounding supports Alchemist flow without introducing structure too early.',
      durationMinutes: 4,
    },
    reset: {
      blockType: 'reset',
      title: 'Pattern Break',
      actionVariants: {
        default:     'Short walk, change rooms, or brief physical movement. You\'re shifting out of over-thinking into arrival.',
        containment: 'Step away. Short walk or change of scene — enough to break the over-planning loop before it consumes you.',
        recovery:    'Change your environment. Step outside or change rooms. Nothing is required of you in this moment.',
      },
      rationale: 'Resets the Alchemist from planning mode into presence mode.',
      durationMinutes: 5,
    },
  },

  Sentinel: {
    ground: {
      blockType: 'ground',
      title: 'Physical Grounding',
      actionVariants: {
        default:     'Two minutes: feet flat on the floor, deliberate breathing. Let the environment settle before anything else begins.',
        containment: 'Before anything else: feet on the floor, one slow breath. The load is real — start here anyway.',
        recovery:    'No agenda. Feet on the floor, slow breath. The day asks nothing of you yet.',
      },
      rationale: 'Sentinel needs physical anchoring before any environmental check or self-assessment.',
      durationMinutes: 3,
    },
    anchor: {
      blockType: 'anchor',
      title: 'Role Definition',
      actionVariants: {
        default:     'In one sentence: define your role today. What are you protecting? What are you building? What are you setting aside entirely?',
        containment: 'One sentence: what is your role today? Define it before the pressure defines it for you. What are you here to protect?',
        recovery:    'A smaller definition. What is the one thing you are here to do today? Name it, and let everything else wait.',
      },
      rationale: 'Clarity of role prevents the Sentinel from amplifying pressure through premature self-assessment.',
      durationMinutes: 8,
    },
    cognition: {
      blockType: 'cognition',
      title: 'Situational Assessment',
      actionVariants: {
        default:     'From your secured position: review today\'s priorities and assess your capacity — in that order. Assessment before security amplifies pressure.',
        containment: 'From your grounded position: one priority only. What is the most important thing, and what does it actually require of you?',
        recovery:    'A light review from a settled place. What needs your attention today — and what can genuinely wait?',
      },
      rationale: 'Assessment from stability produces clarity; assessment before stability produces pressure.',
      durationMinutes: 12,
    },
    ignite: {
      blockType: 'ignite',
      title: 'Activation Movement',
      actionVariants: {
        default:     'Brief physical movement to activate the nervous system before role engagement. Two to three minutes maximum.',
        containment: 'Two minutes of movement — not to energise, but to arrive. Physical activation before role assessment.',
        recovery:    'Gentle movement only. No activation required — just physical presence before any mental engagement.',
      },
      rationale: 'Physical activation supports the Sentinel\'s grounding sequence without replacing it.',
      durationMinutes: 3,
    },
    reset: {
      blockType: 'reset',
      title: 'Pressure Release',
      actionVariants: {
        default:     'Release any early-morning self-assessment or readiness check. You do not need to know if you\'re ready yet. The morning will reveal that.',
        containment: 'Stop the readiness check. You cannot assess your way to security — only action will reveal your capacity today.',
        recovery:    'Release the self-assessment entirely. You do not need to be ready. The morning asks only for your presence.',
      },
      rationale: 'Sentinels who assess readiness too early amplify rather than reduce morning pressure.',
      durationMinutes: 4,
    },
  },

  Tide: {
    ignite: {
      blockType: 'ignite',
      title: 'Sensory Contact',
      actionVariants: {
        default:     'Make deliberate contact with the morning through your senses before any screen: natural light, movement, warmth. The day begins here.',
        containment: 'Sensory contact before any demand. Natural light or movement — brief, deliberate. This is how the day begins, not how it continues.',
        recovery:    'Just light and movement. Step outside or open a window. The day does not require your full attention yet.',
      },
      rationale: 'Tide rhythm requires sensory contact with the day before directional clarity can emerge.',
      durationMinutes: 10,
    },
    ground: {
      blockType: 'ground',
      title: 'Direction Finding',
      actionVariants: {
        default:     'After physical arrival, ask one question: what direction does today want to move in? Write one word or phrase. Do not analyse.',
        containment: 'One question: what direction matters today? Write one word before the demands arrive and take the answer from you.',
        recovery:    'No analysis required. One word for the day\'s direction — or none. This is a gentle finding, not a planning exercise.',
      },
      rationale: 'Direction-finding before screens prevents the Tide from drifting into digital input before clarity forms.',
      durationMinutes: 6,
    },
    cognition: {
      blockType: 'cognition',
      title: 'Clarity Window',
      actionVariants: {
        default:     'From your arrived state, engage with the one thing that needs your mind most. Natural structure will emerge from presence, not from plans.',
        containment: 'From arrival: one thing only. The thing that most needs your attention today. Structure will emerge — do not force it.',
        recovery:    'Make light contact with your most important work. No output required — just presence. The Tide returns when conditions allow.',
      },
      rationale: 'Structured thinking after physical arrival honours the Tide\'s ebb-and-flow nature.',
      durationMinutes: 12,
    },
    anchor: {
      blockType: 'anchor',
      title: 'First Move',
      actionVariants: {
        default:     'Take the first concrete action of the day — the one thing that starts the flow. Do it now, without refinement or preparation.',
        containment: 'One concrete action — the simplest version of your most important move. Do it now, without further preparation.',
        recovery:    'The smallest possible first move. No preparation required — just the first step, exactly as it is.',
      },
      rationale: 'A defined first action gives the Tide a channel rather than a shoreline to drift along.',
      durationMinutes: 6,
    },
    reset: {
      blockType: 'reset',
      title: 'Drift Check',
      actionVariants: {
        default:     'Pause and ask: have you moved toward screens before directional clarity? If yes, return to sensory contact before continuing.',
        containment: 'Pause. Have you drifted toward screens before direction? Return to sensory contact — one breath, one step back.',
        recovery:    'No screens, no assessment. Return to the morning — light, stillness, one breath. Direction will come when you are ready.',
      },
      rationale: 'Screen consumption before directional clarity is the Tide\'s primary anti-pattern.',
      durationMinutes: 3,
    },
  },
};

// ─── Sequence library ─────────────────────────────────────────────────────────
// Defines the block order (by BlockType) for each Archetype × OperatingMode.
// Circuit breakers may override index 0.

const SEQUENCES: Record<Archetype, Record<OperatingMode, BlockType[]>> = {
  Architect: {
    STEADY_EXECUTION: ['ground', 'cognition', 'anchor'],
    RECOVERY:         ['ground', 'reset'],
    FOCUS_REBUILD:    ['ground', 'ignite', 'cognition'],
    HIGH_STAKES_DAY:  ['ignite', 'cognition', 'anchor'],   // circuit: ignite first
    OVERWHELM_CONTAINMENT: ['ignite', 'anchor'],            // circuit: ignite first, reduced
  },
  Alchemist: {
    STEADY_EXECUTION: ['ignite', 'cognition', 'anchor'],
    RECOVERY:         ['ground', 'reset'],
    FOCUS_REBUILD:    ['ignite', 'ground', 'cognition'],
    HIGH_STAKES_DAY:  ['anchor', 'ignite', 'cognition'],   // circuit: anchor first, ≤3 blocks
    OVERWHELM_CONTAINMENT: ['anchor', 'ignite'],            // circuit: anchor first, ≤3 blocks
  },
  Sentinel: {
    STEADY_EXECUTION: ['ground', 'anchor', 'cognition'],
    RECOVERY:         ['ground', 'reset'],
    FOCUS_REBUILD:    ['ground', 'anchor', 'cognition'],
    HIGH_STAKES_DAY:  ['ground', 'anchor', 'cognition'],
    OVERWHELM_CONTAINMENT: ['ground', 'anchor'],
  },
  Tide: {
    STEADY_EXECUTION: ['ignite', 'ground', 'anchor'],
    RECOVERY:         ['ground', 'reset'],
    FOCUS_REBUILD:    ['ignite', 'ground', 'cognition'],
    HIGH_STAKES_DAY:  ['ignite', 'anchor', 'cognition'],   // circuit: ignite first
    OVERWHELM_CONTAINMENT: ['ignite', 'anchor'],            // circuit: ignite first
  },
};

// ─── Block count ceiling ──────────────────────────────────────────────────────

function blockCeiling(
  complexity: ComplexityTolerance,
  mode: OperatingMode,
  archetype: Archetype
): number {
  // Hard limits from circuit breakers
  if (mode === 'OVERWHELM_CONTAINMENT') return 2;
  if (archetype === 'Alchemist' && mode === 'HIGH_STAKES_DAY') return 3;
  if (mode === 'RECOVERY') return 2;
  // Complexity-based ceiling
  const base = complexity === 'layered' ? 6 : 3;
  // Architect HIGH_STAKES: reduce by 50%
  if (archetype === 'Architect' && mode === 'HIGH_STAKES_DAY') {
    return Math.max(2, Math.floor(base * 0.5));
  }
  return base;
}

// ─── Time label helper ────────────────────────────────────────────────────────

function buildTimeLabel(wakeTarget: string, offsetMinutes: number): string {
  const [hStr, mStr] = wakeTarget.split(':');
  const baseH = parseInt(hStr ?? '6', 10);
  const baseM = parseInt(mStr ?? '0', 10);
  const totalM = baseH * 60 + baseM + offsetMinutes;
  const h = Math.floor(totalM / 60) % 24;
  const m = totalM % 60;
  const suffix = h < 12 ? 'AM' : 'PM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const displayM = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
  return `${displayH}${displayM} ${suffix}`;
}

// ─── Today ISO helper ─────────────────────────────────────────────────────────

function todayISO(): string {
  return new Date().toISOString().split('T')[0] ?? todayKey();
}

// ─── Rationale builder ────────────────────────────────────────────────────────

const MODE_UNCERTAINTY: Record<OperatingMode, string> = {
  RECOVERY:
    'This plan was generated from rules, not your personal history. Recovery mornings vary — accuracy will improve as your patterns emerge.',
  FOCUS_REBUILD:
    'This plan was generated from rules. What rebuilds clarity varies significantly between people — your history will sharpen this over time.',
  STEADY_EXECUTION:
    'This plan was generated from rules, not from your personal history. Accuracy improves with use.',
  HIGH_STAKES_DAY:
    'This plan was generated from rules. High-stakes mornings carry context the system cannot yet read — your feedback will sharpen future plans.',
  OVERWHELM_CONTAINMENT:
    'This plan was generated from rules. When load is at its highest, individual responses vary most — your history will help the system calibrate.',
};

function buildRationale(
  context: DailyContext,
  state: OperatingState,
  profile: OnboardingProfile
): PlanRationale {
  const energyLabel = context.physiologicalState.energy.toLowerCase();
  const stressLabel = context.physiologicalState.stress.toLowerCase();
  const modeLabel = state.mode.replace(/_/g, ' ').toLowerCase();

  const noticed: string[] = [
    `Your energy is ${energyLabel} and your stress is ${stressLabel} this morning.`,
    `Your ${profile.archetype} archetype and ${profile.seasonalFocus} seasonal focus shape this plan.`,
  ];

  if (context.flags.includes('HAS_TIME_SPECIFIC_WEIGHT')) {
    noticed.push('A time-specific commitment or pressure point was noted in your morning context.');
  }
  if (context.flags.includes('POOR_SLEEP')) {
    noticed.push('Sleep quality was below your usual baseline — plan calibrated accordingly.');
  }

  const planLogic = `Operating mode: ${state.mode}. Your ${energyLabel} energy and ${stressLabel} stress directed a ${modeLabel} sequence. The first block is ${state.firstBlockOverride ?? 'guided by your archetype'}.`;

  const protecting = `Your ${profile.seasonalFocus} season — protecting the conditions that make this period productive.`;
  const creating = `Traction toward your ${profile.seasonalFocus} direction — each session builds the pattern.`;

  const uncertainty: string[] = [
    MODE_UNCERTAINTY[state.mode],
  ];

  return {
    noticed,
    planLogic,
    firstBlockReason: `Starting with ${state.firstBlockOverride ?? 'the first block'} because your ${profile.archetype} archetype needs this foundation before moving forward.`,
    protecting,
    creating,
    uncertainty,
    operatingMode: state.mode,
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generatePlan(input: PlanGenerationInput): OperatingPlan {
  const { context, state, profile } = input;
  const archetype = profile.archetype;
  const mode = state.mode;
  const modeCategory = MODE_CATEGORY[mode];
  const now = new Date().toISOString();
  const today = todayISO();

  // Get base sequence for this archetype × mode
  const sequenceTypes = SEQUENCES[archetype][mode];
  const ceiling = blockCeiling(profile.complexityTolerance, mode, archetype);

  // Cap to ceiling
  let candidateTypes = sequenceTypes.slice(0, ceiling);

  // Build steps — trim from end if total duration exceeds availableWindow
  let totalDuration = candidateTypes
    .map(bt => BLOCK_TEMPLATES[archetype][bt])
    .reduce((sum, t) => sum + t.durationMinutes, 0);

  // Trim blocks from end until within window (keep minimum of 1 block)
  while (totalDuration > state.availableWindow && candidateTypes.length > 1) {
    candidateTypes = candidateTypes.slice(0, -1);
    totalDuration = candidateTypes
      .map(bt => BLOCK_TEMPLATES[archetype][bt])
      .reduce((sum, t) => sum + t.durationMinutes, 0);
  }

  // FIX 1 — Duration clamp for single-block case:
  // If one block remains and still exceeds availableWindow,
  // clamp its duration to Math.max(3, availableWindow).
  // Minimum is 3 minutes — never reduce below that regardless of window.
  let singleBlockClampedDuration: number | null = null;
  if (candidateTypes.length === 1) {
    const template = BLOCK_TEMPLATES[archetype][candidateTypes[0]!];
    if (template.durationMinutes > state.availableWindow) {
      singleBlockClampedDuration = Math.max(3, state.availableWindow);
      totalDuration = singleBlockClampedDuration;
    }
  }

  // Assemble PlanStep objects with time labels and mode-aware action copy
  let offsetMinutes = 0;
  const mainSequence: PlanStep[] = candidateTypes.map((bt, i) => {
    const template = BLOCK_TEMPLATES[archetype][bt];
    const duration = (i === 0 && singleBlockClampedDuration !== null)
      ? singleBlockClampedDuration
      : template.durationMinutes;
    const step: PlanStep = {
      order: i + 1,
      timeLabel: buildTimeLabel(profile.wakeTarget, offsetMinutes),
      blockType: template.blockType,
      title: template.title,
      action: template.actionVariants[modeCategory],
      rationale: template.rationale,
      durationMinutes: duration,
    };
    offsetMinutes += duration;
    return step;
  });

  // Fallback sequence: minimal 2-step for any state (universal, not archetype-specific)
  const fallbackSequence: PlanStep[] = [
    {
      order: 1,
      timeLabel: buildTimeLabel(profile.wakeTarget, 0),
      blockType: 'ground',
      title: 'Minimum Viable Morning',
      action: 'One thing: settle your nervous system before any demand. Stillness, breath, or gentle movement. Nothing else is required.',
      rationale: 'When capacity is lowest, one grounded moment is the entire plan.',
      durationMinutes: 5,
    },
    {
      order: 2,
      timeLabel: buildTimeLabel(profile.wakeTarget, 5),
      blockType: 'anchor',
      title: 'Single Non-Negotiable',
      action: 'Name the one thing that cannot go undone today. Write it. That\'s your morning.',
      rationale: 'One anchor prevents the fragmented energy of trying to do everything.',
      durationMinutes: 5,
    },
  ];

  const rationale = buildRationale(context, state, profile);

  const planId = `${today}:morning`;
  const source: PlanSource = 'rule-based';

  // FIX 2 — Human-readable planTitle and openingLine (no enum casing, no underscores)
  const archetypeLabel = archetype; // 'Architect' | 'Alchemist' | 'Sentinel' | 'Tide' — already title-case
  const planTitle = `${MODE_TITLE_PREFIX[mode]} · ${archetypeLabel}`;
  const openingLine = MODE_OPENING_LINE[mode][archetype];

  return {
    schemaVersion: '1.0',
    promptVersion: '1.0',
    sessionType: 'morning',
    uid: profile.uid,
    date: today,
    planId,
    planTitle,
    openingLine,
    planObjective: `Use the next ${state.availableWindow} minutes to establish the foundation for your day.`,
    rationale,
    mainSequence,
    fallbackSequence,
    nonNegotiableAction: mainSequence[0]?.action ?? 'Begin with presence.',
    sensoryCue: archetype === 'Tide' || archetype === 'Alchemist'
      ? 'Natural light or movement before any screen contact.'
      : 'Quiet space, tools in place, digital input deferred.',
    antiPatternWarning: {
      Architect: 'Preparation that never ends is not preparation — it is avoidance.',
      Alchemist: 'Planning the work before arriving in the body blocks creative flow.',
      Sentinel:  'Self-assessment before state stabilisation amplifies pressure.',
      Tide:      'Screen contact before directional clarity is drift, not flow.',
    }[archetype],
    summaryInsight: `Rule-based plan for ${archetypeLabel}. ${MODE_TITLE_PREFIX[mode]}.`,
    confidenceNote: 'low',
    internalArchetype: archetype,
    operatingMode: mode,
    source,
    generatedAt: now,
  };
}
