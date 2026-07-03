export const meta = {
  name: 'design-judge-panel',
  description: 'Diverge K candidate designs from distinct stances, judge them, and consolidate the best grafts into one buildable spec biased to kill the #1 objection',
  phases: [
    { title: 'Map & Design', detail: 'optional reuse-map of an existing build + K divergent design candidates' },
    { title: 'Judge & Consolidate', detail: 'score candidates, then merge best grafts into one spec' },
  ],
}

// ── CONTEXT ──────────────────────────────────────────────────────────────
// Fat, verbatim brief interpolated into EVERY agent. State the segment, the
// primary user, the north-star, WHAT is being designed, and — critically —
// the single make-or-break OBJECTION the design must defuse. Also list what
// to REUSE if building on top of an existing codebase (feeds the cartographer).
const CTX = `<<CTX: project + segment + primary user + north-star + the artifact being
designed + THE #1 MAKE-OR-BREAK OBJECTION to design around + what to reuse from any
existing build (paths/line ranges) >>`

// The K distinct designer stances. They MUST genuinely conflict — that's what
// makes candidates diverge instead of converging to the same safe middle.
const STANCES = [
  { key: 'stance-a', brief: '<<STANCE A brief — an opinionated, one-note philosophy to design fully through>>' },
  { key: 'stance-b', brief: '<<STANCE B brief — a DIFFERENT axis of optimization that trades against A>>' },
  { key: 'stance-c', brief: '<<STANCE C brief — a third, orthogonal philosophy>>' },
]

phase('Map & Design')

// OPTIONAL — include only when designing ON TOP of an existing build. Delete
// this agent (and drop reuseMap from the destructure below) for greenfield.
const MAP_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['copy_verbatim', 'reuse_pattern', 'cut', 'styles_notes', 'summary'],
  properties: {
    copy_verbatim: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'line_range', 'purpose'], properties: { name: { type: 'string' }, line_range: { type: 'string' }, purpose: { type: 'string' } } } },
    reuse_pattern: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'line_range', 'how_it_works'], properties: { name: { type: 'string' }, line_range: { type: 'string' }, how_it_works: { type: 'string' } } } },
    cut: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'reason'], properties: { name: { type: 'string' }, reason: { type: 'string' } } } },
    styles_notes: { type: 'string', description: 'which existing style classes to reuse and which NEW ones the new screens need' },
    summary: { type: 'string' },
  },
}

// HONESTY-FORCING design schema: every candidate MUST show a populated preview,
// a DEGRADED/edge-state preview (so weak states cannot hide), explicit risks,
// and edge-case handling. Add domain-specific fields as needed.
const DESIGN_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['stance', 'preview', 'degradedPreview', 'screens', 'coreInteraction', 'objectionKill', 'edgeCases', 'risks'],
  properties: {
    stance: { type: 'string', description: 'One-sentence philosophy of THIS candidate' },
    preview: { type: 'string', description: 'A realistic, POPULATED mock of what the user literally sees (ASCII/emoji/described layout — no raw escape codes). Show the common, happy state.' },
    degradedPreview: { type: 'string', description: 'A SECOND preview in a DIFFERENT / degraded state (empty data, absent fields, error/overflow, first-run) to prove graceful degradation.' },
    screens: { type: 'string', description: 'Each screen: what it IS, key elements, and its states.' },
    coreInteraction: { type: 'string', description: 'The core loop step-by-step — concrete interactions and microcopy, not principles.' },
    objectionKill: { type: 'string', description: 'The specific design moves that defuse the #1 objection named in CTX.' },
    edgeCases: { type: 'string', description: 'How absent data, overflow, failure, and the awkward cases are handled.' },
    risks: { type: 'string', description: 'Honest downsides / who would dislike this candidate and why.' },
  },
}

