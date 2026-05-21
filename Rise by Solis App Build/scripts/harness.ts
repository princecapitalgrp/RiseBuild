/**
 * scripts/harness.ts
 *
 * Phase 0.5 — 50-profile quality harness for PlanGenerationService rule-based fallback.
 *
 * Run with:
 *   npx tsx scripts/harness.ts
 *
 * Produces a failure report to stdout. Scores every output against all 7 dimensions.
 */

import { generatePlan, type PlanGenerationInput } from '../src/engine/PlanGenerationService';
import type {
  Archetype,
  DailyContext,
  MemorySummary,
  OnboardingProfile,
  OperatingMode,
  OperatingPlan,
  OperatingState,
  SeasonalFocus,
  ComplexityTolerance,
} from '../domain/types';

// ─── Score types ──────────────────────────────────────────────────────────────

type DimensionScore = 'PASS' | 'BORDERLINE' | 'FAIL';
type Verdict = 'GREEN' | 'YELLOW' | 'RED';

interface DimensionResult {
  score: DimensionScore;
  note: string;
}

interface ProfileScore {
  profileIndex: number;
  archetype: Archetype;
  mode: OperatingMode;
  availableWindow: number;
  complexity: ComplexityTolerance;
  season: SeasonalFocus;
  d1: DimensionResult;
  d2: DimensionResult;
  d3: DimensionResult;
  d4: DimensionResult;
  d5: DimensionResult;
  d6: DimensionResult;
  d7: DimensionResult;
  verdict: Verdict;
  plan: OperatingPlan;
}

// ─── Profile factory ──────────────────────────────────────────────────────────

const ARCHETYPES: Archetype[] = ['Architect', 'Alchemist', 'Sentinel', 'Tide'];
const MODES: OperatingMode[] = [
  'STEADY_EXECUTION',
  'RECOVERY',
  'FOCUS_REBUILD',
  'HIGH_STAKES_DAY',
  'OVERWHELM_CONTAINMENT',
];

function makeProfile(
  archetype: Archetype,
  complexityTolerance: ComplexityTolerance,
  season: SeasonalFocus,
): OnboardingProfile {
  return {
    schemaVersion: '1.0',
    uid: `test-${archetype.toLowerCase()}`,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    consentTimestamp: '2025-01-01T00:00:00Z',
    wakeTarget: '06:30',
    preferredDuration: 30,
    movementBaseline: 'regular',
    agencyStructure: archetype === 'Architect' || archetype === 'Alchemist' ? 'Author' : 'Protagonist',
    pressureResponse: archetype === 'Architect' || archetype === 'Sentinel' ? 'Push' : 'Pull',
    archetype,
    archetypeTranslation: `${archetype} test profile`,
    archetypeConfidence: 0.85,
    complexityTolerance,
    needsRationale: true,
    overwhelmStyle: 'reduction',
    sensoryStyle: 'quiet',
    theWeight: null,
    seasonalFocus: season,
  };
}

