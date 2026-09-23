"""Median every step across repeated perf_compare.py runs, and diff two builds.

A change is only called "clear" when the before and after run ranges don't overlap, so a
median that moved inside run-to-run noise is reported as noise, not as a win.

Usage:
  python summarize.py "evidence/00-baseline/A/perf_run*.json"
  python summarize.py --compare "evidence/00-baseline/A/perf_run*.json" "evidence/01-A1/A/perf_run*.json" [--json out.json]
"""
from __future__ import annotations

import glob
import json
import os
import re
import statistics
import sys

METRICS = ["settle_s", "frames", "janky_pct", "p50_ms", "p90_ms", "p99_ms", "fs_frames", "fs_mean_ms",
           "fs_p50_ms", "fs_p90_ms", "ui_mean_ms", "rt_mean_ms", "cpu_ms", "cpu_rt_ms", "cpu_ui_ms",
           "cpu_js_ms", "cpu_ms_per_s", "host_gpu_pct", "host_cpu_pct"]
# fs_frames (frames the app actually drew in the window) is in here because on an emulator it is
# one of the few numbers that means the same thing as it would on a phone: a frame is a frame.
# Durations (fs_*_ms, rt_mean_ms) and whole-process CPU are inflated by the GL translation layer.
COMPARE = ["settle_s", "fs_frames", "fs_mean_ms", "fs_p90_ms", "rt_mean_ms", "ui_mean_ms", "cpu_ms",
           "cpu_rt_ms", "cpu_js_ms"]


def load(patterns) -> dict:
    paths = []
    for p in patterns:
        paths.extend(sorted(glob.glob(p)))
    steps: dict = {}
    crashes: dict = {}
    for path in paths:
        with open(path) as f:
            data = json.load(f)
        for s in data["steps"]:
            if "error" in s:
                continue
            flat = dict(s)
            flat.update(s.get("frames") or {})
            # a window where the app was not running measured nothing; counting its zeros would
            # turn a crash into an improvement
            # A live React Native app cannot spend under ~100 ms of CPU across a 4-10 s window;
            # anything that small means the process restarted or was never there.
            cpu = flat.get("cpu_ms")
            if flat.get("app_alive") is False or (cpu is not None and cpu < 100):
                crashes.setdefault(s["action"], 0)
                crashes[s["action"]] += 1
                continue
            row = steps.setdefault(s["action"], {m: [] for m in METRICS})
            for m in METRICS:
                v = flat.get(m)
                if v is not None:
                    row[m].append(float(v))
    return {"runs": len(paths), "steps": steps, "dropped_windows": crashes}


def compare(before: dict, after: dict) -> list:
    rows = []
    for action, a in before["steps"].items():
        b = after["steps"].get(action)
        if not b:
            continue
        row = {"action": action, "metrics": {}}
        for m in COMPARE:
            va, vb = a[m], b[m]
            if not va or not vb:
                continue
            ma, mb = statistics.median(va), statistics.median(vb)
            clear = max(vb) < min(va) or min(vb) > max(va)
            row["metrics"][m] = {
                "before": ma, "after": mb, "before_range": [min(va), max(va)], "after_range": [min(vb), max(vb)],
                "delta_pct": round((mb - ma) / ma * 100, 1) if ma else None,
                "clear": clear, "n": [len(va), len(vb)],
            }
        rows.append(row)
    return rows


