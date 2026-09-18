"""Cross-platform responsiveness harness: same flows on iPhone (WDA) and Android (adb).

For every action: resolve the target first (not timed), send the input, start the clock,
then poll screenshots until the screen stops changing. "settle_s" is when the screen
first reached the state it then held. Resolution is limited by screenshot latency,
which is reported alongside so the numbers can be read honestly.

Never submits bookings or sends chat messages: flows only switch tabs, scroll, and open
the booking flow's first screen.

Usage:
  python perf_compare.py ios
  python perf_compare.py android emulator-5556 [out.json]
"""
from __future__ import annotations

import base64
import io
import json
import os
import re
import statistics
import subprocess
import sys
import time

from PIL import Image, ImageChops, ImageStat

HERE = os.path.dirname(os.path.abspath(__file__))
RIG = r"C:\Users\manso\Desktop\Remote-phone"
PKG = "com.otopair.app"
SETTLE_DIFF = 1.5      # mean abs grayscale diff (0-255) below which two frames count as "same"
SETTLE_TIMEOUT = 15.0
TABS = ["Home", "Bookings", "Cars", "Oto", "Home"]


def host_load() -> dict:
    """Host GPU utilisation and CPU load. The emulators render through the host GPU, so a
    game or a browser on the desktop inflates every RenderThread number; recording it makes
    a contaminated run obvious instead of silently wrong."""
    out = {}
    try:
        g = subprocess.run(["nvidia-smi", "--query-gpu=utilization.gpu", "--format=csv,noheader,nounits"],
                           capture_output=True, text=True, timeout=10).stdout.strip().splitlines()
        if g:
            out["host_gpu_pct"] = int(g[0])
    except Exception:
        pass
    try:
        c = subprocess.run(["powershell", "-NoProfile", "-Command",
                            "(Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average"],
                           capture_output=True, text=True, timeout=20).stdout.strip()
        if c:
            out["host_cpu_pct"] = int(float(c))
    except Exception:
        pass
    return out


def small_gray(png_bytes: bytes) -> Image.Image:
    img = Image.open(io.BytesIO(png_bytes)).convert("L")
    img.thumbnail((120, 260))
    return img


def diff(a: Image.Image, b: Image.Image) -> float:
    if a.size != b.size:
        b = b.resize(a.size)
    return ImageStat.Stat(ImageChops.difference(a, b)).mean[0]


# --------------------------------------------------------------------------- backends
class IOS:
    name = "iPhone 15 Pro (iOS 26.2, production build)"

    def __init__(self):
        sys.path.insert(0, os.path.join(RIG, "server"))
        from wda_client import WDAClient  # noqa: E402

        self.wda = WDAClient("http://127.0.0.1:8100")
        self.wda.ensure_session()
        # XCTest otherwise waits for the app to go idle before every tap (10s + 2s cool-off);
        # an app with never-ending animations never idles, so taps would hang and skew timings.
        self.wda._req("POST", "/appium/settings",
                      json={"settings": {"waitForIdleTimeout": 0, "animationCoolOffTimeout": 0}})
        size = self.wda._req("GET", "/window/size")
        self.w, self.h = size["width"], size["height"]

    def screen(self) -> Image.Image:
        b64 = self.wda._req("GET", "/screenshot", sessioned=False)
        return small_gray(base64.b64decode(b64))

    def find(self, label: str, bottom_most: bool = False):
        hits = [e for e in self.wda.elements() if (e.get("label") or "").strip() == label and e.get("rect")]
        hits = [e for e in hits if e["rect"]["width"] > 4 and e["rect"]["height"] > 4 and 0 <= e["rect"]["y"] < self.h]
        if not hits:
            return None
        e = max(hits, key=lambda e: e["rect"]["y"]) if bottom_most else hits[0]
        r = e["rect"]
        return (r["x"] + r["width"] / 2, r["y"] + r["height"] / 2)

    def tap(self, xy):
        self.wda.tap_xy(*xy)

    def swipe_up(self):
        self.wda.swipe(self.w / 2, self.h * 0.72, self.w / 2, self.h * 0.30, 0.15)

    def swipe_down(self):
        self.wda.swipe(self.w / 2, self.h * 0.30, self.w / 2, self.h * 0.72, 0.15)

    def restart_app(self):
        env = dict(os.environ, ENABLE_GO_IOS_AGENT="user")
        ios = os.path.join(RIG, "tools", "go-ios", "ios.exe")
        subprocess.run([ios, "kill", PKG], env=env, capture_output=True, timeout=30)
        time.sleep(1)
        subprocess.run([ios, "launch", PKG], env=env, capture_output=True, timeout=30)
        time.sleep(8)
        # Cold start shows the intro ("Your car, sorted." / "Skip for now") every launch.
        skip = self.find("Skip for now")
        if skip:
            self.tap(skip)
            time.sleep(5)

    def frame_stats_reset(self):
        pass

    def frame_stats(self):
        return None

    def window_begin(self):
        pass

    def cpu_window(self):
        return {}


