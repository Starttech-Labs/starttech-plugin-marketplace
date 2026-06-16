# /// script
# requires-python = ">=3.9"
# dependencies = ["matplotlib>=3.5"]
# ///
"""
XmR (Individual X and Moving Range) chart utilities.

Implements the standard Wheeler / SPC formulas:
    UNPL = X_bar + 2.66 * mR_bar       (upper natural process limit, X chart)
    LNPL = X_bar - 2.66 * mR_bar       (lower natural process limit, X chart)
    URL  = 3.268 * mR_bar              (upper range limit, mR chart)

Constants 2.66 (= 3 / d2) and 3.268 (= D4) are the standard values for n=2
moving ranges.

Three signal-detection rules (from Wheeler, as summarised by xmrit.com):
    1. Process Limit Rule  - any point outside the natural process limits.
    2. Quartile Limit Rule - 3 of 4 consecutive points in the outer quartile
                             (closer to a limit than to the center line).
    3. Run of 8            - 8 consecutive points on the same side of center.

Running it (text / table mode is stdlib-only; chart mode needs matplotlib):

    # Preferred — uv provisions matplotlib ephemerally via the PEP 723 header above:
    uv run scripts/xmr.py --values "12,14,11,...,18" --chart /tmp/xmr.png

    # Any python3 works for text/table (no chart):
    python3 scripts/xmr.py --values "12,14,11,...,18"

    # From a CSV:
    python3 scripts/xmr.py data.csv --date-col date --value-col signups

Programmatic use (import — only if the script dir is importable):
    from xmr import analyze, render_chart
    result = analyze(values, dates=dates, dividers=[12])
"""

from __future__ import annotations

import math
import re

from dataclasses import dataclass, field, asdict
from typing import Sequence, Optional


E2 = 2.66    # 3 / d2 for n=2
D4 = 3.268   # range limit factor for n=2

MIN_POINTS = 6
GELLING = 12
HARDENED = 20


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class Signal:
    index: int
    date: Optional[str]
    value: float
    rule: str          # "process_limit_x", "process_limit_mr", "quartile", "run_of_8"
    direction: str     # "high" or "low"
    detail: str

    def to_dict(self):
        return asdict(self)


@dataclass
class SegmentAnalysis:
    start_index: int
    end_index: int        # inclusive
    n_points: int
    x_bar: float
    mr_bar: float
    unpl: float
    lnpl: float
    url: float
    moving_ranges: list = field(default_factory=list)
    signals: list = field(default_factory=list)
    predictable: bool = True
    maturity: str = ""     # "insufficient", "minimum", "gelling", "hardened"

    def to_dict(self):
        d = asdict(self)
        d["signals"] = [s.to_dict() for s in self.signals]
        return d


# ---------------------------------------------------------------------------
# Core math
# ---------------------------------------------------------------------------

def moving_ranges(values: Sequence[float]) -> list:
    """First value has no moving range -> None at index 0."""
    out = [None]
    for i in range(1, len(values)):
        out.append(abs(values[i] - values[i - 1]))
    return out


def compute_limits(values: Sequence[float], mrs: Optional[Sequence] = None) -> dict:
    """Compute X_bar, mR_bar, UNPL, LNPL, URL for a single segment.

    `mrs` may carry the segment's moving ranges already computed elsewhere --
    e.g. with a leading divider-spanning range so the post-intervention jump
    counts toward this segment's limits. When omitted, the moving ranges are
    derived from `values` alone (None entries are ignored either way). X_bar is
    always the mean of `values` only; the supplied mrs affect only mR_bar."""
    if len(values) < 2:
        raise ValueError("Need at least 2 data points to compute limits.")
    x_bar = sum(values) / len(values)
    if mrs is None:
        mrs = moving_ranges(values)
    used = [r for r in mrs if r is not None]
    mr_bar = sum(used) / len(used)
    unpl = x_bar + E2 * mr_bar
    lnpl = x_bar - E2 * mr_bar
    url = D4 * mr_bar
    return {
        "x_bar": x_bar,
        "mr_bar": mr_bar,
        "unpl": unpl,
        "lnpl": lnpl,
        "url": url,
    }


# ---------------------------------------------------------------------------
# Signal detection
# ---------------------------------------------------------------------------

