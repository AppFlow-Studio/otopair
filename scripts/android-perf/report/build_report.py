"""Build the Android performance report page from the evidence folders.

Inputs
  items.json                          one entry per optimisation, hand-written prose + pointers
  ../evidence/<label>/<A|B>/perf_run*.json   perf runs per build and device
  ../evidence/<label>/<A|B>/diff/<state>.png before | after | diff composites
  patches/<id>.patch                  the code change for that item

Output
  out/index.html and out/img/*.jpg    the page and its images, ready to publish

Usage: python build_report.py
"""
from __future__ import annotations

import html
import json
import os
import shutil
import statistics
import subprocess
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
EVID = os.path.abspath(os.path.join(HERE, "..", "evidence"))
OUT = os.path.join(HERE, "out")
IMG = os.path.join(OUT, "img")
sys.path.insert(0, os.path.dirname(HERE))
from summarize import load, paired  # noqa: E402
from items_prose import EXEC_HTML, ITEMS, IOS_HTML, JS_HTML, METHOD_HTML, NOT_DONE_HTML, PAGE  # noqa: E402

DEVICES = {"A": "Budget · Android 9 · 720×1280 · 2 cores",
           "B": "Pixel · Android 14 · 1080×2400 · 4 cores"}
# Metric label, and whether lower is better (all of these: yes)
METRIC_LABELS = [("settle_s", "settle s"), ("fs_frames", "frames drawn"),
                 ("fs_mean_ms", "frame mean ms"), ("fs_p90_ms", "frame p90 ms"),
                 ("rt_mean_ms", "RenderThread ms/frame"), ("ui_mean_ms", "UI thread ms/frame"),
                 ("cpu_ms", "CPU ms"), ("cpu_rt_ms", "CPU RenderThread ms"), ("cpu_js_ms", "CPU JS ms")]


def jpeg(src: str, name: str, width: int = 1180, quality: int = 78, crop=None) -> str | None:
    """Copy one evidence PNG into the report as a width-limited JPEG."""
    if not os.path.exists(src):
        return None
    im = Image.open(src).convert("RGB")
    if crop:
        im = im.crop(crop)
    if im.size[0] > width:
        im = im.resize((width, round(im.size[1] * width / im.size[0])), Image.LANCZOS)
    os.makedirs(IMG, exist_ok=True)
    im.save(os.path.join(IMG, name), quality=quality, optimize=True)
    return f"img/{name}"


def diff_report(label: str, dev: str) -> dict:
    p = os.path.join(EVID, label, dev, "diff", "report.json")
    if not os.path.exists(p):
        return {}
    with open(p) as f:
        return json.load(f)


def metric_cell(r: dict) -> str:
    d = r["delta_pct"]
    if d is None:
        return "<td>—</td>"
    good = d < 0
    cls = ("clear " if r["clear"] else "noise ") + ("good" if good else "bad")
    arrow = "↓" if good else "↑"
    fmt = lambda v: f"{v:.2f}" if abs(v) < 10 and v != int(v) else f"{v:.0f}"
    agree = f' <span class="agree">{r["pairs_better"]}/{r["pairs"]}</span>'
    return (f'<td class="{cls}"><span class="nums">{fmt(r["before"])} → {fmt(r["after"])}</span>'
            f'<span class="delta">{arrow} {abs(d):.0f}%{agree}</span></td>')


def perf_table(item: dict, dev: str) -> str:
    import glob as _glob
    bp = sorted(_glob.glob(os.path.join(EVID, "rot", item["before_label"], dev, "run*.json")))
    ap = sorted(_glob.glob(os.path.join(EVID, "rot", item["after_label"], dev, "run*.json")))
    n = min(len(bp), len(ap))
    if n == 0:
        return f'<p class="muted">No rotation rounds recorded on this device for {html.escape(item["id"])}.</p>'
    rows = paired(bp[:n], ap[:n])
    before = {"runs": n}
    after = {"runs": n}
    keep = item.get("actions")
    head = "".join(f"<th>{lbl}</th>" for _, lbl in METRIC_LABELS)
    body = []
    for row in rows:
        if keep and not any(k in row["action"] for k in keep):
            continue
        cells = []
        for m, _ in METRIC_LABELS:
            r = row["metrics"].get(m)
            cells.append(metric_cell(r) if r else "<td>—</td>")
        body.append(f'<tr><th scope="row">{html.escape(row["action"])}</th>{"".join(cells)}</tr>')
    return (f'<div class="tablewrap"><table class="perf"><caption>{html.escape(DEVICES[dev])} · '
            f'{n} paired rounds · median of per-round deltas · the small figure is how many rounds agreed; '
            f'a coloured delta means all of them did'
            f'</caption><thead><tr><th scope="col">flow</th>{head}</tr></thead><tbody>'
            f'{"".join(body)}</tbody></table></div>')