// Cartographer (effort 'high') + K designers (effort 'high') share ONE barrier.
// Designers must DESIGN ONLY — no writing/editing/running anything.
const [reuseMap, ...candidateResults] = await parallel([
  () => agent(
    `You are a codebase cartographer. Read the EXISTING build described in CTX and produce a precise REUSE MAP: (a) infrastructure to COPY VERBATIM (with exact line ranges + one-line purpose), (b) PATTERNS to follow (with line ranges), (c) what to CUT or fundamentally REPLACE for the new direction. Be exact with line numbers — the builder relies on this to avoid re-reading everything.\n\nCONTEXT:\n${CTX}`,
    { label: 'reuse-map', phase: 'Map & Design', schema: MAP_SCHEMA, effort: 'high' }
  ),
  ...STANCES.map((s) => () => agent(
    `You are a product designer. Design a COMPLETE interaction design for <<ARTIFACT>> THROUGH THIS STANCE — commit to it fully, do not hedge toward the other stances:\n\nSTANCE — ${s.brief}\n\nProduce a concrete, buildable design covering every field in the schema: specific screens, states, exact interactions, and microcopy — not principles. It MUST decisively defuse the #1 objection named in CONTEXT. Reuse the proven design system / engine noted in CONTEXT. Return via the structured output tool. Do NOT write, edit, or run anything — design only.\n\nCONTEXT:\n${CTX}`,
    { label: `design:${s.key}`, phase: 'Map & Design', schema: DESIGN_SCHEMA, effort: 'high' }
  )),
])

// Map BEFORE filtering so a failed (null) designer can't shift the stance keys
// of the survivors — index must stay aligned with STANCES.
const candidates = candidateResults.map((d, i) => d && { ...d, key: STANCES[i].key }).filter(Boolean)
log(`Map done; ${candidates.length} design candidates generated`)

phase('Judge & Consolidate')

// ══════════════════════════════════════════════════════════════════════════
// VARIANT A — SINGLE LEAD JUDGE (cheap; one pass over lightweight candidates).
// One agent ranks all candidates, picks ONE default, and names the best grafts.
// Use this when the winner is likely obvious and you just need rank+grafts.
// (Source: statusline-redesign-candidates.)
// ──────────────────────────────────────────────────────────────────────────
/*
const JUDGE_SCHEMA_A = {
  type: 'object', additionalProperties: false,
  required: ['ranking', 'recommendedKey', 'recommendationRationale', 'bestGrafts', 'commonPitfalls'],
  properties: {
    ranking: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['key', 'score', 'verdict'],
      properties: {
        key: { type: 'string' },
        score: { type: 'integer', description: '0-100 overall' },
        verdict: { type: 'string', description: 'One line: strengths + the single biggest weakness' },
      } } },
    recommendedKey: { type: 'string', description: 'The single best candidate to default to' },
    recommendationRationale: { type: 'string' },
    bestGrafts: { type: 'array', items: { type: 'string' }, description: 'Specific ideas from OTHER candidates worth grafting onto the winner' },
    commonPitfalls: { type: 'string', description: 'Robustness gaps to avoid across all candidates when implementing' },
  },
}
const judgeInput = candidates.map((d) =>
  `### Candidate "${d.key}" — ${d.stance}\nPREVIEW:\n${d.preview}\nDEGRADED:\n${d.degradedPreview}\nCORE: ${d.coreInteraction}\nOBJECTION-KILL: ${d.objectionKill}\nEDGE CASES: ${d.edgeCases}\nRISKS: ${d.risks}\n`
).join('\n')
const judgment = await agent(
  `You are judging ${candidates.length} candidate designs. Judge on <<CRITERIA one-liners>>. Be a tough, specific critic.\n\nCANDIDATES:\n${judgeInput}\n\nRank them, pick ONE to recommend as the default, call out the best ideas from the others worth grafting on, and list concrete implementation pitfalls.\n\nCONTEXT:\n${CTX}`,
  { label: 'judge', phase: 'Judge & Consolidate', schema: JUDGE_SCHEMA_A }
)
// ...then feed `judgment` into the consolidate lead below instead of `scored`.
*/

// ══════════════════════════════════════════════════════════════════════════
// VARIANT B — CANDIDATE × CRITERION MATRIX, rolled up by MEAN (active below).
// Each (candidate, criterion) pair gets its OWN judge agent (effort 'high').
// Use when you need a defensible per-criterion score and no clear favorite.
// (Source: zero-books-design-spec.)
//
// ⚠️ ROLL-UP IS **MEAN**, NEVER MEDIAN. MEDIAN belongs ONLY to
//    calibrate-usability-findings (reconciling independent severity votes),
//    NOT to this design judge. Do not swap it in here.
// ══════════════════════════════════════════════════════════════════════════
const CRITERIA = [
  { key: 'fidelity',  q: '<<CRITERION 1 — does it faithfully realize the intended direction, or secretly regress to the thing being replaced?>>' },
  { key: 'objection', q: '<<CRITERION 2 — does it decisively KILL the #1 objection named in CTX?>>' },
  { key: 'segment',   q: '<<CRITERION 3 — segment fit: usable/reassuring for the primary user vs the north-star?>>' },
  { key: 'buildable', q: '<<CRITERION 4 — buildability within the stated constraints in one focused build?>>' },
]

