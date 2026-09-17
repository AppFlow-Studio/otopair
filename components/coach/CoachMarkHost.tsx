/**
 * CoachMarkHost — decides which single hint, if any, belongs on screen now.
 *
 * Mounted on the tab LAYOUT so it survives moving between tabs, but unlike
 * the tour it replaced it never navigates. Each mark waits on its own screen
 * for its own moment; the driver's route decides which one is even a
 * candidate.
 *
 * The showing rule, in order:
 *   1. a mark whose `route` matches where we are
 *   2. that has not been seen (AsyncStorage, one key per mark)
 *   3. whose trigger is satisfied (has a car / has a booking / just here)
 *   4. once the screen has ARRIVED and the target has STOPPED MOVING
 *
 * Steps 3 and 4 are separate on purpose. 3 is "does this hint make sense
 * yet", 4 is "is it safe to point at something" — Cars and Home both animate
 * their whole page in on focus, so a hint placed on arrival lands on a
 * screen that is still travelling.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { usePathname } from "expo-router";
import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { FORCE_COACH_MARKS_EVERY_LAUNCH } from "@/constants/devFlags";
import { useCoachRegistry, type CoachRect } from "./CoachContext";
import { CoachOverlay } from "./CoachOverlay";
import { COACH_MARKS, coachMarkKey, marksForRoute, type CoachMark } from "./coachMarks";

/** Let the screen settle before measuring into it. */
const ARRIVE_SETTLE_MS = 120;
/** How long a target must hold still before we point at it. */
const RECT_STABLE_MS = 260;
/** Give a target this long to report before giving up on this mark. */
const RECT_TIMEOUT_MS = 2500;

export async function markCoachSeen(id: string): Promise<void> {
  try {
    await AsyncStorage.setItem(coachMarkKey(id), String(Date.now()));
  } catch {
    // A hint that shows twice is a far smaller problem than a crash.
  }
}

export async function resetAllCoachMarks(): Promise<void> {
  try {
    await AsyncStorage.multiRemove(COACH_MARKS.map((m) => coachMarkKey(m.id)));
  } catch {
    /* ignore */
  }
}

/**
 * Screens telling the host "the driver just did this".
 *
 * Module-level rather than context because `seen` lives in the host's own
 * state, and the screens that need to fire this are several layers below it.
 */
const satisfyListeners = new Set<(id: string) => void>();

/**
 * Retire a hint the moment the driver does the thing it describes.
 *
 * "Tap a service to add it" is advice right up until the first service is in
 * the cart. After that it is a card sitting on top of the list explaining
 * something the driver has just demonstrably understood, and making them
 * clear it by hand is busywork on top of a job they already did.
 *
 * `done` is levelled, not edged: it fires once on the first true and never
 * again, so deselecting everything does not bring the hint back.
 */
export function useSatisfyCoachMark(id: string, done: boolean): void {
  const fired = useRef(false);
  useEffect(() => {
    if (!done || fired.current) return;
    fired.current = true;
    satisfyListeners.forEach((fn) => fn(id));
  }, [id, done]);
}

