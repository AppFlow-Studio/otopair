/**
 * Shared three-stop background gradients for car-tinted screens
 * (Cars page + Vehicle Detected). Mirrors the home screen's brightness
 * curve (`STATIC_GRADIENT` in ScrollDrivenGradientBackground:
 * ['#86C2E8','#B0D6F0','#EAF2FA']) — saturated mid-tone at the top,
 * softer tint in the middle, near-white at the bottom — tinted per car
 * color so every car-context screen reads as part of the same light-mode
 * app. Stops are evenly distributed (no `locations` prop) for the same
 * smooth top→bottom fade home uses.
 */

export const DEFAULT_GRADIENTS: string[][] = [
  ["#A6B5D0", "#C5CFDE", "#EDF0F5"],
  ["#86C2E8", "#B0D6F0", "#EAF2FA"],
];

export const COLOR_GRADIENTS: Record<string, string[]> = {
  black:             ["#8E96A7", "#B8BFCD", "#ECEFF4"],
  "midnight-silver": ["#8190A5", "#AEB9C9", "#EAEEF3"],
  silver:            ["#8290A0", "#AEB7C6", "#EAEDF2"],
  white:             ["#B8C2D0", "#D0D7E1", "#F2F5F9"],
  gray:              ["#525C70", "#8B96A8", "#EBEEF3"],
  red:               ["#E8909C", "#F0B5BE", "#FBE2E5"],
  blue:              ["#86C2E8", "#B0D6F0", "#EAF2FA"],
  green:             ["#7BCBA7", "#A8DDC1", "#E4F3EB"],
  beige:             ["#D4B189", "#E4CCAE", "#F6EAD6"],
  brown:             ["#B98D6A", "#D0AC8D", "#EFE0CD"],
};