def headline(item: dict) -> str:
    """One line for the summary table, taken from the measurements rather than written by hand.

    Picks the largest improvement that every round agreed on, across both devices; says so plainly
    when nothing cleared the noise.
    """
    if item.get("headline"):
        return item["headline"]
    import glob as _glob
    best = None
    for dev in ("A", "B"):
        bp = sorted(_glob.glob(os.path.join(EVID, "rot", item["before_label"], dev, "run*.json")))
        ap = sorted(_glob.glob(os.path.join(EVID, "rot", item["after_label"], dev, "run*.json")))
        n = min(len(bp), len(ap))
        if not n:
            continue
        for row in paired(bp[:n], ap[:n]):
            for m, r in row["metrics"].items():
                if not r["clear"] or r["delta_pct"] >= -5:
                    continue
                if best is None or r["delta_pct"] < best[0]:
                    best = (r["delta_pct"], row["action"], dict(METRIC_LABELS)[m], dev, r)
    if not best:
        return '<span class="muted">nothing outside run-to-run noise</span>'
    d, action, label, dev, r = best
    fmt = lambda v: f"{v:.2f}" if abs(v) < 10 and v != int(v) else f"{v:.0f}"
    who = "budget phone" if dev == "A" else "Pixel"
    return (f'{label} on <b>{html.escape(action)}</b> {fmt(r["before"])} → {fmt(r["after"])} '
            f'(<b>{abs(d):.0f}% lower</b>, {who}, {r["pairs_better"]}/{r["pairs"]} rounds)')


def visual_block(item: dict) -> str:
    """before | after | diff composites for the states this item names, per device."""
    out = []
    skip = item.get("skip_devices", [])
    for dev in [d for d in ("A", "B") if d not in skip]:
        rep = diff_report(item["after_label"], dev)
        figs = []
        for state in item.get("states", []):
            src = os.path.join(EVID, item["after_label"], dev, "diff", f"{state}.png")
            rel = jpeg(src, f'{item["id"]}-{dev}-{state}.jpg')
            if not rel:
                continue
            r = rep.get(f"{state}.png", {})
            changed = r.get("real_changed_px")
            note = ("identical" if changed == 0 else
                    f'{changed:,} px differ outside animated regions' if changed is not None else "")
            shift = r.get("scroll_shift_px")
            if shift:
                note += f" · scroll offset differed by {shift:+d} px between runs"
            figs.append(f'<figure><img loading="lazy" src="{rel}" alt="{html.escape(state)} before, after and '
                        f'difference on {html.escape(DEVICES[dev])}">'
                        f'<figcaption><b>{html.escape(state)}</b> — before | after | changed pixels'
                        f'{" · " + html.escape(note) if note else ""}</figcaption></figure>')
        if figs:
            out.append(f'<h4>{html.escape(DEVICES[dev])}</h4>{"".join(figs)}')
    # pixel-change table across every captured screen
    tbl = []
    for dev in [d for d in ("A", "B") if d not in skip]:
        rep = diff_report(item["after_label"], dev)
        if not rep:
            continue
        cells = []
        for state, r in sorted(rep.items()):
            px = r.get("real_changed_px")
            cls = "ok" if px == 0 else "warn"
            cells.append(f'<tr><th scope="row">{html.escape(state[:-4])}</th>'
                         f'<td class="{cls}">{px:,}</td><td>{r.get("scroll_shift_px", 0):+d}</td></tr>')
        tbl.append(f'<div class="tablewrap"><table class="pixels"><caption>{html.escape(DEVICES[dev])} — pixels '
                   f'differing outside animated regions, every captured screen</caption><thead><tr><th>screen</th>'
                   f'<th>changed px</th><th>scroll offset</th></tr></thead><tbody>{"".join(cells)}</tbody></table></div>')
    return "".join(out) + "".join(tbl)


