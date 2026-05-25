/**
 * Theme configuration for the app.
 * Contains colors, typography, spacing, and component-specific styles.
 */

import { Platform } from "react-native";

// ============================================================================
// COLORS
// ============================================================================

const tintColorLight = "#0a7ea4";
const tintColorDark = "#fff";

export const Colors = {
  light: {
    text: "#11181C",
    background: "#fff",
    tint: tintColorLight,
    icon: "#687076",
    tabIconDefault: "#687076",
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: "#ECEDEE",
    background: "#151718",
    tint: tintColorDark,
    icon: "#9BA1A6",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
  },
};

// Brand Colors
export const BrandColors = {
  primary: "#141C24",
  secondary: "#5299FE",
  white: "#FFFFFF",
  black: "#000000",
  background: "#f5f5f7",
} as const;

// Semantic Colors — locked by docs/notifications/PLAN.md §B.2.
// Used by the in-app toast system and any future surface that needs
// success/warning/error/info hierarchy. Keep in lockstep with the spec.
export const SemanticColors = {
  primaryBlue: "#2563EB",
  primaryBlueDark: "#1D4ED8",
  primaryBlueLight: "#EFF6FF",
  primaryBlueLightAlt: "#DBEAFE",
  successGreen: "#059669",
  successGreenLight: "#ECFDF5",
  warningAmber: "#D97706",
  warningAmberLight: "#FFFBEB",
  errorRed: "#DC2626",
  errorRedLight: "#FEF2F2",
  textPrimary: "#1A1A1A",
  textSecondary: "#374151",
  textMuted: "#6B7280",
  textDisabled: "#9CA3AF",
  border: "#E2E8F0",
  surface: "#F8FAFC",
  // Dark-mode sheet — keep here so toast tokens can reference symbolically
  successGreenDarkBg: "#022C22",
  primaryBlueDarkBg: "#0B1B33",
  primaryBlueDarkBgAlt: "#0F2A52",
  warningAmberDarkBg: "#2C1F08",
  errorRedDarkBg: "#2C0B0B",
  textPrimaryDark: "#F8FAFC",
  textSecondaryDark: "#CBD5E1",
  // Tinted icons for dark variants
  successGreenLightOnDark: "#10B981",
  primaryBlueLightOnDark: "#60A5FA",
  warningAmberLightOnDark: "#FBBF24",
  errorRedLightOnDark: "#F87171",
} as const;

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const FontFamily = {
  regular: "Urbanist-Regular",
  medium: "Urbanist-Medium",
  semiBold: "Urbanist-SemiBold",
  bold: "Urbanist-Bold",
  extraBold: "Urbanist-ExtraBold",
  light: "Urbanist-Light",
  italic: "Urbanist-Italic",
  serif: "SourceSerif4-Regular",
  serifSemiBold: "SourceSerif4-SemiBold",
  serifBold: "SourceSerif4-Bold",
} as const;

export const FontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
  "3xl": 30,
  "4xl": 36,
  "5xl": 48,
} as const;

export const LineHeight = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

// Legacy font config (for platform-specific fallbacks)
export const Fonts = Platform.select({
  ios: {
    sans: "Urbanist-Regular",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "Urbanist-Regular",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "'Urbanist', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});

// ============================================================================
// SPACING
// ============================================================================

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
} as const;

// ============================================================================
// BORDER RADIUS
// ============================================================================

export const BorderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 20,
  full: 9999,
} as const;

// ============================================================================
// BUTTON STYLES
// ============================================================================

export const ButtonStyles = {
  primary: {
    backgroundColor: BrandColors.primary,
    textColor: BrandColors.white,
    borderRadius: BorderRadius.lg, // 12px
    paddingVertical: Spacing.sm, // 8px
    paddingHorizontal: Spacing.lg, // 16px
  },
  secondary: {
    backgroundColor: BrandColors.secondary,
    textColor: BrandColors.white,
    borderRadius: BorderRadius.md, // 8px
    paddingVertical: Spacing.sm, // 8px
    paddingHorizontal: Spacing.lg, // 16px
  },
  ghost: {
    backgroundColor: "transparent",
    textColor: BrandColors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
} as const;

// ============================================================================
// SHADOWS
// ============================================================================

export const Shadows = {
  sm: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
} as const;

// ============================================================================
// LAYOUT CONSTANTS
// ============================================================================

/**
 * Consistent layout values for bottom sheet scroll padding.
 * All sheets should use these to ensure content scrolls above fixed elements.
 * Used in ServiceBottomSheet.tsx
 * Used in AddMoreServicesSheet.tsx
 * Used in BookingDetailsContent.tsx
 * Used in CollapsedContent.tsx
 * Used in ConfirmationContent.tsx
 * Used in MechanicSelectionContent.tsx
 * Used in ServiceSelectionContent.tsx
 */
export const Layout = {
  /** Height of the native tab bar */
  tabBarHeight: 30,
  /** Standard footer height (button + vertical padding) */
  footerHeight: 100,
  /** Visual buffer so content doesn't touch footer */
  scrollBuffer: 150,
} as const;

/**
 * Helper to calculate sheet content bottom padding.
 * Call this function instead of using static values - ensures fresh calculation.
 *
 * @param hasFooter - Whether the sheet has a footer button
 * @param safeAreaBottom - Pass insets.bottom from useSafeAreaInsets()
 */
export function getSheetContentPadding(hasFooter: boolean, safeAreaBottom: number = 0): number {
  if (hasFooter) {
    return Layout.footerHeight + Layout.tabBarHeight + Layout.scrollBuffer + safeAreaBottom;
  }
  return Layout.tabBarHeight + Layout.scrollBuffer + safeAreaBottom;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type ColorScheme = "light" | "dark";
export type FontFamilyKey = keyof typeof FontFamily;
export type FontSizeKey = keyof typeof FontSize;
export type SpacingKey = keyof typeof Spacing;
export type BorderRadiusKey = keyof typeof BorderRadius;
export type ButtonVariant = keyof typeof ButtonStyles;
