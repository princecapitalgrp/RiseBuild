# Phase 0.5 — Plan Quality Scoring Sheet

Used to evaluate every output from the 50-profile harness.
Each dimension is scored independently. Final verdict is the lowest single score.

---

## Dimensions

### D1 — Archetype Fit
Does the plan sequence honour the archetype's documented operating rules?

| Score | Criteria |
|---|---|
| **PASS** | First block type matches archetype rule (Architect/Sentinel → ground; Alchemist/Tide → ignite). Block titles and action copy are archetype-specific, not generic. Anti-pattern warning names the correct archetype anti-pattern. |
| **BORDERLINE** | First block correct but block titles are generic. OR Anti-pattern warning exists but uses wrong archetype language. |
| **FAIL** | First block violates archetype rule with no circuit-breaker justification. OR Block copy is identical across two archetypes with different profiles. |

**Calibration examples:**

- PASS: Sentinel RECOVERY → sequence `['ground', 'reset']`. Title "Physical Grounding", action describes feet-flat breathing. AntiPattern: "Self-assessment before state stabilisation amplifies pressure."
- BORDERLINE: Alchemist RECOVERY → sequence `['ground', 'reset']` (correct circuit-breaker override) but action copy references "control" and "structure" — Architect language.
- FAIL: Tide STEADY_EXECUTION → first block is `ground` with no circuit-breaker. Violates Tide ignite-first rule.

---

### D2 — Mode Fit
Does the plan sequence and rationale explicitly reflect the operating mode?

| Score | Criteria |
|---|---|
| **PASS** | Block count matches mode ceiling (RECOVERY/OVERWHELM ≤ 2; Alchemist HIGH_STAKES ≤ 3). planLogic references the mode name and its implications. uncertainty[] is present and non-empty. |
| **BORDERLINE** | Block count correct but planLogic only names the mode without explaining its implications. OR uncertainty[] is present but uses identical text across all 50 profiles. |
| **FAIL** | Block count exceeds mode ceiling. OR planLogic does not reference the mode. OR uncertainty[] is empty. |

**Calibration examples:**

- PASS: Architect OVERWHELM_CONTAINMENT → 2 blocks. planLogic: "Operating mode: OVERWHELM CONTAINMENT. Your low energy and high stress directed a overwhelm containment sequence."
- BORDERLINE: All 50 profiles produce identical uncertainty[]: `['This plan was generated from rules, not from your personal history. Accuracy improves with use.']` — present but not mode-differentiated.
- FAIL: Architect OVERWHELM_CONTAINMENT → 3 blocks returned (exceeds ceiling of 2).

---

### D3 — Modifier Application
Are available-window trims and complexity-tolerance caps applied correctly?

| Score | Criteria |
|---|---|
| **PASS** | For `availableWindow=10`: blocks are trimmed from the end until total duration ≤ 10. For `complexityTolerance='simple'`: ceiling of 3 applied. For `complexityTolerance='layered'`: ceiling of 6 applied where mode allows. |
| **BORDERLINE** | Trim logic fires but leaves total duration 1–2 minutes over window (rounding artifact). |
| **FAIL** | Total duration exceeds availableWindow by more than 2 minutes. OR block ceiling is ignored. |

**Calibration examples:**

- PASS: Architect STEADY_EXECUTION with `availableWindow=15`, `complexityTolerance='simple'` → 3 blocks (ceiling=3), totalDuration=25 → trimmed to 2 blocks (ground+cognition, 20 min) → trimmed to 1 block (ground, 8 min) because 20 > 15. Wait — actually the trim logic removes from end: 3 blocks total 8+12+5=25, trim last → 2 blocks 8+12=20, still >15, trim last → 1 block 8, ≤15. Correct.
- FAIL: Sentinel STEADY_EXECUTION with `availableWindow=5` → should trim to 1 block (ground, 3 min). If 2 blocks returned (3+8=11 min > 5), FAIL.

---

### D4 — Rationale Quality
Does the rationale communicate genuine understanding rather than template output?

| Score | Criteria |
|---|---|
| **PASS** | noticed[] includes energy + stress specific values (not just "low/high" labels). planLogic explains the sequencing logic. firstBlockReason names the specific archetype need. protecting/creating are specific to the seasonalFocus value. |
| **BORDERLINE** | noticed[] present but only uses enum labels ("Your energy is low and your stress is high"). protecting/creating reference seasonalFocus by name but with identical template text across all profiles with the same season. |
| **FAIL** | noticed[] is empty. OR planLogic is a single sentence with no sequencing explanation. OR firstBlockReason is missing. OR uncertainty[] is empty. |

**Calibration examples:**

- PASS (best case possible for rule-based): noticed = ["Your energy is low and your stress is high this morning.", "Your Architect archetype and Building seasonal focus shape this plan.", "A time-specific commitment or pressure point was noted in your morning context."] — uses specific flags.
- BORDERLINE (expected for most profiles): noticed only has the 2 base items. protecting = "Your Building season — protecting the conditions that make this period productive." — generic template with season name inserted.
- FAIL: noticed = [] OR firstBlockReason = "Starting with undefined because your Architect archetype needs this foundation before moving forward."

