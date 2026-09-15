/**
 * CoachDemoBooking — a real booking card, with made-up data, shown only
 * while the spotlight tour is on the "Watch it happen" step.
 *
 * WHY THIS EXISTS: the tour runs for a brand-new driver, and a brand-new
 * driver has never booked anything. The first version gated the step on a
 * genuinely live booking and therefore skipped it for exactly the audience
 * the tour is FOR — the one part of the app they have not seen and most need
 * explained. Showing them nothing was backwards.
 *
 * It renders <BookingCard>, the same component the real list renders, rather
 * than a lookalike — so it cannot drift from the real thing, and what the
 * driver is taught is what they will actually see. BookingCard is used
 * directly instead of UpcomingBookingCard because that wrapper subscribes to
 * Convex tickets for the booking id, and this id belongs to no booking.
 *
 * Every handler is a no-op: during the tour the overlay swallows taps
 * anyway, and this card must never open a details sheet for a booking that
 * does not exist.
 */

import React from "react";
import { View, StyleSheet } from "react-native";

import { BookingCard, type Booking } from "@/components/bookings/BookingCard";
import { CoachTarget } from "./CoachTarget";

const noop = () => {};

/**
 * Deliberately ordinary: a mid-job brake service at a generic shop. The
 * status is what puts the card in its live, staged state — the whole point
 * of the step.
 */
export const DEMO_BOOKING: Booking = {
  /**
   * The `booking_` prefix is load-bearing: isLocalBookingId() in
   * constants/bookingActionPolicy treats it as a local, non-server booking,
   * so BookingCard's useBookingActions skips its Convex query instead of
   * looking up an id that belongs to no booking. Without it the card throws
   * on mount and the whole tab renders white — which is exactly what it did.
   */
  // Last six characters become the reference the card prints, so they are
  // chosen to read as "#SAMPLE" rather than a slice of the slug.
  id: "booking_00SAMPLE",
  services: ["Brake pads & rotors"],
  carModel: "A6",
  carYear: "2015",
  licensePlate: "SAMPLE",
  mechanicName: "Sam R.",
  shopName: "Main Street Auto",
  date: "Today",
  time: "10:00 AM",
  status: "in_progress",
  liveStage: "service_in_progress",
};

class Boundary extends React.Component<
  { children: React.ReactNode },
  { err: string | null }
> {
  state = { err: null as string | null };
  static getDerivedStateFromError(e: unknown) {
    return { err: e instanceof Error ? `${e.message}` : String(e) };
  }
  componentDidCatch(e: unknown) {
    if (__DEV__) console.warn("[coach] demo booking card failed to render:", e);
  }
  render() {
    // A tutorial card must never take a tab down with it. If the real
    // BookingCard ever stops tolerating a local booking, the step loses its
    // target and skips — which is survivable — instead of white-screening
    // Bookings, which is what happened the first time.
    if (this.state.err) return null;
    return this.props.children as React.ReactElement;
  }
}

export function CoachDemoBooking() {
  return (
    <View style={styles.wrap} pointerEvents="none">
      <Boundary>
      <CoachTarget id="bookings.live" radius={20}>
        <BookingCard
          booking={DEMO_BOOKING}
          variant="upcoming"
          unreadMessageCount={0}
          onViewDetails={noop}
          onCancelBooking={noop}
          onReschedule={noop}
          onRequestPickup={noop}
          onMessageShop={noop}
          onDownloadPdf={noop}
          onToggleFavorite={noop}
        />
      </CoachTarget>
      </Boundary>
    </View>
  );
}

const styles = StyleSheet.create({
  // No margins of its own: it sits exactly where a real card would in the
  // list, so the step teaches the real position as well as the real card.
  wrap: {},
});

export default CoachDemoBooking;
