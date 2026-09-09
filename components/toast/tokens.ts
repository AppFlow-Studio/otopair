/**
 * Per-variant visual tokens for the unified Airbnb-style toast.
 *
 * Every variant is a solid fill-color card with white text and a
 * white icon inside a translucent-white 40pt chip. Colors vary by
 * variant (green success, red error, blue info, amber warning, navy
 * trust) but the shape and motion are identical.
 *
 * Light/dark values are the same — the fill card reads on either
 * theme, unlike the previous white-card light-mode design which
 * disappeared into a light background.
 */

import type { ToastVariant } from "./types";

export const DEFAULT_DURATION_MS: Record<ToastVariant, number> = {
  success: 5000,
  info: 4500,
  warning: 6000,
  error: 6500,
  trust: 6000,
};

export interface ToastPalette {
  /** Solid card fill. */
  bg: string;
  /** Border color — matches bg since the card is a solid fill. */
  border: string;
  /** White. Icon rendered on top of the translucent chip. */
  iconColor: string;
  /** 16% white so the chip separates from the card. */
  iconContainerBg: string;
  iconContainerBorder?: string;
}

const WHITE = "#FFFFFF";
const CHIP_BG = "rgba(255, 255, 255, 0.16)";

function fill(bg: string): ToastPalette {
  return {
    bg,
    border: bg,
    iconColor: WHITE,
    iconContainerBg: CHIP_BG,
    iconContainerBorder: undefined,
  };
}

/**
 * Per-variant fill colors. Success green matches the PM spec; the
 * others follow the same "solid color, white content" grammar so any
 * trigger (role change, mileage update, booking cancelled, errors)
 * reads as the same UI system.
 */
export const VARIANT_TOKENS: Record<ToastVariant, ToastPalette> = {
  success: fill("#059669"), // emerald-600
  info: fill("#2563EB"),    // blue-600
  warning: fill("#B45309"), // amber-700 — matches SOON chip tone
  error: fill("#DC2626"),   // red-600 — matches NOW chip tone family
  trust: fill("#0F172A"),   // slate-900 — premium / high-attention
};

export const TOAST_SHADOW = {
  light: {
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 12,
  },
  dark: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
} as const;

export const TOAST_TEXT = {
  title: WHITE,
  body: "rgba(255, 255, 255, 0.85)",
} as const;

export const MAX_QUEUE_SIZE = 3;
