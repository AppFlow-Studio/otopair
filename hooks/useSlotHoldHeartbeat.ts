/**
 * useSlotHoldHeartbeat
 *
 * Keeps a leased slot hold alive while the checkout is on screen (bug #393).
 * A leased hold (`holdSlot({ lease: true })`) only lives ~90 s unless the app
 * touches it, so a killed or long-backgrounded app stops blocking the slot for
 * everyone else within one lease instead of the whole 15-minute TTL.
 *
 *   - touches `api.slotHolds.touchSlotHold` every 30 s while AppState is
 *     "active", and once on every transition back to "active";
 *   - also touches right away when the reactive hold row reads as gone or
 *     lapsed, so a lost hold is noticed without waiting for the next beat;
 *   - on SLOT_HOLD_EXPIRED because the LEASE lapsed (backgrounded, network
 *     blip) it silently re-holds the SAME slot — same session, same
 *     shop/mechanic/date/time/duration, `lease: true`. Only if that re-hold
 *     fails does it call `onExpired` so the screen can show "Session expired".
 *   - once the hold's hard cap (the Director's checkout time limit) has passed
 *     it does NOT re-hold: the cap stays a hard stop, exactly as before leases,
 *     so a screen left open can't keep a slot away from other customers forever.
 *
 * Quote-accept holds ignore the lease server-side (their TTL drives the
 * expired-quote grace), so callers must pass `enabled: false` for them.
 *
 * USED IN: app/booking/mechanic/[id]/payment.tsx, confirming.tsx
 */

import { useCallback, useEffect, useRef } from "react";
import { AppState } from "react-native";

import { useMutation, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { readBookingError } from "@/convex/lib/bookingErrors";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useBookingStore, type SlotHoldSpec } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { displayTimeToHHMM } from "@/utils/timeSlotUtils";

const HEARTBEAT_MS = 30_000;

export type SlotHoldLostReason = "expired" | "unavailable";

