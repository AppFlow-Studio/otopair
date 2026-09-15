/**
 * CoachTour — drives the spotlight tour across tabs.
 *
 * Mounted on the tab LAYOUT, not on a screen: the tour walks Home → Cars →
 * Bookings → Oto, so anything mounted on a screen would unmount underneath
 * it halfway through.
 *
 * The tour navigates itself. It cannot rely on the driver tapping the real
 * tab, because on iOS 26+ the tab bar is a UIKit view that no coach mark can
 * point at — see the note in coachSteps.ts.
 *
 * Waiting is the interesting part. After navigating, the target for the new
 * step does not exist yet; it mounts, lays out, and reports a rect. Until
 * then there is nothing to cut a hole around, so the overlay holds the
 * previous frame. If a rect never arrives (a screen changed and a target
 * went with it), the step is skipped rather than hanging the tour behind a
 * scrim the driver cannot dismiss.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";

import { guardedRouter as router } from "@/lib/navigationLock";
import { useCoachTourStore } from "@/stores/useCoachTourStore";
import { useCoachRegistry, type CoachRect } from "./CoachContext";
import { CoachOverlay } from "./CoachOverlay";
import { CoachFinale } from "./CoachFinale";
import { COACH_STEPS } from "./coachSteps";

export const COACH_SEEN_KEY = "otopair.coachMarksSeenAt";

/** Give a target this long to mount and report before giving up on it.
 *  Kept short: this is dead time on a dimmed screen with nothing on it. */
const RECT_TIMEOUT_MS = 2000;

/** Let the overlay fade down before the screen changes under it. Matches the
 *  fade-out in CoachOverlay. */
const NAV_DELAY_MS = 200;

/**
 * A short debounce after the route changes, so we do not start measuring into
 * a tab that has not begun drawing. The real wait is RECT_STABLE_MS below —
 * earlier versions tried to do the whole job with a duration here and kept
 * getting it wrong, because no single number covers every screen's entrance.
 */
const ARRIVE_SETTLE_MS = 120;

/**
 * How long a target must hold still before we will point at it. Covers each
 * screen's own entrance animation without knowing anything about it.
 */
const RECT_STABLE_MS = 260;

export async function markCoachToursSeen(): Promise<void> {
  try {
    await AsyncStorage.setItem(COACH_SEEN_KEY, String(Date.now()));
  } catch {
    // A tour that replays is a far smaller problem than a crash on launch.
  }
}

export async function hasSeenCoachTour(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(COACH_SEEN_KEY)) != null;
  } catch {
    return false;
  }
}

