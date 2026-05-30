/**
 * Linking Utilities
 *
 * PURPOSE: Open external URLs (maps, phone) using expo-linking.
 * USED IN: Confirmation screen, shop carousel cards
 */

import { Platform } from "react-native";
import * as Linking from "expo-linking";

/**
 * Open the device's default maps app with directions to an address.
 *
 * - iOS  → Apple Maps via the `maps:` scheme (falls back to
 *   maps.apple.com if the scheme isn't handled, e.g., simulator).
 * - Android → the `geo:` URI, which lets Android show its app
 *   chooser (Google Maps, Waze, etc., depending on what's installed),
 *   falling back to the Google Maps web URL.
 */
export async function openMapsForAddress(address: string): Promise<void> {
  const encoded = encodeURIComponent(address);
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;

  const candidates =
    Platform.OS === "ios"
      ? [`maps://?daddr=${encoded}`, `http://maps.apple.com/?daddr=${encoded}`, webFallback]
      : [`geo:0,0?q=${encoded}`, webFallback];

  for (const url of candidates) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // try next candidate
    }
  }

  // Last-ditch: try the web URL without canOpenURL gating.
  try {
    await Linking.openURL(webFallback);
  } catch {
    // swallow — caller doesn't need a UI surface for this
  }
}

/**
 * Open the device's default maps app with directions to a lat/lng.
 *
 * Mirrors `openMapsForAddress` but skips geocoding by passing coordinates
 * directly. The optional `label` is displayed as the destination name in
 * the maps app (Apple Maps & Google Maps both honor it).
 *
 * - iOS  → Apple Maps via `maps:` scheme (falls back to maps.apple.com).
 * - Android → `geo:` URI for the app chooser (Google Maps, Waze, etc.).
 */
export async function openMapsForCoordinates(
  latitude: number,
  longitude: number,
  label?: string,
): Promise<void> {
  const coord = `${latitude},${longitude}`;
  const encodedLabel = label ? encodeURIComponent(label) : undefined;
  const webFallback = `https://www.google.com/maps/dir/?api=1&destination=${coord}`;

  const candidates =
    Platform.OS === "ios"
      ? [
          encodedLabel
            ? `maps://?daddr=${coord}&q=${encodedLabel}`
            : `maps://?daddr=${coord}`,
          `http://maps.apple.com/?daddr=${coord}`,
          webFallback,
        ]
      : [
          encodedLabel ? `geo:${coord}?q=${coord}(${encodedLabel})` : `geo:${coord}?q=${coord}`,
          webFallback,
        ];

  for (const url of candidates) {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // try next candidate
    }
  }

  try {
    await Linking.openURL(webFallback);
  } catch {
    // swallow — caller doesn't need a UI surface for this
  }
}

/**
 * Open the phone dialer with a number (prompts user to call).
 */
export async function openPhone(phone: string): Promise<void> {
  const url = `tel:${phone.trim()}`;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// Incoming `otopair://` deep links — used by push notifications fired from
// the Pre-Job Approval flow (booking_approvals.ts) and any future
// surface that wants to deep-link the customer to a specific booking.
//
// Push payloads use these forms:
//   otopair://booking/<bookingId>                  → booking detail
//   otopair://booking/<bookingId>/approve-estimate → approval prompt
//   otopair://booking/<bookingId>/reauth           → reauth confirm flow
//
// Expo Router auto-handles deep links when the URL path matches the file-
// based route. Our approve-estimate route lives at
// `app/booking/approve-estimate/[id].tsx`, so the push form (which puts the
// id segment first) doesn't auto-resolve — we route it manually below.
// ─────────────────────────────────────────────────────────────────────────

export type OtopairDeepLink =
  | { kind: "approve_estimate"; bookingId: string }
  | { kind: "reauth"; bookingId: string }
  | { kind: "booking_detail"; bookingId: string };

/** Parse an `otopair://` URL into a known target. Returns null when the URL
 *  is unrecognized — caller should ignore (don't navigate to an unknown
 *  destination). */
export function parseOtopairDeepLink(url: string): OtopairDeepLink | null {
  if (!url) return null;
  // Accept both `otopair://booking/...` and any path that contains it
  // (some platforms wrap the URL in their own envelope on cold launch).
  const match = url.match(/otopair:\/\/(.+)$/i);
  if (!match) return null;
  const pathAndQuery = match[1].split("?")[0];
  const segments = pathAndQuery
    .split("/")
    .map((s) => decodeURIComponent(s))
    .filter((s) => s.length > 0);

  if (segments[0] !== "booking" || segments.length < 2) return null;

  const bookingId = segments[1];
  if (segments[2] === "approve-estimate") {
    return { kind: "approve_estimate", bookingId };
  }
  if (segments[2] === "reauth") {
    return { kind: "reauth", bookingId };
  }
  if (segments.length === 2) {
    return { kind: "booking_detail", bookingId };
  }
  return null;
}

/** Route a known otopair deep link via expo-router. Safe to call with any
 *  URL — unknown URLs are silently ignored. Typed loosely on the router so
 *  this stays decoupled from expo-router's generic Href types. */
export function routeOtopairDeepLink(
  router: { push: (target: any) => void },
  url: string,
): void {
  const parsed = parseOtopairDeepLink(url);
  if (!parsed) return;
  if (parsed.kind === "approve_estimate") {
    router.push({
      pathname: "/booking/approve-estimate/[id]",
      params: { id: parsed.bookingId },
    });
    return;
  }
  if (parsed.kind === "reauth") {
    // Reauth re-uses the approve-estimate screen with a `mode=reauth` param.
    // The screen branches on the param + a live `payment_approval_state`
    // check so the deep link can't render the wrong view if the state has
    // already cleared by the time the user taps the notification.
    router.push({
      pathname: "/booking/approve-estimate/[id]",
      params: { id: parsed.bookingId, mode: "reauth" },
    });
    return;
  }
  if (parsed.kind === "booking_detail") {
    // Bookings list is the surface that opens the detail sheet; navigating
    // there keeps the user inside the main tab nav. The list reads the
    // `bookingId` query param to auto-open the detail sheet on land.
    router.push({
      pathname: "/(main-tabs)/bookings",
      params: { bookingId: parsed.bookingId },
    });
  }
}