def _detect_process_limit(values, mrs, limits, dates, offset):
    signals = []
    unpl, lnpl, url = limits["unpl"], limits["lnpl"], limits["url"]
    for i, v in enumerate(values):
        d = dates[i] if dates else None
        if v > unpl:
            signals.append(Signal(
                index=i + offset, date=d, value=v,
                rule="process_limit_x", direction="high",
                detail=f"value {v:g} exceeds UNPL {unpl:.2f}",
            ))
        elif v < lnpl:
            signals.append(Signal(
                index=i + offset, date=d, value=v,
                rule="process_limit_x", direction="low",
                detail=f"value {v:g} below LNPL {lnpl:.2f}",
            ))
    for i, r in enumerate(mrs):
        if r is None:
            continue
        if r > url:
            d = dates[i] if dates else None
            signals.append(Signal(
                index=i + offset, date=d, value=r,
                rule="process_limit_mr", direction="high",
                detail=f"moving range {r:g} exceeds URL {url:.2f}",
            ))
    return signals


def _detect_quartile(values, limits, dates, offset):
    """3 of any 4 consecutive points closer to a limit than to the center."""
    signals = []
    x_bar, unpl, lnpl = limits["x_bar"], limits["unpl"], limits["lnpl"]
    upper_mid = (x_bar + unpl) / 2  # boundary of upper outer quartile
    lower_mid = (x_bar + lnpl) / 2  # boundary of lower outer quartile

    for i in range(len(values) - 3):
        upper = [j for j in range(i, i + 4) if values[j] > upper_mid]
        lower = [j for j in range(i, i + 4) if values[j] < lower_mid]
        # When a 4-window has 3+ points in an outer zone, flag the most recent
        # point that is itself in that zone -- NOT necessarily the 4th point of
        # the window. Gating on the 4th point would silently miss a 3-of-4 run
        # whose final point reverts toward the center (e.g. a run anchored at
        # the very start of a segment, which no later window re-captures).
        # Anchoring on the last in-zone point keeps value/direction consistent
        # with the signal; _dedupe drops the repeats produced as the window
        # slides over the same in-zone point.
        if len(upper) >= 3:
            idx = upper[-1]
            signals.append(Signal(
                index=idx + offset, date=dates[idx] if dates else None,
                value=values[idx], rule="quartile", direction="high",
                detail=f"3 of 4 consecutive points above {upper_mid:.2f} "
                       f"(midpoint between center {x_bar:.2f} and UNPL {unpl:.2f})",
            ))
        elif len(lower) >= 3:
            idx = lower[-1]
            signals.append(Signal(
                index=idx + offset, date=dates[idx] if dates else None,
                value=values[idx], rule="quartile", direction="low",
                detail=f"3 of 4 consecutive points below {lower_mid:.2f} "
                       f"(midpoint between center {x_bar:.2f} and LNPL {lnpl:.2f})",
            ))
    return _dedupe(signals)


def _detect_run_of_8(values, limits, dates, offset):
    """8 consecutive points on the same side of the center line."""
    signals = []
    x_bar = limits["x_bar"]
    side = 0  # +1 above, -1 below, 0 reset (point on the line)
    run = 0
    for i, v in enumerate(values):
        if v > x_bar:
            s = 1
        elif v < x_bar:
            s = -1
        else:
            s = 0
        if s == side and s != 0:
            run += 1
        else:
            side = s
            run = 1 if s != 0 else 0
        if run == 8:
            signals.append(Signal(
                index=i + offset, date=dates[i] if dates else None,
                value=v, rule="run_of_8",
                direction="high" if side > 0 else "low",
                detail=f"8 consecutive points {'above' if side > 0 else 'below'} "
                       f"center line {x_bar:.2f}",
            ))
    return signals


def _dedupe(signals: list) -> list:
    seen = set()
    out = []
    for s in signals:
        key = (s.index, s.rule)
        if key not in seen:
            seen.add(key)
            out.append(s)
    return out


def detect_signals(values, limits, dates=None, offset=0, mrs=None) -> list:
    """Run all three rules. `offset` lets you produce global indices when
    analysing a segment that doesn't start at 0. `mrs` may carry the segment's
    moving ranges (e.g. with a leading divider-spanning range) so the mR rule
    flags the post-divider jump; when omitted it's computed from `values`."""
    if mrs is None:
        mrs = moving_ranges(values)
    sigs = []
    sigs += _detect_process_limit(values, mrs, limits, dates, offset)
    sigs += _detect_quartile(values, limits, dates, offset)
    sigs += _detect_run_of_8(values, limits, dates, offset)
    sigs.sort(key=lambda s: (s.index, s.rule))
    return sigs


