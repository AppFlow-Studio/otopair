"""Drive the app to a fixed list of screens and save a full-resolution screenshot of each.

Run once on the build before a change and once on the build after it, then compare the
two folders with diff_states.py. Scrolls use slow drags (below Android's minimum fling
velocity) so they land on the same offset every run instead of depending on momentum.

Usage:
  python capture_states.py emulator-5554 evidence/A1/before
"""
from __future__ import annotations

import io
import os
import subprocess
import sys
import time

from PIL import Image, ImageChops, ImageStat

from perf_compare import PKG, Android


def slow_drag_up(dev: Android, fraction: float = 0.45) -> None:
    density = int(dev.sh("wm density").split(":")[-1].strip().split()[0])
    min_fling = 50 * density / 160  # px/s, ViewConfiguration.getScaledMinimumFlingVelocity
    y1, y2 = int(dev.h * 0.78), int(dev.h * (0.78 - fraction))
    ms = int((y1 - y2) / (0.55 * min_fling) * 1000)
    dev.sh(f"input swipe {dev.w // 2} {y1} {dev.w // 2} {y2} {ms}")


def grab(dev: Android) -> bytes:
    return subprocess.run([dev.adb, "-s", dev.serial, "exec-out", "screencap", "-p"],
                          capture_output=True, timeout=30).stdout


def shot(dev: Android, out: str, name: str, burst: int = 5) -> None:
    """Save the screen, then a mask of every pixel that changed on its own over a short burst.

    The mask marks regions the app animates without input (typewriter text, avatar slide,
    pulsing dots, map tiles) so diffs between builds can tell those apart from real changes.
    """
    if not dev.foreground():
        # one attempt to recover: relaunch and go back to the tab we were asked for
        print(f"  !! {PKG} not in front before {name}; relaunching", flush=True)
        dev.restart_app()
        if not dev.foreground():
            raise SystemExit(f"aborting capture: {PKG} is not the foreground app")
    png = grab(dev)
    with open(os.path.join(out, f"{name}.png"), "wb") as f:
        f.write(png)
    first = Image.open(io.BytesIO(png)).convert("RGB")
    mask = Image.new("L", first.size, 0)
    for _ in range(burst):
        time.sleep(0.9)
        nxt = Image.open(io.BytesIO(grab(dev))).convert("RGB")
        if nxt.size == first.size:
            m = ImageChops.difference(first, nxt).convert("L").point(lambda v: 255 if v > 12 else 0)
            mask = ImageChops.lighter(mask, m)
    mask.save(os.path.join(out, f"{name}.dyn.png"))
    print(f"  {name}  (animated px: {mask.histogram()[255]})", flush=True)


def tab(dev: Android, label: str, wait: float) -> bool:
    xy = dev.find(label, bottom_most=True)
    if not xy:
        print(f"  !! tab {label} not found", flush=True)
        return False
    dev.tap(xy)
    time.sleep(wait)
    return True


def main() -> None:
    dev = Android(sys.argv[1])
    out = sys.argv[2]
    os.makedirs(out, exist_ok=True)
    print(f"== {dev.name} -> {out}", flush=True)

    dev.restart_app()
    if not dev.foreground():
        dev.restart_app()
        if not dev.foreground():
            raise SystemExit(f"aborting capture: {PKG} did not come to the foreground")
    tab(dev, "Home", 6)
    shot(dev, out, "01_home_top")
    for i in range(1, 4):
        slow_drag_up(dev)
        time.sleep(2)
        shot(dev, out, f"02_home_scroll{i}")

    if tab(dev, "Bookings", 6):
        shot(dev, out, "03_bookings_top")
        slow_drag_up(dev)
        time.sleep(2)
        shot(dev, out, "04_bookings_scroll1")

    if tab(dev, "Cars", 8):
        shot(dev, out, "05_cars_top")
        for i in range(1, 4):
            slow_drag_up(dev)
            time.sleep(2)
            shot(dev, out, f"06_cars_scroll{i}")

    if tab(dev, "Oto", 8):
        shot(dev, out, "07_oto")

    # Fresh process so Home is at scroll offset 0 and "Map" is on screen.
    dev.restart_app()
    tab(dev, "Home", 5)
    xy = dev.find("Map")
    if xy:
        dev.tap(xy)
        # The budget AVD sometimes sits on a blank white screen for a while before the booking
        # map appears; wait until the frame has real content instead of a fixed delay.
        t0 = time.time()
        while time.time() - t0 < 30:
            img = Image.open(io.BytesIO(grab(dev))).convert("L")
            if ImageStat.Stat(img.crop((0, img.size[1] // 8, img.size[0], img.size[1] * 3 // 4))).stddev[0] > 25:
                break
            time.sleep(1)
        print(f"  booking flow content after {time.time() - t0:.1f}s", flush=True)
        time.sleep(6)
        shot(dev, out, "08_booking_flow")
    else:
        print("  !! Map not found", flush=True)

    dev.sh(f"am force-stop {PKG}")


if __name__ == "__main__":
    main()