def crop_block(item: dict) -> str:
    """Before and after, cropped to the part of the screen the change is about, at full pixels.

    A 400px-wide thumbnail of a whole phone screen hides exactly the detail a reviewer needs for
    something like a tab bar tint, so each item can name a region to show life-size.
    """
    figs = []
    for spec in item.get("crops", []):
        dev = spec.get("dev", "A")
        box = tuple(spec["box"])
        pair = []
        for label in (item["before_label"], item["after_label"]):
            src = os.path.join(EVID, label, dev, "shots", f'{spec["state"]}.png')
            if not os.path.exists(src):
                pair = []
                break
            pair.append(Image.open(src).convert("RGB").crop(box))
        if not pair:
            continue
        w, h = pair[0].size
        gap, label_h = 14, 22
        sheet = Image.new("RGB", (w * 2 + gap, h + label_h), (255, 255, 255))
        d = ImageDraw.Draw(sheet)
        d.text((2, 4), "before", fill=(90, 100, 112))
        d.text((w + gap + 2, 4), "after", fill=(90, 100, 112))
        sheet.paste(pair[0], (0, label_h))
        sheet.paste(pair[1], (w + gap, label_h))
        name = f'{item["id"]}-crop-{spec["state"]}-{dev}.png'
        os.makedirs(IMG, exist_ok=True)
        sheet.save(os.path.join(IMG, name))
        figs.append(f'<figure><img loading="lazy" src="img/{name}" alt="{html.escape(spec.get("caption", ""))}">'
                    f'<figcaption>{html.escape(spec.get("caption", ""))} · '
                    f'{html.escape(DEVICES[dev])}, actual pixels</figcaption></figure>')
    return "".join(figs)


