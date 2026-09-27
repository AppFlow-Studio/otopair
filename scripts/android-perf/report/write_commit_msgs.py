"""Write one commit message per item, with that item's measured numbers in the body.

The plan asks for a commit per item carrying its before -> after figures; writing them from the
evidence rather than by hand keeps the history honest. Reads the same rotation data the report
uses and the prose from items_prose.py.

Usage: python write_commit_msgs.py
"""
from __future__ import annotations

import glob
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
EVID = os.path.abspath(os.path.join(HERE, "..", "evidence"))
OUT = os.path.join(HERE, "commit-msg")
sys.path.insert(0, os.path.dirname(HERE))
sys.path.insert(0, HERE)
from items_prose import ITEMS  # noqa: E402
from summarize import paired  # noqa: E402

SUBJECTS = {
    "A1": "perf(android): draw the tab bar tint without expo-blur",
    "A2": "perf(android): freeze tabs that aren't showing",
    "A3": "perf(android): drop console.log/info/debug from release bundles",
    "A4": "perf(android): pulse the enrichment pill only while it's on screen",
    "A5": "perf(android): detach off-screen sections on the long scrolls",
    "C3": "perf(android): stand down off-screen typewriter and avatar animations",
    "A6": "perf(android): ship right-sized copies of the oversized images",
    "A7": "perf(android): enable R8 code and resource shrinking for release",
    "C4": "perf(android): type the Home placeholder on the UI thread",
    "C5": "perf(android): count the Cars health ring up on the UI thread",
    "C6": "perf(android): stop Cars scrolling waking the JS thread every frame",
}
# Anything in the staged files that this item's prose doesn't account for. The history should
# explain every line it carries, including the ones that are there for a later item.
NOTES = {
    "A3": "package.json also gains expo-build-properties in this commit. It is a dependency with "
          "no effect until app.json asks for it, and it is here because it belongs to the R8 "
          "minify item (A7), which is prepared but not measured or enabled yet. Nothing in this "
          "build uses it.",
}
# Why an item survives with no measurable win. Written per item rather than generated, because the
# mechanism is the argument and it has to be stated plainly for anyone reading the history later.
KEPT_BECAUSE = {
    "A4": "the pill is mounted on four screens and renders nothing on nearly all of them, so an "
          "endless withRepeat was re-evaluating two animated styles per frame for no pixels, which "
          "is pure waste whatever its size",
    "A6": "it is a packaging win rather than a runtime one: the four images the app draws smallest "
          "and ships largest are now right-sized on Android, 5.4 MB of PNG down to 1.6 MB, with iOS "
          "keeping the originals byte for byte. The one flow where every round agreed moved the "
          "wrong way (tap Oto, JS CPU +20%). That window is chat startup and network work, not "
          "image decode, and its median has swung between 560 and 2,900 ms across builds that "
          "never touched it, so it is measuring the network, not this change",
}
# Items with no rotation data at all. This is not "the figures were flat" — no run exists, because
# the rig was taken over mid-pass (docs/ANDROID_PERF_PLAN.md §9.6). Without this the generator would
# print "no change beyond run-to-run noise" over an empty evidence folder and the history would
# claim a measurement nobody took. An entry here replaces the "Measured:" preamble outright.
NOT_MEASURED = {
    "C6": "Not measured. There are no before/after rounds for this change, and their absence does "
          "not mean the numbers were flat — the rotation was never run. Partway through the pass an "
          "install from outside this work replaced the app on both emulators with a differently "
          "signed build, and these APKs will not go over it (INSTALL_FAILED_UPDATE_INCOMPATIBLE on "
          "the budget device, INSTALL_FAILED_VERSION_DOWNGRADE on the Pixel), so no timing round, no "
          "screenshot and no pixel diff was possible. 09-C6 was built and the change confirmed in "
          "the shipped bundle; that is all. It is committed on a mechanism that can be checked "
          "without a device: RN wires onScroll to the native scroll view whether or not a handler is "
          "passed (ScrollView.js:1787), and Android drops a SCROLL event only when "
          "scrollEventThrottle >= max(17, now - lastDispatch) (ReactScrollViewHelper.emitScrollEvent) "
          "— so the 16 this screen passed never throttled anything, and every scrolled frame crossed "
          "into JS to assign a ref that no file in the repository reads. Expect cpu_js_ms on the "
          "cars-scroll window to fall toward the floor and ui_mean_ms to stay flat, since this "
          "removes JS-thread work rather than native work. That is a prediction, not a result, until "
          "someone restores the devices and runs 08-locked against 09-C6.",
}
# The closing line about pixels. The default is true of every item that was captured; an item that
# could not be captured says so here instead of inheriting a claim that was never checked.
PIXELS_DEFAULT = ("Pixels: every captured screen compared before and after on both devices; "
                  "differences outside self-animating regions are listed in the report.")
