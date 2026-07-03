## Prompt Library — discovery-to-prototype

Copy-paste prompts for each phase of the method. Every template is domain-neutral: replace `<<PLACEHOLDERS>>`. The two flavors of prompt are marked:
- **👤 To-Claude (chat):** what the operator types to steer a session. Grounded in Rafa's real prompts (shown in quotes).
- **⚙️ In-script (agent):** prose you interpolate into a Workflow `agent()` call. See `workflow-conventions.md` for the CTX block, schemas, and effort dial these assume.

Golden rule behind all of them: **name the artifact, name the persona, name the incumbents, and demand falsifiable evidence + provenance.** Never ask an agent to "review" without a CTX block and a schema.

---

### Phase 0 — Read the status quo (optional; when running inside an existing product's repo)

**👤 Map the current product from the code** — read-only. You're in the product's main repo, so establish the status quo *from the code*, not from memory:

```
We're in the main repo of <<PRODUCT>>. Before we design <<THE NEW MODULE / REDESIGN>>, map the STATUS QUO
from the actual code — read-only, no edits. Fan out one probe per subsystem the concept touches and report,
with file:line evidence: (a) the real data model + entities we must stay compatible with; (b) what
<<TARGET_MODULE>> actually does today and its honest salvageable-vs-replace verdict; (c) the stack, patterns,
and design-token source a new module must follow; (d) integration points and any invariant the code already
enforces. Fuse it into a status-quo brief I can drop into the CTX block. Map, don't change.
```
Skip this only when the concept is greenfield or the current module is irrelevant — bad enough to replace wholesale, then design the model fresh (as with the church-accounting module the running example replaced). In-script: `examples/map-status-quo.js`.

---

### Phase 1 — Research (ground the domain and the market)

**👤 Kick off adversarial deep-research** *(invoke the pre-built `deep-research` skill with args — do NOT hand-script this for a standalone round; you only script a research fan-out when it must feed an internal code audit, see Phase 4-alt).*

> Grounded in: *"i want you to deeply understand how accounting modules work across other ChMS systems, especially those targeting the same churches we do (100-250 members, US-based), so we can have an intelligent conversation about the design choices we made."*

```
/deep-research i want you to deeply understand how <<DOMAIN>> works across other
<<CATEGORY>> systems, especially those targeting the same <<SEGMENT>> we do
(<<SEGMENT_SPECIFICS>>), so we can have an intelligent conversation about the design
choices we made. Research BOTH dominant patterns: (A) <<PATTERN_A>>; (B) <<PATTERN_B>>.
For each named incumbent (<<INCUMBENTS>>) dig into: <<DIMENSION_1>>, <<DIMENSION_2>>,
<<DIMENSION_3>>, <<DIMENSION_4>> — with concrete detail (data models, exact field names,
the actual UX a <<PERSONA>> sees). Throughout, prioritize the <<PERSONA>> lens: what's
hard, what onboarding/templates exist, what terminology is exposed vs hidden, pricing
for <<SEGMENT>>, and real complaints from reviews/forums. Surface table-stakes vs
differentiators. Goal: validate a PROTOTYPE (not a shipping product) and settle the
tasks we'll give usability-test participants.
```
When it lands, ask the skill (or yourself) to separate **what the research literally verified** from **your inference**, and label each. Prefer PRIMARY vendor/authoritative docs over blog summaries; note any pattern that was a *coverage gap* (not independently verified) so it can't be laundered into a claim later.

**👤 Trigger a scoped round-2** when you spot a gap in your own research (frame it as one precise product question, not "re-research the topic"):

> Grounded in: *"read the research we've done and check the prototype for inconsistencies... for example i'm not sure if we divide the opening balance to funds. see how <<INCUMBENT_A>> and <<INCUMBENT_B>> handle the imported through <<CHANNEL>> transactions and their backfilling implications."*

```
/deep-research We've researched <<DOMAIN>> already. One gap remains, framed as a single
product question: how does <<PERSONA>> accomplish <<SPECIFIC_FIRST_TIME_JOB>> and get an
accurate result? Look specifically at how <<INCUMBENTS>> handle <<MECHANIC>>. I want the
convention we should adopt as our default, plus the one place incumbents structurally
can't compete.
```

---

### Phase 2 — Decisions → numbered falsifiable bets

**👤 Convert design decisions into bets.** After research, restate every design choice as a numbered bet you can later test. Ground each bet in a research convention or a deliberate counter-position.