def diff_html(item: dict) -> str:
    p = os.path.join(HERE, "patches", f'{item["id"]}.patch')
    if not os.path.exists(p):
        return ""
    lines = []
    with open(p, encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            cls = ("meta" if line.startswith(("diff ", "index ", "--- ", "+++ ", "@@")) else
                   "add" if line.startswith("+") else "del" if line.startswith("-") else "ctx")
            lines.append(f'<span class="{cls}">{html.escape(line) or "&nbsp;"}</span>')
    return f'<div class="diff"><pre>{chr(10).join(lines)}</pre></div>'


def build() -> None:
    doc = dict(PAGE)
    doc["items"] = ITEMS
    doc["intro_html"] = EXEC_HTML + JS_HTML + METHOD_HTML
    doc["outro_html"] = NOT_DONE_HTML + IOS_HTML
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(IMG, exist_ok=True)
    # figures built outside the evidence pipeline (see make_asset_figure.py)
    extra = os.path.join(HERE, "extra_img")
    if os.path.isdir(extra):
        for name in os.listdir(extra):
            shutil.copy(os.path.join(extra, name), os.path.join(IMG, name))

    nav = "".join(f'<a href="#{i["id"]}">{i["id"]}</a>' for i in doc["items"])
    verdict_rows = []
    for i in doc["items"]:
        verdict_rows.append(
            f'<tr><th scope="row"><a href="#{i["id"]}">{i["id"]}</a></th><td>{html.escape(i["title"])}</td>'
            f'<td><span class="chip {i["verdict"]}">{html.escape(i["verdict_label"])}</span></td>'
            f'<td>{headline(i)}</td></tr>')

    sections = []
    for i in doc["items"]:
        extras = "".join(f'<h4>{html.escape(x["title"])}</h4>{x["html"]}' for x in i.get("extra", []))
        files = "".join(f'<li><code>{html.escape(f)}</code></li>' for f in i.get("files", []))
        sections.append(f'''
<section id="{i["id"]}">
  <header class="item-head">
    <div>
      <p class="eyebrow">{html.escape(i.get("group", ""))}</p>
      <h2>{i["id"]} · {html.escape(i["title"])}</h2>
    </div>
    <span class="chip {i["verdict"]}">{html.escape(i["verdict_label"])}</span>
  </header>
  <div class="prose">{i["why"]}</div>
  {f"<h3>Files touched</h3><ul class='files'>{files}</ul>" if files else ""}
  <h3>The change</h3>
  <div class="prose">{i.get("what", "")}</div>
  {diff_html(i)}
  {f'<h3>Measured</h3>{perf_table(i, "A")}{perf_table(i, "B")}' if i.get("measured", True) else ""}
  {f'<h3>Pixels</h3>{crop_block(i)}{visual_block(i)}' if i.get("states") or i.get("show_pixels", True) else ""}
  {extras}
</section>''')

    page = f'''<title>{doc["page_title"]}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Urbanist:wght@500;700;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
:root {{
  --ground:#eef2f7; --surface:#ffffff; --surface-2:#f7f9fc; --ink:#141c24; --ink-2:#44515f;
  --muted:#6c7887; --line:#d9e1ea; --accent:#2f6fd0; --accent-soft:#e7f0fd;
  --good:#0f7a52; --good-soft:#e2f4ec; --bad:#b3341f; --bad-soft:#fbe9e5; --warn:#8a6100; --warn-soft:#fdf2da;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --body:"IBM Plex Sans",system-ui,-apple-system,Segoe UI,sans-serif;
  --display:"Urbanist",var(--body);
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --ground:#0d1218; --surface:#151d26; --surface-2:#1a232e; --ink:#e7eef6; --ink-2:#bac6d4;
    --muted:#8d9baa; --line:#2a3644; --accent:#7fb0ff; --accent-soft:#16283f;
    --good:#6cd0a4; --good-soft:#12291f; --bad:#ff9b85; --bad-soft:#2c1712; --warn:#e8bf6a; --warn-soft:#2a2212;
  }}
}}
:root[data-theme="dark"] {{
  --ground:#0d1218; --surface:#151d26; --surface-2:#1a232e; --ink:#e7eef6; --ink-2:#bac6d4;
  --muted:#8d9baa; --line:#2a3644; --accent:#7fb0ff; --accent-soft:#16283f;
  --good:#6cd0a4; --good-soft:#12291f; --bad:#ff9b85; --bad-soft:#2c1712; --warn:#e8bf6a; --warn-soft:#2a2212;
}}
body {{ background:var(--ground); color:var(--ink); font-family:var(--body); font-size:15px; line-height:1.6; }}
.wrap {{ max-width:1180px; margin:0 auto; padding-inline:16px; padding-block:0 64px; }}
h1,h2,h3,h4 {{ font-family:var(--display); text-wrap:balance; margin:0; }}
h1 {{ font-size:clamp(28px,4.4vw,44px); font-weight:800; letter-spacing:-0.02em; }}
h2 {{ font-size:clamp(20px,2.6vw,27px); font-weight:700; letter-spacing:-0.01em; }}
h3 {{ font-size:15px; font-weight:700; text-transform:uppercase; letter-spacing:0.08em; color:var(--muted);
      margin:28px 0 10px; }}
h4 {{ font-size:14px; font-weight:700; color:var(--ink-2); margin:20px 0 8px; }}
p {{ margin:0 0 12px; }}
a {{ color:var(--accent); }}
code {{ font-family:var(--mono); font-size:0.88em; background:var(--surface-2); border:1px solid var(--line);
        border-radius:4px; padding:1px 5px; }}
.prose {{ max-width:70ch; color:var(--ink-2); }}
.prose b, .prose strong {{ color:var(--ink); }}
header.page {{ padding-block:44px 8px; }}
.eyebrow {{ font-family:var(--mono); font-size:11px; letter-spacing:0.14em; text-transform:uppercase;
            color:var(--muted); margin:0 0 6px; }}
.lede {{ font-size:17px; max-width:72ch; color:var(--ink-2); }}
nav.items {{ position:sticky; top:env(safe-area-inset-top,0px); z-index:5; display:flex; flex-wrap:wrap; gap:6px;
             background:color-mix(in srgb, var(--ground) 88%, transparent); backdrop-filter:blur(8px);
             padding:10px 0; border-bottom:1px solid var(--line); margin-bottom:8px; }}
nav.items a {{ font-family:var(--mono); font-size:12px; text-decoration:none; color:var(--ink-2);
               border:1px solid var(--line); background:var(--surface); border-radius:999px; padding:3px 10px; }}
nav.items a:hover {{ border-color:var(--accent); color:var(--accent); }}
section {{ background:var(--surface); border:1px solid var(--line); border-radius:14px; padding:22px;
           margin-top:22px; }}
.item-head {{ display:flex; gap:14px; align-items:flex-start; justify-content:space-between; flex-wrap:wrap;
              margin-bottom:12px; }}
.chip {{ font-family:var(--mono); font-size:11px; letter-spacing:0.06em; text-transform:uppercase;
         padding:4px 9px; border-radius:999px; white-space:nowrap; }}
.chip.kept {{ background:var(--good-soft); color:var(--good); }}
.chip.reverted {{ background:var(--bad-soft); color:var(--bad); }}
.chip.skipped, .chip.pending {{ background:var(--warn-soft); color:var(--warn); }}
ul.files {{ margin:0; padding-left:18px; }}
ul.files li {{ margin:2px 0; }}
.tablewrap {{ overflow-x:auto; margin:10px 0 16px; }}
table {{ border-collapse:collapse; width:100%; font-size:13px; }}
caption {{ caption-side:top; text-align:left; color:var(--muted); font-size:12px; padding-bottom:6px; }}
th, td {{ border-bottom:1px solid var(--line); padding:6px 9px; text-align:left; vertical-align:top; }}
thead th {{ font-family:var(--mono); font-size:11px; text-transform:uppercase; letter-spacing:0.05em;
            color:var(--muted); font-weight:500; }}
tbody th {{ font-weight:600; font-size:12.5px; }}
td {{ font-variant-numeric:tabular-nums; white-space:nowrap; }}
td .nums {{ display:block; }}
td .delta {{ display:block; font-family:var(--mono); font-size:11px; }}
td .agree {{ color:var(--muted); font-size:10px; }}
td.clear .delta {{ font-weight:600; }}
td.clear.good .delta {{ color:var(--good); }}
td.clear.bad .delta {{ color:var(--bad); }}
td.noise .delta {{ color:var(--muted); }}
td.ok {{ color:var(--good); }}
td.warn {{ color:var(--warn); }}
.tilde {{ font-family:var(--mono); }}
table.summary td:last-child {{ white-space:normal; }}
.diff {{ overflow-x:auto; background:var(--surface-2); border:1px solid var(--line); border-radius:10px;
         padding:10px 0; }}
.diff pre {{ margin:0; font-family:var(--mono); font-size:12px; line-height:1.55; }}
.diff span {{ display:block; padding:0 14px; white-space:pre; }}
.diff .add {{ background:var(--good-soft); color:var(--good); }}
.diff .del {{ background:var(--bad-soft); color:var(--bad); }}
.diff .meta {{ color:var(--muted); }}
figure {{ margin:0 0 18px; }}
figure img {{ width:100%; max-width:100%; border:1px solid var(--line); border-radius:8px; background:var(--surface-2); }}
figcaption {{ font-size:12px; color:var(--muted); margin-top:5px; }}
.muted {{ color:var(--muted); }}
.note {{ background:var(--accent-soft); border:1px solid var(--line); border-left:3px solid var(--accent);
         border-radius:8px; padding:12px 14px; margin:12px 0; }}
.note.warn {{ background:var(--warn-soft); border-left-color:var(--warn); }}
@media (max-width:640px) {{ section {{ padding:16px 13px; }} }}
</style>
<div class="wrap">
<header class="page">
  <p class="eyebrow">{doc["eyebrow"]}</p>
  <h1>{doc["heading"]}</h1>
  <div class="lede">{doc["lede"]}</div>
</header>
<nav class="items" aria-label="Optimisations">{nav}</nav>
{doc["intro_html"]}
<section id="summary">
  <h2>Every change, and whether it earned its place</h2>
  <div class="tablewrap"><table class="summary"><thead><tr><th>item</th><th>change</th><th>verdict</th>
  <th>what the numbers said</th></tr></thead><tbody>{"".join(verdict_rows)}</tbody></table></div>
</section>
{"".join(sections)}
{doc.get("outro_html", "")}
</div>'''
    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, "index.html"), "w", encoding="utf-8") as f:
        f.write(page)
    n = len(os.listdir(IMG)) if os.path.isdir(IMG) else 0
    size = sum(os.path.getsize(os.path.join(IMG, x)) for x in os.listdir(IMG)) if n else 0
    print(f"wrote {os.path.join(OUT, 'index.html')} ({os.path.getsize(os.path.join(OUT, 'index.html'))/1024:.0f} KB)"
          f" + {n} images ({size/1e6:.1f} MB)")


if __name__ == "__main__":
    build()
