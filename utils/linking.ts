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
 * Open the phone dialer with a number (prompts user to call).
 */
export async function openPhone(phone: string): Promise<void> {
  const url = `tel:${phone.trim()}`;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
  }
}
