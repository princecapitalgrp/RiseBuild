# Rise by Solis — Project Context for Claude

This file governs every session. Every architectural decision is checked against it.
Do not deviate from these constraints without explicit user instruction.

## Companion Documents — Read These Too

This file covers technical architecture, design system, and implementation constraints.
The following files must also be read before any session involving product, strategy, or testing decisions:

- **STRATEGY.md** — Product vision, user definition, PMF definition, moat analysis, acquisition strategy, runway constraint, non-negotiable constraints.
- **TESTFLIGHT-COHORT.md** — Cohort architecture (A/B/C), recruitment, what to measure, failure conditions, TestFlight readiness checklist.
- **SALES-MOTION.md** — B2C and B2B sales motion by phase, pricing, paywall placement, conversion targets, ROI framing for enterprise.

---

## Product Vision

**Rise is a Personal Operating System for calm, focus, and self-trust.**

It is not a wellness app. It is not a habit tracker. It is not a morning routine generator.

The morning is the first and highest-signal operating window of the Personal OS.
Block 1 implements morning only. The architecture must reflect the full OS from day one.

**Core product claim:** "This app understands me unusually well."
That claim must be architecturally earned — not asserted in copy.

**The product loop that earns the claim:**
```
Voice/text input → Interpreted state → OperatingState assessment →
Personalized OperatingPlan + PlanRationale → Guided execution →
ExecutionRecord → Reflection → MemorySummary update → TrustSignal →
Better next plan
```

---

## Brand Voice

- **Tone:** Precise, warm, unhurried. Not clinical. Not motivational. Not productivity-coded.
- **Register:** Intelligent peer who knows you unusually well. Not a coach. Not an assistant.
- **Language:** "Operating plan", "your morning", "what you're carrying", "first move" — not "routine", "habit", "goal", "optimize".
- **Never use:** cold grey, startup-blue, flat white, motivational slogans, gamification language.

---

## Design System

**Stack:** Expo managed workflow (React Native)
**Layout:** NativeWind for spacing, typography tokens, screen composition
**Polish:** StyleSheet + memoized inline styles for animations, shadows, gradients, blur, pressed states
**Navigation:** Expo Router (file-based)
**Feel:** Apple design language first. Bevel Health-adjacent in clarity, calmness, spacing, motion, premium restraint.

### Palette B — Amber Core (daytime, editorial, warm trust screens)
```
warmCream:     #FAF8F4
warmStone:     #F5F0E8
dustyLinen:    #E8DED0
amberMist:     #D4B896
dawnGold:      #C9A54C
dustyOchre:    #C8A96E
mutedAmber:    #D4963A
warmWalnut:    #8C6B3E
deepBrown:     #3A2E28
richCharcoal:  #2A2420
```

### Palette C — Charcoal Sun (hero moments, readiness states, premium/dark surfaces)
```
deepCharcoal:  #2A2420  (primary bg)
warmGraphite:  #3D3530
smokyBrown:    #524840
dustyMocha:    #655A50
warmSand:      #E8DED0
softCream:     #FAF7F2
dawnGold:      #C9A54C
amberGlow:     #E8956A
paleApricot:   #F2C99A
```

**Geometric visual language:** Solar arc / circle motifs. Used sparingly as texture, not decoration.

**Do:** amber, stone, charcoal, warmth, depth, restraint
**Never:** cold black + neon + tech-blue, startup-blue, flat white, motivational slogans

---

## Archetype System

Four archetypes. Deterministic 2×2 from two primary signals.

| Agency \ Pressure | Tighten Control | Stall-Delay |
|---|---|---|
| **The Author** | Architect | Alchemist |
| **The Protagonist** | Sentinel | Tide |

### Operating Rules per Archetype

**Architect** — Designer of the Morning Domain
- Optimize for: structural command before first external demand
- Risk: control-seeking spiral disguised as preparation
- First block type: `ground` (containment, no digital input)
- Anti-pattern: "Let preparation become its own procrastination"