```
Here are the design decisions we've made for the <<PRODUCT>> prototype:
<<DECISION_1>> ... <<DECISION_N>>.
Turn each into a NUMBERED, FALSIFIABLE design bet: "Bet N — <<PERSONA>> can <<DO_X>>
without <<HARD_THING>>." For each bet state (a) the specific user behavior it gambles
on, (b) which research convention supports it or which incumbent it counter-positions
against, and (c) the one observable task that would falsify it. Every feature in the
prototype must exist to answer exactly one bet. Flag any decision that maps to NO
testable bet — that's scope we should cut or a risk we're not measuring.
```

**👤 Adversarially trace a contested decision through the real formula** — hand Claude your own theory and ask it to break it with a numeric counterexample (this is how Rafa pressure-tests his own reasoning):

> Grounded in: *"if a customer wanted to bring over every transaction for the current year, it might actually work gracefully: 1... 2... 3... can you find any gaps in my theory?"* and *"...but i need you to sense check this."*

```
Here's my theory for how <<MECHANIC>> should work: <<STEP_1>>, <<STEP_2>>, <<STEP_3>>.
Trace it through the ACTUAL formula in the code (<<FUNCTION>> at <<file:line>>), with
real numbers from the seed. Can you find any gaps? If it double-counts, mis-states, or
breaks the invariant, show me the exact worked counterexample ($X vs $Y). Then tell me
what the standard convention does instead and whether adopting it collapses this whole
class of edge case. Sense-check me — don't just agree.
```

**👤 Ground everything back in research** (a recurring one-liner Rafa uses to stop over-reach):

> *"is your conclusion based on our research?"* · *"did you take our previous research into account for everything we have done in this session?"*

---

### Phase 2b — Counter-position (mid-conversation follow-up, then a build commit)

The counter-position is **not a fresh request** — Rafa appends it to the tail of a fresh-eyes audit, then commits to building the winner in a *later* turn. Reproduce both steps.

**👤 Step 1 — tack it onto the audit request** (see the fresh-eyes audit prompt in Phase 4):

> Grounded in: *"...if with all your knowledge and thinking from first principles you have some suggestions that are counter-positioned to existing solutions i would like to know about them, after your assessment."*

```
...[end of your fresh-eyes audit request]... And after your assessment: if, thinking
from first principles, you have suggestions that are genuinely COUNTER-POSITIONED to
existing solutions (not a variant of what everyone ships — something incumbents
structurally can't copy), I want to know about them. Generate several via distinct
ideation lenses, then judge them for TRUE counter-positioning + segment-fit and give me
the top set.
```
In-script this is a tail phase on the audit: `Ideate` (N distinct counter-positioning LENSES, each proposing one concept) → `Judge` (score each for *conviction / true-counter-position* and *segment-fit*, keep the winners).

**👤 Step 2 — commit to building the winner as a full parallel prototype** (a separate, later message):

> Grounded in: *"can you reimagine the prototype armed with the competitive research and our work to follow the <<CONCEPT>> — <<ONE_LINE_THESIS>> approach? this is something i had told the team myself. create a new dir for this new prototype."*

```
Reimagine the prototype armed with the competitive research and our work to follow the
<<CONCEPT>> — "<<ONE_LINE_THESIS>>" — approach. Keep the proven design system and report
engine, but INVERT the core model per that thesis. Create a NEW directory for this
prototype; the existing build stays untouched so we can test both.
```
Before writing code, run the design-spec panel (`workflow-conventions.md` → judge-panel pattern): a **reuse-map cartographer** (copy-verbatim vs reuse-pattern vs cut) alongside **K opposed design stances**, judged on a candidate×criterion matrix, consolidated by one `xhigh` lead **biased toward the option that best kills the #1 objection.**

---

### Phase 3 — Prototype (build a customer-testable instrument)

**👤 Reskin / consolidate to authoritative tokens** (read tokens verbatim from the source-of-truth design file, never reverse-engineer a palette):

> Grounded in: *"i'd like you to check what <<PRODUCT>> currently looks like and create a second prototype that's exactly similar in the models and functionality as the original but reskinned to match the design system... the models, attributes, scenarios, functionality, should remain as is — we only want to change the skin."*

```
Build/reskin the prototype to match <<PRODUCT>>'s design system. Use the AUTHORITATIVE
tokens read verbatim from the source of truth (<<FIGMA_URL or token file>>), not a
palette scraped off the live app. Keep data.js (models/attributes/scenarios) and the
logic byte-identical; change only the skin + branding strings. Then re-run the
verification harness to PROVE functionality is unchanged (<<N>>/<<N>> scenarios pass).
```
Build guidance (not a prompt — standing rules): vanilla, `file://`-runnable, localStorage + reset; **seed a realistic living ledger AND plant one demo beat per risky bet** (a duplicate to MATCH-not-double-post; a batch to SPLIT; an ambiguous item with no suggestion to force human judgment). Build the invariant-critical math **in-context yourself** — the arithmetic must be airtight to the penny.

---

