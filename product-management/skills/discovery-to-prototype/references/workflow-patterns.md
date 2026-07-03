# Workflow patterns

The reusable dynamic-workflow shapes behind the method, distilled from real runs. Each entry: when to reach for it, its shape, the gotchas, and the runnable skeleton (if one ships in `examples/`). All of them embed the `CTX` block and a falsifiable finding schema in every agent — see `workflow-conventions.md`.

The one skeleton underneath most of them: **fan out generators with orthogonal charters → verify each finding with a refute-biased skeptic → consolidate with one higher-effort lead.** Learn that first; the rest are variations.

---

## 1. Audit → adversarial-verify → synthesize *(the workhorse)*

**When:** any artifact — code, design, doc, plan — you want critiqued and refuse to trust a single agent's finding list. Roughly half of all runs are a variant of this.

**Shape:** N auditors, each pinned to a *distinct* dimension (implementation / domain-model / persona-usability / market-convention / scope), each emitting structured falsifiable findings → **each finding** is independently verified by a skeptic told to re-read the source and default to refute (run this as a `pipeline` so a finding verifies while others are still being generated) → survivors are deduped, clustered, and severity-ranked by one `xhigh` lead that also credits `what_is_solid` and emits go / no-go with must-fix vs. nice-to-have.

**Gotchas:** the verify pass is not a formality — it exists to kill plausible-but-wrong findings; bias it to refute. Gate the expensive verify on severity (only re-verify Sev ≥ 3) when the finding list is long. Skeleton: `examples/audit-verify-synthesize.js`.

---

## 2. Divergent design candidates → judge panel → consolidate grafts

**When:** taste-driven or early-design deliverables where a single "best" isn't derivable, especially when one make-or-break objection should drive the choice.

**Shape:** an optional cartographer maps the reuse surface first (copy-verbatim / reuse-pattern / cut) → K designers, each handed an *opposed* stance, each filling one honesty-forcing schema (`preview` + `altPreview` of the degraded state + `risks` + `edge-cases`) → a judge that either (a) is a single lead emitting one 0–100 score per candidate + `recommendedKey` + `bestGrafts`, or (b) scores a candidate×criterion matrix rolled up by **mean** → an `xhigh` lead merges the best grafts into one buildable spec, biased toward the option that best *kills the #1 objection*.

