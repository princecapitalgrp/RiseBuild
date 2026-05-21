# Solis — Strategic Intelligence File
# Companion to CLAUDE.md. Read both before every session.
# CLAUDE.md owns architecture. This file owns strategy, positioning, and PMF.

---

## Product Vision

Solis is the private personal OS for the generation that knows
exactly what they should be doing and cannot make themselves do it.

It is not a habit tracker. It is not a wellness app. It is not
a productivity tool. It is the first system that closes the gap
between knowledge and execution by understanding how a specific
person actually functions — their stabilizers, their derailers,
their reliable first moves — and using that understanding to
generate a daily morning structure they will actually follow.

The felt experience it engineers: the natural dopamine and
oxytocin release that comes from disciplined execution of
meaningful tasks. Not optimization. Not performance. The quiet
satisfaction of having done the hard things that move the needle,
balanced between the rigidity of hustle culture and the
permissiveness of low achievement.

The product succeeds when a user opens it at 6am three weeks
after downloading it because it feels safe to be vulnerable to,
understands them unusually well, and has made them feel more
driven, less shameful about past inaction, less scared about
their future, and more optimistic about their life.

---

## The User

**Primary:** The founder-entrepreneur or high-achieving student.
Gen Z. Motivation without discipline. Knowledge without execution.
Overstimulated and under-executing. Feels the pain of regret
acutely. Wants novelty, growth, and the discomfort of stagnation
resolved — not by being told what to do, but by having a system
that understands them well enough to generate a plan they trust.

**Secondary:** Young professionals in high-pressure industries
(finance, consulting, law) where work-life balance is routinely
sacrificed and the cost is felt but rarely addressed.

**Tertiary:** Middle-aged professionals introduced through personal
referral. Not the primary design target but a real user group
for whom the physical health and daily structure value is
immediately legible.

The common denominator across all three: the omnipresent human
pain of not becoming who you know you could be.

---

## Brand

**Name:** Solis. From the Latin "of the sun." Rise by Solis.
The sun as a physical, spiritual, and mental healing force.
The morning as the highest-leverage moment in the day.

**Design adjacent to:** Bevel (health/wellness UX, comprehensive
tracking, premium restraint), Apple (design language, marketing
precision, brand trust), Anthropic (good morals, trust
architecture, AI that is genuinely useful rather than
performatively intelligent).

**Visual system:** Apple-first design language. Palette B (Amber
Core) for daytime editorial and warm trust screens. Palette C
(Charcoal Sun) for hero moments and premium dark surfaces.
Bevel-adjacent clarity, spacing, and motion. Not a Tailwind port.

**Voice:** Intelligent, calm, private, quietly elite. Never
motivational-poster. Never clinical. Never hustle-coded.
The tone of a trusted advisor who has read everything and
distilled it specifically for you.

---

## The Privacy Promise (Architectural, Not Rhetorical)

All personal emotional data — the weight named, childhood
morning pattern, operating state, protocol history, check-in
data, memory summary — is stored locally on device using MMKV
with encryption. It never touches a server without explicit,
informed, revocable user consent.

Firestore is permitted for: subscription state, anonymous
aggregate analytics only. Never for personal health or
emotional data.

This is not a marketing claim. It is an architectural constraint
enforced at the repository layer. Components never talk to
Firestore directly. Firestore is an implementation detail
behind repositories, not the domain model.

Every new data field added to the product must be classified
in `domain/storage-classification.md` before implementation.

---

## The Six Personalization Loop Entities

Each has a distinct storage owner and lifecycle. These are
non-negotiable boundaries.

1. **RawInput** — MMKV, transient. What the user explicitly told
   the system today.
2. **OperatingState** — MMKV, daily. Produced by InterpretationService
   from DailyContext. Five modes: RECOVERY, FOCUS_REBUILD,
   STEADY_EXECUTION, HIGH_STAKES_DAY, OVERWHELM_CONTAINMENT.
   Includes capacity (0–1), confidence, sessionType.
