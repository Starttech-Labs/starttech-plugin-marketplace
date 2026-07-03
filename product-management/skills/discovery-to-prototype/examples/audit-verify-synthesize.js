export const meta = {
  name: 'audit-verify-synthesize',
  description: 'Workhorse audit: fan out N distinct-lens auditors over an artifact, adversarially verify EVERY finding (default-refute), then an xhigh lead dedups/clusters/ranks into a go/no-go.',
  phases: [
    { title: 'Map', detail: 'one cartographer builds a shared navigation map so auditors move fast (optional; skip for tiny artifacts)' },
    { title: 'Audit', detail: 'one auditor per distinct LENS fills a falsifiable finding schema (incl. a works-well field)' },
    { title: 'Verify', detail: 'per-finding skeptic re-reads the source and confirms / needs-nuance / refutes — default to refute' },
    { title: 'Synthesize', detail: 'xhigh lead clusters surviving findings across lenses, ranks by impact, gives go/no-go' },
  ],
}

// ---------------------------------------------------------------------------
// 1) FAT CONTEXT — interpolated verbatim into EVERY agent. Put the goal, the
//    user/persona, the north-star decision, the architecture/invariants, and
//    the prior CLAIMS-TO-VERIFY here (label them as claims, never as truth).
// ---------------------------------------------------------------------------
const CTX = `
WORKING DIR / ARTIFACT: <<ARTIFACT>>  (e.g. /path/to/app — files to read directly: <<FILES>>)

GOAL: <<what this artifact is for, and what success looks like>>.
PRIMARY USER / PERSONA: <<who>>.
NORTH STAR (explicit owner decision that TRUMPS everything else): <<the one rule>>.

ARCHITECTURE / MODEL: <<how it is built; the KEY INVARIANT(s) every code path must preserve>>.

PRIOR CLAIMS TO VERIFY (treat as CLAIMS about the artifact — do NOT assume true; each auditor/verifier must check against the real source):
- <<claim 1, with a rough file:line pointer>>
- <<claim 2>>
`

// DISCLOSED / BY-DESIGN — deliberately-cut scope. Every agent is told NOT to
// flag these as gaps. This is what keeps the fan-out from re-raising known cuts.
const DISCLOSED = `
OUT OF SCOPE / BY DESIGN (do NOT flag these as defects or gaps — the owner deferred them on purpose):
- <<intentional cut 1>>
- <<intentional cut 2>>
`

// ---------------------------------------------------------------------------
// 2) LENSES — one auditor per DISTINCT angle. Distinctness is the point: no two
//    lenses should share a job, or you get duplicate findings the lead must merge.
//    key -> id prefix; focus -> the angle; instructions -> exactly what to read & check.
// ---------------------------------------------------------------------------
const LENSES = [
  {
    key: 'design-market',
    focus: 'The artifact vs how the category usually works and what users expect (research-grounded).',
    instructions: `Read <<the surface/spec files>>. Judge the design choices against the known conventions in your context. Where does it FAITHFULLY match, and — more importantly — where does it DIVERGE in a way that violates the north star or confuses the persona? Flag both gaps (missing convention) and inconsistencies (does one thing, claims another).`,
  },
  {
    key: 'implementation',
    focus: 'Code vs claims: does the build actually do what the docs/spec/seed claim? Bugs, contradictions.',
    instructions: `Read the engine and its inputs closely, plus the docs, to know what is CLAIMED. Find where the IMPLEMENTATION contradicts the CLAIMS, is internally inconsistent, or is simply buggy. Verify each PRIOR CLAIM by reading the actual code and cite file:line. Report concrete defects with file:line, the claim they contradict, and severity.`,
  },
  {
    key: 'domain',
    focus: 'Correctness from first principles: model coherence, numeric/semantic correctness, invariant preservation.',
    instructions: `Read the model + the compute/report paths. From domain first principles, scrutinize whether the KEY INVARIANT is genuinely maintained by EVERY code path, whether the numbers are right, and whether the model can even express what an expert user needs. Cite specifics; flag real errors and conceptual gaps alike.`,
  },
  {
    key: 'protocol-scope',
    focus: 'Does the surrounding plan (test protocol / spec) actually validate the thesis, and what consequential ABSENCE threatens the goal?',
    instructions: `Cross-check the plan against what the build ACTUALLY does. Do the tasks/claims genuinely exercise the thesis? Then step back: what is the most consequential ABSENCE, and is each a legitimate cut (see OUT OF SCOPE) or a real threat to the goal/thesis? Prioritize.`,
  },
  // ...add lenses until the artifact's risk surface is covered. 4-6 is typical.
]

