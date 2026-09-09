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

// Figure/ground tokens for carded-on-canvas layouts (e.g. order/receipt
// detail). The page is a warm light-gray canvas, cards are flat white;
// contrast comes from color alone — no borders, no shadows.
export const SurfaceColors = {
  canvas: "#F2F2F2",
  cardSurface: "#FFFFFF",
  // Flat warm off-white — for editorial list layouts where rows sit
  // directly on the canvas without per-row card chrome.
  canvasWarm: "#FAF9F7",
} as const;

// Layered drop shadow for elevated cards on a soft canvas (e.g.
// order/receipt detail). Tight contact + larger soft ambient. One
// shared value so the elevation is tunable in a single place. Uses
// RN 0.79+ `boxShadow` (Fabric / New Architecture).
export const CardShadow = {
  default: "0px 2px 4px rgba(0,0,0,0.05), 0px 10px 28px rgba(0,0,0,0.07)",
} as const;

// Vertical rhythm for list-style screens (e.g. Past Services).
// `rowVertical` is the paddingVertical applied to each row — tune
// in one place to change the whole list's density.
export const ListSpacing = {
  rowVertical: 12,
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
  mono: "IBMPlexMono-Regular",
  monoMedium: "IBMPlexMono-Medium",
  monoSemiBold: "IBMPlexMono-SemiBold",
  monoBold: "IBMPlexMono-Bold",
  /** Instrument surface — Past Services. Grotesque for readouts and service
   *  names, technical mono for micro-labels and figures. */
  interRegular: "Inter-Regular",
  interMedium: "Inter-Medium",
  interSemiBold: "Inter-SemiBold",
  interBold: "Inter-Bold",
  techMono: "GeistMono-Regular",
  techMonoMedium: "GeistMono-Medium",
} as const;

/**
 * Service-log palette — Settings → Past Services.
 *
 * The screen reads as an instrument surface: the shared Oto ambient gradient,
 * hairline dividers, technical micro-labels, and month subtotals rendered as
 * large readouts. Brand tokens re-pointed for that surface, not new colors —
 * `ink` is BrandColors.primary, `accent` is BrandColors.secondary.
 */
export const ServiceLogColors = {
  /** Panel behind the channel sheet. */
  panel: "#FFFFFF",
  /** Primary type and readouts. */
  ink: "#141C24",
  /** Secondary type. */
  mid: "#475569",
  /** Micro-labels, units, meta lines. */
  low: "#6B7280",
  /** The single signal colour — active channel, readout rule. */
  accent: "#5299FE",
  /** Vehicle thumbnail plate. */
  plate: "#E9F0F8",
  /** Vehicle glyph on the plate, when there is no photo. */
  glyph: "#A9BACB",
  /** Hairline dividers — `ink` at 9%. */
  hairline: "rgba(20, 28, 36, 0.09)",
  /** Sheet top edge — `ink` at 14%. */
  edge: "rgba(20, 28, 36, 0.14)",
  /** Inactive channel underline — `ink` at 8%. */
  channelIdle: "rgba(20, 28, 36, 0.08)",
  /** Inactive channel bar in the sheet — `ink` at 10%. */
  barIdle: "rgba(20, 28, 36, 0.10)",
  /** Selected channel row wash — `ink` at 4.5%. */
  rowActive: "rgba(20, 28, 36, 0.045)",
  /** Row separator inside the sheet — `ink` at 7%. */
  sheetRule: "rgba(20, 28, 36, 0.07)",
  /** Scrim behind the sheet — `ink` at 22%. */
  veil: "rgba(20, 28, 36, 0.22)",
  /** Backdrop behind a full-screen job photo — `ink` at 96%, near-opaque so
   *  the photo reads against it. */
  photoVeil: "rgba(20, 28, 36, 0.96)",
  /** Raised surface on the gradient — mechanic + payment cards on the detail. */
  card: "#FFFFFF",
  /** Avatar placeholder before a mechanic photo resolves. */
  avatar: "#DCE6F2",
  /** Completion badge + work-performed ticks — SemanticColors.successGreen. */
  positive: "#059669",
  /** Completion badge fill — `positive` at 10%. */
  positiveWash: "rgba(5, 150, 105, 0.10)",
  /** Unfilled review stars. */
  star: "#C9CDD4",
  /** Text on an accent fill. */
  onAccent: "#FFFFFF",
  /** Dot leaders and other purely structural marks — lighter than `low` so a
   *  rule never competes with the label it connects. */
  leader: "#A9AAB2",
} as const;

