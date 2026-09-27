"""Write Android-only, right-sized copies of the few oversized PNGs the app actually ships.

Metro resolves `foo.android.png` ahead of `foo.png` when bundling for Android, so this adds
files and changes no code, and iOS keeps the originals byte for byte.

Sizes are 2x the largest place each image is drawn, which covers every phone density the app
targets (the largest is a 3.5x 1440p screen, and these are drawn far smaller than full width).

Usage: python make_android_assets.py [--check]
"""
from __future__ import annotations

import os
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# source, target width, why that width
TARGETS = [
    ("assets/images/car-silhouette-sedan.png", 900,
     "largest draw is CarSilhouette width={scale(200)} on add-vehicle-review (~235dp)"),
    ("assets/images/car-silhouette-suv.png", 900, "same component, suv variant"),
    ("assets/images/car-silhouette-truck.png", 900, "same component, truck variant"),
    ("assets/images/lexus.png", 1050,
     "Oto chat greeting card vehicle art, drawn ~180dp wide"),
]


def main() -> None:
    check = "--check" in sys.argv
    for rel, width, why in TARGETS:
        src = os.path.join(ROOT, rel)
        dst = src[: -len(".png")] + ".android.png"
        with Image.open(src) as im:
            if im.size[0] <= width:
                print(f"skip  {rel} (already {im.size[0]}px wide)")
                continue
            out = im.resize((width, round(im.size[1] * width / im.size[0])), Image.LANCZOS)
            before = os.path.getsize(src)
            if check:
                print(f"would write {dst} {out.size} — {why}")
                continue
            out.save(dst, optimize=True)
            after = os.path.getsize(dst)
            print(f"{rel}: {im.size[0]}x{im.size[1]} {before/1e6:.2f} MB  ->  "
                  f"{out.size[0]}x{out.size[1]} {after/1e6:.2f} MB  ({why})")


if __name__ == "__main__":
    main()