export function CoachMarkHost() {
  const reg = useCoachRegistry();
  const pathname = usePathname();

  const me = useQuery(api.users.getMe);
  const vehicleCount = useVehicleStore((s) => Object.keys(s.vehicles).length);
  const bookingCount = useBookingStore((s) => Object.keys(s.bookings).length);

  /** Which marks have already been seen. null while still loading. */
  const [seen, setSeen] = useState<Record<string, boolean> | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (FORCE_COACH_MARKS_EVERY_LAUNCH) {
        if (!cancelled) setSeen({});
        return;
      }
      try {
        const pairs = await AsyncStorage.multiGet(
          COACH_MARKS.map((m) => coachMarkKey(m.id)),
        );
        if (cancelled) return;
        const next: Record<string, boolean> = {};
        pairs.forEach(([k, v], i) => {
          void k;
          next[COACH_MARKS[i].id] = v != null;
        });
        setSeen(next);
      } catch {
        if (!cancelled) setSeen({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const triggerMet = useCallback(
    (mark: CoachMark): boolean => {
      switch (mark.trigger) {
        case "first_run":
          // The phone-mock tour has to be behind them, or this lands on top
          // of it. `tutorialSeenAt` is stamped on completion OR skip.
          return !!me && (me as { tutorialSeenAt?: number }).tutorialSeenAt != null;
        case "first_vehicle":
          return vehicleCount > 0;
        case "first_booking":
          return bookingCount > 0;
        case "has_vehicle":
          return vehicleCount > 0;
        case "first_visit":
          return true;
        default:
          return false;
      }
    },
    [me, vehicleCount, bookingCount],
  );

  /** The one mark eligible right now, if any. */
  const candidate =
    seen == null
      ? null
      : (marksForRoute(pathname).find((m) => !seen[m.id] && triggerMet(m)) ?? null);

  // ── arrival + stillness, the same two gates the tour used ────────────────
  const [arrived, setArrived] = useState(false);
  useEffect(() => {
    if (!candidate) {
      setArrived(false);
      return;
    }
    const t = setTimeout(() => setArrived(true), ARRIVE_SETTLE_MS);
    return () => clearTimeout(t);
  }, [candidate?.id, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const remeasure = reg?.remeasure;
  const rawRect = arrived && candidate ? (reg?.resolve(candidate.target) ?? null) : null;
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

  // Keep asking until it resolves — tab screens stay mounted, so revisiting
  // one fires no onLayout and its rect is whatever it was when we last left.
  useEffect(() => {
    if (!candidate || !remeasure || rect) return;
    remeasure();
    const iv = setInterval(remeasure, 200);
    return () => clearInterval(iv);
  }, [candidate?.id, pathname, remeasure, rect]); // eslint-disable-line react-hooks/exhaustive-deps

  /** A target that never reports: drop the mark for this visit, silently. */
  const [skipped, setSkipped] = useState<string | null>(null);
  useEffect(() => {
    if (!candidate || rect) return;
    const t = setTimeout(() => {
      if (__DEV__) {
        console.warn(`[coach] "${candidate.target}" never reported — skipping "${candidate.id}"`);
      }
      setSkipped(candidate.id);
    }, RECT_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [candidate?.id, rect]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onSatisfy = (id: string) => {
      setSeen((prev) => ({ ...(prev ?? {}), [id]: true }));
      if (FORCE_COACH_MARKS_EVERY_LAUNCH) return;
      void markCoachSeen(id);
    };
    satisfyListeners.add(onSatisfy);
    return () => {
      satisfyListeners.delete(onSatisfy);
    };
  }, []);

  const dismiss = useCallback(() => {
    if (!candidate) return;
    const id = candidate.id;
    setSeen((prev) => ({ ...(prev ?? {}), [id]: true }));
    // Not stamped while forcing a replay, or a device used for testing ends
    // up marked as having seen a hint it is about to be shown again.
    if (FORCE_COACH_MARKS_EVERY_LAUNCH) return;
    void markCoachSeen(id);
  }, [candidate]);

  const showing = !!candidate && candidate.id !== skipped && !!rect;

  /**
   * Acting on a non-blocking hint counts as acknowledging it.
   *
   * The booking hints let the driver keep tapping, so tapping a category
   * takes them to the next screen — and without this the hint vanished with
   * the route and came straight back when they stepped back. Once they have
   * moved on from the screen a hint is about, that hint is done.
   *
   * Only non-blocking marks: the others swallow taps, so leaving their
   * screen is not something the driver can do by accident.
   */
  const shownId = useRef<string | null>(null);
  useEffect(() => {
    if (showing && candidate?.blocking === false) shownId.current = candidate.id;
  }, [showing, candidate]);

  useEffect(() => {
    const id = shownId.current;
    if (!id) return;
    const mark = COACH_MARKS.find((m) => m.id === id);
    if (!mark || (pathname && pathname.startsWith(mark.route))) return;
    shownId.current = null;
    setSeen((prev) => ({ ...(prev ?? {}), [id]: true }));
    if (FORCE_COACH_MARKS_EVERY_LAUNCH) return;
    void markCoachSeen(id);
  }, [pathname]);
  if (!showing || !candidate) return null;

  return (
    <CoachOverlay
      visible
      mark={candidate}
      rect={rect}
      onDismiss={dismiss}
    />
  );
}

export default CoachMarkHost;

/**
 * Whether a given mark has yet to be seen.
 *
 * For screens that must RENDER something for a mark to point at. The Oto tab
 * hides its composer behind the greeting, so without this the "Ask Oto" hint
 * has no target on the one screen a new driver actually lands on.
 *
 * Deliberately only the seen-flag, not the trigger: the screen asking is the
 * trigger in every case that needs this.
 */
export function useCoachMarkPending(id: string): boolean {
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (FORCE_COACH_MARKS_EVERY_LAUNCH) {
        if (!cancelled) setPending(true);
        return;
      }
      try {
        const v = await AsyncStorage.getItem(coachMarkKey(id));
        if (!cancelled) setPending(v == null);
      } catch {
        if (!cancelled) setPending(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);
  return pending;
}