/**
 * Booking-card colour roles, split by the surface the card sits on.
 * `OnLight` is the default white/light card; `OnNavy` is the same roles tuned
 * for the navy gradient (see PendingQuoteCard / UpcomingAppointmentHero).
 */
export const BookingCardOnLight = {
  text: '#1F2937',
  textMuted: '#6B7280',
  icon: '#9CA3AF',
  chevron: '#C3CBD6',
  accent: '#5299FE',
  amber: '#C8972E',
  danger: '#DC2626',
  /** Neutral button face. */
  surface: '#FFFFFF',
  surfaceBorder: '#E5E7EB',
  dangerSurface: '#FEF2F2',
  dangerBorder: '#FECACA',
  divider: '#F3F4F6',
} as const;

/**
 * The same roles on the navy gradient. Accent and amber are lifted — #5299FE
 * and #C8972E are tuned for white and go muddy on navy — and button faces
 * become translucent white so the gradient still reads through them instead of
 * being punched out by opaque chips.
 */
export const BookingCardOnNavy = {
  text: '#FFFFFF',
  textMuted: 'rgba(255,255,255,0.62)',
  icon: 'rgba(255,255,255,0.52)',
  chevron: 'rgba(255,255,255,0.42)',
  accent: '#7FB4FF',
  amber: '#E8BC63',
  danger: '#FCA5A5',
  surface: 'rgba(255,255,255,0.08)',
  surfaceBorder: 'rgba(255,255,255,0.18)',
  dangerSurface: 'rgba(252,165,165,0.12)',
  dangerBorder: 'rgba(252,165,165,0.32)',
  divider: 'rgba(255,255,255,0.12)',
} as const;

/**
 * Type roles for the Service Record surfaces (list, service detail, receipt).
 *
 * One indirection on purpose: those three screens reference roles, never
 * families, so the whole typographic system can be swapped from here without
 * touching a single screen.
 *
 * Currently pointed at Urbanist — the app's own family, used everywhere else.
 * The previous pairing was Inter for figures with Geist Mono for micro-labels;
 * `micro` and `figure` are separate roles precisely because they were the two
 * that carried the mono, and they're the ones to re-point first if the
 * technical feel is wanted back.
 */
export const ServiceLogFonts = {
  /** Headlines and hero amounts. */
  display: FontFamily.bold,
  /** Names, row titles, emphasised values. */
  semi: FontFamily.semiBold,
  /** Default body weight. */
  medium: FontFamily.medium,
  /** Secondary copy and findings prose. */
  regular: FontFamily.regular,
  /** Tracked-caps micro-labels: WORK PERFORMED, ODOMETER IN, RECEIPT · … */
  micro: FontFamily.medium,
  /** Lighter micro copy — line-item details, footer meta. */
  microRegular: FontFamily.regular,
  /** Money columns. NOTE: Urbanist is proportional, so figures no longer align
   *  on a fixed advance the way the mono did. */
  figure: FontFamily.medium,
} as const;

/**
 * The shared Oto ambient gradient, verbatim from the AI-chat surface
 * (app/(main-tabs)/ai-chat/index.tsx). Past Services reuses it so the two
 * screens sit on the same ground. Blue resolves to white inside the top 20%.
 */
export const OtoGradient = {
  colors: ["#A5CDFF", "#D6E8FF", "#FFFFFF"] as const,
  locations: [0, 0.1, 0.2] as const,
  start: { x: 0, y: 0 },
  end: { x: 0, y: 1 },
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