# ---------------------------------------------------------------------------
# Top-level analysis
# ---------------------------------------------------------------------------

def _maturity(n: int) -> str:
    if n < MIN_POINTS:
        return "insufficient"
    if n < GELLING:
        return "minimum"
    if n < HARDENED:
        return "gelling"
    return "hardened"


def _analyze_segment(values, dates, start, end) -> SegmentAnalysis:
    seg_values = values[start:end + 1]
    seg_dates = dates[start:end + 1] if dates else None
    # Moving ranges for this segment. For a segment that follows a divider, the
    # first moving range spans the divider (|values[start] - values[start-1]|),
    # i.e. the post-intervention jump. It IS counted toward this segment's
    # mR-bar, its limits (mR-bar widens UNPL/LNPL/URL), and its mR signal
    # detection -- matching xmrit, where the jump belongs to the new segment and
    # is flagged if it breaches that segment's URL. X-bar still uses seg_values
    # only, so the center line is unaffected.
    seg_mrs = moving_ranges(seg_values)
    if start > 0:
        seg_mrs[0] = abs(values[start] - values[start - 1])
    limits = compute_limits(seg_values, seg_mrs)
    sigs = detect_signals(seg_values, limits, seg_dates, offset=start, mrs=seg_mrs)
    return SegmentAnalysis(
        start_index=start,
        end_index=end,
        n_points=len(seg_values),
        x_bar=limits["x_bar"],
        mr_bar=limits["mr_bar"],
        unpl=limits["unpl"],
        lnpl=limits["lnpl"],
        url=limits["url"],
        moving_ranges=seg_mrs,
        signals=sigs,
        predictable=len(sigs) == 0,
        maturity=_maturity(len(seg_values)),
    )


def analyze(values: Sequence[float],
            dates: Optional[Sequence[str]] = None,
            dividers: Optional[Sequence[int]] = None) -> dict:
    """Analyse a series. If `dividers` is given, treat each index in it as the
    first point of a new segment (so dividers=[12] splits into 0..11 and 12..end).
    Returns a plain dict suitable for JSON / printing."""
    n = len(values)
    if dates is not None and len(dates) != n:
        return {
            "ok": False,
            "n_points": n,
            "message": f"dates has {len(dates)} entries but values has {n}; "
                       f"they must be the same length.",
        }
    nonfinite = [i for i, v in enumerate(values) if not math.isfinite(v)]
    if nonfinite:
        return {
            "ok": False,
            "n_points": n,
            "message": (f"values contains a non-finite entry (NaN or infinity) at "
                        f"index {nonfinite[0]}; every value must be a finite number. "
                        f"NaN/inf would otherwise pass through as a false "
                        f"'predictable' result, since every comparison against them "
                        f"is false."),
        }
    if n < MIN_POINTS:
        return {
            "ok": False,
            "n_points": n,
            "message": f"Need at least {MIN_POINTS} points for an XmR chart; "
                       f"got {n}. Wait for more data.",
        }

    if dividers:
        boundaries = sorted(set(dividers))
        segments = []
        start = 0
        for b in boundaries:
            if b <= start or b >= n:
                continue
            segments.append((start, b - 1))
            start = b
        segments.append((start, n - 1))
    else:
        segments = [(0, n - 1)]

    too_small = [s for s, e in segments if e - s + 1 < 2]
    if too_small:
        return {
            "ok": False,
            "n_points": n,
            "message": ("A divider produced a segment with fewer than 2 points "
                        f"(segment starting at index {too_small[0]}); each segment "
                        "needs at least 2 points to compute a moving range. "
                        "Move or remove that divider."),
        }

    seg_results = [_analyze_segment(values, dates, s, e) for s, e in segments]
    return {
        "ok": True,
        "n_points": n,
        "n_segments": len(seg_results),
        "segments": [s.to_dict() for s in seg_results],
    }


# ---------------------------------------------------------------------------
# Chart rendering (optional - requires matplotlib)
# ---------------------------------------------------------------------------

