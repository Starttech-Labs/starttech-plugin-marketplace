---
name: discovery-to-prototype
description: Apply the adversarial, dynamic-workflow-driven method for taking a product idea into a customer-testable prototype in a domain you don't personally own — research how incumbents actually work, turn design decisions into numbered falsifiable bets (plus a genuine counter-position), build a zero-install clickable prototype seeded to exercise each bet, trace coverage, then verify by triangulating a live persona walkthrough, a static fan-out audit, and ground-truth math. Takes the existing product as an OPTIONAL input: when run inside a product's main repo (the usual case), it reads the current implementation from the codebase to ground the design; when the concept is greenfield it skips that. Trigger when the user asks to "validate a concept/design", "build a prototype to test with customers", "research this domain and design a better X", "turn my design into testable bets", "pressure-test my product bets", "write a usability-test protocol", "counter-position against incumbents", or wants to spin up parallel audit/verification workflows over a product design. Do NOT trigger for a single quick UI mock, a pure literature-only research request with no design intent, or generic coding tasks.
version: 0.1.0
---

# Discovery to prototype

A repeatable method for building a product concept in a domain you are **not** the expert in, and coming out the other side with a customer-testable prototype and an honest account of what it does and doesn't prove. The loop:

```
(0) READ STATUS QUO ─▶ RESEARCH → DESIGN (falsifiable bets + counter-position) → PROTOTYPE → TRACE (coverage) → VERIFY (triangulate)
  (optional: when you're         ^                                                                                |
   in the product's repo)        └──────────── gap found → scoped round-2  ·  finding contradicts you → correct ──┘

  engine (runs through every phase): fan out generators → adversarially verify each finding → higher-effort lead synthesizes
```

The distinctive moves: every design decision becomes a **numbered falsifiable bet**; the core invariant is made true **by construction**, not guarded by a warning; and nothing is trusted until an independent pass, biased to *refute*, has re-derived it from source. Dynamic workflows (parallel/pipeline subagents) are the engine that makes the adversarial passes cheap enough to run constantly.

## When to use this

Use it for the arc from "I have an idea in domain X" to "I have a prototype I can put in front of a prospect and a list of what it validates." Use individual phases standalone too — the coverage trace before a usability test, the calibrate-findings panel after one, the counter-position panel when a design feels like a copy.

Do not pull it in for a throwaway mock, a pure fact-finding research question with no design intent, or ordinary feature coding. It earns its overhead when a decision is expensive to get wrong and you are working outside your own expertise.

**The engine needs the Workflow tool** (available under `/effort` ultracode, or when the user opts into multi-agent orchestration). Without it, run the same *shape* by hand: launch N `Task` subagents in one message, then paste their outputs into a synthesis prompt. The patterns are identical; only the mechanism differs.

## The non-negotiables

These make the method work; skip them and the output is a fast pile of confident-but-wrong.

- **Default to adversarial skepticism.** Every generated finding must survive a verify pass told to *refute* it — re-read the source, default to "does not hold up unless reproducible." Reproduce every critical yourself before stating it as fact.
- **Triangulate before you trust.** A finding is strongest when live behavior, a static code audit, and the source mechanism (`file:line`) all agree. One source is a hypothesis.
- **Ground truth over proxy, every layer.** Primary vendor docs over blogs. Exact design tokens read from source over an eyeballed palette. The live DOM (`getComputedStyle`) over a screenshot. Persisted state over "it renders."
- **No over-claiming.** Label provenance inline (research-backed vs. inference; `[saw it live]` vs. `[latent in code]`; REAL vs. SIMULATED vs. DEAD). Retract speculation out loud the moment evidence contradicts it. An agent-driven walkthrough finds real defects but is **not** user validation — never say "validated with users" on that basis.
- **Make the invariant true by construction.** Fix the root cause so the bad state is unreachable (remove the affordance), not merely warned against — and let that structural fix become the product thesis. Stay honest that "ties out by construction" ≠ "matches reality" (the fidelity trap).
- **Force divergence, then converge.** Give parallel agents orthogonal charters so coverage is real, then let one higher-effort lead consolidate into a single committed decision.
- **Scale effort to the cost of being wrong.** A study-invalidating money bug earns a multi-angle adversarial pass; a small tweak earns two explore agents. Do not manufacture a 40-agent fan-out for a small task.
- **Verify empirically instead of hedging.** Never answer a checkable question from memory — run the query, drive the app, re-fetch the doc.

## Before anything: the CONTEXT block

Write one fat `CTX` brief and reuse it everywhere — it is the highest-leverage habit in the method. It is self-contained: product goal, persona (one named sentence), north-star, architecture, the core invariant, explicit in/out scope, seed facts and the wedge. Interpolate it into **every** subagent prompt in every workflow; context-free agents invent their own success criteria and re-flag things cut on purpose. Keep a companion `DISCLOSED / BY-DESIGN` list ("do not re-flag these"). Store both as string constants in each workflow script and as a small cross-linked memory spine (`scope.md`, `research.md`, `design-bets.md`, `verify-status.md`).

