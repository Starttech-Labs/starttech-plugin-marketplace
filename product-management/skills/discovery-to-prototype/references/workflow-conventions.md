## Conventions — discovery-to-prototype Workflow scripts

These are the load-bearing conventions behind the ~27 real Workflow scripts. Follow them and a script reads as "one of ours." The engine is dynamic workflows: `agent(prompt, {label, phase, schema, effort, isolation, agentType})` returns the agent's output (a validated object when `schema` is given); `parallel(thunks)` is a barrier; `pipeline(items, ...stages)` streams with no barrier between stages.

---

### 1. The CTX block (embed it in EVERY agent prompt)

Fresh-eyes agents have none of the operator's memory. A shared, self-contained CTX block is interpolated into every generator AND every verifier so they don't invent their own success criteria or re-flag intentional cuts. It is the single highest-leverage convention.

**Anatomy (fixed section order):**

| Section | What it states |
|---|---|
| `WORKING DIR` + `Files to read directly` | Absolute paths + a one-line role for each file, with approx line counts |
| `PRODUCT GOAL` | It is a **research artifact to validate design with prospects, NOT the shippable product** |
| `TARGET` / `PRIMARY USER` | The persona in plain terms (+ any light secondary persona) |
| `NORTH STAR` | The 2-3 named incumbents to match on feature set / terminology / UX. **This trumps the persona as a tie-breaker.** |
| `SCOPE` | What's in — and an explicit `deliberately out of scope:` list |
| `ARCHITECTURE` + `INVARIANT` | The data model in one paragraph, and the one equation that must always hold |
| `EXISTING PRODUCT / STATUS QUO` *(optional)* | When running in the product's repo: the current module's real data model + behavior, house stack/conventions, hard constraints, and a salvage-vs-replace verdict — **read from the code (Phase 0 / `map-status-quo.js`), not described from memory**. Omit when greenfield. |
| `THE N DESIGN BETS UNDER TEST` | Numbered, falsifiable, one line each |
| `MARKET RESEARCH (verified <date>, sources)` | The conventions your defaults come from; flag any pattern that was a *coverage gap, not independently verified* |
| `CLAIMS FROM A PRIOR AUDIT (treat as CLAIMS TO VERIFY — do NOT assume true)` | Seed hypotheses H1..Hn with file:line, to confirm/refute |
| `SEED` | The exact demo data + the planted demo beats |

**Filled generic example:**
```js
const CTX = `
WORKING DIR: <<ABS_DIR>>
Files to read directly: README.md, index.html, styles.css, app.js (~<<N>> lines, the engine), data.js (seed)

PRODUCT GOAL: an interactive clickable prototype to VALIDATE design choices with prospective
customers BEFORE building the real product. A research artifact, not the shippable product.

TARGET: <<SEGMENT>>. PRIMARY USER: <<PERSONA_ONE_LINER>> (<<SECONDARY_PERSONA>> is light/secondary).

NORTH STAR (explicit product-owner decision): match what <<INCUMBENT_A>> and <<INCUMBENT_B>> offer —
feature set, terminology, UX patterns. This TRUMPS persona.

SCOPE: <<WHAT'S IN>>. Deliberately OUT of scope: <<CUT_1>>, <<CUT_2>>, <<COLD_START?>>.

ARCHITECTURE: <<MODEL IN ONE PARAGRAPH>>. INVARIANT: <<SUM(A) === SUM(B)>> — must hold on every path.

EXISTING PRODUCT / STATUS QUO (from reading <<REPO>>, if any): <<current data model + what the target module
does today + house conventions/stack + salvage-vs-replace verdict, with file:line>>. Omit when greenfield.

THE <<N>> DESIGN BETS UNDER TEST:
1. <<BET_1>>
2. <<BET_2>>
...

MARKET RESEARCH (verified <<DATE>> across <<SOURCES>>): <<CONVENTIONS>>. Note: <<PATTERN_X>> was a
research coverage gap (not independently verified) — do not treat as fact.