def render_chart(values: Sequence[float],
                 dates: Optional[Sequence] = None,
                 output_path: str = "xmr_chart.png",
                 dividers: Optional[Sequence[int]] = None,
                 title: str = "XmR Chart",
                 metric_label: str = "Value") -> str:
    """Render a two-panel XmR chart (X chart on top, mR chart below).
    Returns the path to the saved image. Requires matplotlib."""
    try:
        import matplotlib
        matplotlib.use("Agg")  # headless: no display needed
        import matplotlib.pyplot as plt
        import matplotlib.dates as mdates
    except ImportError as exc:
        raise SystemExit(
            "Chart rendering needs matplotlib, which isn't importable.\n"
            "Re-run this script with `uv run` (it provisions matplotlib via the\n"
            "PEP 723 header automatically), or install it into the python you're using."
        ) from exc
    from datetime import datetime

    result = analyze(values, dates, dividers)
    if not result["ok"]:
        raise ValueError(result["message"])

    # Parse dates if provided as strings
    x_axis = list(range(len(values)))
    use_dates = False
    if dates:
        try:
            parsed = [datetime.fromisoformat(str(d)) for d in dates]
            x_axis = parsed
            use_dates = True
        except Exception:
            x_axis = list(range(len(values)))

    fig, (ax_x, ax_mr) = plt.subplots(
        2, 1, figsize=(11, 7), sharex=True,
        gridspec_kw={"height_ratios": [2, 1]},
    )

    # Plot raw points + lines
    ax_x.plot(x_axis, values, "-o", color="#2c3e50", markersize=4,
              linewidth=1, zorder=3)

    # mR panel: one continuous line over the whole series. The moving range that
    # spans a divider is the post-intervention jump; it belongs to the new
    # segment's mR-bar/limits (see _analyze_segment) and is highlighted as a
    # signal below if it breaches that segment's URL -- matching xmrit.
    mrs_all = moving_ranges(values)
    mr_x = [x_axis[i] for i, r in enumerate(mrs_all) if r is not None]
    mr_y = [r for r in mrs_all if r is not None]
    ax_mr.plot(mr_x, mr_y, "-o", color="#2c3e50", markersize=4,
               linewidth=1, zorder=3)

    # Per-segment limits + signals
    signal_indices = set()
    for seg in result["segments"]:
        s, e = seg["start_index"], seg["end_index"]
        seg_x = x_axis[s:e + 1]
        # X chart limit lines
        for key, color, style in [
            ("x_bar", "#c0392b", "-"),
            ("unpl", "#2980b9", "--"),
            ("lnpl", "#2980b9", "--"),
        ]:
            ax_x.plot([seg_x[0], seg_x[-1]], [seg[key]] * 2,
                      color=color, linestyle=style, linewidth=1, zorder=2)
        # mR chart limit lines
        for key, color, style in [
            ("mr_bar", "#c0392b", "-"),
            ("url", "#2980b9", "--"),
        ]:
            ax_mr.plot([seg_x[0], seg_x[-1]], [seg[key]] * 2,
                       color=color, linestyle=style, linewidth=1, zorder=2)
        for sig in seg["signals"]:
            signal_indices.add((sig["index"], sig["rule"]))

    # Highlight signal points
    for idx, rule in signal_indices:
        if rule == "process_limit_mr":
            ax_mr.plot(x_axis[idx], mrs_all[idx], "o",
                       color="#e74c3c", markersize=9, zorder=4,
                       markeredgecolor="white", markeredgewidth=1.5)
        else:
            ax_x.plot(x_axis[idx], values[idx], "o",
                      color="#e74c3c", markersize=9, zorder=4,
                      markeredgecolor="white", markeredgewidth=1.5)

    # Dividers
    if dividers:
        for d in dividers:
            if 0 < d < len(values):
                ax_x.axvline(x_axis[d], color="#7f8c8d",
                             linestyle=":", linewidth=1)
                ax_mr.axvline(x_axis[d], color="#7f8c8d",
                              linestyle=":", linewidth=1)

    ax_x.set_title(title, fontsize=13, fontweight="bold", loc="left")
    ax_x.set_ylabel(metric_label)
    ax_mr.set_ylabel("Moving range")
    ax_mr.set_xlabel("Date" if use_dates else "Observation")
    for ax in (ax_x, ax_mr):
        ax.grid(True, alpha=0.25)
        ax.spines["top"].set_visible(False)
        ax.spines["right"].set_visible(False)
    if use_dates:
        ax_mr.xaxis.set_major_locator(mdates.AutoDateLocator())
        ax_mr.xaxis.set_major_formatter(mdates.ConciseDateFormatter(
            ax_mr.xaxis.get_major_locator()))
    plt.tight_layout()
    plt.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return output_path