class Android:
    def __init__(self, serial: str):
        self.serial = serial
        self.adb = os.path.join(os.environ["LOCALAPPDATA"], "Android", "Sdk", "platform-tools", "adb.exe")
        rel = self.sh("getprop ro.build.version.release").strip()
        size = re.search(r"(\d+)x(\d+)", self.sh("wm size")).groups()
        self.w, self.h = int(size[0]), int(size[1])
        self.name = f"{serial} (Android {rel}, {self.w}x{self.h}, android-repair release build)"

    def sh(self, cmd: str) -> str:
        return subprocess.run([self.adb, "-s", self.serial, "shell", cmd], capture_output=True,
                              text=True, timeout=60).stdout.replace("\r", "")

    def screen(self) -> Image.Image:
        png = subprocess.run([self.adb, "-s", self.serial, "exec-out", "screencap", "-p"],
                             capture_output=True, timeout=30).stdout
        return small_gray(png)

    def find(self, label: str, bottom_most: bool = False):
        # Android 9's uiautomator refuses to dump while the app never goes idle (Home's
        # typewriter placeholder keeps it busy), so retry, and remember where the tab bar
        # buttons were: they never move, so a cached position is as good as a fresh one.
        cache_path = os.path.join(HERE, "perf", f"positions-{self.serial}.json")
        cache = {}
        if os.path.exists(cache_path):
            with open(cache_path) as f:
                cache = json.load(f)
        key = f"{label}|{bottom_most}"
        for _ in range(4):
            xy = self._find_once(label, bottom_most)
            if xy:
                if bottom_most and label in ("Home", "Bookings", "Cars", "Oto"):
                    cache[key] = xy
                    os.makedirs(os.path.dirname(cache_path), exist_ok=True)
                    with open(cache_path, "w") as f:
                        json.dump(cache, f)
                return xy
            if key in cache and self.foreground():
                return tuple(cache[key])
            time.sleep(0.7)
        return None

    def _find_once(self, label: str, bottom_most: bool):
        # A failed dump leaves the previous file behind; delete it so stale XML from an
        # earlier screen can never be matched.
        self.sh("rm -f /sdcard/ui.xml; uiautomator dump /sdcard/ui.xml")
        xml = subprocess.run([self.adb, "-s", self.serial, "exec-out", "cat", "/sdcard/ui.xml"],
                             capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=30).stdout
        hits = []
        for node in re.findall(r"<node [^>]*>", xml):
            t = re.search(r'text="([^"]*)"', node)
            d = re.search(r'content-desc="([^"]*)"', node)
            if (t and t.group(1).strip() == label) or (d and d.group(1).strip() == label):
                b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', node)
                if b:
                    x1, y1, x2, y2 = map(int, b.groups())
                    if x2 - x1 > 10 and y2 - y1 > 10:
                        hits.append(((x1 + x2) / 2, (y1 + y2) / 2))
        if not hits:
            return None
        return max(hits, key=lambda p: p[1]) if bottom_most else hits[0]

    def tap(self, xy):
        self.sh(f"input tap {int(xy[0])} {int(xy[1])}")

    def swipe_up(self):
        self.sh(f"input swipe {self.w // 2} {int(self.h * 0.72)} {self.w // 2} {int(self.h * 0.30)} 150")

    def swipe_down(self):
        self.sh(f"input swipe {self.w // 2} {int(self.h * 0.30)} {self.w // 2} {int(self.h * 0.72)} 150")

    def restart_app(self):
        self.sh(f"am force-stop {PKG}")
        self.sh(f"monkey -p {PKG} -c android.intent.category.LAUNCHER 1")
        time.sleep(30 if self.w <= 720 else 18)
        skip = self.find("Skip")
        if skip:
            self.tap(skip)
            time.sleep(5)

    def foreground(self) -> bool:
        """Is the app the focused window? A capture of the launcher or of Chrome looks like a
        screenshot to the tooling, so every screen grab has to check first."""
        out = self.sh("dumpsys window windows | grep -E 'mCurrentFocus|mFocusedApp'")
        if not out.strip():
            out = self.sh("dumpsys activity activities | grep -E 'ResumedActivity|mResumedActivity'")
        return PKG in out

    def cpu_ticks(self) -> dict:
        """Per-thread CPU ticks (utime+stime) for the app process, grouped by thread name."""
        pid = self.sh(f"pidof {PKG}").strip().split()
        if not pid:
            return {}
        out = self.sh(f"cat /proc/{pid[0]}/task/*/stat")
        ticks: dict = {}
        for line in out.splitlines():
            m = re.match(r"\d+ \((.*)\) \S+ (?:\S+ ){10}(\d+) (\d+)", line)
            if m:
                name = re.sub(r"[-_:]?\d+$", "", m.group(1))  # fold pool-1-thread-3 etc.
                ticks[name] = ticks.get(name, 0) + int(m.group(2)) + int(m.group(3))
        return ticks

    def frame_stats_reset(self):
        self.sh(f"dumpsys gfxinfo {PKG} reset")

    def frame_stats(self):
        out = self.sh(f"dumpsys gfxinfo {PKG} framestats")
        def grab(pat):
            m = re.search(pat, out)
            return m.group(1) if m else None
        stats = {
            "frames": grab(r"Total frames rendered: (\d+)"),
            "janky_pct": grab(r"Janky frames: \d+ \(([\d.]+)%\)"),
            # gfxinfo's own percentiles come from coarse histogram buckets (81/105/117/133/150/200 ms
            # on slow devices), so they can't show a 10-20% change; the fs_* values below are exact.
            "p50_ms": grab(r"50th percentile: (\d+)ms"),
            "p90_ms": grab(r"90th percentile: (\d+)ms"),
            "p99_ms": grab(r"99th percentile: (\d+)ms"),
        }
        stats.update(framestats(out))
        return stats

    def window_begin(self):
        self.frame_stats_reset()
        self._pid0 = self.sh(f"pidof {PKG}").strip()
        self._cpu0 = self.cpu_ticks()

    def cpu_window(self) -> dict:
        """CPU the app used since window_begin, in ms (ticks are 10 ms), split by thread role."""
        c1 = self.cpu_ticks()
        d = {k: (c1[k] - self._cpu0.get(k, 0)) * 10 for k in c1 if c1[k] - self._cpu0.get(k, 0) > 0}
        js = sum(v for k, v in d.items() if k.startswith("mqt_") and "js" in k)
        top = dict(sorted(d.items(), key=lambda kv: -kv[1])[:8])
        # The budget device kills the app on booking entry now and then. A window measured on a
        # dead process reads as zero work, which would look like a spectacular improvement, so
        # say plainly whether the app was there.
        pid1 = self.sh(f"pidof {PKG}").strip()
        # If the process restarted inside the window, the two tick snapshots come from different
        # processes and their difference is meaningless - count that as "not measured".
        alive = bool(pid1) and pid1 == getattr(self, "_pid0", pid1)
        return {"cpu_ms": sum(d.values()), "cpu_rt_ms": d.get("RenderThread", 0),
                "cpu_ui_ms": d.get(PKG[:15], 0), "cpu_js_ms": js, "cpu_top_threads_ms": top,
                "app_alive": alive}


