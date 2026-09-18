"""Tile every PNG in a folder into one labeled sheet (for quick review)."""
import os, sys
from PIL import Image, ImageDraw
src, out = sys.argv[1], sys.argv[2]
cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
w = int(sys.argv[4]) if len(sys.argv) > 4 else 240
names = sorted(n for n in os.listdir(src) if n.endswith(".png"))
ims = []
for n in names:
    im = Image.open(os.path.join(src, n)).convert("RGB")
    h = int(im.size[1] * w / im.size[0])
    ims.append((n, im.resize((w, h))))
h = ims[0][1].size[1]
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * (w + 8), rows * (h + 22)), "white")
d = ImageDraw.Draw(sheet)
for i, (n, im) in enumerate(ims):
    x, y = (i % cols) * (w + 8), (i // cols) * (h + 22)
    d.text((x + 2, y + 4), n[:-4], fill="black")
    sheet.paste(im, (x, y + 20))
sheet.save(out)