**Alchemist** — Transformer of Creative Flow
- Optimize for: protected fluid transmutation period
- Risk: over-planning before physical movement
- First block type: `ignite` (kinetic movement to clear fog)
- Anti-pattern: "Planning the work before physically arriving in the body"

**Sentinel** — Guardian of the Secured Start
- Optimize for: environment secured, role clearly defined
- Risk: amplifying pressure by measuring readiness too early
- First block type: `ground` (anchoring before assessment)
- Anti-pattern: "Self-assessment before state stabilization"

**Tide** — Voyager of Natural Momentum
- Optimize for: ebb-and-flow, natural morning energy
- Risk: digital drift disguised as staying informed
- First block type: `ignite` (sensory contact with the day)
- Anti-pattern: "Screen consumption before directional clarity"

---

## Privacy Promise — Architectural Statement

**MMKV is the trust promise, not a feature.**

All personal and emotional data — check-in input, the named weight, mood, protocols, reflections, memory — lives in encrypted MMKV storage on-device. It does not leave the device.

**Ephemeral Transcript Policy:** Voice transcripts are never written to MMKV. They exist in XState machine context only for the duration of the check-in session. At submission, they are processed into `DailyContext` (structured, no verbatim text) and discarded. The transcript itself is never persisted.

**AI privacy contract:**
- Sent to server: archetype, `DailyContext` (structured interpretation), `MemorySummary` pattern summary
- Never sent: raw check-in text, the named weight, reflection notes, any user-authored text

**Firestore scope (hard boundary):**
- Subscription/entitlement state
- Opt-in cross-device sync manifest (no personal content)
- Anonymized aggregate analytics (no PII, explicit opt-in)
- Nothing else

**Consent rule:** If adding a new field to any type, it must be classified in `domain/storage-classification.md` before implementation. Every field not in MMKV requires explicit justification and user consent path.

---

## The Six Personalization Loop Entities

Each entity has a distinct storage owner, lifecycle, and privacy classification.

| Layer | Entity | MMKV Key | Lifecycle | Raw user text? |
|---|---|---|---|---|
| 1 | `RawCheckIn` | `checkin:{date}` | Daily, retained 90 days | YES — never leaves device |
| 2a | `DailyContext` | `context:{date}` | Daily, retained 90 days | No — structured only |
| 2b | `OperatingState` | `operatingState:{date}` | Daily, retained 90 days | No |
| 3 | `OperatingPlan` | `plan:{date}` | Per session, retained 1 year | No |
| 4 | `ExecutionRecord` | `execution:{date}` | Daily, append-only, retained 1 year | No |
| 5 | `Reflection` | `reflection:{date}` | Per session, retained 1 year | YES — never leaves device |
| 6 | `MemorySummary` | `memory` | Rolling window, single doc | No — categorized only |

Voice transcript: transient only. Never assigned a MMKV key.

---

## Derived Fields — Not Stored, Not Asked

Some plan generation parameters are computed at runtime from profile fields, not stored as their own fields and not collected as onboarding questions. Any future session that adds a field to `OnboardingProfile` or the API request schema must first check whether the value is derivable.

**`guidanceStyle`** — derived, not stored.
Computed at plan generation time from `pressureResponse`: `Push` → `directive`, `Pull` → `invitational`.
It is never an `OnboardingProfile` field. It is never an onboarding question.

---

## Non-Negotiable Constraints

1. **MMKV is primary for all personal data.** No exceptions without explicit user instruction.
2. **Raw user text never leaves the device.** The named weight, mood text, reflection notes — on-device only.
3. **Firestore is an implementation detail.** No component, hook, or service outside a repository calls Firestore.
4. **`uncertainty[]` is required in every `PlanRationale`.** The system must acknowledge what it could not interpret confidently.
5. **`sessionType` is present on all six loop entities from day one.** Only `'morning'` is implemented. The field exists.
6. **`PlanRationale` is a first-class artifact.** It ships with every `OperatingPlan`. It is visible to the user.
7. **The rule-based fallback must always exist.** If the AI call fails, `PlanGenerationService` falls back to the rule engine. The user always receives a plan.
8. **ExecutionRecord is append-only.** Events are never deleted or overwritten.
9. **Transcript retention policy applies from first release.** No carve-outs.
10. **Every new field must be classified in `domain/storage-classification.md` before implementation.**