def framestats(out: str) -> dict:
    """Exact per-frame durations from `dumpsys gfxinfo <pkg> framestats` (last 120 frames per window).

    total = IntendedVsync -> FrameCompleted, ui = HandleInputStart -> SyncQueued (UI thread:
    input, animation, layout, record), rt = SyncStart -> FrameCompleted (RenderThread).
    Columns are looked up by name because Android 12+ reordered and added some.
    """
    total, ui, rt = [], [], []
    blocks = out.split("---PROFILEDATA---")
    for block in blocks[1::2]:
        lines = [l.strip().rstrip(",") for l in block.strip().splitlines() if l.strip()]
        if not lines:
            continue
        idx = {name: i for i, name in enumerate(lines[0].split(","))}
        need = ["IntendedVsync", "HandleInputStart", "SyncQueued", "SyncStart", "FrameCompleted"]
        if not all(n in idx for n in need):
            continue
        for line in lines[1:]:
            v = line.split(",")
            if not v[0].isdigit():
                continue
            v = [int(x) for x in v]
            ms = lambda a, b: (v[idx[b]] - v[idx[a]]) / 1e6
            t, u, r = ms("IntendedVsync", "FrameCompleted"), ms("HandleInputStart", "SyncQueued"), ms("SyncStart", "FrameCompleted")
            # Frames the renderer dropped or never completed carry zeroed timestamps (Android 12+).
            if not (0 < t < 5000 and u >= 0 and r >= 0):
                continue
            total.append(t)
            ui.append(u)
            rt.append(r)
    if not total:
        return {"fs_frames": 0}
    q = lambda xs, p: sorted(xs)[min(len(xs) - 1, int(p * len(xs)))]
    return {"fs_frames": len(total), "fs_mean_ms": round(statistics.mean(total), 1),
            "fs_p50_ms": round(q(total, 0.5), 1), "fs_p90_ms": round(q(total, 0.9), 1),
            "ui_mean_ms": round(statistics.mean(ui), 1), "rt_mean_ms": round(statistics.mean(rt), 1)}