PIXELS = {
    "C6": "Pixels: not compared — the same install failure that blocked the timing blocked the "
          "capture. This change does not rest on that comparison. The callback it removes only ever "
          "wrote scrollOffsetRef, which nothing in the repository reads, so no rendered pixel can "
          "depend on it; the ScrollView sets no stickyHeaderIndices (which would force the throttle "
          "to 1 and override the constant), the app registers no native scroll listeners, no "
          "scrollPerfTag is set so the FPS listener stays inert, and sendMomentumEvents gates only "
          "event emission — the post-touch runnable, the paging snap and the fling animator are "
          "untouched, so the scroll behaves as it did.",
}
# the flows worth quoting per item, longest-named first so the match is unambiguous
FOCUS = {
    "A1": ["tap Home", "tap Bookings"],
    "A2": ["Cars idle 10s (no input)", "tap Cars", "tap Home"],
    "A3": ["Home idle 10s (no input)", "Cars idle 10s (no input)",
           "booking screen idle 10s (no input)", "tap Cars", "home scroll 4 down + 4 up"],
    "A4": ["Home idle 10s (no input)", "Cars idle 10s (no input)",
           "booking screen idle 10s (no input)"],
    "A5": ["home scroll 4 down + 4 up", "Home idle 10s (no input)"],
    "C3": ["booking screen idle 10s (no input)", "Cars idle 10s (no input)", "tap Home",
           "tap Bookings", "open booking flow (tap Map)"],
    "A6": ["open booking flow (tap Map)", "tap Oto"],
    "A7": ["tap Home", "tap Cars"],
    # exact action names as perf_compare.py emits them
    "C4": ["Home idle 10s (no input)", "tap Home"],
    "C5": ["Cars idle 10s (no input)", "tap Cars"],
    "C6": ["cars scroll 4 down + 4 up", "tap Cars"],
}
# Only the figures that mean on an emulator what they would mean on a phone. These AVDs render
# through a GL translation layer to the host GPU and repaint the whole screen every frame, so
# RenderThread CPU, whole-process CPU and frame durations are inflated by the harness, not by the
# app; they are quoted in the report as directional and left out of the history.
METRICS = [("cpu_js_ms", "JS CPU"), ("ui_mean_ms", "UI thread/frame"),
           ("fs_frames", "frames drawn"), ("settle_s", "settle")]
UNIT = {"cpu_js_ms": "ms", "ui_mean_ms": "ms", "fs_frames": "", "settle_s": "s"}
DEV_NAME = {"A": "budget (Android 9, 2 cores)", "B": "pixel (Android 14, 4 cores)"}


def rows_for(item: dict, dev: str):
    bp = sorted(glob.glob(os.path.join(EVID, "rot", item["before_label"], dev, "run*.json")))
    ap = sorted(glob.glob(os.path.join(EVID, "rot", item["after_label"], dev, "run*.json")))
    n = min(len(bp), len(ap))
    return (paired(bp[:n], ap[:n]), n) if n else ([], 0)


