/**
 * Per-variant visual tokens. Authoritative source for hex values is
 * docs/notifications/PLAN.md §B.3 — keep in lockstep.
 */
import { SemanticColors } from "@/constants/theme";

import type { ToastVariant } from "./types";

export const DEFAULT_DURATION_MS: Record<ToastVariant, number> = {
  success: 5000,
  info: 4500,
  warning: 6000,
  error: 6500,
  trust: 6000,
};

export interface ToastPalette {
  bg: string;
  border: string;
  iconColor: string;
  iconContainerBg: string;
  iconContainerBorder?: string;
}

export interface ToastVariantTokens {
  light: ToastPalette;
  dark: ToastPalette;
}

// Per Ahmad: every toast wears a flat white card on light mode, with
// the icon naked (no chip background) in its variant color. Dark mode
// keeps its tinted look so the toast stays readable against dark
// surfaces — flat white there would be harsh.
const LIGHT_CARD_BG = "#FFFFFF";
const LIGHT_CARD_BORDER = "rgba(15, 23, 42, 0.08)";
// `iconContainerBg: "transparent"` + `iconContainerBorder: undefined`
// (when also `borderWidth: 0`) gives ToastIcon a no-chip naked icon.
const NO_CHIP = {
  iconContainerBg: "transparent",
  iconContainerBorder: undefined,
} as const;

export const VARIANT_TOKENS: Record<ToastVariant, ToastVariantTokens> = {
  success: {
    light: {
      bg: LIGHT_CARD_BG,
      border: LIGHT_CARD_BORDER,
      iconColor: SemanticColors.successGreen,
      ...NO_CHIP,
    },
    dark: {
      bg: SemanticColors.successGreenDarkBg,
      border: `${SemanticColors.successGreen}66`,
      iconColor: SemanticColors.successGreenLightOnDark,
      iconContainerBg: SemanticColors.successGreenDarkBg,
      iconContainerBorder: `${SemanticColors.successGreen}66`,
    },
  },
  info: {
    light: {
      bg: LIGHT_CARD_BG,
      border: LIGHT_CARD_BORDER,
      iconColor: SemanticColors.primaryBlue,
      ...NO_CHIP,
    },
    dark: {
      bg: SemanticColors.primaryBlueDarkBg,
      border: `${SemanticColors.primaryBlue}66`,
      iconColor: SemanticColors.primaryBlueLightOnDark,
      iconContainerBg: SemanticColors.primaryBlueDarkBg,
      iconContainerBorder: `${SemanticColors.primaryBlue}66`,
    },
  },
  warning: {
    light: {
      bg: LIGHT_CARD_BG,
      border: LIGHT_CARD_BORDER,
      iconColor: SemanticColors.warningAmber,
      ...NO_CHIP,
    },
    dark: {
      bg: SemanticColors.warningAmberDarkBg,
      border: `${SemanticColors.warningAmber}66`,
      iconColor: SemanticColors.warningAmberLightOnDark,
      iconContainerBg: SemanticColors.warningAmberDarkBg,
      iconContainerBorder: `${SemanticColors.warningAmber}66`,
    },
  },
  error: {
    light: {
      bg: LIGHT_CARD_BG,
      border: LIGHT_CARD_BORDER,
      iconColor: SemanticColors.errorRed,
      ...NO_CHIP,
    },
    dark: {
      bg: SemanticColors.errorRedDarkBg,
      border: `${SemanticColors.errorRed}66`,
      iconColor: SemanticColors.errorRedLightOnDark,
      iconContainerBg: SemanticColors.errorRedDarkBg,
      iconContainerBorder: `${SemanticColors.errorRed}66`,
    },
  },
  trust: {
    light: {
      bg: LIGHT_CARD_BG,
      border: LIGHT_CARD_BORDER,
      iconColor: SemanticColors.primaryBlue,
      ...NO_CHIP,
    },
    dark: {
      bg: SemanticColors.primaryBlueDarkBg,
      border: `${SemanticColors.primaryBlue}99`,
      iconColor: SemanticColors.primaryBlueLightOnDark,
      iconContainerBg: SemanticColors.primaryBlueDarkBg,
      iconContainerBorder: `${SemanticColors.primaryBlue}66`,
    },
  },
};

export const TRUST_GRADIENT = {
  light: [SemanticColors.primaryBlueLight, SemanticColors.primaryBlueLightAlt] as [string, string],
  dark: [SemanticColors.primaryBlueDarkBg, SemanticColors.primaryBlueDarkBgAlt] as [string, string],
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

/** Trust-Moment overrides the default shadow with a blue-tinted glow. */
export const TRUST_SHADOW = {
  light: {
    shadowColor: SemanticColors.primaryBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 32,
    elevation: 14,
  },
  dark: {
    shadowColor: SemanticColors.primaryBlue,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.32,
    shadowRadius: 32,
    elevation: 14,
  },
} as const;

export const TOAST_TEXT = {
  light: {
    title: SemanticColors.textPrimary,
    body: SemanticColors.textSecondary,
  },
  dark: {
    title: SemanticColors.textPrimaryDark,
    body: SemanticColors.textSecondaryDark,
  },
} as const;

export const MAX_QUEUE_SIZE = 3;