export function CoachTour() {
  const running = useCoachTourStore((s) => s.running);
  const index = useCoachTourStore((s) => s.index);
  const next = useCoachTourStore((s) => s.next);
  const back = useCoachTourStore((s) => s.back);
  const stop = useCoachTourStore((s) => s.stop);

  const reg = useCoachRegistry();
  const pathname = usePathname();
  const step = COACH_STEPS[index];
  // The closing step has no target — it is a plain card, not a spotlight.
  /**
   * Only accept a rect once we are actually ON the step's screen.
   *
   * Tab screens stay mounted, so the NEXT step's target is alive and
   * reporting a perfectly valid rect while the driver is still looking at the
   * previous tab. Without this gate the hole and the bubble jumped to the new
   * position first and the page changed after — the tour appeared to point at
   * nothing for a beat, then the screen caught up.
   */
  const onStepScreen = !!pathname && !!step && pathname.startsWith(step.route);

  /**
   * ...and only once the screen has actually settled.
   *
   * usePathname flips the moment the route changes, which is BEFORE the tab
   * transition has finished drawing. Gating on pathname alone still let the
   * hole and the bubble appear over a screen that was mid-swap. Waiting out
   * ARRIVE_SETTLE_MS means the page lands first and the coach mark fades up
   * onto a screen that has stopped moving.
   */
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!running || !onStepScreen) {
      setArrived(false);
      return;
    }
    const t = setTimeout(() => setArrived(true), ARRIVE_SETTLE_MS);
    return () => clearTimeout(t);
  }, [running, onStepScreen, index]);

  const rawRect = arrived ? (reg?.resolve(step?.target) ?? null) : null;

  /**
   * ...and only once the target has stopped moving.
   *
   * A duration cannot express "the screen has finished arriving", because
   * some screens keep animating after the tab has drawn: Cars fades and
   * slides its whole page in on focus, Home animates its sheet. Bookings and
   * Oto do neither, which is exactly why those two steps looked right while
   * Home and Cars put the spotlight up before the page.
   *
   * So wait for stillness instead of for a clock. The registry only emits a
   * new rect when the numbers actually change, so any movement restarts this
   * timer and it fires only once the element has held the same position for
   * RECT_STABLE_MS. That is true whatever a screen's entrance animation is,
   * and it needs no knowledge of any of them.
   */
  const rawKey = rawRect
    ? `${Math.round(rawRect.x)}:${Math.round(rawRect.y)}:${Math.round(
        rawRect.width,
      )}:${Math.round(rawRect.height)}`
    : null;
  const [rect, setRect] = useState<CoachRect | null>(null);
  useEffect(() => {
    if (!rawRect) {
      setRect(null);
      return;
    }
    const t = setTimeout(() => setRect(rawRect), RECT_STABLE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawKey]);

  // Navigate to the step's tab. Comparing on a prefix because the tab routes
  // resolve to "/home", "/cars" etc. but can carry params.
  useEffect(() => {
    if (!running || !step) return;
    if (pathname && pathname.startsWith(step.route)) return;
    /**
     * Held back a beat on purpose. Navigating the instant the step changes
     * swaps the screen underneath while the hole is still collapsing and the
     * card is still fading — three things moving at once, which is what read
     * as a glitchy hand-off between tabs. Letting the overlay close down
     * first means the tab change happens under a settled, plain scrim.
     */
    const t = setTimeout(
      // Group-qualified, the way the rest of the app addresses these tabs
      // (see ServiceSelectionContent). The bare "/ai-chat" silently did
      // nothing: the tour sat on Home, the composer never mounted, and the
      // step skipped on a target that was never given a chance to exist.
      () => router.navigate(`/(main-tabs)${step.route}` as never),
      NAV_DELAY_MS,
    );
    return () => clearTimeout(t);
  }, [running, step, pathname]);

  /**
   * Ask every target to measure itself again when a step begins, and again as
   * the screen settles. A rect captured at mount was measured against a
   * scroll offset of zero; by the time the tour arrives the screen has
   * scrolled, animated in, or both. Without this the tour points at where
   * things used to be.
   */
  const remeasure = reg?.remeasure;
  useEffect(() => {
    if (!running || !remeasure || !step?.target) return;
    // Keep asking until the rect resolves, not for a fixed burst. Tab screens
    // stay mounted, so revisiting one fires no onLayout at all — its rect is
    // whatever it was when the driver last left, which is usually off-screen
    // and therefore rejected. A few timers at the start missed that entirely
    // and the step skipped on a target that was sitting right there.
    if (rect) return;
    remeasure();
    const iv = setInterval(remeasure, 200);
    return () => clearInterval(iv);
  }, [running, index, pathname, remeasure, step, rect]);

  // Skip a step whose target never shows up.
  const skipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (skipTimer.current) {
      clearTimeout(skipTimer.current);
      skipTimer.current = null;
    }
    // A step with no target is never waiting on one.
    if (!running || !step || !step.target || rect) return;
    skipTimer.current = setTimeout(() => {
      if (__DEV__) {
        console.warn(`[coach] no rect for "${step.target}" — skipping step`);
      }
      next();
    }, RECT_TIMEOUT_MS);
    return () => {
      if (skipTimer.current) clearTimeout(skipTimer.current);
    };
  }, [running, step, rect, next]);

  const finish = useCallback(() => {
    stop();
    void markCoachToursSeen();
  }, [stop]);

  const handleAdvance = useCallback(() => {
    if (index >= COACH_STEPS.length - 1) {
      finish();
      // The closing card ends on the real first task rather than a dead
      // "Done" — a tour that closes on an acknowledgement spends the intent
      // it just built. Same destination the phone-mock tour's last card uses.
      router.push("/add-vehicle" as never);
      return;
    }
    next();
  }, [index, next, finish]);

  if (!running || !step) return null;

  if (step.finale) {
    return (
      <CoachFinale
        onPrimary={() => {
          finish();
          router.push("/add-vehicle" as never);
        }}
        onDismiss={finish}
      />
    );
  }

  return (
    <CoachOverlay
      visible={running}
      index={index}
      rect={rect}
      onAdvance={handleAdvance}
      onBack={back}
      onSkip={finish}
    />
  );
}

export default CoachTour;