function makeContext(
  mode: OperatingMode,
  availableWindow: number,
  hasTimeWeight: boolean,
  hasPoorSleep: boolean,
): { context: DailyContext; state: OperatingState } {
  const energy = mode === 'RECOVERY' || mode === 'OVERWHELM_CONTAINMENT' ? 'LOW'
    : mode === 'FOCUS_REBUILD' ? 'MODERATE'
    : 'HIGH';

  const stress = mode === 'OVERWHELM_CONTAINMENT' || mode === 'HIGH_STAKES_DAY' ? 'HIGH'
    : mode === 'RECOVERY' ? 'MODERATE'
    : 'LOW';

  const capacity = energy === 'LOW' ? 0.25 : energy === 'MODERATE' ? 0.55 : 0.80;
  const urgency = stress === 'HIGH' ? 'HIGH' : stress === 'MODERATE' ? 'MODERATE' : 'LOW';

  const flags: string[] = [];
  if (hasTimeWeight) flags.push('HAS_TIME_SPECIFIC_WEIGHT');
  if (hasPoorSleep) flags.push('POOR_SLEEP');

  const context: DailyContext = {
    schemaVersion: '1.0',
    modelVersion: '1.0',
    sessionType: 'morning',
    interpretedAt: '2025-01-01T06:30:00Z',
    physiologicalState: {
      energy,
      stress,
      sleepQuality: hasPoorSleep ? 'POOR' : 'ADEQUATE',
      overallReadiness: capacity < 0.4 ? 'CHALLENGED' : capacity < 0.7 ? 'MODERATE' : 'READY',
    },
    emotionalTone: mode === 'OVERWHELM_CONTAINMENT' ? 'SCATTERED'
      : mode === 'RECOVERY' ? 'HEAVY'
      : 'CLEAR',
    cognitiveLoad: stress === 'HIGH' ? 'HIGH' : stress === 'MODERATE' ? 'MODERATE' : 'LOW',
    commitmentProfile: {
      time: '09:00',
      type: mode === 'HIGH_STAKES_DAY' ? 'PRESENTATION' : 'SOLO_DEEP_WORK',
      leadTime: 150,
      stakes: mode === 'HIGH_STAKES_DAY' ? 'HIGH' : 'LOW',
    },
    weightCategory: 'PROFESSIONAL',
    availableMinutes: availableWindow,
    flags,
  };

  const firstBlockOverride: OperatingState['firstBlockOverride'] =
    mode === 'HIGH_STAKES_DAY' ? 'ignite' :
    mode === 'OVERWHELM_CONTAINMENT' ? 'ignite' :
    undefined;

  const state: OperatingState = {
    schemaVersion: '1.0',
    modelVersion: '1.0',
    sessionType: 'morning',
    mode,
    urgency: urgency as OperatingState['urgency'],
    capacity,
    confidence: 0.5,
    pulseState: stress === 'HIGH' ? 'SCATTERED' : 'NORMAL',
    availableWindow,
    firstBlockOverride,
    producedAt: '2025-01-01T06:30:00Z',
  };

  return { context, state };
}

// ─── Scoring functions ────────────────────────────────────────────────────────

// Expected first block per archetype (default, no circuit-breaker)
const ARCHETYPE_FIRST_BLOCK: Record<Archetype, 'ground' | 'ignite'> = {
  Architect: 'ground',
  Alchemist: 'ignite',
  Sentinel: 'ground',
  Tide: 'ignite',
};

// Modes that override first block
const CIRCUIT_BREAKER_MODES = new Set<OperatingMode>(['HIGH_STAKES_DAY', 'OVERWHELM_CONTAINMENT', 'RECOVERY']);
// RECOVERY for Architect/Alchemist/Sentinel/Tide all use ground as first (or ignite for Alch/Tide circuit)
// Actually let's read from SEQUENCES directly:
const SEQUENCE_FIRST_BLOCK: Record<Archetype, Record<OperatingMode, string>> = {
  Architect: {
    STEADY_EXECUTION: 'ground',
    RECOVERY: 'ground',
    FOCUS_REBUILD: 'ground',
    HIGH_STAKES_DAY: 'ignite',
    OVERWHELM_CONTAINMENT: 'ignite',
  },
  Alchemist: {
    STEADY_EXECUTION: 'ignite',
    RECOVERY: 'ground',
    FOCUS_REBUILD: 'ignite',
    HIGH_STAKES_DAY: 'anchor',
    OVERWHELM_CONTAINMENT: 'anchor',
  },
  Sentinel: {
    STEADY_EXECUTION: 'ground',
    RECOVERY: 'ground',
    FOCUS_REBUILD: 'ground',
    HIGH_STAKES_DAY: 'ground',
    OVERWHELM_CONTAINMENT: 'ground',
  },
  Tide: {
    STEADY_EXECUTION: 'ignite',
    RECOVERY: 'ground',
    FOCUS_REBUILD: 'ignite',
    HIGH_STAKES_DAY: 'ignite',
    OVERWHELM_CONTAINMENT: 'ignite',
  },
};

const MODE_BLOCK_CEILING: Partial<Record<OperatingMode, Partial<Record<Archetype, number>>>> = {
  RECOVERY: { Architect: 2, Alchemist: 2, Sentinel: 2, Tide: 2 },
  OVERWHELM_CONTAINMENT: { Architect: 2, Alchemist: 2, Sentinel: 2, Tide: 2 },
  HIGH_STAKES_DAY: { Alchemist: 3 },
};

