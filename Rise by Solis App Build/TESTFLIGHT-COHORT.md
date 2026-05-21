# TestFlight Cohort Design — Rise by Solis

---

## What TestFlight Is

TestFlight is Apple's official beta testing platform. It allows
you to distribute a pre-App Store version of the app to up to
10,000 users via email invitation. Users install it like a normal
app. It expires after 90 days per build, which creates natural
cohort boundaries. Crucially, it gives you real behavioral data
— open rates, session duration, return visits — from real people
using a real iOS app on their real devices, at their real 6am.

This is where behavioural PMF is tested, not web.

---

## Cohort Architecture

Three distinct groups. Do not mix them. Each group answers
different questions.

---

### Cohort A — The Signal Group (20 people)

**Who:** People you know personally and can have a direct
conversation with after they use the app. ESCP peers who
are high-achieving, motivated but inconsistent in execution.
Gen Z. Self-improvement oriented. Feel the pain of not
becoming who they know they could be.

**Purpose:** Quality of personalization signal. These are the
people who will tell you whether the protocol felt like it
understood them or felt generic. You are not measuring
retention here — you are measuring the depth of the
"it understands me" response.

**How to recruit:** Direct message. Not a group announcement.
"I built something I want you to be the first to use.
It takes 10 minutes and I want your honest reaction
the next morning." One by one. The individual ask
produces better signal than the broadcast.

**What to measure:**
- Day-1 and Day-3 qualitative response.
- Whether they produce any language matching the target
  signal without prompting.
- Call or voice note them on day 3. Ask: "What did it get
  right? What did it miss? Did anything surprise you?"

---

### Cohort B — The Retention Group (50–100 people)

**Who:** Extended ESCP network, young finance professionals,
people reached through founder content. Do not know you
personally. Received the app because they encountered
something you made — a Substack post, a short video,
a Reddit comment — and wanted access.

**Purpose:** Real retention data without social obligation.
Cohort A will use the app partly because they know you.
Cohort B uses it or does not based purely on whether
it earns their morning. This is your real PMF signal.

**How to recruit:** Waitlist from landing page. Every piece
of founder content ends with "early access via TestFlight
— link in bio." Accept in batches of 20–30, not all at once.
Staggered entry means you have rolling cohort data rather
than one simultaneous drop where problems compound.

**What to measure:**
- Day-7 retention rate
- Day-30 retention rate
- Sean Ellis test at day-21 for anyone still active

---

### Cohort C — The Stretch Group (20–30 people)

**Who:** Parents' network, middle-aged professionals, people
outside the primary demographic. Introduced through
personal referral from family connections.

**Purpose:** Discover whether the value proposition translates
beyond the primary demographic, and whether the referral
mechanic works. Not for PMF measurement. For learning
what the product means to people who were not designed for.

**What to measure:**
- Whether they complete onboarding.
- Whether the archetype system produces something legible
  for their context.
- What language they use to describe the product to others.

---

## The One Metric That Defines TestFlight Success

**Operating mode distribution shift over 30 days.**

If users who began primarily in RECOVERY or
OVERWHELM_CONTAINMENT are spending measurably more mornings
in STEADY_EXECUTION or FOCUS_REBUILD after 30 days, the
product is doing what it claims to do. No other metric
proves the category-level claim as cleanly.

| Signal | Threshold | What It Proves |
|--------|-----------|----------------|
| Day-30 retention | >30% | They stayed |
| Operating mode shift | Measurable RECOVERY → STEADY drift | It worked |
| Both together | — | PMF |

---

## Sean Ellis Test — Timing and Method

- **Survey at:** Day-21 of active use (not day-7, not day-30).
- **Eligible respondents:** Users who opened the app ≥5 times
  in the past 14 days only.
- **Question:** "How would you feel if you could no longer use
  Solis?" (Very Disappointed / Somewhat Disappointed /
  Not Disappointed / I No Longer Use It)
- **Target:** >40% Very Disappointed.
- **If below 40%:** Ask every "Somewhat Disappointed" user:
  "What one thing would move you to Very Disappointed?"
  That answer is the product roadmap.

---

## Qualitative Signal Tracking

Log every instance of unprompted language that matches or
approximates the following target phrases:

- "It understands me"
- "It got me right"
- "It felt personal"
- "I can't explain how it knew"
- "It's different from everything else I've tried"

5+ such instances per week from Cohort B = PMF signal confirmed.

These quotes are also the investor narrative. Collect them
verbatim with date, cohort, and archetype label.

---

## What Comes After TestFlight

TestFlight data becomes the investor narrative:

1. Retention curve with specific numbers (not "good retention" —
   actual percentages at day-7, day-14, day-30)
2. Verbatim "it understands me" quotes from Cohort A
3. Operating mode distribution shift chart from Cohort B
4. Sean Ellis test results from active Cohort B users

This is the deck. Not slides about market size or the competitor
landscape. Real behavioral data from real users at 6am on real
mornings. That is what separates a fundable story from a pitch.

---

## Failure Conditions and Responses

| Failure Signal | Threshold | Response |
|----------------|-----------|----------|
| First-week churn | >75% | Onboarding is broken. Stop adding features. Fix onboarding. |
| Day-7 return rate | <20% without reminder | Product is not earning the morning. Audit PlanRationale quality. |
| Sean Ellis below 40% | — | Survey "Somewhat Disappointed" users. Don't increase marketing. |
| Cohort A reports protocol felt generic | Day-3 calls | Personalization depth is insufficient. Audit MemorySummary fidelity. |

---

## Build Requirements for TestFlight Readiness

The following must be true before opening TestFlight:

- [ ] Full morning session completable end-to-end without errors
- [ ] All four archetypes produce distinct, non-generic protocols
- [ ] PlanRationale.uncertainty[] always populated
- [ ] MemorySummary updates correctly after session completion
- [ ] TrustSignal computes and displays correctly
- [ ] Local MMKV storage confirmed — no personal data in Firestore
- [ ] Paywall implemented (even if not enforced in beta)
- [ ] Operating mode logged per session (for distribution analysis)
- [ ] Crash-free rate >99% on last internal build