---

## Personalization Engine — `engine/` is the center

The `engine/` directory is the intelligence core. Everything else (auth, storage, UI, API) exists to serve it.

```
engine/
├── PersonalizationEngine.ts        orchestrator — three daily entry points
├── InterpretationService.ts        RawCheckIn → DailyContext + OperatingState (on-device)
├── PlanGenerationService.ts        OperatingState + memory → OperatingPlan + PlanRationale (server)
├── ExecutionTracker.ts             Layer 4 event log, synchronous MMKV append
├── MemoryEngine.ts                 Layers 4+5 → MemorySummary update (on-device)
├── FitEvaluator.ts                 session FitScore — pure computation, no side effects
└── TrustEvaluator.ts               FitScore history → TrustSignal (long-term)
```

**Three daily entry points:**
```typescript
// Morning: check-in submitted
PersonalizationEngine.processCheckin(raw: RawCheckIn): Promise<OperatingPlan>

// During execution: any action on the plan screen
PersonalizationEngine.recordExecution(event: ExecutionEvent): void

// After plan: reflection submitted
PersonalizationEngine.processReflection(reflection: Reflection): Promise<{
  updatedMemory: MemorySummary;
  fitScore: FitScore;
  trustSignal: TrustSignal;
}>
```

---

## OperatingState Modes

| Mode | When | System priority |
|---|---|---|
| `RECOVERY` | Low energy, high stress | Containment. Minimum viable morning. |
| `FOCUS_REBUILD` | Moderate capacity, clarity needed | Anchor first. Build toward cognition. |
| `STEADY_EXECUTION` | Normal operating capacity | Standard sequence for this archetype. |
| `HIGH_STAKES_DAY` | High-stakes commitment ahead | Protect cognitive reserve. Strategic prep. |
| `OVERWHELM_CONTAINMENT` | Stress at ceiling | Triage. Single non-negotiable only. |

---

## Memory Model — Behavioral Buckets

`MemorySummary` models how this person functions under different conditions.

| Bucket | What it accumulates |
|---|---|
| `stabilizers` | Conditions and actions that reliably improve operating state |
| `derailers` | Recurring patterns that pull the user off their intended trajectory |
| `tractionBuilders` | First moves that consistently generate forward momentum |
| `selfTrustThreats` | Patterns that erode self-trust (categorized, not verbatim) |
| `reliableFirstMoves` | Opening actions that consistently precede good sessions |

---

## Seven Metrics

| # | Metric | Measures | Target |
|---|---|---|---|
| 1 | Rolling FitScore trend | PE calibration quality | Week 4 > Week 1 |
| 2 | Execution depth | Plan complexity calibration | Rising trend, 30 days |
| 3 | Follow-through rate | Plans feel achievable | >60% at 30 days |
| 4 | User-rated accuracy | Felt understanding | Avg >3.8 at 30 days |
| 5 | High-accuracy pattern density | Memory learning rate | Positive ratio by week 3 |
| 6 | Self-trust trend | `TrustSignal.composite` over time | `BUILDING` by week 4 |
| 7 | Operating mode distribution | % sessions not in RECOVERY/OVERWHELM | >70% STEADY+ by week 8 |

Metrics 1–5: engine quality. Metrics 6–7: category outcomes — calm, focus, self-trust over time.
All computed on-device from MMKV. No data leaves device to generate them.

---

## Auth Model

**Onboard-first.** The user completes the full 10-question onboarding and receives their first `OperatingPlan` before account creation is required.

**Session survival contract:**
- `session:pending_onboarding` is written to MMKV synchronously at the moment onboarding completes, before the auth gate renders.
- Same-session return: resume at auth gate.
- Same-device purged return: detect `session:pending_onboarding` on launch, resume at auth gate.
- Different-device before auth: not recoverable. By design. Privacy-native means no cloud record without consent.