CLAIMS FROM A PRIOR AUDIT (treat as CLAIMS TO VERIFY against the code — do NOT assume true):
- H1: <<CLAIM>> (<<file:line>>)
- H2: <<CLAIM>> (<<file:line>>)

SEED (data.js): <<CHURCH/ORG, entities, opening figures that sum to the invariant>>. Planted beats:
<<a duplicate to MATCH>>, <<a batch to SPLIT>>, <<an ambiguous item with no suggestion>>.
`
```

### 2. DISCLOSED / BY-DESIGN list

Two things live in CTX that stop agents from wasting the run:
1. **BY-DESIGN / DISCLOSED** — intentional simulations and scope cuts agents must **not** re-flag as bugs (e.g. *"Connect / Sync are simulated no-ops," "budgets are out of scope," "the `dedupeKey` field is decorative — the live matcher is `findFeedMatch()`"*). In-script phrasing: *"DISTINGUISH genuinely broken / inconsistent from intentionally simplified by design. Always say which."*
2. **CLAIMS TO VERIFY (H1..Hn)** — prior-audit claims fed in but explicitly flagged *"do NOT assume true"*, each to be confirmed/refuted against the real code, plus *"and add anything new."*

### 3. The falsifiable FINDING_SCHEMA

Every finding must be a falsifiable claim + hard evidence + bounded severity, and there must always be a **non-defect channel** so the audit stays balanced.

```js
const FINDINGS_SCHEMA = {
  type: 'object', additionalProperties: false, required: ['findings'],
  properties: { findings: { type: 'array', items: {
    type: 'object', additionalProperties: false,
    required: ['id','title','type','severity','claim','evidence','why_it_matters','recommendation'],
    properties: {
      id:       { type: 'string', description: 'stable id, prefix per dimension e.g. "impl-1"' },
      title:    { type: 'string' },
      type:     { type: 'string', enum: ['gap','inconsistency','bug','convention-divergence',
                                         'validity-risk','thesis-risk','works-well'] },
      severity: { type: 'string', enum: ['critical','serious','minor','cosmetic'] },
      claim:    { type: 'string', description: 'the specific assertion, FALSIFIABLE' },
      evidence: { type: 'string', description: 'file:line, a quoted line, a computed number, or a named research convention' },
      why_it_matters: { type: 'string' },
      recommendation: { type: 'string' },
    },
  } } },
}
```
Notes: (a) the `works-well` enum member is the non-defect channel — persona-walkthrough and verify scripts require agents to also report what genuinely works. (b) For live usability findings use the NN/g severity scale `4=critical/wrong-financial-outcome · 3=serious · 2=minor/self-recoverable · 1=cosmetic`. (c) The synthesis schema carries a top-level `what_is_solid: string[]` so the lead credits solid bets, not just risks.

**Verifier verdict schema** (paired with the above): `verdict ∈ [confirmed, needs-nuance, refuted]`, plus `corrected_claim`, `evidence` (*what you actually checked*), `confidence`, `note`. Survivors = `verdict !== 'refuted'`.

### 4. The effort dial (track stakes, not budget)

| Role | effort |
|---|---|
| Generators / auditors / designers / reuse-map cartographer | `'high'` |
| The single consolidating lead synthesizer / final build-spec | `'xhigh'` |
| Cheap refute-verifiers, judge-per-criterion, calibrate lenses | default (omit `effort`) |

*"Right-size: a 4-agent fan-out fits an 80-line task; a 42-agent research+audit fits a whole prototype. Don't manufacture parallelism that adds no signal."*

### 5. parallel vs pipeline

- **`parallel(thunks)`** — a barrier: launches all thunks, waits for all. Use for independent fan-out where you need every result before the next phase (N auditors; K design takes; judge-per-criterion; read-only reality probes). Nest a `parallel` inside a `parallel` for a candidate×criterion matrix.
- **`pipeline(items, stageA, stageB, ...)`** — **no barrier between stages**: each item flows stage→stage on its own, so verification of dimension-1's findings starts while dimension-2 is still generating. Use for the core **find→verify** skeleton so it streams. Signature: `stage(item, originalItem, index)`.

