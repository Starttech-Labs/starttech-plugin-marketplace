---
name: xmr-analysis
description: Apply XmR (Individual X and Moving Range) chart methodology to distinguish meaningful signal from routine variation in time-series business metrics. Trigger when the user explicitly invokes XmR concepts — mentions "XmR", "signal vs noise", "signal and noise", "control limits", "process limits", "natural process limits", "routine variation", "exceptional variation", "predictable / unpredictable metric", "Wheeler chart", or asks for an "XmR chart" — or when the user pastes/uploads time-series data and explicitly asks to apply this methodology. Do NOT trigger on generic "is this trend real?" or "did this go up?" questions unless XmR-style language is invoked.
---

# XmR analysis

XmR (also called process behaviour, Shewhart-individuals, or Wheeler charts) is a method for telling whether a movement in a time-series metric is **signal** (worth investigating) or **noise** (routine variation). Two paired charts: the **X chart** plots the values themselves; the **mR chart** plots the absolute change between consecutive points. Both get computed limits, and three rules decide what counts as signal.

## When to use this

Trigger only when the user explicitly invokes the methodology — see the description above for the exact language. If the user asks a generic "did our intervention work?" question without XmR framing, answer directly; don't pull XmR in unprompted.

When triggered, the user usually wants one of three things:
- **Text analysis** — "is this signal or noise?", "did the intervention work?", "is this metric predictable?". Default to this.
- **Markdown table** — when they want the computed values (limits, MRs, signal flags) to inspect or paste into a doc.
- **Rendered chart** — when they explicitly ask for a chart, plot, or visualisation, or for something to share with stakeholders.

Pick the mode from the ask. If unclear, deliver the text analysis and offer the other two.

## Inputs you need

- A **time-series** of one metric, sampled at a regular cadence (daily, weekly, monthly).
- Dates or sequence labels, ideally — but the analysis works on values alone.
- Anywhere from 6 points (bare minimum) to 20+ (limits are well-hardened).
- For before/after analysis: the index (or date) of the change so you can place a **divider**.

The data can come from anywhere the user has it — pasted values, a CSV they point you at, or the result of a query you just ran. The helper script accepts both inline values and a CSV path (see below).

If you have fewer than 6 points, say so and stop. Limits computed from 2–5 points are not meaningful.

If you have more than ~18 months of data, ask whether the older points are still relevant. Business context changes; old data can poison the limits.

## The math (memorise this)

For each segment (a stretch of data between dividers, or the whole series if no dividers):

```
moving range mR_i = |x_i - x_{i-1}|       for i ≥ 1 (no mR for the first point)

X̄ (center)     = mean(values)
mR̄              = mean(moving ranges)

UNPL  =  X̄ + 2.66 · mR̄    upper natural process limit (X chart)
LNPL  =  X̄ - 2.66 · mR̄    lower natural process limit (X chart)
URL   =  3.268 · mR̄        upper range limit (mR chart)
```

The constants are 2.66 (= 3 / d₂, with d₂ = 1.128 for n=2) and 3.268 (= D₄ for n=2). They are not tunable — using anything else is no longer an XmR chart.

If LNPL comes out negative for a metric that cannot go below zero (counts, percentages, etc.), clamp it to 0 for display purposes and note that you've done so.

## The three signal-detection rules

A point is a **signal** (and the metric is **unpredictable** in that segment) if any of these fire:

1. **Process limit rule.** Any X-chart point outside [LNPL, UNPL], or any mR-chart point above URL. Strongest signal — investigate immediately.
2. **Quartile limit rule.** 3 out of any 4 consecutive points sit closer to a limit than to the center line (i.e. above (X̄+UNPL)/2 or below (X̄+LNPL)/2). Moderate signal.
3. **Run of 8.** 8 consecutive points on the same side of the center line. Weaker signal but indicates a sustained shift.

If none of these fire across the segment, the metric is **predictable**: it stays within its natural variation, and you can plan around the limits.

## Diagnosis and recommended action

Once you've classified the metric, the action is different:

**Predictable metric.** The current process is doing what it does. The variation will continue between the limits unless something changes. To improve, you have to change the underlying process — new channel, new tech, new copy, restructure the funnel. Tinkering inside the noise band is wasted effort. Ideal: first narrow the limits (reduce variation), then shift them (improve the average). In practice, for product metrics, shifting is usually what matters.

**Unpredictable metric.** Something is generating special-cause events. Before fundamentally changing the process, find and address the special causes:
- **Spikes** ("good" exceptional points): identify what caused them, replicate where possible. If they're one-off and uncontrollable, consider excluding them and recomputing limits.
- **Dips** ("bad" exceptional points): identify the cause, document the process gap, eliminate the cause.
- A process with too many concurrent changes (campaign launches, daily copy tweaks, etc.) is often the underlying issue — simplify before you can interpret.

**Distinguish predictable-but-disappointing from unpredictable.** A predictable metric within an unsatisfactory range is a different problem than one that's swinging wildly. The first needs a new approach; the second needs root-cause work.

## Before/after analysis with dividers

When the user is asking "did intervention X work?", place a divider at the intervention date. The script recomputes limits for each segment independently. Three things to look for:

