"""Prove the Home search bar's placeholder renders identically between two builds.

Why this exists: capture_states.py masks the placeholder as an animated region, so
diff_states.py deliberately ignores it. That is right for scroll/layout diffs and
useless for C4, whose whole risk is that the Android placeholder became a TextInput
and TextInput text metrics may not match Text text metrics. This script compares the
placeholder itself, by catching both builds showing the SAME fully-typed phrase.

It leans on one property of the typewriter: a completed phrase stays on screen for
typeMs + holdMs + deleteMs = 1590 ms (hooks/useTypewriterText.ts), so a burst at
~150 ms always contains several frames of it.

Usage:
  # 1. on each build, with the app on Home and signed in:
  py -3 stylecheck_searchbar.py capture emulator-5554 evidence/10-C5/A/searchbar
  py -3 stylecheck_searchbar.py capture emulator-5554 evidence/11-C4/A/searchbar

  # 2. compare them (writes crops + report.json into <outdir>):
  py -3 stylecheck_searchbar.py compare evidence/10-C5/A/searchbar \
      evidence/11-C4/A/searchbar evidence/11-C4/A/stylecheck

  # debug: what does one png say?
  py -3 stylecheck_searchbar.py measure evidence/07-A6/A/shots/01_home_top.png

A pass is 0 differing pixels in the cropped row. Anything else is a real change:
this crop contains no animation once the phrase is complete, so unlike the
whole-screen diffs there is no "sub-pixel text at a shifted scroll offset" excuse.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time

from PIL import Image, ImageChops

ADB = os.path.join(os.environ.get("LOCALAPPDATA", ""), "Android", "Sdk",
                   "platform-tools", "adb.exe")

WHITE = (255, 255, 255)


def _is_ink(px, x, y):
    r, g, b = px[x, y][:3]
    return r < 250 or g < 250 or b < 250


def find_card(im):
    """Bounding box of the white search-bar card in the top half of the screen.

    Found by its shape rather than by hard-coded coordinates so it survives the
    hero/no-hero layouts and both devices: a band of rows each carrying one long
    unbroken run of pure white, 38-52 dp tall.
    """
    w, h = im.size
    px = im.load()
    dens = w / 360.0  # px per dp; both AVDs are 360-411 dp wide, close enough to bound
    rows = []
    for y in range(int(h * 0.05), int(h * 0.55)):
        first = last = None
        count = 0
        for x in range(w):
            if px[x, y][:3] == WHITE:
                count += 1
                if first is None:
                    first = x
                last = x
        # A card row is a wide, mostly-white span that does NOT reach either
        # screen edge — the search bar is inset, the page behind it is not.
        # Qualifying on the white COUNT rather than on one unbroken run is
        # what lets rows through the label and the 1 dp divider still count;
        # on the Pixel those break the longest run down to a quarter of the
        # screen and an earlier version of this lost the card completely.
        if (first is not None and first > 0 and last < w - 1
                and last - first > w * 0.55 and count > w * 0.45):
            rows.append((y, first, last))
    if not rows:
        return None
    # Group rows into cards keyed on the left edge, which the rounded corners
    # pull in by only a few px, unlike the white runs themselves.
    bands = []
    for y, x0, x1 in rows:
        if (bands and y - bands[-1][1] <= 3
                and abs(x0 - bands[-1][4]) <= 12 * dens):
            bands[-1][1] = y
            bands[-1][2] = min(bands[-1][2], x0)
            bands[-1][3] = max(bands[-1][3], x1)
        else:
            bands.append([y, y, x0, x1, x0])
    for y0, y1, x0, x1, _left in bands:
        if 38 * dens <= (y1 - y0 + 1) <= 52 * dens:
            return (x0, y0, x1, y1)
    return None


def measure(path):
    """Geometry of the placeholder inside the search card. None if no card."""
    im = Image.open(path).convert("RGB")
    card = find_card(im)
    if card is None:
        return None
    x0, y0, x1, y1 = card
    px = im.load()
    dens = im.size[0] / 360.0
    # Scan only the card's content band, so the rounded corners (which show
    # background, i.e. ink) stay out of it.
    ty0, ty1 = int(y0 + 8 * dens), int(y1 - 8 * dens)

    # Column groups inside the card: [magnifier] [glyphs...] [divider] [map].
    cols = []
    run = None
    for x in range(x0 + 1, x1):
        if any(_is_ink(px, x, y) for y in range(ty0, ty1)):
            if run is None:
                run = x
        elif run is not None:
            cols.append((run, x - 1))
            run = None
    if run is not None:
        cols.append((run, x1 - 1))

    def _tall(g):
        ys = [y for y in range(ty0, ty1)
              for x in range(g[0], g[1] + 1) if _is_ink(px, x, y)]
        return (max(ys) - min(ys) + 1) if ys else 0

    # The divider is the one thin column that is also tall: 1 dp wide and 24 dp
    # high. No glyph comes close — cap height here is 13 dp — so this separates
    # the label from the Map button without hard-coding the button's width.
    tx0 = (cols[0][1] + 1) if cols else int(x0 + 36 * dens)
    tx1 = int(x1 - 60 * dens)
    for g in cols[1:]:
        if (g[1] - g[0] + 1) <= max(3, int(3 * dens)) and _tall(g) >= 20 * dens:
            tx1 = g[0]
            break

    ink = [(x, y) for y in range(ty0, ty1) for x in range(tx0, tx1) if _is_ink(px, x, y)]
    out = {"card": [x0, y0, x1, y1],
           "card_h": y1 - y0 + 1,
           "text_window": [tx0, tx1, ty0, ty1], "text": None}
    if ink:
        xs = [p[0] for p in ink]
        lo, hi = min(xs), max(xs)
        first = [p[1] for p in ink if lo <= p[0] <= lo + int(9 * dens)]
        out["text"] = {"startX": lo, "endX": hi, "width": hi - lo + 1,
                       "capTop": min(first), "capBot": max(first),
                       "capH": max(first) - min(first) + 1, "inkPx": len(ink)}
    return out


def capture(serial, outdir, seconds=3.0, interval=0.15):
    os.makedirs(outdir, exist_ok=True)
    n = int(seconds / interval)
    print(f"burst: {n} frames every {interval}s from {serial}")
    for i in range(n):
        png = subprocess.run([ADB, "-s", serial, "exec-out", "screencap", "-p"],
                             capture_output=True, timeout=30).stdout
        with open(os.path.join(outdir, f"f{i:03d}.png"), "wb") as f:
            f.write(png)
        time.sleep(interval)
    print(f"wrote {n} frames to {outdir}")
    holds = find_holds(outdir)
    print(f"  frames showing a settled phrase: {sorted(h[0] for h in holds)}")
    if not holds:
        print("  !! no settled phrase caught - is Home focused and signed in?")


def find_holds(d, min_run=4):
    """Frames whose placeholder width is unchanged across >= min_run samples.

    A phrase mid-type changes width every frame; a completed one is static for
    ~1.6 s. The widest stable run is the fully-typed phrase.
    """
    frames = []
    for name in sorted(os.listdir(d)):
        if not name.endswith(".png"):
            continue
        m = measure(os.path.join(d, name))
        frames.append((name, m["text"]["width"] if m and m["text"] else None))
    holds, i = [], 0
    while i < len(frames):
        w = frames[i][1]
        j = i
        while j < len(frames) and frames[j][1] == w:
            j += 1
        if w and (j - i) >= min_run:
            holds.append((frames[i][0], w, j - i))
        i = j
    return holds


def compare(dir_a, dir_b, outdir):
    os.makedirs(outdir, exist_ok=True)
    ha, hb = find_holds(dir_a), find_holds(dir_b)
    if not ha or not hb:
        print(f"FAIL: no settled phrase in {'A' if not ha else 'B'}")
        return 2
    # Match on width: the same phrase renders the same width in both builds if
    # the metrics match. If no width is shared, that is itself the finding.
    wa = {w: (n, r) for n, w, r in ha}
    shared = [w for w in wa if any(w == w2 for _, w2, _ in hb)]
    rep = {"a": dir_a, "b": dir_b,
           "holds_a": [{"frame": n, "width": w, "run": r} for n, w, r in ha],
           "holds_b": [{"frame": n, "width": w, "run": r} for n, w, r in hb]}
    if not shared:
        rep["result"] = "no phrase of equal width in both bursts"
        rep["verdict"] = "FAIL"
        print("FAIL: the two builds never showed a phrase of the same width.")
        print(f"  A widths {[w for _, w, _ in ha]}   B widths {[w for _, w, _ in hb]}")
        print("  Either the bursts caught different phrases (re-run), or the")
        print("  text metrics differ (a real regression).")
    else:
        width = max(shared)
        fa = wa[width][0]
        fb = next(n for n, w, _ in hb if w == width)
        ma = measure(os.path.join(dir_a, fa))
        mb = measure(os.path.join(dir_b, fb))
        ia = Image.open(os.path.join(dir_a, fa)).convert("RGB").crop(tuple(ma["card"]))
        ib = Image.open(os.path.join(dir_b, fb)).convert("RGB").crop(tuple(mb["card"]))
        ia.save(os.path.join(outdir, "before.png"))
        ib.save(os.path.join(outdir, "after.png"))
        if ia.size != ib.size:
            rep.update(verdict="FAIL", result=f"card size {ia.size} vs {ib.size}")
            print(f"FAIL: search card geometry changed {ia.size} -> {ib.size}")
        else:
            diff = ImageChops.difference(ia, ib).convert("L").point(
                lambda v: 255 if v > 12 else 0)
            diff.save(os.path.join(outdir, "diff.png"))
            n = diff.histogram()[255]
            rep.update(verdict="PASS" if n == 0 else "FAIL",
                       differing_px=n, phrase_width=width,
                       frame_a=fa, frame_b=fb,
                       geom_a=ma, geom_b=mb)
            print(f"phrase width {width}px: {fa} vs {fb}")
            print(f"  card {ia.size}, differing px = {n}  -> "
                  f"{'PASS' if n == 0 else 'FAIL'}")
            if n:
                print(f"  A text {ma['text']}")
                print(f"  B text {mb['text']}")
    with open(os.path.join(outdir, "report.json"), "w") as f:
        json.dump(rep, f, indent=2)
    return 0 if rep.get("verdict") == "PASS" else 1


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)
    cmd = sys.argv[1]
    if cmd == "capture":
        capture(sys.argv[2], sys.argv[3],
                float(sys.argv[4]) if len(sys.argv) > 4 else 3.0)
    elif cmd == "compare":
        raise SystemExit(compare(sys.argv[2], sys.argv[3], sys.argv[4]))
    elif cmd == "measure":
        for p in sys.argv[2:]:
            print(p, json.dumps(measure(p), indent=2))
    else:
        print(__doc__)
        raise SystemExit(2)