**Providers:** Email + Password, Google Sign-In, Apple Sign In (required for App Store).

---

## PMF Definition

Rise has found product-market fit when:

1. **Retention:** 40%+ of users who complete onboarding return for a morning session the following day.
2. **Personalization signal:** User-rated accuracy average exceeds 4.0 by session 7.
3. **Category claim validated:** >60% of retained users report feeling "understood unusually well" in qualitative feedback by week 4.
4. **Trust building:** `TrustSignal.trend = BUILDING` for >50% of users who have completed 10+ sessions.
5. **Operating mode stabilization:** Users show measurably fewer `RECOVERY` and `OVERWHELM_CONTAINMENT` mornings by week 6 compared to week 1.

---

## Future Session Windows (not implemented in Block 1)

The architecture supports: `morning | midday | evening | longevity`

Block 1 = morning only. All six loop entities carry `sessionType` from day one.
No midday, evening, or longevity logic is built or implied in Block 1.
When those windows are added, they slot into the existing engine without structural changes.

---

## Source Locations

- Expo project: `Rise by Solis App/` (to be initialized)
- Design language: `Design Language/` (Palette B + C images)
- Domain types: `Rise by Solis App/domain/types.ts`
- Storage classification: `Rise by Solis App/domain/storage-classification.md`
- Onboarding session spec: `Rise by Solis App/domain/onboarding-session.md`
- Web prototype (reference only): archived — not the product

# Rise by Solis — Project Context for Claude

This file governs every session.
Every architectural and product decision must be checked against it.
Do not deviate from these constraints without explicit user instruction.

---

## 1) Product Vision

**Rise is a Personal Operating System for calm, focus, and self-trust.**

It is not a generic wellness app.
It is not a habit tracker.
It is not a motivational routine tool.
It is not a journaling app with AI pasted on top.

**Block 1 implements the morning operating window only.**
This is deliberate.
Morning is the highest-signal proving ground for the core claim because it has:
- the cleanest cause-and-effect loop
- the least external noise
- the strongest daily recurrence
- the fastest feedback on whether the product actually helped

The architecture must support a broader Personal OS from day one, but **scope remains morning-only in Block 1**.

### Core Product Claim

**“This app understands me unusually well.”**

That claim must be earned structurally, not asserted in copy.

### The Core Product Loop

