import type { Href } from "expo-router";

export function bookingDetailsRoute(bookingId: string): Href {
  return `/bookings?bookingId=${encodeURIComponent(bookingId)}` as Href;
}