The recurring skeleton (≈half of all runs):
```js
const perDim = await pipeline(
  DIMENSIONS,
  (d) => agent(genPrompt(d, CTX), { label:`find:${d.key}`, phase:'Audit', schema: FINDINGS_SCHEMA, effort:'high' }),
  (review, d) => parallel(((review&&review.findings)||[]).map((f) => () =>
    agent(verifyPrompt(f, CTX), { label:`verify:${d.key}:${f.id}`, phase:'Verify', schema: VERDICT_SCHEMA, effort:'high' })
      .then(v => ({ dimension:d.key, finding:f, verdict:v })))),
)
const survived = perDim.flat().filter(x => x.verdict && x.verdict.verdict !== 'refuted')
const synthesis = await agent(synthPrompt(survived, CTX),
  { label:'synthesize', phase:'Synthesize', schema: SYNTH_SCHEMA, effort:'xhigh' })
```

### 6. Adversarial-verify voting

Two shapes, pick by stakes:
- **One verifier per finding** (cheapest, the default in the core skeleton): the verifier is told *"Default to skepticism; if you cannot substantiate it from the code/docs, mark it refuted or needs-nuance. Do not rubber-stamp."* A finding is **kept unless refuted**.
- **Multi-vote (3 lenses / 3 votes)** for high-stakes claims: keep the finding if it survives the majority. A claim is **killed only on a 2-of-3 refute** (e.g. deep-research needs 2/3 refutes to drop a claim); a **3-0 or 2-1 keep** survives. Do **not** silently collapse a split — **report it** (carry `agree_count`, the per-lens vote tally, and the strongest counterargument) so a 2-1 reads differently from a 3-0.

**MEDIAN is reserved for the calibrate pattern only** — severity de-inflation of an *existing* finding list (3 lenses: persona-realism / argue-it-down / adversarial-skeptic → roll to the median severity). Never use median in the design judge.

### 7. Judge panels — two allowed shapes (never median)

- **Single lead judge:** all candidates in one prompt; returns one `0-100 score` each, a single `recommendedKey`, `bestGrafts` (steal-worthy ideas from the losers), and `commonPitfalls`. Best for a quick taste-driven pick.
- **Candidate×criterion matrix, rolled up by MEAN:** `parallel(candidates → parallel(criteria → judge))`, each judge scores one candidate on one criterion (1-5) + `best_element` + `weakness`; average per candidate; then an `xhigh` lead consolidates the best grafts into one buildable spec, **biased toward the option that best kills the named #1 objection.** Best when a make-or-break objection must drive the choice.

### 8. Single-writer rule

Edits to one big shared file are **single-writer** — do them in-context, in one coherent read-before-write pass; parallel agents racing on the same file corrupt it. **Fan out only for read-only work** (review / audit / research / reality-probe) where independence removes anchoring bias. Never `parallel(... edits ...)`.

### 9. Script skeleton (every script starts this way)
```js
export const meta = {
  name: '<<kebab-name>>',
  description: '<<one line>>',
  phases: [
    { title: 'Audit',      detail: 'N distinct-lens agents emit falsifiable findings' },
    { title: 'Verify',     detail: 'adversarially refute each finding against the source' },
    { title: 'Synthesize', detail: 'dedupe + rank survivors into themes; credit what is solid' },
  ],
}
const CTX = `...`            // §1 — interpolated into EVERY agent
const DIMENSIONS = [ ... ]   // orthogonal charters so coverage is real, not N copies of one view
// schemas (§3) ... then phase('Audit'); pipeline(...); phase('Synthesize'); return {...}
```
Give parallel agents **deliberately distinct mandates/lenses/stances** so outputs diverge instead of collapsing to one answer, then let one higher-effort lead converge them into a single go/no-go. Terminate any generation with an adversarial verify pass, and reproduce every CRITICAL finding yourself against the real engine before stating it as fact.
