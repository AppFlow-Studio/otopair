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

export const VARIANT_TOKENS: Record<ToastVariant, ToastVariantTokens> = {
  success: {
    light: {
      bg: SemanticColors.successGreenLight,
      border: `${SemanticColors.successGreen}33`,
      iconColor: SemanticColors.successGreen,
      iconContainerBg: "#FFFFFF",
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
      bg: SemanticColors.primaryBlueLight,
      border: `${SemanticColors.primaryBlue}33`,
      iconColor: SemanticColors.primaryBlue,
      iconContainerBg: "#FFFFFF",
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
      bg: SemanticColors.warningAmberLight,
      border: `${SemanticColors.warningAmber}40`,
      iconColor: SemanticColors.warningAmber,
      iconContainerBg: "#FFFFFF",
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
      bg: SemanticColors.errorRedLight,
      border: `${SemanticColors.errorRed}40`,
      iconColor: SemanticColors.errorRed,
      iconContainerBg: "#FFFFFF",
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
      // gradient applied separately; this is the fallback solid color
      bg: SemanticColors.primaryBlueLight,
      border: `${SemanticColors.primaryBlue}59`,
      iconColor: SemanticColors.primaryBlue,
      iconContainerBg: "#FFFFFF",
      iconContainerBorder: `${SemanticColors.primaryBlue}33`,
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