1. **Center line shifted** in the intended direction → the intervention moved the average.
2. **Limits shifted** in the intended direction → the whole band of variation moved, not just an outlier.
3. **New segment is stable** (predictable within its new limits, no rule violations) → the change held, didn't just produce a one-off spike.

All three together is a clean win. Shifted center but unstable new segment usually means the intervention introduced new special causes alongside the lift.

6–8 points post-divider is often enough to draw a conclusion. More is better but waiting indefinitely is usually wrong — at some point you have to call it.

## Using the helper script

The skill ships with `scripts/xmr.py` (next to this file). Use it for any non-trivial dataset rather than computing by hand — easy to slip a decimal otherwise. Run it via Bash; it prints the full analysis as JSON to stdout.

**Resolve the script path first.** The script ships next to this SKILL.md at `scripts/xmr.py`. This skill is distributed as part of the `product-management` plugin, so reference the script through the `${CLAUDE_SKILL_DIR}` environment variable that Claude Code sets to this skill's own directory — i.e. `${CLAUDE_SKILL_DIR}/scripts/xmr.py` — which resolves correctly regardless of the current working directory (it will not be the skill directory; the user is usually inside their own project). If `$CLAUDE_SKILL_DIR` is somehow unset in your shell, fall back to locating this skill's directory under the plugin cache and using the absolute path to `scripts/xmr.py`. Use the resolved absolute path in the commands below.

**Choosing how to run it:**
- **Text or table mode (no chart)** is stdlib-only — any `python3` works:
  ```
  python3 ${CLAUDE_SKILL_DIR}/scripts/xmr.py --values "12,14,11,15,13,18,12,14,22,13" --divider 5
  ```
- **Chart mode needs matplotlib.** Don't reach for `pip`. Prefer `uv run`, which provisions matplotlib ephemerally via the script's PEP 723 header (nothing is installed into the user's environment):
  ```
  uv run ${CLAUDE_SKILL_DIR}/scripts/xmr.py --values "12,14,11,15,13,18,12,14,22,13" \
      --dates "2026-01-01,2026-01-08,..." --divider 5 \
      --chart ./xmr-chart.png --title "Weekly active churches" --metric-label "Active churches"
  ```
  Precedence for the chart runtime: (1) if `uv` is on PATH, use `uv run`; (2) else if some `python3` can already `import matplotlib`, use that; (3) else stop and tell the user — suggest installing `uv` or adding matplotlib to their own environment, and offer the text/table mode in the meantime. Never silently `pip install`.

**From a CSV instead of inline values:**
```
python3 ${CLAUDE_SKILL_DIR}/scripts/xmr.py data.csv --date-col date --value-col signups --divider 12
```

**What it returns.** JSON with `segments` (one per divider-bounded stretch), each carrying `x_bar`, `mr_bar`, `unpl`, `lnpl`, `url`, `moving_ranges`, `signals[]`, `predictable`, and `maturity` ("insufficient" / "minimum" / "gelling" / "hardened"). Parse the JSON and format it however the user asked.

`--divider N` marks index `N` as the first point of a new segment (repeatable for multiple dividers).

## Output format

### Text analysis (default)

Structure the response like this:

> **Verdict.** One sentence: predictable or unpredictable, and the headline finding.
>
> **Limits.** X̄, UNPL, LNPL, mR̄, URL — as a short list or inline.
>
> **Signals (if any).** For each: point/date, value, which rule fired, what it suggests.
>
> **Recommendation.** Tied to predictable-vs-unpredictable, and to whatever question prompted the analysis.

Don't drown the response in caveats. The point of the chart is to give a clear call.

### Markdown table

Include columns: date (or index), value, moving range, in/out of limits, signal rule (if any). Above the table, list the segment limits.

### Chart

Generate with the `--chart` flag (or `render_chart()` if importing). Save it to a path in or under the current working directory — e.g. `./xmr-chart.png` or a path the user names — and then reference that path back to the user in your response (it renders as a clickable link in the terminal). Do not use `/mnt/...` paths or any "present file" mechanism; those don't exist in Claude Code. The output is a two-panel PNG: X chart (X̄ in red, UNPL/LNPL dashed blue) on top, mR chart (mR̄ red, URL dashed blue) below, signal points in red, dividers as dotted grey verticals.

## Common pitfalls

- **Mixed cadence.** Don't mix daily and weekly data in the same chart. Resample first.
- **Too few points.** Below 6, the limits are noise. Between 6 and 12, treat them as provisional.
- **Stale baseline.** A divider at the intervention is almost always the right call when "did X work?" is the question. Don't compute limits across both periods.
- **Negative LNPL on bounded metrics.** Clamp for display, note it. Don't pretend the math is wrong.
- **Confusing predictable with good.** A metric that's predictably awful is still awful. Predictability tells you about variation, not about whether you're happy.
- **Treating quartile / run-of-8 rules as equal to process-limit hits.** They're weaker. Note this in the writeup.
- **Acting on every signal.** The rules have a ~3% false positive rate by design. Repeated, related signals are far more informative than a single one.

## Reference

For visual exploration without code, [xmrit.com](https://xmrit.com) is the standard free tool — same methodology, runs entirely client-side. Useful when the user wants to fiddle interactively rather than receive a static chart.