One optional input feeds this brief: **the existing product**. When the session runs inside a product's main repo — the norm — do not describe the architecture, constraints, or status quo from memory; derive them by *reading the codebase* first (Phase 0) and add an `EXISTING PRODUCT / STATUS QUO` section to `CTX`. Skip that only when the concept is greenfield or the current module is irrelevant to it.

The full anatomy, a filled generic example, the falsifiable finding schema, and the effort/parallel-vs-pipeline/voting conventions live in **`references/workflow-conventions.md`** — read it before writing the first workflow.

## The phases

Each phase names what to produce, the moves, and the workflow to run. Copy-paste prompts for every phase are in **`references/prompt-templates.md`**; the reusable workflow shapes are catalogued in **`references/workflow-patterns.md`** with runnable skeletons in **`examples/`**.

### 0 · Read the status quo — *optional; the usual case when working inside an existing product's repo*
Produce a factual **status-quo brief** of the current product so the design is grounded in what actually exists — not a guess. Sessions usually run inside the product's main repo, so the status quo is *readable*: fan out one read-only agent per subsystem the concept touches (`examples/map-status-quo.js`). Each maps the real data model, the target module's actual behavior (not its docs' claims), the house stack/conventions a new module must fit, the integration constraints and any invariant the codebase already enforces, and an honest **salvageable-vs-replace** verdict — all with `file:line` evidence. A lead fuses the probes into the `CTX` `EXISTING PRODUCT` section and sharpens the wedge, so you differentiate against the *real* current thing. Skip this only when the concept is greenfield or the existing module is bad enough to ignore — as with the church-accounting module the running example replaced, which was weak enough that the prototype went greenfield and took nothing from it. Keep it strictly read-only: map, don't edit.

### 1 · Research — ground the domain and the market
Produce market-validated-or-killed hypotheses *before* committing any design. Invoke the pre-built **`deep-research` skill** with one scoped question (sharpen scope with 2–3 clarifying questions first); it fans out searches → dedups → verifies each claim by majority vote → synthesizes with citations. Prefer primary vendor docs. Pick 2–3 named incumbents as a **North Star**, adopt their conventions as defaults, then hunt the one place they structurally **can't follow you** — the wedge. When a gap surfaces in your own round-1, trigger a *scoped* round-2 framed as one precise product question. Script a research fan-out yourself only when the research must feed an internal code audit (see `research-first-then-audit` in the patterns).

### 2 · Design — falsifiable bets, plain model, a counter-position
Rewrite every decision as a **numbered bet**: "Bet N: [choice] — testable by [observable behavior]." Hide the hard machinery behind plain nouns the user already owns; treat exposed domain jargon as a smell. Identify the one invariant that must always hold and make it true **by construction**. When a design claim is contested, trace it through the *actual formula in code* and expose the flaw with a concrete numeric counterexample. Then generate a genuine **counter-position** — a stance an incumbent could not adopt without breaking their own model — via the divergent-design → judge-panel workflow (`examples/design-judge-panel.js`), biased toward killing the single make-or-break objection.

### 3 · Prototype — build a customer-testable instrument
Build **vanilla, `file://`-runnable, localStorage-persisted with a reset** so a prospect double-clicks and it runs — a separate throwaway artifact, kept out of the product's build. **Isolate invariant-critical math into a DOM-free module** so a headless harness can import it at verify time. Build that math yourself, airtight to the penny. Seed a realistic living dataset **plus planted "beats"** that each force one risky bet during a demo (e.g. a duplicate to force a match-not-double-post, a batch to force a split, an ambiguous item with no suggestion to force human judgment). **If Phase 0 produced a status-quo brief, mirror the existing product's data model, entities, and terminology** in the prototype's seed so findings transfer to the real build — a bet validated on a foreign model doesn't carry over. When the module is being replaced wholesale (greenfield), design the model fresh instead. Prototyping is **single-writer** — never fan out edits to one shared file (parallel agents corrupt it); use parallel agents only for read-only scouting. Skin to authoritative tokens read from source *if a design system exists*, verified against the live DOM, not screenshots; otherwise use a neutral placeholder palette and skip skinning. (The reuse-map cartographer in `examples/design-judge-panel.js` can target either the real module or a prior prototype iteration.)

### 4 · Trace — what did you actually build vs. the bets?
Before writing any test task, fan out one read-only agent per feature area (`examples/coverage-and-calibrate.js`, coverage half). Each returns, per bet and per planned task, a verdict `yes` / `partial` / `no` with `file:line` evidence, plus `scopeNotes` (what is stubbed/faked/simulated) and `surprises` (README-says-X-but-code-does-Y). Cut or fix anything the build can't actually do *before* the protocol — never usability-test a faked feature or claim a stubbed bet is validated.

### 5 · Verify — triangulate live, static, and ground-truth math
Write the acceptance criteria as a **standalone protocol first** (NN/g: ~5 single-segment participants, think-aloud, anti-priming wording with a jargon→plain table, a pilot, a 1–4 severity rubric). Then verify in layers, cheap to expensive: `node --check` → a **Node harness importing the DOM-free module** to assert the invariant on real numbers → static DOM dump → **live click-drive as the persona**, asserting the invariant at the data level after *every* money action, footgun path first. Run the live walkthrough and a **static fan-out audit** of the same flows in parallel, then reconcile — static findings are hypotheses; keep only what live behavior + data checks confirm (`examples/audit-verify-synthesize.js`). Calibrate self-assessed severities on a 3-lens **median** panel (`examples/coverage-and-calibrate.js`, calibrate half) — accept demotions. Publish an explicit **CANNOT-be-validated list** so a green check is never laundered into "validated." After each fix round, run a fix-verification + regression gate (adversarially review your *own* diff — fixes routinely add regressions). Declare "good to go" only when a review cycle finds zero new issues.

## The dynamic-workflow engine

The reusable shapes, each with when-to-use and gotchas, are in **`references/workflow-patterns.md`**; runnable skeletons are in `examples/`. The essentials:

- **Parallel vs. pipeline.** `parallel(thunks)` is a barrier (use for coverage / removing anchoring bias). `pipeline(items, ...stages)` has no barrier — item A can be verifying while B still generates (the default for generate→verify→synthesize). Most real workflows are pipelines of parallel stages.
- **Adversarial-verify voting.** After generation, run a *separate* pass whose only job is to knock each finding down — re-read/re-fetch source, default to "refuted." Keep a claim only if it survives (for research claims: 3-0 or 2-1 in favor, report the split).
- **The effort dial.** `effort:'high'` on generators/designers/cartographer; `effort:'xhigh'` on the single consolidating lead; leave cheap refute-verifiers at default.
- **Schema-as-rubric.** Every finding must be falsifiable: claim + evidence (`file:line` / quote / computed number) + bounded severity + a type + a why, and a mandatory non-defect **`works-well`** field so audits credit what's solid instead of manufacturing defects.

## Pitfalls

- **Fan-out for its own sake.** Right-size; use the effort dial before agent count.
- **Trusting a finding list as truth.** Always terminate generation with a refute-biased verify pass; reproduce criticals firsthand.
- **Skipping the coverage trace** and usability-testing a faked feature. Run Phase 4 before writing the protocol.
- **Parallel agents editing one shared file.** Single-writer; fan out only for read-only review.
- **Context-free subagents.** Embed the `CTX` + `DISCLOSED` list in every prompt.
- **Verifying a screen "looks right"** instead of that the numbers tie out. Assert the invariant at the data level; distinguish "ties out" from "correct."
- **Priming participants with your jargon.** Anti-prime with a jargon→plain table; test comprehension, not recall.
- **Reconciling the protocol against intent, not the actual seed/build.** Drive the live build for each task.
- **Over-claiming fidelity.** Agent walkthroughs ≠ user validation; label REAL/SIMULATED/DEAD; calibrate severities before quoting them.
- **Believing your own fixes are clean.** Adversarially review your own diff.
- **Declaring "done" by checklist** rather than convergence. "Good to go" = a review cycle that finds nothing new.

## Resources

- **`references/workflow-conventions.md`** — the CTX-block anatomy (filled example), the falsifiable finding schema, the effort dial, parallel-vs-pipeline, adversarial-verify voting, the single-writer rule.
- **`references/workflow-patterns.md`** — the catalogue of reusable workflow shapes (audit→verify→synthesize, design→judge-panel, triangulated verify, calibrate-findings, fix-gate, reality probe, research-then-audit, refute-one-claim) with when/shape/gotchas.
- **`references/prompt-templates.md`** — copy-paste prompts per phase, grounded in the real prompts that drove this method.
- **`examples/map-status-quo.js`** — Phase 0: read-only cartography of the existing product in the current repo → a status-quo brief (real data model, target-module behavior, conventions, salvage-vs-replace) for the `CTX` block.
- **`examples/audit-verify-synthesize.js`** — the workhorse: fan-out distinct-lens auditors → per-finding adversarial verify → xhigh lead synthesis.
- **`examples/design-judge-panel.js`** — divergent design candidates → judge panel → consolidate grafts (single-judge or mean; median is *not* used here).
- **`examples/coverage-and-calibrate.js`** — the read-only coverage trace, and the 3-lens median severity calibration.