# --------------------------------------------------------------------------- timing
def settle(dev, t0: float) -> dict:
    """Poll screenshots until two consecutive frames match; return when the held state began."""
    shots, lat = [], []
    while True:
        s0 = time.perf_counter()
        img = dev.screen()
        t = time.perf_counter()
        lat.append(t - s0)
        shots.append((t - t0, img))
        if len(shots) >= 3 and diff(shots[-1][1], shots[-2][1]) < SETTLE_DIFF and diff(shots[-2][1], shots[-3][1]) < SETTLE_DIFF:
            held_since = shots[-3][0]
            # walk back while earlier frames already matched the held state
            for i in range(len(shots) - 4, -1, -1):
                if diff(shots[i][1], shots[-1][1]) < SETTLE_DIFF:
                    held_since = shots[i][0]
                else:
                    break
            return {"settle_s": round(held_since, 2), "shot_latency_s": round(statistics.median(lat), 2), "timed_out": False}
        if t - t0 > SETTLE_TIMEOUT:
            return {"settle_s": round(t - t0, 2), "shot_latency_s": round(statistics.median(lat), 2), "timed_out": True}


def act(dev, label: str, bottom_most=False, scroll_tries=0, window_s: float = 4.0) -> dict:
    xy = dev.find(label, bottom_most)
    tries = 0
    while xy is None and tries < scroll_tries:
        dev.swipe_up()
        time.sleep(1.5)
        xy = dev.find(label, bottom_most)
        tries += 1
    if xy is None:
        return {"action": f"tap {label}", "error": "not found"}
    time.sleep(0.8)
    dev.window_begin()
    t0 = time.perf_counter()
    dev.tap(xy)
    r = settle(dev, t0)
    r.update({"action": f"tap {label}", "frames": dev.frame_stats()})
    finish_window(dev, r, t0, window_s)
    return r


def finish_window(dev, r: dict, t0: float, window_s: float) -> None:
    """Frames are read at settle; CPU is read at a fixed time after the input so every build is
    charged for the same span (a screen that settles faster doesn't get a shorter window)."""
    left = window_s - (time.perf_counter() - t0)
    if left > 0:
        time.sleep(left)
    cpu = dev.cpu_window()
    if cpu:
        r.update(cpu)
        r["cpu_window_s"] = round(time.perf_counter() - t0, 1)
    r.update(host_load())