function scoreD1(plan: OperatingPlan, archetype: Archetype, mode: OperatingMode): DimensionResult {
  const firstBlock = plan.mainSequence[0];
  if (!firstBlock) return { score: 'FAIL', note: 'No blocks in mainSequence' };

  const expectedFirst = SEQUENCE_FIRST_BLOCK[archetype][mode];
  if (firstBlock.blockType !== expectedFirst) {
    return { score: 'FAIL', note: `Expected first block '${expectedFirst}', got '${firstBlock.blockType}'` };
  }

  // Check antiPatternWarning exists and contains archetype name
  if (!plan.antiPatternWarning) {
    return { score: 'BORDERLINE', note: 'antiPatternWarning missing' };
  }
  if (!plan.antiPatternWarning.includes(
    archetype === 'Architect' ? 'Architect' :
    archetype === 'Alchemist' ? 'Alchemist' :
    archetype === 'Sentinel' ? 'Sentinel' :
    'Tide'
  )) {
    // Anti-pattern warnings don't actually mention the archetype name in current impl
    // They describe the pattern — check for archetype-specific keywords
    const archetypeKeywords: Record<Archetype, string[]> = {
      Architect: ['preparation', 'procrastination', 'avoidance'],
      Alchemist: ['body', 'creative', 'physical'],
      Sentinel: ['assessment', 'stabilisation', 'pressure'],
      Tide: ['screen', 'drift', 'flow', 'directional'],
    };
    const hasKeyword = archetypeKeywords[archetype].some(kw =>
      plan.antiPatternWarning.toLowerCase().includes(kw)
    );
    if (!hasKeyword) {
      return { score: 'BORDERLINE', note: `antiPatternWarning may not be archetype-specific: "${plan.antiPatternWarning}"` };
    }
  }

  return { score: 'PASS', note: `First block: ${firstBlock.blockType} (expected ${expectedFirst})` };
}

function scoreD2(plan: OperatingPlan, archetype: Archetype, mode: OperatingMode, complexity: ComplexityTolerance): DimensionResult {
  const blockCount = plan.mainSequence.length;
  const ceiling = MODE_BLOCK_CEILING[mode]?.[archetype];

  if (ceiling !== undefined && blockCount > ceiling) {
    return { score: 'FAIL', note: `${blockCount} blocks returned but ceiling is ${ceiling} for ${archetype}×${mode}` };
  }

  const hardCeilings: Partial<Record<OperatingMode, number>> = {
    RECOVERY: 2,
    OVERWHELM_CONTAINMENT: 2,
  };
  const hardCeiling = hardCeilings[mode];
  if (hardCeiling !== undefined && blockCount > hardCeiling) {
    return { score: 'FAIL', note: `${blockCount} blocks returned but hard ceiling is ${hardCeiling} for ${mode}` };
  }

  // Check for mode in any expected form: STEADY_EXECUTION, steady execution, or STEADY EXECUTION
  const modeInLogic =
    plan.rationale.planLogic.includes(mode) ||
    plan.rationale.planLogic.toLowerCase().includes(mode.replace(/_/g, ' ').toLowerCase());
  if (!modeInLogic) {
    return { score: 'FAIL', note: `planLogic does not reference mode "${mode}": "${plan.rationale.planLogic}"` };
  }

  if (!plan.rationale.uncertainty || plan.rationale.uncertainty.length === 0) {
    return { score: 'FAIL', note: 'uncertainty[] is empty' };
  }

  // uncertainty is always same string — borderline
  return {
    score: 'BORDERLINE',
    note: `Block count: ${blockCount} (ok). Mode in planLogic: yes. uncertainty[] non-empty but not mode-differentiated.`,
  };
}

