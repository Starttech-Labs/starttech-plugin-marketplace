export const meta = {
  name: 'map-status-quo',
  description: 'Read-only cartography of the EXISTING product in the current repo: one agent per subsystem maps the real data model, the target module\'s actual behavior, house conventions/stack, hard constraints, and an honest salvage-vs-replace verdict — fused into a status-quo brief to drop into the CTX block before designing. Makes zero edits.',
  phases: [
    { title: 'Probe', detail: 'one read-only agent per subsystem maps the real code (facts + file:line, no edits)' },
    { title: 'Brief', detail: 'a lead fuses the probes into one status-quo brief for the CTX EXISTING PRODUCT section' },
  ],
}

// ===========================================================================
// Use this when the session runs INSIDE an existing product's main repo (the
// usual case). It is HOW the CTX "EXISTING PRODUCT / STATUS QUO" section gets
// written — by READING the code, not describing it from memory. Skip this whole
// script only when the concept is greenfield or the current module is bad enough
// to replace wholesale (then design the model fresh).
// ===========================================================================
const CTX = `
REPO: <<ABS_REPO_DIR>>  (you are running inside the product's main repo)
CONCEPT WE ARE ABOUT TO DESIGN: <<the new module / redesign, one line>>.
TARGET MODULE IN THE EXISTING PRODUCT: <<the area being replaced/extended, e.g. "the current accounting module">>.
PERSONA the new thing is for: <<who>>.
Goal of THIS run: establish the STATUS QUO from the real code so the design is grounded in what
actually exists (data model, conventions, constraints, what's salvageable) — not a guess.
`

// One area per subsystem the concept touches. Distinct, non-overlapping charters
// so probes don't duplicate. Add/trim to fit the repo.
const AREAS = [
  {
    key: 'data-model',
    focus: 'the persistent data model + entities the concept touches',
    instructions: 'Find the schemas / models / tables / types for <<the relevant domain>>. Report each entity, its key fields, relationships, and where it is defined. Call out anything the new design MUST stay compatible with.',
  },
  {
    key: 'target-module',
    focus: 'the EXISTING module we intend to replace or extend',
    instructions: 'Trace what <<TARGET MODULE>> actually does today: entry points, the REAL behavior (not the docs\' claims), and its concrete gaps/pain. Then judge honestly what is SALVAGEABLE vs. bad enough to REPLACE — with evidence, not vibes.',
  },
  {
    key: 'conventions',
    focus: 'house stack, patterns, and conventions a new module must fit',
    instructions: 'Report the framework/stack, state management, the styling / design-token source, the testing setup, and the naming/architecture conventions. Give concrete file examples a new module should imitate.',
  },
  {
    key: 'constraints',
    focus: 'integration points + hard constraints + already-enforced invariants',
    instructions: 'Find the APIs, auth, money/number handling, and external services the concept must integrate with, plus any invariant the codebase ALREADY enforces (and where). These bound the design.',
  },
  // ...add areas until the concept's surface is covered.
]

// READ-ONLY probe schema: no observation without file:line evidence.
const PROBE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['area', 'facts', 'salvage_vs_replace'],
  properties: {
    area: { type: 'string' },
    facts: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['observation', 'evidence'],
        properties: {
          observation: { type: 'string', description: 'a concrete fact about the status quo' },
          evidence: { type: 'string', description: 'file:line or a quoted line — no claim without it' },
        },
      },
    },
    conventions_to_follow: { type: 'array', items: { type: 'string' } },
    compatibility_constraints: { type: 'array', items: { type: 'string' }, description: 'things the new design must not break' },
    salvage_vs_replace: { type: 'string', description: 'honest verdict on the existing code in this area: reuse what, rebuild what, and why' },
  },
}

phase('Probe')
// Fan out read-only. NEVER fan out edits — this script only reads and reports.
const probes = (await parallel(AREAS.map((a) => () =>
  agent(
    `You are a READ-ONLY code cartographer for the "${a.key}" area. FOCUS: ${a.focus}.
${a.instructions}

Read the ACTUAL code — do not trust names, comments, or docs. Every observation needs file:line or a quoted line. Make NO edits and propose no changes here; just report the status quo faithfully.

CONTEXT:
${CTX}`,
    { label: `probe:${a.key}`, phase: 'Probe', schema: PROBE_SCHEMA, effort: 'high' }
  )
))).filter(Boolean)
log(`Probed ${probes.length} areas of the existing product`)

phase('Brief')
const BRIEF_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['status_quo_brief', 'salvage_verdict', 'open_questions'],
  properties: {
    // Drop this straight into CTX as its "EXISTING PRODUCT / STATUS QUO" section.
    status_quo_brief: { type: 'string', description: 'CTX-ready EXISTING PRODUCT section: real data model + module behavior + conventions + constraints, with file:line' },
    salvage_verdict: { type: 'string', description: 'reuse vs. rebuild the existing module, with the deciding evidence' },
    hard_constraints: { type: 'array', items: { type: 'string' } },
    open_questions: { type: 'array', items: { type: 'string' }, description: 'gaps the probes could not resolve from code alone — ask the founder or verify empirically' },
  },
}
const brief = await agent(
  `Fuse these ${probes.length} read-only probes into ONE tight STATUS-QUO BRIEF, written to drop straight into a CTX block as its "EXISTING PRODUCT / STATUS QUO" section. Include: the real data model the concept touches; what the target module actually does today and its honest salvage-vs-replace verdict; the house conventions/stack a new module must follow; and the hard compatibility constraints + any already-enforced invariant. Stay factual and keep the file:line evidence. Flag any contradiction between probes as an open question.

PROBES:
${JSON.stringify(probes)}

CONTEXT:
${CTX}`,
  { label: 'status-quo-brief', phase: 'Brief', schema: BRIEF_SCHEMA, effort: 'xhigh' }
)

return brief