**Gotchas:** the judge should name steal-worthy grafts, not just crown a winner. **Median is not used here** — that belongs to calibrate-findings (#4). Generators at `effort:'high'`, the lead at `xhigh`. Skeleton: `examples/design-judge-panel.js`.

---

## 3. Triangulated verify: live walkthrough ‖ static audit, reconciled

**When:** validating an interactive prototype where some defects only appear on click and others only in the code.

**Shape:** run two things concurrently — a background static engine-audit (one subagent per user flow, shared finding schema including a works-well kind, plus a Runtime agent that builds a Node harness importing the DOM-free math module to confirm the actual figures) and a foreground live drive as the persona through the protocol, asserting the invariant at the data level after every action. Then **reconcile**: static findings are hypotheses; keep only those live behavior + data checks confirm. Finish with a calibrate pass (#4).

**Gotchas:** take the footgun/escape-hatch path *first* — falsify, don't demonstrate. Check money at the data level, never from the screenshot. For breadth when you can't hand-drive everything, fan out one persona-embodied agent per task (each bucketing its experience into broken / model-mismatch / works-well) — but that complements, does not replace, a real hand-drive.

---

## 4. Calibrate-findings *(de-inflate an existing list)*

**When:** after a live session or manual audit produced raw self-assessed severities and you fear over-claiming before sharing.

**Shape:** feed the already-observed findings in as arguments → per finding, 3 orthogonal lenses in parallel (persona-realism, which treats the facts as reliable and only calibrates; deliberately-conservative-argue-it-down; adversarial-skeptic-refute) → roll up to the **median** severity + a "real-for-persona" vote tally + the strongest counterargument. It discovers nothing new — it recalibrates what you have.

**Gotchas:** this is the *only* pattern where median belongs. Accept demotions as readily as promotions. Skeleton: `examples/coverage-and-calibrate.js` (calibrate half).

---

## 5. Fix-verification + regression gate → go/no-go

**When:** after applying a round of edits — a repeatable ship/test gate to run after *every* change round.

**Shape:** enumerate the *specific* applied fixes → one verifier per fix confirms it is correct AND complete AND hunts an adjacent regression (optionally a second recheck told not to trust the first: "find an incomplete fix that looks complete") → a parallel cross-consistency sweep (protocol↔build, README↔build, seed coherence) + adjacent-flow regression sweep → synthesize into go / go-with-minor-cleanups / no-go.

**Gotchas:** fixes routinely introduce regressions — including destructive ones. Adversarially review your *own* diff; re-verify safety fixes live. Gate the expensive independent verify on severity.

---

## 6. Read-only ground-truth reality probe *(facts, not judgment)*

**When:** you're working inside an existing product's repo and need to establish the **status quo** before designing a replacement or addition (the common case — Phase 0); or you suspect your own memory, notes, README, or a prior audit have drifted from the code; or you need a precise map before spending design/build effort.

**Shape:** parallel Explore agents, **one per file/aspect**, each returning observed facts + evidence quotes — zero edits, zero verdicts. Three forms of the same shape:
- **Status-quo / product cartography (Phase 0):** one agent per subsystem the concept touches, each returning the real data model, the target module's actual behavior, house conventions/stack, hard constraints, and a `salvage-vs-replace` verdict — a lead fuses them into the `CTX` `EXISTING PRODUCT` section. Skeleton: `examples/map-status-quo.js`.
- **Coverage trace (Phase 4):** one agent per feature area returning `yes`/`partial`/`no` per bet & task + `scopeNotes` + `surprises`. Skeleton: `examples/coverage-and-calibrate.js` (coverage half).
- **Memory/notes drift check:** one agent per file/aspect returning a `notableChanges` list of `{key, observed, evidence}`, then reconcile claimed state against what the code currently is.

**Gotchas:** keep it strictly read-only and judgment-free — its value is uncontaminated facts. Never let it edit; map, don't change.

---

## 7. Research-first, then audit against the research

**When:** domain expertise is load-bearing and you're not the expert — establish how real competitors/mechanics behave, then judge the build against that. This is where you **script** a research fan-out yourself (rather than invoking the `deep-research` skill) because the research must feed an internal audit.

**Shape:** parallel web-research agents (competitors + domain mechanics) return cited, confidence-tagged findings → those feed internal audit dimensions carrying a `from_hypothesis` flag (confirmed-provided vs. newly-discovered) with confirmed/refuted/partial verdicts → a later variant cross-checks each build decision as honored / deliberate-divergence / tension / gap / contradiction with `file:line` evidence, and flags claims the research does *not* support as unverified extrapolation.

**Gotchas:** keep an `unsupported_claims` field so business-model or market assertions the research never verified get flagged rather than laundered into fact.

---

## 8. Investigation → adversarial refute of one load-bearing claim

**When:** a single high-stakes yes/no decision ("will X silently cost me / break?") where you want to be actively talked *out* of a comfortable assumption. Scale depth to the cost of being wrong.

**Shape:** a few parallel doc/tool investigations gather cited evidence with exact quotes → one adversarial fact-checker tries to *refute* the specific claim, independently re-fetching primary sources, defaulting to "refuted" if evidence is insufficient.

**Gotchas:** state the claim precisely before refuting it. Retract your earlier guess out loud if the refuter can't kill it and it still turns out wrong — provenance honesty is the point.

---

## 9. Selective / conditional verify *(skip what isn't checkable)*

**When:** reviewing a mixed artifact (e.g. a usability protocol) where only some findings are source-checkable and others are judgment calls.

**Shape:** route only the code-checkable findings to an independent source re-read; let judgment-call findings pass through with a "not code-checkable" stub, so no verify budget is wasted on the unverifiable.

**Gotchas:** be explicit about which findings were verified vs. taken on judgment — don't imply the whole set was checked.

---

## Composing them

A full validation pass usually chains several: a **coverage trace** (#6) before the protocol → a **triangulated verify** (#3) that runs a **static audit** (#1) alongside the live drive → a **calibrate** pass (#4) on what survives → a **fix gate** (#5) after each repair round. Read `workflow-conventions.md` for the mechanics (effort dial, parallel-vs-pipeline, voting, the schema) that every one of these shares.