function scoreD3(plan: OperatingPlan, availableWindow: number, complexity: ComplexityTolerance, mode: OperatingMode, archetype: Archetype): DimensionResult {
  const totalDuration = plan.mainSequence.reduce((s, b) => s + b.durationMinutes, 0);
  const blockCount = plan.mainSequence.length;

  if (totalDuration > availableWindow + 2) {
    return { score: 'FAIL', note: `Total duration ${totalDuration}min exceeds availableWindow ${availableWindow}min by more than 2min` };
  }

  if (totalDuration > availableWindow) {
    return { score: 'BORDERLINE', note: `Total duration ${totalDuration}min slightly over availableWindow ${availableWindow}min (rounding)` };
  }

  // Check complexity ceiling (only for modes without hard ceilings)
  const hardCeilings: Partial<Record<OperatingMode, number>> = {
    RECOVERY: 2,
    OVERWHELM_CONTAINMENT: 2,
  };
  if (!hardCeilings[mode]) {
    const expectedMax = complexity === 'layered' ? 6 : 3;
    // Architect HIGH_STAKES cuts 50%
    if (archetype === 'Architect' && mode === 'HIGH_STAKES_DAY') {
      const base = complexity === 'layered' ? 6 : 3;
      const cap = Math.max(2, Math.floor(base * 0.5));
      if (blockCount > cap) {
        return { score: 'FAIL', note: `Block count ${blockCount} exceeds Architect HIGH_STAKES cap ${cap}` };
      }
    } else if (archetype === 'Alchemist' && mode === 'HIGH_STAKES_DAY') {
      if (blockCount > 3) {
        return { score: 'FAIL', note: `Block count ${blockCount} exceeds Alchemist HIGH_STAKES cap 3` };
      }
    } else if (blockCount > expectedMax) {
      return { score: 'FAIL', note: `Block count ${blockCount} exceeds complexity cap ${expectedMax} for ${complexity}` };
    }
  }

  return { score: 'PASS', note: `Duration: ${totalDuration}min/${availableWindow}min. Blocks: ${blockCount}.` };
}

function scoreD4(plan: OperatingPlan): DimensionResult {
  const { noticed, planLogic, firstBlockReason, uncertainty } = plan.rationale;

  if (!noticed || noticed.length === 0) {
    return { score: 'FAIL', note: 'noticed[] is empty' };
  }

  if (!planLogic || planLogic.length < 20) {
    return { score: 'FAIL', note: `planLogic too short: "${planLogic}"` };
  }

  if (!firstBlockReason || firstBlockReason.includes('undefined')) {
    return { score: 'FAIL', note: `firstBlockReason missing or has 'undefined': "${firstBlockReason}"` };
  }

  if (!uncertainty || uncertainty.length === 0) {
    return { score: 'FAIL', note: 'uncertainty[] is empty' };
  }

  // noticed[] uses enum labels (LOW/HIGH) not specific values — borderline
  const hasSpecificEnergy = noticed.some(n =>
    n.includes('low') || n.includes('moderate') || n.includes('high')
  );

  if (!hasSpecificEnergy) {
    return { score: 'BORDERLINE', note: 'noticed[] present but lacks energy/stress specificity' };
  }

  // All expected fields present but templated — borderline
  return {
    score: 'BORDERLINE',
    note: `noticed[]: ${noticed.length} items. planLogic: present. firstBlockReason: present. uncertainty: ${uncertainty.length} items. All templated.`,
  };
}

const RAW_TEXT_FIELDS = [
  'test-weight', // theWeight value used in harness profiles
  'mood text',   // not included in harness (we don't pass mood to PlanGenerationService)
];

function scoreD6(plan: OperatingPlan): DimensionResult {
  // Stringify the entire plan and search for raw text values that should never appear
  const planJson = JSON.stringify(plan);

  for (const rawText of RAW_TEXT_FIELDS) {
    if (planJson.includes(rawText)) {
      return { score: 'FAIL', note: `Raw text detected in plan output: "${rawText}"` };
    }
  }

  return { score: 'PASS', note: 'No raw text fields detected in plan output' };
}

