"""Compare two capture_states.py folders pixel by pixel.

For every screenshot present in both folders it writes a before | after | diff composite
(changed pixels in red over a dimmed copy of the after frame) and reports how many pixels
changed. The status bar is excluded: its clock and icons change between runs.

Usage:
  python diff_states.py evidence/A1/before evidence/A1/after evidence/A1/diff [--crop x1,y1,x2,y2]
"""
from __future__ import annotations

import json
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps

SHIFT_TOLERANCE = 12  # px of vertical slack allowed between two runs of the same screen
THRESHOLD = 12  # per-channel difference that counts as a real change (JPEG-free PNGs, so noise is ~0)


def status_bar_px(h: int, w: int) -> int:
    # 24dp status bar; density inferred from width (720 -> 2.0, 1080 -> 2.625 for these AVDs)
    density = 2.0 if w <= 720 else 2.625
    return int(24 * density) + 2


def changed_mask(a: Image.Image, b: Image.Image) -> Image.Image:
    return ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > THRESHOLD else 0)


def best_shift(a: Image.Image, b: Image.Image, span: int = 40) -> int:
    w, h = a.size
    top, bottom = int(h * 0.25), int(h * 0.7)
    band = a.convert("L").crop((0, top, w, bottom))
    gb = b.convert("L")
    scores = []
    for d in range(-span, span + 1):
        if top + d < 0 or bottom + d > h:
            continue
        diff = ImageChops.difference(band, gb.crop((0, top + d, w, bottom + d)))
        scores.append((sum(diff.point(lambda v: 1 if v > THRESHOLD else 0).histogram()[1:]), abs(d), d))
    return min(scores)[2] if scores else 0


def compare(a_path: str, b_path: str, out_path: str, crop=None) -> dict:
    a = Image.open(a_path).convert("RGB")
    b = Image.open(b_path).convert("RGB")
    if a.size != b.size:
        b = b.resize(a.size)
    top = status_bar_px(*a.size[::-1])
    box = crop or (0, top, a.size[0], a.size[1])
    a, b = a.crop(box), b.crop(box)

    mask = changed_mask(a, b)
    # Two runs never land on the same scroll offset, and different parts of a screen can sit at
    # different offsets (a sticky header stays put while the content under it moves, and the Cars
    # entry animation settles a few px away each time). So a pixel only counts as changed when it
    # differs at EVERY alignment in the range, not just at the single best one.
    shift = best_shift(a, b)
    strict = mask
    for d in range(-SHIFT_TOLERANCE, SHIFT_TOLERANCE + 1):
        if d == 0:
            continue
        shifted = Image.new("RGB", b.size, (0, 0, 0))
        shifted.paste(b, (0, -d))
        strict = ImageChops.multiply(strict, changed_mask(a, shifted))
        if not strict.getbbox():
            break
    mask_all = mask
    mask = strict
    # Regions that animated on their own in either run (see capture_states.shot), grown a
    # little so anti-aliased edges of a moving element don't count as a real change.
    dyn = Image.new("L", a.size, 0)
    for p in (a_path, b_path):
        mp = p[:-4] + ".dyn.png"
        if os.path.exists(mp):
            m = Image.open(mp).convert("L")
            if m.size != (box[2] - box[0], box[3] - box[1]):
                m = m.crop(box)
            dyn = ImageChops.lighter(dyn, m)
    dyn = dyn.filter(ImageFilter.MaxFilter(9))
    real = ImageChops.subtract(mask, dyn)
    changed = mask_all.histogram()[255]
    real_changed = real.point(lambda v: 255 if v else 0).histogram()[255]
    total = a.size[0] * a.size[1]

    dim = ImageOps.grayscale(b).point(lambda v: 90 + v * 0.55).convert("RGB")
    yellow = Image.new("RGB", b.size, (255, 196, 0))
    red = Image.new("RGB", b.size, (255, 32, 32))
    overlay = Image.composite(yellow, dim, ImageChops.multiply(mask, dyn))
    overlay = Image.composite(red, overlay, real)

    gap = 12
    comp = Image.new("RGB", (a.size[0] * 3 + gap * 2, a.size[1]), (255, 255, 255))
    comp.paste(a, (0, 0))
    comp.paste(b, (a.size[0] + gap, 0))
    comp.paste(overlay, (2 * (a.size[0] + gap), 0))
    ImageDraw.Draw(comp)
    comp.save(out_path)
    return {"scroll_shift_px": shift, "changed_px": changed, "total_px": total, "changed_pct": round(100 * changed / total, 3),
            "real_changed_px": real_changed, "real_changed_pct": round(100 * real_changed / total, 4),
            "real_bbox": real.getbbox()}


def main() -> None:
    before, after, out = sys.argv[1], sys.argv[2], sys.argv[3]
    crop = None
    if "--crop" in sys.argv:
        crop = tuple(int(v) for v in sys.argv[sys.argv.index("--crop") + 1].split(","))
    os.makedirs(out, exist_ok=True)
    report = {}
    for name in sorted(os.listdir(before)):
        if not name.endswith(".png") or name.endswith(".dyn.png") or not os.path.exists(os.path.join(after, name)):
            continue
        r = compare(os.path.join(before, name), os.path.join(after, name), os.path.join(out, name), crop)
        report[name] = r
        print(f"  {name:24s} shift {r['scroll_shift_px']:+3d}px  changed {r['changed_pct']:6.2f}%   outside animated regions {r['real_changed_px']:6d} px  {r['real_bbox']}", flush=True)
    with open(os.path.join(out, "report.json"), "w") as f:
        json.dump(report, f, indent=2)


if __name__ == "__main__":
    main()
