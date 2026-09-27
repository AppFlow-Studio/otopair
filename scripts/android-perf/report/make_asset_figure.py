"""Build the A6 figure: the shipped image before and after, at the size it is actually drawn.

The car silhouettes only appear for a car with no photo, so the measured flows never show them.
This renders what a driver would see instead: each image scaled to its largest on-screen size,
plus a 4x zoom on the same detail, so the resampling can be judged rather than asserted.

Usage: python make_asset_figure.py
"""
from __future__ import annotations

import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
OUT = os.path.join(HERE, "extra_img")

# (original, android copy, width it is drawn at on a 3.5x screen, zoom box in DRAWN pixels)
CASES = [
    ("assets/images/car-silhouette-suv.png", "assets/images/car-silhouette-suv.android.png",
     823, (300, 180, 520, 330)),
]


def main() -> None:
    os.makedirs(OUT, exist_ok=True)
    for src, android, draw_w, zbox in CASES:
        a = Image.open(os.path.join(ROOT, src)).convert("RGB")
        b = Image.open(os.path.join(ROOT, android)).convert("RGB")
        h = round(a.size[1] * draw_w / a.size[0])
        # what Android does at draw time: bilinear down-scale of whatever it decoded
        a_drawn = a.resize((draw_w, h), Image.BILINEAR)
        b_drawn = b.resize((draw_w, h), Image.BILINEAR)
        za = a_drawn.crop(zbox).resize(((zbox[2] - zbox[0]) * 3, (zbox[3] - zbox[1]) * 3), Image.NEAREST)
        zb = b_drawn.crop(zbox).resize(((zbox[2] - zbox[0]) * 3, (zbox[3] - zbox[1]) * 3), Image.NEAREST)

        pad, label_h = 16, 26
        w = draw_w * 2 + pad * 3
        sheet = Image.new("RGB", (w, label_h + h + pad + label_h + za.size[1] + pad), (255, 255, 255))
        d = ImageDraw.Draw(sheet)
        sa = os.path.getsize(os.path.join(ROOT, src)) / 1e6
        sb = os.path.getsize(os.path.join(ROOT, android)) / 1e6
        d.text((pad, 6), f"before — {a.size[0]}x{a.size[1]} source, {sa:.2f} MB", fill=(40, 48, 58))
        d.text((pad * 2 + draw_w, 6), f"after — {b.size[0]}x{b.size[1]} android copy, {sb:.2f} MB",
               fill=(40, 48, 58))
        sheet.paste(a_drawn, (pad, label_h))
        sheet.paste(b_drawn, (pad * 2 + draw_w, label_h))
        y = label_h + h + pad
        d.text((pad, y + 4), "3x zoom, same detail", fill=(110, 120, 132))
        d.text((pad * 2 + draw_w, y + 4), "3x zoom, same detail", fill=(110, 120, 132))
        sheet.paste(za, (pad, y + label_h))
        sheet.paste(zb, (pad * 2 + draw_w, y + label_h))
        name = os.path.basename(src).replace(".png", "-compare.jpg")
        sheet.save(os.path.join(OUT, name), quality=88, optimize=True)
        print(f"wrote {os.path.join(OUT, name)}  ({a.size[0]}px source vs {b.size[0]}px, drawn at {draw_w}px)")


if __name__ == "__main__":
    main()