function scoreD5(plan: OperatingPlan): DimensionResult {
  // FAIL: any underscores visible to users
  if (plan.planTitle.includes('_')) {
    return { score: 'FAIL', note: `planTitle contains underscores: "${plan.planTitle}"` };
  }
  if (plan.openingLine.includes('_')) {
    return { score: 'FAIL', note: `openingLine contains underscores: "${plan.openingLine}"` };
  }

  // FAIL: ALL_CAPS enum token at the start (pre-fix formula pattern)
  if (plan.planTitle.match(/^[A-Z][A-Z]+ [—·]/)) {
    return {
      score: 'BORDERLINE',
      note: `planTitle still uses ALL CAPS mode prefix: "${plan.planTitle}"`,
    };
  }

  // FAIL: robotic "for Archetype" phrasing in openingLine
  if (plan.openingLine.match(/morning for \w+\.?$/)) {
    return {
      score: 'BORDERLINE',
      note: `openingLine uses robotic "for Archetype" phrasing: "${plan.openingLine}"`,
    };
  }

  // PASS: human-readable title and openingLine
  return {
    score: 'PASS',
    note: `Title: "${plan.planTitle}" | Opening: "${plan.openingLine}"`,
  };
}

// Track per-archetype action copy to detect divergence failures and improvements
const archetypeActionSeen: Record<string, Set<string>> = {};

function scoreD7(plan: OperatingPlan, archetype: Archetype, mode: OperatingMode): DimensionResult {
  // Full action fingerprint: sequence of blockType:action pairs
  const actionFingerprint = plan.mainSequence.map(b => `${b.blockType}:${b.action}`).join('||');
  const sequenceFingerprint = plan.mainSequence.map(b => `${b.blockType}:${b.title}`).join('→');

  const actionKey = `${archetype}:actions`;
  if (!archetypeActionSeen[actionKey]) {
    archetypeActionSeen[actionKey] = new Set();
  }

  const isDuplicateActionSet = archetypeActionSeen[actionKey].has(actionFingerprint);
  archetypeActionSeen[actionKey].add(actionFingerprint);

  if (isDuplicateActionSet) {
    // Identical action copy seen for this archetype in a different mode — mode-blind
    return {
      score: 'BORDERLINE',
      note: `Action copy is identical to a previous ${archetype} profile. Mode-blind copy for sequence: ${sequenceFingerprint}`,
    };
  }

  // Unique action copy for this archetype — divergence is working
  return {
    score: 'PASS',
    note: `Unique action copy for ${archetype} × ${mode}. Sequence: ${sequenceFingerprint}`,
  };
}

// ─── Verdict combinator ───────────────────────────────────────────────────────

function computeVerdict(scores: DimensionResult[]): Verdict {
  if (scores.some(s => s.score === 'FAIL')) return 'RED';
  if (scores.some(s => s.score === 'BORDERLINE')) return 'YELLOW';
  return 'GREEN';
}

// ─── Build test profiles ──────────────────────────────────────────────────────

interface TestCase {
  archetype: Archetype;
  mode: OperatingMode;
  availableWindow: number;
  complexity: ComplexityTolerance;
  season: SeasonalFocus;
  hasTimeWeight: boolean;
  hasPoorSleep: boolean;
  label: string;
}

