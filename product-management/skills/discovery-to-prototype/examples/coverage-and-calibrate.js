export const meta = {
  name: 'coverage-and-calibrate',
  description: 'Two read-only checks for a customer-testable prototype: (1) COVERAGE TRACE — prove each numbered bet + test task is really implemented (not stubbed/faked); (2) CALIBRATE — pressure-test an EXISTING finding list for realism + severity. Neither edits anything; CALIBRATE discovers nothing new.',
  phases: [
    { title: 'Coverage', detail: 'one agent per feature area traces every bet + task to the actual code (yes/partial/no + file:line)' },
    { title: 'Calibrate', detail: 'each already-found finding x 3 orthogonal lenses (persona-realism / conservative / adversarial-skeptic), rolled up by MEDIAN severity + realism vote tally (no new findings)' },
  ],
}

// ============================================================================
// SHARED CONTEXT — agents have none of the operator's memory. Interpolate this
// fat block into EVERY prompt. Fill the placeholders; keep the structure.
// ============================================================================
const CTX = `
PRODUCT: <<PRODUCT — one paragraph: who the user is, the core wedge/promise, the
mental model the design leans on. Be concrete; this frames every judgement.>>

ARTIFACT (read with ABSOLUTE paths — do not assume from names, OPEN the code):
<<ARTIFACT_FILES — e.g.
- /abs/path/app.js   (the whole app; where flows + the balance/derivation engine live)
- /abs/path/data.js  (the seed: the single ledger everything is derived from)
- /abs/path/README.md (states the numbered bets + what is deliberately out of scope)>>
`

// The numbered, FALSIFIABLE design bets the prototype is gambling on.
const BETS = `
NUMBERED DESIGN BETS (what the design gambles the user can do):
- B1 <<bet — one falsifiable sentence>>
- B2 <<bet>>
- B3 <<bet>>
// ...add every bet; coverage questions below reference these ids.
`

// The moderated test tasks the prototype must actually support end-to-end.
const TASKS = `
TEST TASKS (each must be completable in the running app):
- T-A <<task — the real-world scenario the user is handed>>
- T-B <<task>>
// ...one per task letter; coverage questions reference these ids.
`

// ============================================================================
// PART 1 — COVERAGE TRACE
// Fan out one read-only agent per FEATURE AREA. Each answers, per capability,
// yes / partial / no with file:line + REAL behavior, then flags what is
// stubbed/faked (scopeNotes) and what contradicts the README (surprises).
// ============================================================================

const COVERAGE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['area', 'findings', 'scopeNotes', 'surprises'],
  properties: {
    area: { type: 'string' },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['capability', 'verdict', 'evidence'],
        properties: {
          capability: { type: 'string', description: 'the exact capability question, tagged with the bet/task ids it covers' },
          verdict: { type: 'string', enum: ['yes', 'partial', 'no'] },
          evidence: { type: 'string', description: 'function names + line numbers + what the code ACTUALLY does (not what the name implies)' },
        },
      },
    },
    scopeNotes: { type: 'string', description: 'anything intentionally out of scope, stubbed, faked, or simulated (a non-defect: this is DISCLOSED by design)' },
    surprises: { type: 'string', description: 'anything that contradicts the README/bet claims or that a test designer must know' },
  },
}

// One entry per feature area. `fns` narrows what to open; `questions` are the
// numbered capability probes, each tagged with the BET/TASK ids it verifies.
const AREAS = [
  {
    label: '<<area-slug>>',
    area: '<<Feature area, human-readable>>',
    fns: '<<function names + approx line numbers to open, comma-separated; name the seed structures too>>',
    questions: `1. <<capability question>> (T-A, B1)
2. <<capability question — e.g. is the disclosed abstraction truly hidden in BOTH entry and display?>> (B1, B3)
3. <<capability question — trace a number end-to-end and confirm the financial outcome>> (T-B, B2)`,
  },
  // ...one AREA per slice of the app; keep each agent's reading load bounded.
]

async function runCoverageTrace() {
  phase('Coverage')
  const results = await parallel(AREAS.map(a => () =>
    agent(
      `${CTX}\n${BETS}\n${TASKS}\n\n` +
      `YOUR AREA: ${a.area}\n\n` +
      `Open these specifically (trace real behavior, do NOT infer from names): ${a.fns}\n\n` +
      `Answer each capability question with a verdict (yes/partial/no) and CODE-CITED evidence (function + line + what it really writes to state / how balances + reports treat it / what the UI renders):\n${a.questions}\n\n` +
      `Return one finding per numbered question, in order. In scopeNotes list anything stubbed/faked/simulated or marked out of scope in the README (disclosed-by-design, not a defect). In surprises note anything that contradicts the README's claimed bets or that a test designer must know. Set "area" to "${a.area}".`,
      { label: a.label, phase: 'Coverage', schema: COVERAGE_SCHEMA, effort: 'high' }
    )
  ))
  return results.filter(Boolean)
}

