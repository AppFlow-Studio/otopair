"""Flag capture sets that did not actually photograph the app.

A capture run can go wrong quietly: if the app fails to come up, the taps land on the launcher
and the tooling happily saves twelve screenshots of Chrome. Every screen is compared against the
same screen in the reference build; a set where the top-of-screen shots differ wildly is
reported so it can be re-captured instead of reaching the report.

Usage: python validate_shots.py [reference_label]
"""
from __future__ import annotations

import glob
import os
import sys

from PIL import Image, ImageChops

HERE = os.path.dirname(os.path.abspath(__file__))
EVID = os.path.join(HERE, "evidence")
# Screens that sit at a fixed scroll offset, so a big difference means different content,
# not a different scroll position.
STABLE = ["01_home_top", "03_bookings_top", "05_cars_top", "07_oto"]


def changed_fraction(a_path: str, b_path: str) -> float:
    a = Image.open(a_path).convert("L")
    b = Image.open(b_path).convert("L")
    if a.size != b.size:
        return 1.0
    m = ImageChops.difference(a, b).point(lambda v: 255 if v > 12 else 0)
    return m.histogram()[255] / (a.size[0] * a.size[1])


def main() -> None:
    ref = sys.argv[1] if len(sys.argv) > 1 else "00-baseline"
    bad = []
    for label_dir in sorted(glob.glob(os.path.join(EVID, "*", ""))):
        label = os.path.basename(os.path.dirname(label_dir))
        if label in ("rot", "logcheck", ref):
            continue
        for dev in ("A", "B"):
            shots = os.path.join(EVID, label, dev, "shots")
            if not os.path.isdir(shots):
                continue
            worst = 0.0
            for name in STABLE:
                a = os.path.join(EVID, ref, dev, "shots", f"{name}.png")
                b = os.path.join(shots, f"{name}.png")
                if os.path.exists(a) and os.path.exists(b):
                    worst = max(worst, changed_fraction(a, b))
            flag = "  <-- RE-CAPTURE" if worst > 0.12 else ""
            if flag:
                bad.append((label, dev))
            print(f"{label:12s} {dev}  worst stable-screen difference vs {ref}: {worst*100:5.1f}%{flag}")
    print()
    print("re-capture needed:" if bad else "all capture sets look like the app.",
          ", ".join(f"{l}/{d}" for l, d in bad))


if __name__ == "__main__":
    main()