const JUDGE_SCHEMA_B = {
  type: 'object', additionalProperties: false,
  required: ['criterion', 'score', 'reasoning', 'best_element', 'weakness'],
  properties: {
    criterion: { type: 'string' },
    score: { type: 'number', description: '1-5' },
    reasoning: { type: 'string' },
    best_element: { type: 'string', description: 'the single best, steal-worthy idea in this candidate on this criterion' },
    weakness: { type: 'string' },
  },
}

const judged = await parallel(candidates.map((t) => () =>
  parallel(CRITERIA.map((c) => () =>
    agent(
      `Judge this design candidate on ONE criterion only.\n\nCRITERION — ${c.q}\n\nDESIGN CANDIDATE (stance: ${t.stance}):\n${JSON.stringify(t, null, 1)}\n\nScore 1-5 on THIS criterion, name the single best steal-worthy element, and give the sharpest weakness.\n\nCONTEXT:\n${CTX}`,
      { label: `judge:${t.key}:${c.key}`, phase: 'Judge & Consolidate', schema: JUDGE_SCHEMA_B, effort: 'high' }
    ).then((v) => ({ criterion: c.key, verdict: v }))
  )).then((vs) => ({ key: t.key, take: t, scores: vs.filter(Boolean) }))
))

const scored = judged.filter(Boolean).map((j) => ({
  key: j.key,
  take: j.take,
  // MEAN across criteria — NOT median (see warning above).
  avg: j.scores.length ? j.scores.reduce((a, b) => a + b.verdict.score, 0) / j.scores.length : 0,
  scores: j.scores.map((s) => ({ criterion: s.criterion, score: s.verdict.score, best: s.verdict.best_element, weakness: s.verdict.weakness })),
}))

// Consolidating lead: single writer, effort 'xhigh'. Merges the grafts the
// judges flagged into ONE committed spec, biased to KILL the #1 objection.
const SPEC_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['product_summary', 'invariant_or_core', 'screens', 'core_interactions', 'seed_or_demo_plan', 'copy_guidelines', 'build_tasks', 'reuse_directives'],
  properties: {
    product_summary: { type: 'string' },
    invariant_or_core: { type: 'string', description: 'the load-bearing rule/formula/loop and precisely how it is presented to the user' },
    screens: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'purpose', 'key_elements', 'states'], properties: { name: { type: 'string' }, purpose: { type: 'string' }, key_elements: { type: 'string' }, states: { type: 'string' } } } },
    core_interactions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['name', 'flow'], properties: { name: { type: 'string' }, flow: { type: 'string' } } } },
    seed_or_demo_plan: { type: 'string', description: 'exactly what to seed so a tester experiences the magic moment, not an empty app' },
    copy_guidelines: { type: 'array', items: { type: 'string' }, description: 'exact microcopy strings for the load-bearing surfaces' },
    build_tasks: { type: 'array', items: { type: 'string' }, description: 'ordered build checklist' },
    reuse_directives: { type: 'string', description: 'what to copy verbatim vs build new, referencing the reuse map' },
  },
}

const spec = await agent(
  `You are the lead designer/architect making the final build spec. Below are ${candidates.length} design candidates (each judged per-criterion) and a reuse map of the existing codebase. SYNTHESIZE ONE coherent, opinionated, buildable spec — steal the best elements the judges flagged from EACH candidate, resolve conflicts, and commit to specific decisions. Concrete enough that an engineer builds directly from it: exact screens with states, the core rule/loop and its on-screen presentation, step-by-step interactions, a precise seed/demo plan that delivers the magic moment, exact microcopy, and an ordered build checklist. BIAS toward whatever best KILLS the #1 objection named in CONTEXT while staying dead-simple for the primary user. Reuse the proven design system + engine.\n\nSCORED CANDIDATES (JSON):\n${JSON.stringify(scored, null, 1)}\n\nREUSE MAP (JSON):\n${JSON.stringify(reuseMap, null, 1)}\n\nCONTEXT:\n${CTX}`,
  { label: 'consolidate-spec', phase: 'Judge & Consolidate', schema: SPEC_SCHEMA, effort: 'xhigh' }
)

return { reuseMap, scored_summary: scored.map((s) => ({ key: s.key, avg: s.avg, scores: s.scores })), spec }