// ============================================================================
// PART 2 — CALIBRATE FINDINGS  (a PURE JUDGE — it discovers NOTHING new)
// Feed it findings some OTHER run already produced (persona walkthrough, code
// audit, live usability test). Each finding is judged through 3 ORTHOGONAL
// lenses in parallel, then rolled up by MEDIAN severity + a realism vote tally.
// Do NOT ask these agents to find new problems — the input facts are given.
// ============================================================================

// The facts are trusted; the judge weighs realism + severity, not existence.
const CALIBRATE_PERSONA = `${CTX}
You are CALIBRATING findings that were already OBSERVED (live tester + code audit),
so the FACTS are reliable — do NOT dispute whether each happens. Judge only:
(a) would the REAL target user actually hit this, and would it matter to them or to
their books/data? (b) is the proposed severity right, too high, or too low?
Severity: 4 = blocks the task or causes a wrong/undetected outcome; 3 = serious
confusion / silently-wrong result that many will hit; 2 = hesitation / mental-model
mismatch, self-recoverable; 1 = cosmetic. Be concrete and skeptical of overstatement.`

const CALIBRATE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['real_for_user', 'calibrated_severity', 'agree_with_proposed', 'strongest_counterargument', 'one_line_verdict'],
  properties: {
    real_for_user: { type: 'string', enum: ['yes', 'partly', 'no'] },
    calibrated_severity: { type: 'integer', minimum: 1, maximum: 4 },
    agree_with_proposed: { type: 'boolean' },
    strongest_counterargument: { type: 'string' },
    one_line_verdict: { type: 'string' },
  },
}

// The 3 orthogonal lenses. Same schema; different disposition per lens.
const LENSES = [
  { key: 'realism',  instruction: 'LENS: REAL-WORLD USER MENTAL MODEL. Would the real target user actually run into this on a natural path, and does it matter? Judge realism and severity.' },
  { key: 'severity', instruction: 'LENS: SEVERITY CALIBRATION (be conservative — argue it DOWN if it is self-recoverable or cosmetic). Is the proposed severity justified, or inflated?' },
  { key: 'skeptic',  instruction: 'LENS: ADVERSARIAL SKEPTIC. Try HARD to REFUTE that this is a real problem for the target user (it is by-design & acceptable, the copy already mitigates it, the user would not take that path, or it is a test-design artifact not an app defect). Only concede if you cannot refute.' },
]

// Findings to calibrate: pass in via `args`, else the inline example list.
const PRIOR_FINDINGS = (Array.isArray(args) && args.length) ? args : [
  { id: 'F1', sev: 2, text: '<<one already-found finding, stated as an observed fact>>' },
  { id: 'F2', sev: 3, text: '<<another already-found finding>>' },
  // ...
]

async function runCalibrate(findings) {
  phase('Calibrate')
  const results = await pipeline(
    findings,
    // Stage 1: 3 independent lenses in parallel per finding.
    (f) => parallel(LENSES.map(L => () =>
      agent(
        `${CALIBRATE_PERSONA}\n\n${L.instruction}\nFinding #${f.id} (tester-proposed severity ${f.sev}):\n"${f.text}"`,
        { label: `${L.key}:${f.id}`, phase: 'Calibrate', schema: CALIBRATE_SCHEMA }
      )
    )).then(votes => ({ f, votes: votes.filter(Boolean) })),
    // Stage 2: roll up. MEDIAN severity (sort THEN pick middle) + vote tally.
    (judged) => {
      const { f, votes } = judged
      if (!votes.length) return { id: f.id, error: 'no votes' }
      const sevs = votes.map(v => v.calibrated_severity).sort((a, b) => a - b)
      const medianSev = sevs[Math.floor(sevs.length / 2)]
      const realCounts = votes.reduce((m, v) => { m[v.real_for_user] = (m[v.real_for_user] || 0) + 1; return m }, {})
      return {
        id: f.id,
        proposed_sev: f.sev,
        calibrated_sev: medianSev,            // MEDIAN — the only place median belongs here
        realism_votes: realCounts,            // e.g. { yes: 2, partly: 1 }
        agree_count: votes.filter(v => v.agree_with_proposed).length,
        verdicts: votes.map(v => v.one_line_verdict),
        counterarguments: votes.map(v => v.strongest_counterargument),
      }
    }
  )
  return results.filter(Boolean)  // NOTE: same N findings in, same N out — nothing new is discovered.
}

// ============================================================================
// DISPATCH — the two blocks are independent runs. Pick one.
//   • Coverage trace: run against the built prototype, no input needed.
//   • Calibrate: run against an EXISTING finding list (via args), after a
//     separate generator pass produced it.
// Default: if findings were passed in, calibrate them; otherwise trace coverage.
// ============================================================================
if (Array.isArray(args) && args.length) {
  return await runCalibrate(PRIOR_FINDINGS)
}
return await runCoverageTrace()