def main():
    kind = sys.argv[1]
    out = sys.argv[3] if len(sys.argv) > 3 else None
    dev = IOS() if kind == "ios" else Android(sys.argv[2])
    tag = "ios" if kind == "ios" else sys.argv[2]
    print(f"== {dev.name}", flush=True)
    results = {"device": dev.name, "started": time.strftime("%Y-%m-%d %H:%M:%S"),
               "host_load_at_start": host_load(), "steps": []}

    dev.restart_app()
    if kind != "ios" and not dev.foreground():
        # a run that measures the launcher or a browser looks like data but is not
        dev.restart_app()
        if not dev.foreground():
            raise SystemExit(f"aborting run: {PKG} is not the foreground app after launch")
    home = dev.find("Home", bottom_most=True)
    if home:
        dev.tap(home)
        time.sleep(3)

    # 1. tab switching
    for label in TABS:
        r = act(dev, label, bottom_most=True)
        results["steps"].append(r)
        print(f"  {r}", flush=True)

    # 2. home scroll: 4 flings down the feed, then back up
    time.sleep(2)
    dev.window_begin()
    t0 = time.perf_counter()
    for _ in range(4):
        dev.swipe_up()
    for _ in range(4):
        dev.swipe_down()
    r = settle(dev, t0)
    r.update({"action": "home scroll 4 down + 4 up", "frames": dev.frame_stats()})
    finish_window(dev, r, t0, 10.0)
    results["steps"].append(r)
    print(f"  {r}", flush=True)

    # 3. booking flow entry from Home
    time.sleep(2)
    # "Map" in the home search bar exists on both platforms and opens the booking flow
    # (select-services). "Book Service" depends on account state, so it isn't comparable.
    r = act(dev, "Map", window_s=10.0)
    r["action"] = "open booking flow (" + r["action"] + ")"
    time.sleep(1)
    results["steps"].append(r)
    print(f"  {r}", flush=True)
    # idle redraw check on the booking screen
    if kind != "ios":
        time.sleep(5)
        dev.window_begin()
        time.sleep(10)
        idle = {"action": "booking screen idle 10s (no input)", "frames": dev.frame_stats()}
        idle.update(dev.cpu_window())
        idle.update(host_load())
        if idle.get("app_alive") is False:
            # The budget device sometimes loses the app on booking entry (a known open issue on
            # this branch). Keep the evidence: the crash track asked for logcat when it happens.
            crash_dir = os.path.join(HERE, "evidence", "crashes")
            os.makedirs(crash_dir, exist_ok=True)
            name = os.path.basename(out or "run").replace(".json", "")
            stamp = time.strftime("%H%M%S")
            with open(os.path.join(crash_dir, f"{tag}-{name}-{stamp}.log"), "w", encoding="utf-8",
                      errors="replace") as f:
                f.write(subprocess.run([dev.adb, "-s", dev.serial, "logcat", "-d", "-t", "600"],
                                       capture_output=True, text=True, errors="replace").stdout)
            print("  !! app was gone during the booking idle window; logcat saved", flush=True)
        results["steps"].append(idle)
        print(f"  idle 10s: {idle}", flush=True)
    png = os.path.join(HERE, "perf", f"{tag}-booking.png")
    os.makedirs(os.path.dirname(png), exist_ok=True)
    dev.screen().save(png)

    # leave the app on Home
    dev.restart_app()

    # 4. idle cost: sit on a tab with no input; count frames drawn and CPU burned (Android only)
    if kind != "ios":
        for label in ["Home", "Cars"]:
            xy = dev.find(label, bottom_most=True)
            if not xy:
                continue
            dev.tap(xy)
            time.sleep(8)
            dev.window_begin()
            time.sleep(10)
            r = {"action": f"{label} idle 10s (no input)", "frames": dev.frame_stats()}
            r.update(dev.cpu_window())
            r["cpu_ms_per_s"] = round(r["cpu_ms"] / 10, 1)
            r.update(host_load())
            results["steps"].append(r)
            print(f"  {r}", flush=True)
        dev.sh(f"am force-stop {PKG}")

    out = out or os.path.join(HERE, "perf", f"{tag}.json")
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    with open(out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"saved {out}")


if __name__ == "__main__":
    main()
