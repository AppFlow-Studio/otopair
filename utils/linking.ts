/**
 * Linking Utilities
 *
 * PURPOSE: Open external URLs (maps, phone) using expo-linking.
 * USED IN: Confirmation screen, shop carousel cards
 */

import * as Linking from "expo-linking";

/**
 * Open the default maps app with directions to an address.
 * Uses Google Maps URL (works on iOS and Android when app or browser is available).
 */
export async function openMapsForAddress(address: string): Promise<void> {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
  const canOpen = await Linking.canOpenURL(url);
  if (canOpen) {
    await Linking.openURL(url);
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