export function useSlotHoldHeartbeat(
  holdId: string | null,
  sessionId: string | null,
  options: {
    enabled: boolean;
    /** The hold is gone and the same slot could not be re-held. */
    onExpired?: (reason: SlotHoldLostReason) => void;
  },
): { beatNow: () => void } {
  const { enabled } = options;
  const onExpiredRef = useRef(options.onExpired);
  onExpiredRef.current = options.onExpired;

  const touchSlotHold = useMutation(api.slotHolds.touchSlotHold);
  const holdSlot = useMutation(api.slotHolds.holdSlot);
  const { userId } = useUserFromConvex();
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const active = enabled && !!holdId && !!sessionId;

  // Reactive view of the hold. Cache the last slot it described so a re-hold
  // still knows the pinned mechanic/duration after the janitor deletes the row.
  const holdState = useQuery(
    api.slotHolds.getSlotHold,
    active ? { holdId: holdId as Id<"slot_holds"> } : "skip",
  );
  const lastSeenRef = useRef<{
    holdId: string;
    mechanicId: string | null;
    date: string;
    startTime: string;
    durationMinutes: number;
  } | null>(null);
  useEffect(() => {
    if (holdState && holdId) {
      lastSeenRef.current = {
        holdId,
        mechanicId: holdState.mechanicId ? String(holdState.mechanicId) : null,
        date: holdState.date,
        startTime: holdState.startTime,
        durationMinutes: holdState.durationMinutes,
      };
    }
  }, [holdState, holdId]);

  /** The slot to re-hold: what the picker recorded, else what the hold row
   *  last said, filled in from the booking store. */
  const resolveSpec = useCallback((): SlotHoldSpec | null => {
    const store = useBookingStore.getState();
    const seen = lastSeenRef.current?.holdId === store.holdId ? lastSeenRef.current : null;
    const recorded = store.holdSpec;
    const shopId =
      recorded?.shopId ??
      store.selectedMechanicSlot?.shopId ??
      (store.selectedMechanicId
        ? useMechanicStore.getState().getMechanicById(store.selectedMechanicId)?.shopId
        : null);
    const date = recorded?.date ?? seen?.date ?? store.scheduledAppointment?.date;
    const startTime =
      recorded?.startTime ??
      seen?.startTime ??
      store.selectedMechanicSlot?.scheduledTime ??
      (store.scheduledAppointment?.time ? displayTimeToHHMM(store.scheduledAppointment.time) : null);
    const durationMinutes = recorded?.durationMinutes ?? seen?.durationMinutes;
    if (!shopId || !date || !startTime || !durationMinutes) return null;
    return {
      shopId,
      // Prefer the mechanic the hold actually pinned ("Any" resolves to one),
      // so the re-hold keeps the customer on the same mechanic's calendar.
      mechanicId: seen?.mechanicId ?? recorded?.mechanicId ?? store.selectedMechanicId ?? null,
      date,
      startTime,
      durationMinutes,
    };
  }, []);

  const inFlightRef = useRef(false);

  const rehold = useCallback(async (): Promise<void> => {
    const store = useBookingStore.getState();
    const session = store.holdSessionId;
    const spec = resolveSpec();
    const hardCapPassed =
      store.holdHardExpiresAt != null && Date.now() >= store.holdHardExpiresAt;
    if (!session || !spec || hardCapPassed) {
      store.setSlotHold(null);
      onExpiredRef.current?.("expired");
      return;
    }
    try {
      const res = await holdSlot({
        shop_id: spec.shopId as Id<"shops">,
        mechanic_id: spec.mechanicId ? (spec.mechanicId as Id<"mechanics">) : undefined,
        date: spec.date,
        start_time: spec.startTime,
        duration_minutes: spec.durationMinutes,
        session_id: session,
        held_by: userIdRef.current ?? undefined,
        lease: true,
      });
      if (res?.holdId && res.expiresAt != null) {
        useBookingStore.getState().setSlotHold({
          holdId: String(res.holdId),
          expiresAt: res.expiresAt,
          hardExpiresAt: res.hardExpiresAt ?? null,
          spec,
        });
        return;
      }
      // Holds switched off server-side: carry on without one — the commit's
      // availability check is the backstop, exactly like the picker does.
      useBookingStore.getState().setSlotHold(null);
    } catch (err) {
      useBookingStore.getState().setSlotHold(null);
      const code = readBookingError(err)?.code;
      onExpiredRef.current?.(code === "SLOT_UNAVAILABLE" ? "unavailable" : "expired");
    }
  }, [holdSlot, resolveSpec]);

  const beat = useCallback(async () => {
    if (!active || inFlightRef.current) return;
    if (AppState.currentState !== "active") return;
    const store = useBookingStore.getState();
    const currentHoldId = store.holdId;
    const currentSession = store.holdSessionId;
    if (!currentHoldId || !currentSession) return;
    inFlightRef.current = true;
    try {
      const res = await touchSlotHold({
        holdId: currentHoldId as Id<"slot_holds">,
        session_id: currentSession,
      });
      // Ignore a late answer for a hold that was replaced meanwhile.
      if (useBookingStore.getState().holdId === currentHoldId) {
        useBookingStore.getState().updateSlotHoldExpiry(res.expiresAt, res.hardExpiresAt);
      }
    } catch (err) {
      if (readBookingError(err)?.code === "SLOT_HOLD_EXPIRED") {
        if (useBookingStore.getState().holdId === currentHoldId) await rehold();
      }
      // Anything else (offline, transient) — the next beat retries.
    } finally {
      inFlightRef.current = false;
    }
  }, [active, touchSlotHold, rehold]);

  const beatRef = useRef(beat);
  beatRef.current = beat;

  // 30 s beat while foregrounded + one beat on every return to "active".
  useEffect(() => {
    if (!active) return;
    let interval: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (interval) return;
      interval = setInterval(() => void beatRef.current(), HEARTBEAT_MS);
    };
    const stop = () => {
      if (interval) clearInterval(interval);
      interval = null;
    };
    if (AppState.currentState === "active") {
      void beatRef.current();
      start();
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        void beatRef.current();
        start();
      } else {
        stop();
      }
    });
    return () => {
      stop();
      sub.remove();
    };
  }, [active]);

  // The row vanished or lapsed under us (janitor, lease edge, another
  // checkout consumed the slot) — check now rather than at the next beat.
  const holdLooksLost = active && (holdState === null || holdState?.isExpired === true);
  useEffect(() => {
    if (holdLooksLost) void beatRef.current();
  }, [holdLooksLost]);

  const beatNow = useCallback(() => void beatRef.current(), []);
  return { beatNow };
}