// ---------------------------------------------------------------------------
// 3) SCHEMAS — falsifiable finding (claim + concrete evidence + bounded
//    severity + a non-defect works_well field), and a refute-biased verdict.
// ---------------------------------------------------------------------------
const FINDING_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings', 'works_well'],
  properties: {
    // non-defect field: force the auditor to give credit, not just hunt for blood.
    works_well: {
      type: 'array', items: { type: 'string' },
      description: 'things this lens found FAITHFUL / correct / well-built — give credit, keeps the audit honest',
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'title', 'type', 'severity', 'claim', 'evidence', 'why_it_matters', 'recommendation'],
        properties: {
          id: { type: 'string', description: 'short stable id, e.g. <lenskey>-1' },
          title: { type: 'string' },
          type: { type: 'string', enum: ['gap', 'inconsistency', 'bug', 'convention-divergence', 'validity-risk', 'thesis-risk'] },
          severity: { type: 'string', enum: ['critical', 'serious', 'minor', 'cosmetic'] },
          claim: { type: 'string', description: 'the specific assertion, FALSIFIABLE' },
          evidence: { type: 'string', description: 'file:line, a quoted line, a computed number, or a named convention' },
          why_it_matters: { type: 'string' },
          recommendation: { type: 'string' },
        },
      },
    },
  },
}

const VERDICT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdict', 'corrected_claim', 'evidence', 'confidence', 'note'],
  properties: {
    verdict: { type: 'string', enum: ['confirmed', 'needs-nuance', 'refuted'] },
    corrected_claim: { type: 'string', description: 'the claim restated accurately after checking; same as original if confirmed' },
    evidence: { type: 'string', description: 'what you ACTUALLY checked — file:line read, value computed, doc quote' },
    confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
    note: { type: 'string', description: 'nuance, overstatement corrected, or severity adjustment' },
  },
}

// ===========================================================================
// PHASE 1 — MAP (optional). One cartographer at 'high' so every auditor shares
// the same navigation vocabulary (screen labels, function names, entry points).
// To skip on a tiny artifact: set `const map = ''` (keep the line) and delete the
// phase('Map') call — the audit prompt omits the map block automatically when empty.
// ===========================================================================
phase('Map')
const map = await agent(
  `You are mapping <<ARTIFACT>> so other auditors can navigate it fast. Read enough of ${'<<FILES>>'} to produce a concise map: the surfaces/screens and their labels, where the main flows live (with function names), and the core data model + key engine functions. Return prose, ~400-600 words.

CONTEXT:
${CTX}`,
  { label: 'map', phase: 'Map', effort: 'high' }
)
// Guarded so dropping the Map phase (map = '') can't break the audit prompt.
const mapBlock = map ? `Here is a map of the artifact for orientation:\n${map}` : ''

// ===========================================================================
// PHASE 2+3 — AUDIT then VERIFY, fused with pipeline (NO barrier between stages).
// Each lens's findings flow straight into per-finding verification the moment
// that lens lands — a slow lens never blocks a fast lens's verification.
//   generators: effort 'high'   |   refute-verifiers: default effort (cheap)
// ===========================================================================
phase('Audit')
const perLens = await pipeline(
  LENSES,

  // stage A: one auditor per lens
  (lens) => agent(
    `You are a fresh-eyes auditor for the "${lens.key}" lens of <<ARTIFACT>>.

LENS FOCUS: ${lens.focus}
YOUR INSTRUCTIONS: ${lens.instructions}

${mapBlock}

Actually READ the real files — do not rely solely on the context summary; the point is fresh eyes on the real artifact. Return 4-9 of the most consequential, SPECIFIC findings (not generic advice). Each must be falsifiable and carry concrete evidence (file:line, a quoted line, a computed number, or a named convention). Prefer big gaps / real inconsistencies over nitpicks. Also fill works_well — give credit where the artifact is faithful. Use id prefix "${lens.key}-".

CONTEXT:
${CTX}
${DISCLOSED}`,
    { label: `find:${lens.key}`, phase: 'Audit', schema: FINDING_SCHEMA, effort: 'high' }
  ),

  // stage B: adversarial verifier per finding — parallel, fired as soon as the
  // lens lands (no barrier). Default-refute: substantiate from source or drop it.
  (review, lens) => parallel(((review && review.findings) || []).map((f) => () =>
    agent(
      `You are an ADVERSARIAL verifier. An auditor made this finding about <<ARTIFACT>>. CHECK it against the actual source and confirm, correct, or refute it. Default to skepticism: if you cannot substantiate it from the code/docs/data, mark it refuted or needs-nuance. Do NOT rubber-stamp. If the claim is true but overstated (severity inflated, "always" when it's "sometimes"), mark needs-nuance and correct it.

FINDING (${lens.key}):
- title: ${f.title}
- type: ${f.type}
- severity: ${f.severity}
- claim: ${f.claim}
- cited evidence: ${f.evidence}
- why it matters: ${f.why_it_matters}

Verify by READING the relevant file:line yourself and/or reasoning from the conventions in your context. Cite exactly what you checked. If it names deliberately out-of-scope territory, treat it as a non-issue.

CONTEXT:
${CTX}
${DISCLOSED}`,
      { label: `verify:${lens.key}:${f.id}`, phase: 'Verify', schema: VERDICT_SCHEMA } // default effort — cheap
    ).then((v) => ({ lens: lens.key, finding: f, verdict: v }))
  ))
)