3. **OperatingPlan** — MMKV, persisted per session. Contains
   PlanRationale: noticed[], planLogic, protecting, creating,
   uncertainty[]. The uncertainty[] field is non-negotiable.
4. **ExecutionData** — MMKV, daily. What the user actually did.
5. **Reflection** — MMKV, persisted. What the user reported after.
6. **MemorySummary** — MMKV, rolling window. Five behavioral buckets:
   stabilizers, derailers, tractionBuilders, selfTrustThreats,
   reliableFirstMoves.

---

## The Four Archetypes

Classification: Author/Protagonist × Push/Pull.

### ARCHITECT (Author + Push)
- Maladaptive risk: control escalation, over-preparation.
- Intervention: bounded precision, intelligent constraint,
  force-reduction. Never add tasks. Remove them.
- Tone: direct, declarative, non-escalatory.
- Never give: open-ended reflection, optimization language,
  vague intentions.

### ALCHEMIST (Author + Pull)
- Maladaptive risk: false-start shame, vision-capacity gap
  paralysis.
- Intervention: object-completion tasks, micro-momentum.
  Each block produces a finished output.
- Tone: low-friction, momentum-focused, treats user as
  capable not fragile.
- Never give: big-picture framing before momentum exists,
  open-ended creative work first.

### SENTINEL (Protagonist + Push)
- Maladaptive risk: anticipatory emotional flooding,
  frantic-but-hollow action.
- Intervention: physical grounding before emotional
  processing. Safe container first.
- Tone: steady, "we" framing sparingly, reassuring
  without being soft.
- Never give: competitive metrics, optimization language,
  emotional processing before physical grounding.

### TIDE (Protagonist + Pull)
- Maladaptive risk: dissociative drift, losing weeks
  without traction.
- Intervention: gentle tethering, sensory anchors,
  low-stakes forward motion.
- Tone: atmospheric, invitation-based, never forceful.
- Never give: exact timestamps, efficiency rationale,
  anything that implies the morning must be earned.

---

## TrustSignal Architecture

Five component signals → composite 0–1 → BUILDING | STABLE | ERODING.

| Component | What It Measures |
|-----------|-----------------|
| accuracy_trend | Did past protocols match what actually helped? |
| followthrough_consistency | Completion rate over rolling window |
| abandonment_rate | Sessions started but not completed |
| correction_frequency | How often user overrides the plan |
| begin_willingness | How quickly user starts after receiving plan |

ERODING is not a failure state — it is a signal to adjust the
personalization model.

---

## Non-Negotiable Constraints

- Never store personal emotional data in Firestore.
- Never use affiliate recommendations.
- Never use optimization language for Sentinel or Tide.
- Never use "leverage," "synergies," "hit the ground running,"
  "passionate about" in any user-facing copy.
- Never let the UI imply the morning must be earned or performed.
- Never show competitive metrics or comparison to other users.
- Always include uncertainty[] in PlanRationale.
- Always classify new data fields in storage-classification.md
  before implementing them.
- Protocol entity always has sessionType field even when only
  morning is implemented.

---

## PMF Definition

The product has achieved PMF when all of the following are true:

- Day-30 retention exceeds **30%** in TestFlight cohort
- Sean Ellis test returns **>40% "very disappointed"** on first
  40 active users surveyed
- At least **5 users per week** produce unprompted language
  matching "it understands me" or equivalent
- Weekly churn below **5%** after day-14
- Operating mode distribution shows measurable shift: users
  spending fewer mornings in RECOVERY or OVERWHELM_CONTAINMENT
  over a 30-day window

**Failure is defined as:** >75% churn within the first week,
or <20% of users returning on day 7 without a reminder.

### The Sean Ellis Test — Applied Precisely

Survey question: "How would you feel if you could no longer use
Solis?" Options: Very Disappointed / Somewhat Disappointed /
Not Disappointed / I No Longer Use It.

- **Threshold:** 40% answering Very Disappointed = PMF.
- **Timing:** Day-21 of active use. Not day-7 (novelty inflates).
  Not day-30 (churners already gone).