def plain(html_text: str) -> str:
    """The prose as plain text. Paragraph ends become line breaks first: the entries build one
    HTML string out of several adjacent literals, so without this two sentences run together."""
    text = re.sub(r"<[^>]+>", "", html_text.replace("</p>", "</p>\n"))
    for entity, char in (("&nbsp;", " "), ("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">")):
        text = text.replace(entity, char)
    return text


def fmt(v: float) -> str:
    return f"{v:.2f}" if abs(v) < 10 and v != int(v) else f"{v:.0f}"


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for item in ITEMS:
        iid = item["id"]
        body = [SUBJECTS.get(iid, f"perf(android): {item['title']}"), ""]
        # why, as plain text
        why = plain(item["why"])
        for para in [p.strip() for p in why.split("\n") if p.strip()]:
            body += [line for line in wrap(para)] + [""]
        what = plain(item.get("what", ""))
        for para in [p.strip() for p in what.split("\n") if p.strip()]:
            body += [line for line in wrap(para)] + [""]
        if iid in NOTES:
            body += wrap(NOTES[iid]) + [""]
        quoted, rounds_seen = False, 0
        if rounds_available(item, "A") == 0 and iid in NOT_MEASURED:
            body += wrap(NOT_MEASURED[iid])
            write_tail(body, iid, path=os.path.join(OUT, f"{iid}.txt"))
            continue
        body += wrap(
            f"Measured: {item['before_label']} -> {item['after_label']} on the budget emulator, "
            f"round-robin and shuffled each round so both builds saw the same host load; a figure "
            f"is quoted only when every round it appeared in agreed on the direction. Timing comes "
            f"from that device alone — the Pixel is used for the pixel comparison, not for numbers. "
            f"It is still an emulator, so only JS-thread CPU, UI-thread ms/frame, frames drawn "
            f"while idle and settle time are quoted here: RenderThread and whole-process CPU move "
            f"with the host's GL translation layer and are directional at best.")
        for dev in ("A",):
            rows, n = rows_for(item, dev)
            if not n:
                continue
            if dev == "A":
                rounds_seen = n
            body.append("")
            body.append(f"  {DEV_NAME[dev]}, {n} paired rounds:")
            wanted = FOCUS.get(iid, [])
            printed = False
            for row in rows:
                if wanted and row["action"] not in wanted:
                    continue
                parts = []
                for m, label in METRICS:
                    r = row["metrics"].get(m)
                    if not r or not r["clear"] or abs(r["delta_pct"]) < 3:
                        continue
                    # Frames drawn only reads one way in a window where nothing should be drawn
                    # at all. During a transition, fewer frames can mean a smoother animation or
                    # a slower one, so it stays out of those lines.
                    if m == "fs_frames" and "idle" not in row["action"]:
                        continue
                    agreed = max(r["pairs_better"], r["pairs"] - r["pairs_better"])
                    parts.append(f"{label} {fmt(r['before'])}->{fmt(r['after'])}{UNIT[m]} "
                                 f"({r['delta_pct']:+.0f}%, {agreed}/{r['pairs']} rounds)")
                if parts:
                    body.append(f"    {row['action']}: " + "; ".join(parts))
                    printed = True
                    if dev == "A":
                        quoted = True
            if not printed:
                body.append("    no change beyond run-to-run noise")
        # The plan's rule 3: an item that didn't move the numbers is reported as such and kept only
        # on its mechanism, in writing, or not at all.
        if iid in KEPT_BECAUSE:
            lead = ("Small enough to sit at this harness's noise floor"
                    if quoted else
                    f"Inside run-to-run noise on {rounds_seen or 'the recorded'} rounds")
            body.append("")
            body += wrap(f"{lead}; kept because {KEPT_BECAUSE[iid]}.")
        write_tail(body, iid, path=os.path.join(OUT, f"{iid}.txt"))


def rounds_available(item: dict, dev: str) -> int:
    """How many paired rounds exist, without parsing them. Used to tell 'measured and flat' apart
    from 'never measured', which the body has to word very differently."""
    bp = glob.glob(os.path.join(EVID, "rot", item["before_label"], dev, "run*.json"))
    ap = glob.glob(os.path.join(EVID, "rot", item["after_label"], dev, "run*.json"))
    return min(len(bp), len(ap))


def write_tail(body: list, iid: str, path: str) -> None:
    body += [""] + wrap(PIXELS.get(iid, PIXELS_DEFAULT)) + [
        "",
        # The plan asks for the trailer "per the session reminder" (§0 rule 4), and the
        # reminder names the model actually doing the work. Keep this in step with it.
        "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"]
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(body).rstrip() + "\n")
    print(f"wrote {path}")


def wrap(text: str, width: int = 76):
    words, line, out = text.split(), "", []
    for w in words:
        if len(line) + len(w) + 1 > width:
            out.append(line)
            line = w
        else:
            line = f"{line} {w}".strip()
    if line:
        out.append(line)
    return out


if __name__ == "__main__":
    main()
