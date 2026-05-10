/**
 * computeInitials
 *
 * PURPOSE: One source of truth for the user's two-letter initials.
 *          Used by Home (top-left circular button) and Settings
 *          (avatar fallback when no photo). Keeps the two screens
 *          from drifting if the derivation logic ever changes.
 *
 * Pulls the first letter of `first` and `last`, uppercases, falls
 * back to "AJ" (legacy default from settings/index.tsx) when both
 * are empty.
 */

interface ComputeInitialsArgs {
  first?: string | null;
  last?: string | null;
  fallback?: string;
}

export function computeInitials({
  first,
  last,
  fallback = "AJ",
}: ComputeInitialsArgs): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  const a = f.length > 0 ? f[0] : "";
  const b = l.length > 0 ? l[0] : "";
  const value = `${a}${b}`.toUpperCase();
  return value.length > 0 ? value : fallback;
}