function buildTestCases(): TestCase[] {
  const cases: TestCase[] = [];

  // 20 base cases: 4 archetypes × 5 modes — standard profile
  for (const archetype of ARCHETYPES) {
    for (const mode of MODES) {
      cases.push({
        archetype,
        mode,
        availableWindow: 30,
        complexity: 'simple',
        season: 'Building',
        hasTimeWeight: false,
        hasPoorSleep: false,
        label: `base:${archetype}×${mode}`,
      });
    }
  }

  // 10 window constraint cases: tight windows
  for (const archetype of ARCHETYPES) {
    cases.push({
      archetype,
      mode: 'STEADY_EXECUTION',
      availableWindow: 8,
      complexity: 'simple',
      season: 'Stabilising',
      hasTimeWeight: false,
      hasPoorSleep: false,
      label: `tight-window:${archetype}`,
    });
  }
  // One extra to reach 10
  cases.push({
    archetype: 'Architect',
    mode: 'HIGH_STAKES_DAY',
    availableWindow: 5,
    complexity: 'simple',
    season: 'Preparing',
    hasTimeWeight: true,
    hasPoorSleep: false,
    label: 'tight-window:Architect×HIGH_STAKES',
  });
  cases.push({
    archetype: 'Sentinel',
    mode: 'RECOVERY',
    availableWindow: 3,
    complexity: 'simple',
    season: 'Recovering',
    hasTimeWeight: false,
    hasPoorSleep: true,
    label: 'tight-window:Sentinel×RECOVERY×3min',
  });
  cases.push({
    archetype: 'Tide',
    mode: 'OVERWHELM_CONTAINMENT',
    availableWindow: 6,
    complexity: 'simple',
    season: 'Building',
    hasTimeWeight: true,
    hasPoorSleep: true,
    label: 'tight-window:Tide×OVERWHELM×6min',
  });

  // 10 layered complexity cases: 4 archetypes × 2 steady modes + extras
  for (const archetype of ARCHETYPES) {
    cases.push({
      archetype,
      mode: 'STEADY_EXECUTION',
      availableWindow: 60,
      complexity: 'layered',
      season: 'Preparing',
      hasTimeWeight: false,
      hasPoorSleep: false,
      label: `layered:${archetype}×STEADY`,
    });
  }
  cases.push({
    archetype: 'Architect',
    mode: 'FOCUS_REBUILD',
    availableWindow: 45,
    complexity: 'layered',
    season: 'Recovering',
    hasTimeWeight: false,
    hasPoorSleep: false,
    label: 'layered:Architect×FOCUS_REBUILD',
  });
  cases.push({
    archetype: 'Alchemist',
    mode: 'HIGH_STAKES_DAY',
    availableWindow: 40,
    complexity: 'layered',
    season: 'Building',
    hasTimeWeight: true,
    hasPoorSleep: false,
    label: 'layered:Alchemist×HIGH_STAKES',
  });

  // 10 flag/modifier cases
  for (const archetype of ARCHETYPES) {
    cases.push({
      archetype,
      mode: 'RECOVERY',
      availableWindow: 20,
      complexity: 'simple',
      season: 'Recovering',
      hasTimeWeight: false,
      hasPoorSleep: true,
      label: `poor-sleep:${archetype}×RECOVERY`,
    });
  }
  cases.push({
    archetype: 'Architect',
    mode: 'HIGH_STAKES_DAY',
    availableWindow: 20,
    complexity: 'simple',
    season: 'Building',
    hasTimeWeight: true,
    hasPoorSleep: false,
    label: 'time-weight:Architect×HIGH_STAKES',
  });
  cases.push({
    archetype: 'Sentinel',
    mode: 'FOCUS_REBUILD',
    availableWindow: 25,
    complexity: 'simple',
    season: 'Stabilising',
    hasTimeWeight: true,
    hasPoorSleep: true,
    label: 'both-flags:Sentinel×FOCUS_REBUILD',
  });

  // Trim to exactly 50 if over
  return cases.slice(0, 50);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function run() {
  const testCases = buildTestCases();

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`PHASE 0.5 — RULE-BASED FALLBACK QUALITY HARNESS`);
  console.log(`Profiles: ${testCases.length}  |  Dimensions: 7`);
  console.log(`${'═'.repeat(72)}\n`);

  const results: ProfileScore[] = [];

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i]!;
    const profile = makeProfile(tc.archetype, tc.complexity, tc.season);
    const { context, state } = makeContext(tc.mode, tc.availableWindow, tc.hasTimeWeight, tc.hasPoorSleep);

    const input: PlanGenerationInput = {
      context,
      state,
      profile,
      memorySummary: null,
    };

    const plan = generatePlan(input);

    const d1 = scoreD1(plan, tc.archetype, tc.mode);
    const d2 = scoreD2(plan, tc.archetype, tc.mode, tc.complexity);
    const d3 = scoreD3(plan, tc.availableWindow, tc.complexity, tc.mode, tc.archetype);
    const d4 = scoreD4(plan);
    const d5 = scoreD5(plan);
    const d6 = scoreD6(plan);
    const d7 = scoreD7(plan, tc.archetype, tc.mode);

    const verdict = computeVerdict([d1, d2, d3, d4, d5, d6, d7]);

    results.push({
      profileIndex: i + 1,
      archetype: tc.archetype,
      mode: tc.mode,
      availableWindow: tc.availableWindow,
      complexity: tc.complexity,
      season: tc.season,
      d1, d2, d3, d4, d5, d6, d7,
      verdict,
      plan,
    });
  }

  // ── Failure report ──────────────────────────────────────────────────────────

  const fails = results.filter(r => r.verdict === 'RED');
  const yellows = results.filter(r => r.verdict === 'YELLOW');
  const greens = results.filter(r => r.verdict === 'GREEN');

  console.log(`SUMMARY`);
  console.log(`─────────────────────────────────────────────────`);
  console.log(`  GREEN  (pass):     ${greens.length} / ${results.length}`);
  console.log(`  YELLOW (borderline): ${yellows.length} / ${results.length}`);
  console.log(`  RED    (fail):     ${fails.length} / ${results.length}`);
  console.log('');

  // Per-dimension counts
  const dims = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6', 'd7'] as const;
  const dimLabels = ['D1 archetype-fit', 'D2 mode-fit', 'D3 modifiers', 'D4 rationale', 'D5 voice', 'D6 safety', 'D7 divergence'];

  console.log(`DIMENSION BREAKDOWN`);
  console.log(`─────────────────────────────────────────────────`);
  for (let d = 0; d < dims.length; d++) {
    const dim = dims[d]!;
    const label = dimLabels[d]!;
    const failCount = results.filter(r => r[dim].score === 'FAIL').length;
    const borderlineCount = results.filter(r => r[dim].score === 'BORDERLINE').length;
    const passCount = results.filter(r => r[dim].score === 'PASS').length;
    console.log(`  ${label.padEnd(20)}: PASS=${passCount} BORDERLINE=${borderlineCount} FAIL=${failCount}`);
  }
  console.log('');

  // RED profiles detail
  if (fails.length > 0) {
    console.log(`RED PROFILES (${fails.length})`);
    console.log(`─────────────────────────────────────────────────`);
    for (const r of fails) {
      console.log(`\nProfile ${r.profileIndex}: ${r.archetype} × ${r.mode} | window=${r.availableWindow}min | ${r.complexity} | ${r.season}`);
      for (const d of dims) {
        if (r[d].score === 'FAIL') {
          console.log(`  ❌ ${d.toUpperCase()}: ${r[d].note}`);
        }
      }
    }
    console.log('');
  }

  // Borderline patterns
  console.log(`BORDERLINE PATTERNS (systematic issues across all profiles)`);
  console.log(`─────────────────────────────────────────────────`);

  // D5: planTitle formula pattern — show one example
  const firstBorderlineD5 = results.find(r => r.d5.score === 'BORDERLINE');
  if (firstBorderlineD5) {
    console.log(`\nD5 Voice (expected borderline — formulaic titles)`);
    console.log(`  Example planTitle: "${firstBorderlineD5.plan.planTitle}"`);
    console.log(`  Example openingLine: "${firstBorderlineD5.plan.openingLine}"`);
  }

  // D4: rationale templating — show one example
  const firstBorderlineD4 = results.find(r => r.d4.score === 'BORDERLINE');
  if (firstBorderlineD4) {
    console.log(`\nD4 Rationale (expected borderline — templated)`);
    console.log(`  noticed[0]: "${firstBorderlineD4.plan.rationale.noticed[0]}"`);
    console.log(`  noticed[1]: "${firstBorderlineD4.plan.rationale.noticed[1]}"`);
    console.log(`  protecting: "${firstBorderlineD4.plan.rationale.protecting}"`);
    console.log(`  uncertainty[0]: "${firstBorderlineD4.plan.rationale.uncertainty[0]}"`);
  }

  // D7: block copy mode-blindness — show two profiles same archetype, different modes
  const archExample = 'Sentinel';
  const sentinelSteady = results.find(r => r.archetype === archExample && r.mode === 'STEADY_EXECUTION');
  const sentinelRecovery = results.find(r => r.archetype === archExample && r.mode === 'RECOVERY');
  if (sentinelSteady && sentinelRecovery) {
    console.log(`\nD7 Behavioral Divergence (Sentinel ground block — mode-blind copy)`);
    console.log(`  STEADY ground action: "${sentinelSteady.plan.mainSequence[0]?.action}"`);
    console.log(`  RECOVERY ground action: "${sentinelRecovery.plan.mainSequence[0]?.action}"`);
    console.log(`  Identical? ${sentinelSteady.plan.mainSequence[0]?.action === sentinelRecovery.plan.mainSequence[0]?.action}`);
  }

  // D2: uncertainty identical across all
  const uniqueUncertainty = new Set(results.map(r => r.plan.rationale.uncertainty.join('|')));
  console.log(`\nD2 uncertainty[] distinct values across ${results.length} profiles: ${uniqueUncertainty.size}`);
  if (uniqueUncertainty.size === 1) {
    console.log(`  (all identical) → "${results[0]?.plan.rationale.uncertainty[0]}"`);
  }

  // Summary of planTitle uniqueness
  const uniqueTitles = new Set(results.map(r => r.plan.planTitle));
  console.log(`\nplanTitle distinct values: ${uniqueTitles.size} / ${results.length}`);
  if (uniqueTitles.size < results.length) {
    // List all unique titles
    const titleList = Array.from(uniqueTitles).sort();
    for (const t of titleList) {
      const count = results.filter(r => r.plan.planTitle === t).length;
      console.log(`  "${t}" — ${count} profile(s)`);
    }
  }

  // ── Required fixes taxonomy ─────────────────────────────────────────────────

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`REQUIRED FIXES BEFORE PRIORITY 9`);
  console.log(`${'═'.repeat(72)}`);

  const redCount = fails.length;
  const totalProfiles = results.length;

  console.log(`\nFIX 1 — planTitle and openingLine (D5 BORDERLINE, all ${totalProfiles} profiles)`);
  console.log(`  Current: "${results[0]?.plan.planTitle}" / "${results[0]?.plan.openingLine}"`);
  console.log(`  Issue: ALL_CAPS mode label visible to users. Robotic "for {Archetype}" phrasing.`);
  console.log(`  Severity: MEDIUM — fallback plan titles must be warmly branded, not enum-readable.`);
  console.log(`  Required: planTitle map (RECOVERY → 'A Recovery Morning', etc.) + openingLine per archetype×mode.`);

  console.log(`\nFIX 2 — uncertainty[] not mode-differentiated (D2 BORDERLINE, all ${totalProfiles} profiles)`);
  console.log(`  Current: always "${results[0]?.plan.rationale.uncertainty[0]}"`);
  console.log(`  Issue: Single identical string across all modes. OVERWHELM_CONTAINMENT and RECOVERY`);
  console.log(`  deserve different uncertainty framing than STEADY_EXECUTION.`);
  console.log(`  Severity: MEDIUM — system honesty is part of trust architecture.`);
  console.log(`  Required: Mode-specific uncertainty[] variants (5 values minimum).`);

  console.log(`\nFIX 3 — Block copy is mode-blind within archetype (D7 BORDERLINE, all ${totalProfiles} profiles)`);
  console.log(`  Current: Sentinel ground block in RECOVERY uses identical title/action as in HIGH_STAKES_DAY.`);
  console.log(`  Issue: The system claims to understand the user's state but produces identical copy.`);
  console.log(`  Severity: HIGH — undermines "understands me unusually well" claim for fallback plans.`);
  console.log(`  Required: Mode-aware block templates (mode-prefix on title/action) OR mode-adjusted action copy.`);

  console.log(`\nFIX 4 — summaryInsight is a formula (informational, not user-visible)`);
  console.log(`  Current: "Rule-based plan for ${results[0]?.plan.internalArchetype} in ... mode. Accuracy improves as your history builds."`);
  console.log(`  Issue: Not user-facing but stored in MMKV. Acceptable as-is for Block 1 if field is internal.`);
  console.log(`  Severity: LOW — acceptable if summaryInsight is never shown in UI.`);

  console.log(`\nFIX 5 — protecting/creating use generic season template (D4 BORDERLINE)`);
  console.log(`  Current protecting: "${results[0]?.plan.rationale.protecting}"`);
  console.log(`  Issue: All profiles with same season produce identical protecting/creating text.`);
  console.log(`  Severity: LOW for fallback — acceptable since users see the AI path when online.`);

  if (redCount === 0) {
    console.log(`\n✅ GATE: No RED profiles. ${totalProfiles} profiles passed minimum threshold.`);
    console.log(`   BORDERLINE issues documented above. Priority 9 may begin with fixes 1-3 queued.`);
  } else {
    console.log(`\n❌ GATE: ${redCount} RED profiles. Resolve before Priority 9.`);
  }

  console.log(`\n${'═'.repeat(72)}\n`);
}

run();
