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

import React, { useCallback, useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";

import { guardedRouter as router } from "@/lib/navigationLock";
import { useCoachTourStore } from "@/stores/useCoachTourStore";
import { useCoachRegistry } from "./CoachContext";
import { CoachOverlay } from "./CoachOverlay";
import { COACH_STEPS } from "./coachSteps";

export const COACH_SEEN_KEY = "otopair.coachMarksSeenAt";

/** Give a target this long to mount and report before giving up on it.
 *  Kept short: this is dead time on a dimmed screen with nothing on it. */
const RECT_TIMEOUT_MS = 2000;

/** Let the overlay fade down before the screen changes under it. Matches the
 *  fade-out in CoachOverlay. */
const NAV_DELAY_MS = 200;

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
  const rect = reg?.resolve(step?.target) ?? null;

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