// flatten: lenses-with-findings became arrays of {lens,finding,verdict}
const verified = perLens.flat().filter(Boolean)
const survived = verified.filter((x) => x.verdict && x.verdict.verdict !== 'refuted')
const refuted = verified.filter((x) => !x.verdict || x.verdict.verdict === 'refuted')
log(`Audit: ${verified.length} findings, ${survived.length} survived, ${refuted.length} refuted/dropped`)

// ===========================================================================
// PHASE 4 — SYNTHESIZE. ONE lead at 'xhigh' (the only xhigh in the run): cluster
// overlapping findings across lenses, rank by impact on the goal, credit what is
// solid, and return a clear go/no-go. Feed it only SURVIVING findings, already
// restated by the verifier (corrected_claim), never the raw pre-verify claims.
// ===========================================================================
phase('Synthesize')
const SYNTH_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['overall_assessment', 'what_is_solid', 'themes', 'biggest_risks', 'go_no_go'],
  properties: {
    overall_assessment: { type: 'string' },
    what_is_solid: { type: 'array', items: { type: 'string' }, description: 'faithful / well-built choices — give credit for balance' },
    themes: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['theme', 'severity', 'summary', 'evidence', 'recommendation'],
        properties: {
          theme: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'serious', 'minor', 'cosmetic'] },
          summary: { type: 'string' },
          evidence: { type: 'string' },
          recommendation: { type: 'string' },
        },
      },
    },
    biggest_risks: { type: 'array', items: { type: 'string' } },
    go_no_go: { type: 'string', enum: ['go', 'go-with-minor-cleanups', 'no-go'] },
  },
}

// hand the lead the VERIFIER's corrected claim + evidence, not the raw finding
const survivedForSynth = survived.map((x) => ({
  lens: x.lens,
  title: x.finding.title,
  type: x.finding.type,
  severity: x.finding.severity,
  verdict: x.verdict.verdict,
  claim: x.verdict.corrected_claim,
  evidence: x.verdict.evidence,
  why: x.finding.why_it_matters,
  recommendation: x.finding.recommendation,
  confidence: x.verdict.confidence,
}))

// (each lens result also carried a works_well array — collect those too if you
//  want the lead to weigh credit alongside the surviving findings.)

const synthesis = await agent(
  `You are the LEAD reviewer. Below are VERIFIED findings (each already adversarially checked; refuted ones removed) from a multi-lens audit of <<ARTIFACT>>. Cluster overlapping findings ACROSS lenses into coherent THEMES (the same issue often surfaces in 2-3 lenses — merge it). Rank by real impact on the GOAL and the NORTH STAR. Be honest about severity — do NOT inflate. Explicitly credit what is SOLID so the assessment is balanced. Drop pure nitpicks. End with a clear go / go-with-minor-cleanups / no-go.

VERIFIED FINDINGS (JSON):
${JSON.stringify(survivedForSynth, null, 1)}

CONTEXT:
${CTX}
${DISCLOSED}`,
  { label: 'synthesize', phase: 'Synthesize', schema: SYNTH_SCHEMA, effort: 'xhigh' }
)

return { synthesis, survived: survivedForSynth, refutedCount: refuted.length }