```text
Voice/text check-in
→ structured interpretation
→ OperatingState assessment
→ MorningPlan generation + PlanRationale
→ guided execution
→ ExecutionRecord
→ Reflection
→ MemorySummary update
→ TrustSignal update
→ better next MorningPlan


The Strategic Product Framing

The user is not hiring Rise to “optimize.”
The user is hiring Rise to:
	•	reduce internal noise
	•	reduce morning decision load
	•	create traction without force
	•	feel calmer, clearer, and more self-trusting by the start of the day

Build the first operating window, not a standalone morning app.

⸻

2) What This Product Is and Is Not

Rise is:
	•	a Personal Operating System for the morning operating window
	•	an intelligence layer that turns private signals into a useful plan
	•	a calm, privacy-native product that learns how a person functions over time
	•	a system for improving calm, focus, and self-trust through repeated use

Rise is not:
	•	a generic wellness content app
	•	a static morning routine generator
	•	a gamified habit product
	•	a “productivity optimization” app
	•	a cloud-first emotional data platform
	•	a black-box AI that asks for intimacy without architectural restraint

⸻

3) Strategic Scope Rule

Morning first. OS architecture from day one.

Do not build the full-day OS in Block 1.
Do not collapse the category framing into “just a morning app.”

The correct balance is:
	•	Scope: morning only
	•	Architecture: modular enough for future session windows
	•	Positioning: the first and most important operating window of a broader Personal OS

Future-supported session windows:
	•	morning
	•	midday
	•	evening
	•	longevity

Only morning is implemented in Block 1.
All relevant entities must still carry sessionType from day one.

⸻

4) Brand Voice

Tone
	•	precise
	•	warm
	•	calm
	•	unhurried
	•	intelligent
	•	emotionally literate
	•	restrained

Not this
	•	clinical
	•	motivational
	•	hustle-coded
	•	productivity-bro
	•	hyper-therapeutic
	•	chirpy assistant-like
	•	generic self-care language

Register

The app should feel like:
an unusually perceptive, discreet intelligence layer
—not a coach, not a life-hack system, not a chatty assistant.

Preferred language
	•	“your morning”
	•	“operating state”
	•	“morning plan”
	•	“what you’re carrying”
	•	“first move”
	•	“stabilize”
	•	“build traction”
	•	“protect”
	•	“create”
	•	“reduce friction”
	•	“restore clarity”

Avoid
	•	“optimize”
	•	“crush the day”
	•	“habit streak”
	•	“goal completion”
	•	“productivity hack”
	•	“routine mastery”
	•	motivational slogans
	•	gamification language

⸻

5) Design System

Stack
	•	Expo managed workflow
	•	React Native
	•	Expo Router
	•	NativeWind for layout, spacing, typography tokens, and screen composition
	•	StyleSheet and memoized inline styles for animations, shadows, gradients, blur, and pressed states

Design Direction
	•	Apple design language first
	•	Bevel Health-adjacent in clarity, calmness, spacing, motion, and premium restraint
	•	Solis brand system layered in through warmth, depth, texture, hierarchy, and controlled color

Core Feel
	•	premium restraint
	•	tactile clarity
	•	warm intelligence
	•	zero visual clutter
	•	soft depth
	•	highly readable, calm surfaces

Palette B — Amber Core

Use for:
	•	onboarding
	•	trust-building screens
	•	morning plan surfaces
	•	editorial explanations
	•	reflection flows
	•	privacy and rationale screens
warmCream:     #FAF8F4
warmStone:     #F5F0E8
dustyLinen:    #E8DED0
amberMist:     #D4B896
dawnGold:      #C9A54C
dustyOchre:    #C8A96E
mutedAmber:    #D4963A
warmWalnut:    #8C6B3E
deepBrown:     #3A2E28
richCharcoal:  #2A2420

Palette C — Charcoal Sun

Use for:
	•	hero moments
	•	readiness states
	•	premium/dark surfaces
	•	“today’s morning” reveal moments
	•	focus-heavy or high-stakes state moments

deepCharcoal:  #2A2420
warmGraphite:  #3D3530
smokyBrown:    #524840
dustyMocha:    #655A50
warmSand:      #E8DED0
softCream:     #FAF7F2
dawnGold:      #C9A54C
amberGlow:     #E8956A
paleApricot:   #F2C99A

Geometric Language

Use solar arcs / circles sparingly as structure or texture.
They are not decorative filler.

Design Do / Do Not

Do:
	•	warmth
	•	amber
	•	stone
	•	charcoal
	•	calm contrast
	•	depth
	•	premium restraint

Do not:
	•	startup blue
	•	cold grey minimalism
	•	flat white web-app feeling
	•	neon-on-black tech aesthetic
	•	cluttered “wellness” illustration language

6) Archetype System

Four archetypes.
Deterministic 2×2 from two primary signals.

Agency \ Pressure
Tighten Control
Stall-Delay
The Author
Architect
Alchemist
The Protagonist
Sentinel
Tide

Archetype Operating Rules

Architect — Designer of the Morning Domain
	•	optimize for structural command before first external demand
	•	key risk: control-seeking spiral disguised as preparation
	•	preferred first block type: ground
	•	anti-pattern: letting preparation become its own procrastination

Alchemist — Transformer of Creative Flow
	•	optimize for protected fluid transmutation period
	•	key risk: over-planning before physical movement
	•	preferred first block type: ignite
	•	anti-pattern: planning the work before arriving in the body

Sentinel — Guardian of the Secured Start
	•	optimize for environmental security and clear role definition
	•	key risk: amplifying pressure through premature self-assessment
	•	preferred first block type: ground
	•	anti-pattern: self-assessment before stabilization

Tide — Voyager of Natural Momentum
	•	optimize for directional movement that honors real energy
	•	key risk: digital drift disguised as staying informed
	•	preferred first block type: ignite
	•	anti-pattern: screen consumption before directional clarity

Archetype Rule

Archetypes influence plan shape.
They do not rigidly determine the entire morning.
Current state always matters.

⸻

7) Privacy Promise — Architectural Statement

MMKV is the trust promise, not a convenience choice.

All personal and emotional data is local-first by default.

Primary Storage Boundary

Encrypted MMKV is the primary store for:
	•	interpreted emotional/personal state
	•	operating state
	•	plans
	•	execution data
	•	reflections
	•	long-term memory
	•	other private behavioral artifacts approved in the domain model

Ephemeral Transcript Policy

Voice transcripts are not written to MMKV by default.

They may exist transiently in check-in session state during active interpretation, then are discarded once structured interpretation is produced.

By default:
	•	no transcript MMKV key exists
	•	no transcript is persisted
	•	no transcript is sent upstream
	•	no verbatim user language is retained unless a future explicit user opt-in changes that behavior

Raw User Language Rule

Raw user-authored language must not leave the device.
This includes:
	•	raw voice transcript
	•	free-text emotional statements
	•	named weight
	•	reflection notes
	•	verbatim journal-style content

AI Privacy Contract

What may be sent to server/model layer:
	•	archetype
	•	structured interpretation
	•	OperatingState
	•	categorized MemorySummary patterns
	•	other non-verbatim, privacy-reviewed derived artifacts explicitly approved in the domain model

What may never be sent by default:
	•	raw transcript
	•	named weight
	•	free-text reflection content
	•	verbatim user phrasing
	•	any field not classified and approved

Firestore Boundary

Firestore is restricted to:
	•	subscription / entitlement state
	•	opt-in aggregate analytics only
	•	other explicitly approved non-personal infrastructure data

Firestore must not store:
	•	raw emotional data
	•	reflections
	•	MemorySummary content
	•	transcript content
	•	personalized plan content
	•	user-authored text
	•	wellness/health-sensitive personal interpretation data

Aggregate Analytics Definition

“Aggregate analytics” must mean:
	•	non-verbatim
	•	non-PII
	•	non-user-reconstructable
	•	coarse enough that a single user’s private state cannot be inferred
	•	opt-in only when applicable

Do not use “aggregate” loosely.

Governance Rule

If a new field is added anywhere in the domain:
	1.	it must first appear in domain/storage-classification.md
	2.	its storage owner must be justified
	3.	its consent status must be explicit
	4.	its privacy implications must be resolved before implementation

⸻

8) The Six Personalization Loop Entities

These are distinct domain concepts with separate storage ownership and lifecycle.

1. RawInput

What the user provides during check-in.
Default behavior:
	•	transient during active session
	•	only structured derivatives persist by default
	•	raw transcript is not retained unless a future explicit opt-in changes this

2. InterpretedState

Structured interpretation of the check-in.
This captures signals like:
	•	emotional tone
	•	cognitive load
	•	stress level
	•	energy
	•	constraint patterns
	•	relevant pressure categories
	•	other non-verbatim derived meaning

3. OperatingState

A higher-order operating assessment derived from InterpretedState.
It answers:
	•	what kind of morning this is
	•	what mode the system should optimize for
	•	what the user’s capacity likely is
	•	how confident the system is

4. MorningPlan

The generated operating plan for the current session window.
This is the core output object for Block 1.
It includes PlanRationale.

5. ExecutionRecord

Append-only event log describing how the plan was actually used.
This is essential for learning.

6. Reflection

Post-plan feedback from the user about:
	•	what felt accurate
	•	what helped most
	•	what got in the way
	•	what felt off
	•	other relevant private feedback

7. MemorySummary

Rolling summary of stable patterns about how the person functions under different conditions.
No raw text. No verbatim notes.

8. TrustSignal

Longer-horizon signal describing whether the system is building, maintaining, or eroding self-trust.

Note:
TrustSignal is downstream of the main personalization loop, but it is still a first-class domain concept and category outcome.

⸻

9) Core Domain Concepts That Must Exist

OperatingState

OperatingState is a first-class domain object, not a UI convenience.

It includes:
	•	one of five approved modes:
	•	RECOVERY
	•	FOCUS_REBUILD
	•	STEADY_EXECUTION
	•	HIGH_STAKES_DAY
	•	OVERWHELM_CONTAINMENT
	•	capacity from 0–1
	•	confidence
	•	sessionType

PlanRationale

PlanRationale is embedded in every MorningPlan.

It must include:
	•	noticed[]
	•	planLogic
	•	protecting
	•	creating
	•	uncertainty[]

uncertainty[] is non-negotiable.
It records what the system could not interpret confidently and why.

This is part of the trust architecture.
The system must not pretend certainty it does not have.

TrustSignal

TrustSignal must include five components before any composite:
	•	accuracy trend
	•	follow-through consistency
	•	abandonment rate
	•	correction frequency
	•	begin willingness

It also includes:
	•	composite score from 0–1
	•	status:
	•	BUILDING
	•	STABLE
	•	ERODING

Memory models how this person functions under different conditions, not just what they said they liked.

10) Memory Model — Behavioral Buckets

MemorySummary must use these five named behavioral buckets:
Bucket
Meaning
stabilizers
actions/conditions that reliably improve state
derailers
recurring patterns that destabilize the user
tractionBuilders
moves that reliably create forward motion
selfTrustThreats
patterns that erode self-trust
reliableFirstMoves
opening actions that consistently precede a good morning

11) Non-Negotiable Constraints
	1.	MMKV is primary for all personal data.
	2.	Raw user-authored text must not leave the device by default.
	3.	Firestore is an implementation detail behind repositories only.
	4.	No component, screen, hook, or feature module may talk to Firestore directly.
	5.	sessionType exists from day one for all architecturally relevant entities.
	6.	Only morning is implemented in Block 1.
	7.	PlanRationale must ship with every generated MorningPlan.
	8.	uncertainty[] is required in every PlanRationale.
	9.	ExecutionRecord is append-only.
	10.	Transcript retention is ephemeral by default.
	11.	Every new field must be added to domain/storage-classification.md before implementation.
	12.	The system must always return a usable MorningPlan.
	13.	If server/model generation fails, the rule-based fallback must still produce a plan.
	14.	Block 1 is morning-only in scope, but the architecture must remain OS-extensible.


12) Personalization Engine Is the Center

The intelligence core lives in engine/.
All other layers exist to support it.
engine/
├── PersonalizationEngine.ts
├── InterpretationService.ts
├── OperatingStateEngine.ts
├── PlanGenerationService.ts
├── ExecutionTracker.ts
├── MemoryEngine.ts
├── FitEvaluator.ts
└── TrustEvaluator.ts


Responsibilities
	•	PersonalizationEngine
	•	orchestrates the core loop
	•	coordinates check-in, plan creation, reflection processing, and updates
	•	InterpretationService
	•	transforms raw input into structured InterpretedState
	•	on-device
	•	no verbatim leakage
	•	OperatingStateEngine
	•	derives OperatingState from InterpretedState + relevant context
	•	determines the correct operating mode for the current morning
	•	PlanGenerationService
	•	creates MorningPlan + PlanRationale from OperatingState, archetype, and memory
	•	server/model path allowed only with privacy-compliant inputs
	•	must have rule-based fallback
	•	ExecutionTracker
	•	synchronously appends execution events
	•	should never silently fail
	•	MemoryEngine
	•	updates MemorySummary from execution + reflection over time
	•	tracks stable patterns, not raw logs
	•	FitEvaluator
	•	computes session-level fit quality
	•	pure computation, no side effects
	•	TrustEvaluator
	•	computes longer-horizon trust/self-trust signal
	•	evaluates whether the product is building or eroding trust

Core Daily Flow
RawInput
→ InterpretedState
→ OperatingState
→ MorningPlan + PlanRationale
→ ExecutionRecord
→ Reflection
→ MemorySummary update
→ TrustSignal update

13) Morning Operating Modes
Mode
When
System priority
RECOVERY
low energy, high stress, fragile baseline
containment and minimum viable traction
FOCUS_REBUILD
moderate capacity, scattered cognition
anchor first, then rebuild clarity
STEADY_EXECUTION
normal functional capacity
stable, archetype-aligned execution
HIGH_STAKES_DAY
important visible commitment ahead
protect reserve, reduce waste, prepare precisely
OVERWHELM_CONTAINMENT
overload near ceiling
triage, simplify, reduce to one non-negotiable


14) Metrics

Seven metrics are approved.

Engine Quality Metrics
	1.	Rolling FitScore trend
	2.	Execution depth
	3.	Follow-through rate
	4.	User-rated accuracy
	5.	High-accuracy pattern density

Category Outcome Metrics
	6.	Self-trust trend
	7.	Operating mode distribution over time

These must reflect not only whether the plan was “good,” but whether Rise is helping the user become calmer, clearer, and more self-trusting over repeated mornings.

All metrics are computed locally by default.

⸻

15) Auth Model

Onboard-First Rule

The user completes the full onboarding flow and receives their first MorningPlan before account creation is required.

Session Survival Requirements

The onboarding/session model must explicitly support:
	1.	same-session return
	2.	backgrounded-and-purged return on same device
	3.	attempted recovery on a different device before auth completion

These scenarios must be documented precisely in domain/onboarding-session.md.

Current Strategic Decision

If recovery on a different device before auth is impossible by design due to privacy constraints, that must be stated explicitly rather than hidden.

Auth Providers
	•	Email
	•	Google
	•	Apple Sign In

Apple Sign In is required.

⸻

16) PMF Definition

Rise has product-market fit when the following begin to hold simultaneously:
	1.	meaningful next-day return after onboarding
	2.	user-rated plan accuracy rises across the first week
	3.	users repeatedly report feeling understood unusually well
	4.	TrustSignal trends toward BUILDING for a meaningful share of active users
	5.	morning operating states stabilize over time in a favorable direction
	6.	the app becomes part of the user’s real morning behavior, not just a concept they admire

PMF is not “people like the idea.”
PMF is:
the product reliably produces a morning experience that feels unusually accurate, followable, and trust-building.

⸻

17) Decision Hierarchy for Future Tradeoffs

When future sessions face tradeoffs, evaluate them in this order:
	1.	Does this improve or weaken the core claim that the app understands the user unusually well?
	2.	Does this protect or weaken the privacy-native architecture?
	3.	Does this improve or weaken calm, focus, and self-trust as outcomes?
	4.	Does this preserve the morning-first wedge while keeping OS extensibility?
	5.	Does this reduce or increase user friction before value is felt?
	6.	Does this preserve design coherence with the Apple-first / Solis system?
	7.	Does this introduce avoidable implementation complexity at MVP stage?

If a decision scores well technically but weakens the core claim, privacy boundary, or category coherence, reject it.

⸻

18) What This Product Must Never Become

Do not let Rise drift into:
	•	a generic wellness dashboard
	•	a habit-streak app
	•	a motivational app
	•	an over-instrumented quantified-self system
	•	a cloud archive of emotional data
	•	a black-box AI with fake certainty
	•	a feature-bloated lifestyle app
	•	a productivity app wearing warm colors

⸻

19) Source-of-Truth Files
	•	CLAUDE.md
	•	domain/types.ts
	•	domain/storage-classification.md
	•	domain/onboarding-session.md

These are source-of-truth files.
Implementation must follow them.
If implementation pressure conflicts with them, raise the conflict explicitly instead of silently deviating.

⸻

20) Source Locations
	•	Expo project: Rise by Solis App/
	•	Design language: Design Language/
	•	Domain types: Rise by Solis App/domain/types.ts
	•	Storage classification: Rise by Solis App/domain/storage-classification.md
	•	Onboarding session spec: Rise by Solis App/domain/onboarding-session.md

The archived web prototype is reference material only.
It is not the product