- **Eligibility:** Only users who opened the app ≥5 times in the
  past 14 days. Inactive users default to "Not Disappointed"
  and produce a false negative.
- **If below 40%:** Ask every "Somewhat Disappointed" respondent
  one question: "What one thing would move you to Very
  Disappointed?" That answer is the product roadmap.

---

## The Moat — Honest Assessment

### Layer 1 — Privacy Architecture
Real today. Defensible for 3–5 years.
Risk: Apple deepens on-device processing to match the claim.
Mitigation: our moat is structural — local-first with no
commercial incentive to know more. Apple cannot make that claim
while running an ad business.

### Layer 2 — Longitudinal Behavioral Dataset
Not real yet. Becomes real at 6–12 months of retained users.
This is the acquisition asset. A dataset of how specific people
function across mornings, seasons, stress events, and life
transitions — consented, local, enriched by the five behavioral
buckets — is not replicable by a new entrant without equivalent
user trust and equivalent time. Strongest moat. Does not exist
until users stay.

### Layer 3 — Personalization Depth
Partially real. Architecture is correct. Proof is in TestFlight.
A competitor can copy the onboarding questions. They cannot copy
the memory model, TrustSignal architecture, and operating mode
distribution measurement without a significant rebuild — and by
then the dataset is 12 months deeper.

### Layer 4 — Brand Trust
Not real yet. Becomes real through founder content, consistent
behaviour over time, and the privacy promise being demonstrably
kept. Reputational trust in a category where trust is constantly
violated is worth more than any feature.

### Layer 5 — Community and Ritual
Cohort accountability groups, when activated, create social
capital that does not transfer when a user leaves. The stickiest
moat because it is relational, not technical. Does not exist
yet. Becomes the retention mechanism at Phase 2.

**Honest timeline:** Privacy moat buys 18–24 months of
differentiation. Longitudinal dataset moat, if built correctly,
is durable for 5+ years. Community moat, if activated,
is permanent.

---

## Strategic Goal

**Primary:** Raise institutional capital within 12 months on the
basis of retention data, privacy architecture, and demonstrated
"it understands me" signal at scale.

**Secondary:** Position for acquisition by Apple Health, a
corporate wellness platform, or a longevity company at a
valuation justified by proprietary longitudinal behavioral
dataset and trust architecture that cannot be replicated without
equivalent user trust and time.

### Acquisition Assets Being Built From Day One

| Asset | Status | What Makes It Valuable |
|-------|--------|----------------------|
| Local-first longitudinal behavioral dataset | Building | Cannot be replicated without user trust + time |
| Trust architecture structurally incompatible with ad-based models | Live | Apple cannot credibly claim this |
| Retention metrics demonstrating behavioral change | Pending TestFlight | Category-level outcome proof |
| Operating mode distribution | Pending TestFlight | Quantified morning-to-morning improvement |

Apple acquires for: technology, talent, or user base with
proprietary data. At this stage we are building toward the
user base acquisition. The data architecture, retention metrics,
and privacy positioning are not just product features —
they are acquisition assets.

---

## Runway Constraint

Current runway is approximately 90 days of AI subscription cost.
Every decision must be filtered through: **does this get us to a
fundable milestone within 90 days, or does it not?**

A fundable milestone for a pre-revenue consumer app at this stage:

1. Evidence of retention — people came back for 30 days.
2. Evidence of the "it understands me" signal — qualitative
   proof from real users in their own words.
3. A clear path to monetisation — a paywall that converted at a
   defensible rate in TestFlight.

This is achievable in 90 days if the build stays disciplined.

---

## Related Documents

- `CLAUDE.md` — Technical architecture, design system, component
  constraints, data model implementation.
- `TESTFLIGHT-COHORT.md` — Cohort architecture, recruitment
  strategy, what to measure and when.
- `SALES-MOTION.md` — B2C and B2B sales motion by phase,
  pricing, conversion targets, ROI framing.