# ---------------------------------------------------------------------------
# CLI for ad-hoc use
# ---------------------------------------------------------------------------

def _parse_inline(text, whitespace=False):
    """Split an inline list into tokens.

    Commas and newlines always separate. When `whitespace` is true (used for the
    numeric --values, which never contain internal spaces) any run of spaces/tabs
    also separates, so "12 14 11" parses as three numbers. Date labels keep
    comma/newline-only splitting so a label with internal spaces (e.g. "Jan 2026")
    survives as one token.
    """
    if text is None:
        return None
    sep = r"[,\s]+" if whitespace else r"[,\n]+"
    return [p.strip() for p in re.split(sep, text.strip()) if p.strip()]


if __name__ == "__main__":
    import argparse, csv, json, sys

    p = argparse.ArgumentParser(
        description="XmR analysis from a CSV file or inline values.")
    p.add_argument("csv_path", nargs="?",
                   help="CSV with a date column and a value column. "
                        "Omit when using --values.")
    p.add_argument("--date-col", default="date")
    p.add_argument("--value-col", default="value")
    p.add_argument("--values",
                   help="Inline comma/whitespace separated numbers, "
                        "e.g. --values \"12,14,11,18\". Alternative to a CSV.")
    p.add_argument("--dates",
                   help="Inline comma-separated date/sequence labels matching --values "
                        "(optional).")
    p.add_argument("--divider", type=int, action="append", default=[],
                   help="Index where a new segment starts (repeatable).")
    p.add_argument("--chart", help="Optional path to save chart PNG.")
    p.add_argument("--title", default="XmR Chart")
    p.add_argument("--metric-label", default="Value")
    args = p.parse_args()

    dates, values = None, []

    if args.values:
        try:
            values = [float(v) for v in _parse_inline(args.values, whitespace=True)]
        except ValueError as e:
            sys.exit(f"--values must be comma/whitespace separated numbers: {e}")
        for i, v in enumerate(values):
            if not math.isfinite(v):
                sys.exit(f"--values entry #{i + 1} is {v!r}; values must be finite "
                         f"(no NaN or infinity).")
        dates = _parse_inline(args.dates)
        if dates and len(dates) != len(values):
            sys.exit(f"--dates has {len(dates)} labels but --values has "
                     f"{len(values)} numbers; they must match.")
    elif args.csv_path:
        dates = []
        # utf-8-sig so a BOM from Excel/Windows exports is stripped (otherwise
        # the first header becomes '﻿<col>' and the column lookup fails);
        # newline="" is the csv module's documented recommendation.
        try:
            with open(args.csv_path, newline="", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                if reader.fieldnames is None:
                    sys.exit(f"CSV is empty (no header row): {args.csv_path}")
                for col in (args.date_col, args.value_col):
                    if col not in reader.fieldnames:
                        sys.exit(f"CSV column '{col}' not found; columns are: "
                                 f"{', '.join(reader.fieldnames)}")
                for n, row in enumerate(reader, start=2):  # row 1 is the header
                    raw = row[args.value_col]
                    try:
                        val = float(raw)
                    except (TypeError, ValueError):
                        sys.exit(f"CSV row {n}: value {raw!r} in column "
                                 f"'{args.value_col}' is not a number.")
                    if not math.isfinite(val):
                        sys.exit(f"CSV row {n}: value {raw!r} in column "
                                 f"'{args.value_col}' is not finite (no NaN or "
                                 f"infinity).")
                    values.append(val)
                    dates.append(row[args.date_col])
        except FileNotFoundError:
            sys.exit(f"CSV not found: {args.csv_path}")
    else:
        p.error("Provide either a csv_path or --values.")

    result = analyze(values, dates, dividers=args.divider or None)
    json.dump(result, sys.stdout, indent=2, default=str, allow_nan=False)
    print()

    if args.chart:
        render_chart(values, dates, args.chart,
                     dividers=args.divider or None,
                     title=args.title, metric_label=args.metric_label)
        print(f"\nChart saved to {args.chart}", file=sys.stderr)