### Phase 4 — Verify (triangulate live + static + ground-truth math)

**👤 Fresh-eyes coverage / gap audit** (the workhorse; usually paired with the Phase 2b counter-position tail):

> Grounded in: *"take a look at our design choices, our prototype, and our tasks through a pair of fresh eyes and verify whether we have any big gaps or inconsistencies."* and *"does the prototype currently accommodate all the scenarios above? does it cover our most important design choices? does it cover the bank transaction sync?"*

```
Read the research we conducted so you have a clear picture of how <<DOMAIN>> is usually
structured and what the expectations are. Then look at our design choices, our
prototype, and our usability tasks through a pair of FRESH EYES and verify whether we
have any big gaps or inconsistencies. Trace the ACTUAL code — don't trust function names
or the doc's claims. For each of the <<N>> design bets and each scenario, tell me
covered / partial / missing with file:line evidence, and separate a real defect from an
intentional scope cut.
```
In-script: fan out N distinct-lens auditors → per-finding adversarial verify (default-to-refute, re-read source) → `xhigh` lead synthesis into themes + `what_is_solid`. Feed every agent the CTX block + the DISCLOSED/BY-DESIGN list + your seed hypotheses H1..Hn (`workflow-conventions.md`).

**👤 Drive the app as the persona** (the live half of triangulation — Claude clicks through, you don't):

> Grounded in: *"take a look at the tasks in @docs/usability-test-protocol.md and perform them as if you're a test participant. note anything that's outright broken, confusing, or doesn't match a <<SEGMENT>> admin's mental models."* and *"go through the usability tests... from the POV of our target audience, and tell me: 1. if anything's outright broken 2. if any of the mental models we've designed with in mind don't fit those our persona has."*

```
Look at the tasks in <<PROTOCOL_PATH>> and perform them as if you're a test participant —
embody <<PERSONA_NAME>>, a <<PERSONA_ONE_LINER>>. Drive the LIVE app (not the code).
After EVERY action, assert the core invariant at the DATA level (<<INVARIANT>>), not from
the screenshot. Take the footgun / "add all" / escape-hatch path FIRST to try to break
it. Note anything outright broken, confusing, or that doesn't match this persona's
real-world mental model. Separate (A) OUTRIGHT BROKEN (repro + file:line) from
(B) MODEL MISMATCH (tie to a bet/RQ). Also say what genuinely works well.
```
Run the equivalent **static fan-out audit in the background** (one agent per user flow, each pinned to a research question, sharing the finding schema with a `works-well` kind) while you drive live; keep only what live + static + a Node math harness over the real pure functions all agree on.

**👤 Calibrate raw severities before sharing** (de-inflate, don't discover):

> Grounded in: the standing instruction to *"antagonistically verify the numbers one final time"* before anything goes to colleagues.

```
Here are the <<N>> findings from the session with my self-assessed severities: <<LIST>>.
Don't dispute WHETHER they happen (already confirmed live + in code). Calibrate each
through 3 independent lenses in parallel — (1) would <<PERSONA>> really hit it and does
it matter, (2) argue the severity DOWN if self-recoverable, (3) adversarial skeptic that
tries to refute it's a real problem — then roll up to the MEDIAN severity, a
real-for-persona vote tally, and the strongest counterargument per finding.
```

**👤 Push past the risks you listed** (a hard Rafa signal — never let three findings be the answer):

> *"i don't want just three."* · *"some of your conclusions are over cautious. run the query yourself."*

**⚙️ Research-first, then audit against it** (the one time you DO script a research fan-out — when it must feed an internal code audit): parallel web-research agents (competitors + domain mechanics) return cited, confidence-tagged findings → those feed the code-audit dimensions with a `from_hypothesis` flag (confirmed-provided vs newly-discovered), and a later variant adds an `unsupported_claims` field flagging any build/strategy claim the research does NOT actually verify.

---

### Phase 5 — Harden & gate; keep durable state

**👤 Fix→review→converge loop** (usually set as a session Stop-hook goal):

> *"go through fix and review cycles until we're good to go."*

Order fixes highest-impact-first, verify each LIVE (bump a cache-buster so you test current code), then adversarially review your OWN diff fanned out by changed area with an independent real-vs-false-alarm verify stage. "Good to go" means a review cycle that finds **zero** new issues — then tear down scaffolding.

**👤 Honor a scope reduction literally** (overrides a stale goal or Stop-hook — hold read-only even against repeated hook firings):

> *"forget about the goal. just review everything a last time. do not make any changes."*

**👤 Memory-reality audit** after a burst of changes (read-only ground-truth probe, one agent per file, `{key, observed, evidence}`, zero edits):

> *"some of your memories are now inaccurate based on an avalanche of changes in the last few hours. check them against reality and update them accordingly."*