def paired(before_paths: list, after_paths: list) -> list:
    """Compare run i of "before" against run i of "after".

    Runs are interleaved on the device (before, after, before, after...), so each pair saw
    roughly the same host load. Reporting the median of per-pair deltas, plus how many pairs
    moved the same way, survives a busy desktop far better than comparing two medians.
    """
    # Pair by ROUND, not by position in the list. A build whose round-1 file is missing would
    # otherwise have its round 2 compared against another build's round 1, which is exactly the
    # drift the round-robin exists to cancel.
    def by_round(paths):
        out = {}
        for p in paths:
            m = re.search(r"run(\d+)\.json$", os.path.basename(p))
            if m:
                out[int(m.group(1))] = load([p])
        return out

    bmap, amap = by_round(before_paths), by_round(after_paths)
    rounds = sorted(set(bmap) & set(amap))
    befores = [bmap[r] for r in rounds]
    afters = [amap[r] for r in rounds]
    n = len(rounds)
    actions = [a for a in befores[0]["steps"]] if befores else []
    rows = []
    for action in actions:
        row = {"action": action, "metrics": {}}
        for m in COMPARE:
            deltas, pairs = [], []
            for i in range(n):
                va = befores[i]["steps"].get(action, {}).get(m)
                vb = afters[i]["steps"].get(action, {}).get(m)
                if not va or not vb:
                    continue
                a, b = statistics.median(va), statistics.median(vb)
                pairs.append((a, b))
                if a:
                    deltas.append((b - a) / a * 100)
            if not deltas:
                continue
            better = sum(1 for d in deltas if d < 0)
            row["metrics"][m] = {
                "before": statistics.median([p[0] for p in pairs]),
                "after": statistics.median([p[1] for p in pairs]),
                "delta_pct": round(statistics.median(deltas), 1),
                "pairs": len(deltas), "pairs_better": better,
                # every round agreeing on the direction is the paired equivalent of
                # non-overlapping ranges - but one round agreeing with itself proves nothing
                "clear": len(deltas) >= 2 and (better == len(deltas) or better == 0),
                "per_pair_pct": [round(d, 1) for d in deltas],
            }
        rows.append(row)
    return rows


def fmt(v):
    return "—" if v is None else (f"{v:.2f}" if abs(v) < 10 and v != int(v) else f"{v:.0f}")


def main() -> None:
    args = sys.argv[1:]
    out_json = None
    if "--json" in args:
        out_json = args[args.index("--json") + 1]
        args = args[: args.index("--json")]
    if args and args[0] == "--paired":
        import glob as _glob
        bp, ap = sorted(_glob.glob(args[1])), sorted(_glob.glob(args[2]))
        rows = paired(bp, ap)
        print(f"paired runs: {min(len(bp), len(ap))} pairs (medians of per-pair deltas; "
              f"* = every pair agreed)")
        for row in rows:
            parts = []
            for m, r in row["metrics"].items():
                mark = "*" if r["clear"] else " "
                parts.append(f"{m} {fmt(r['before'])}→{fmt(r['after'])} {r['delta_pct']:+.0f}%"
                             f"{mark}({r['pairs_better']}/{r['pairs']})")
            print(f"  {row['action'][:34]:34s} " + "  ".join(parts))
        if out_json:
            with open(out_json, "w") as f:
                json.dump({"pairs": min(len(bp), len(ap)), "rows": rows}, f, indent=2)
        return
    if args and args[0] == "--compare":
        a, b = load([args[1]]), load([args[2]])
        rows = compare(a, b)
        print(f"before: {a['runs']} runs   after: {b['runs']} runs   (medians; * = ranges don't overlap)")
        for row in rows:
            parts = []
            for m, r in row["metrics"].items():
                mark = "*" if r["clear"] else " "
                d = f"{r['delta_pct']:+.0f}%" if r["delta_pct"] is not None else ""
                parts.append(f"{m} {fmt(r['before'])}→{fmt(r['after'])} {d}{mark}")
            print(f"  {row['action'][:34]:34s} " + "  ".join(parts))
        if out_json:
            with open(out_json, "w") as f:
                json.dump({"before_runs": a["runs"], "after_runs": b["runs"], "rows": rows}, f, indent=2)
        return
    s = load(args)
    print(f"{s['runs']} runs (medians)")
    for action, r in s["steps"].items():
        print(f"  {action[:34]:34s} " + "  ".join(f"{m} {fmt(statistics.median(v))}" for m, v in r.items() if v))


if __name__ == "__main__":
    main()