---

### D5 — Voice Compliance
Does the copy match the Rise brand voice (precise, warm, unhurried, intelligent)?

| Score | Criteria |
|---|---|
| **PASS** | planTitle reads as a natural, warm description (not a formula). openingLine speaks to the person, not at them. No motivational slogans. No productivity-bro language. Block actions use second-person imperative with specificity. |
| **BORDERLINE** | planTitle is formulaic but not offensive (`'RECOVERY — Architect Morning'`). openingLine is technically correct but cold (`'A recovery morning for Architect.'`). Block actions are correctly phrased. |
| **FAIL** | planTitle includes enum casing visible to users (`'STEADY_EXECUTION — Architect Morning'`). OR openingLine uses motivational language. OR block action copy references "optimize", "crush", "habit", "goal". |

**Calibration examples:**

- BORDERLINE (expected): `planTitle = 'RECOVERY — Architect Morning'` — mode is display-transformed (`replace(/_/g, ' ')`) but still renders as all-caps `'RECOVERY'`.
- FAIL: `planTitle = 'STEADY_EXECUTION — Architect Morning'` — underscores not replaced. (Note: the code does replace underscores, so this specific case shouldn't occur — but verify.)
- FAIL: `openingLine = 'A recovery morning for Architect.'` — "for Architect" reads robotically; should be "for you" or use possessive.

---

### D6 — Safety / No Raw-Text Leakage
Does any output field contain verbatim user text that should never leave the device?

| Score | Criteria |
|---|---|
| **PASS** | No field in `OperatingPlan` or `PlanRationale` contains any string value from `RawCheckIn.mood`, `.updatedWeight`, or `.pressurePoint`. |
| **BORDERLINE** | N/A — this dimension has no borderline. Any raw text leakage is an immediate FAIL. |
| **FAIL** | Any plan output field contains a value derived verbatim from a raw user text field. |

**Calibration examples:**

- PASS: The rule-based generator only reads structured fields (archetype, mode, energy label, archetype). Raw text fields from RawCheckIn are never passed to PlanGenerationService. PASS expected for all 50 profiles.
- FAIL (hypothetical): noticed[2] = "You mentioned feeling 'exhausted and anxious'" — FAIL.

---

### D7 — Behavioral Divergence
Do profiles with meaningfully different inputs produce meaningfully different outputs?

| Score | Criteria |
|---|---|
| **PASS** | Two profiles sharing an archetype but different modes produce different block sequences, different block titles, different planLogic. Two profiles sharing a mode but different archetypes produce different first blocks, different action copy. |
| **BORDERLINE** | Archetype × mode combinations produce different sequences but identical block copy within an archetype (e.g., Sentinel ground block is always "Physical Grounding / Two minutes" regardless of mode). |
| **FAIL** | Two profiles with different archetypes produce identical block copy. OR two profiles with RECOVERY and HIGH_STAKES_DAY produce identical block sequences for the same archetype. |

**Calibration examples:**

- BORDERLINE (expected): Sentinel RECOVERY and Sentinel HIGH_STAKES_DAY both include the `ground` block. Both use title "Physical Grounding" and identical action copy — because BLOCK_TEMPLATES is mode-blind within an archetype. Sequence order differs (RECOVERY: ground→reset vs HIGH_STAKES: ground→anchor→cognition), so divergence is partial.
- FAIL: Architect RECOVERY block copy is identical to Architect OVERWHELM_CONTAINMENT block copy. (They share a sequence; do the blocks differ? The templates are mode-blind, so ground="Domain Setup" and reset="Circuit Breaker" in both — sequences differ but individual block copy is identical.)

---

## Pass Threshold

| Threshold | Definition |
|---|---|
| **Green** | All 50 profiles: D1 PASS or BORDERLINE, D2 PASS, D3 PASS, D4 PASS or BORDERLINE, D5 BORDERLINE or better, D6 PASS, D7 PASS or BORDERLINE |
| **Yellow (requires fixes before Priority 9)** | Any profile scores D1 FAIL, D2 FAIL, D3 FAIL, D6 FAIL. OR >20% of profiles score D5 FAIL. OR >30% score D7 FAIL. |
| **Red (block Priority 9)** | Any D6 FAIL. OR >50% of profiles fail D1 or D2. OR D3 FAIL on correct edge case inputs. |

---

## Score Summary Form (per profile)

```
Profile {N}: {Archetype} × {Mode} | window={W}min | complexity={C} | season={S}
  D1 archetype fit:        PASS / BORDERLINE / FAIL  — {note}
  D2 mode fit:             PASS / BORDERLINE / FAIL  — {note}
  D3 modifier application: PASS / BORDERLINE / FAIL  — {note}
  D4 rationale quality:    PASS / BORDERLINE / FAIL  — {note}
  D5 voice compliance:     PASS / BORDERLINE / FAIL  — {note}
  D6 safety:               PASS / FAIL               — {note}
  D7 behavioral divergence:PASS / BORDERLINE / FAIL  — {note}
  Verdict: GREEN / YELLOW / RED
```
