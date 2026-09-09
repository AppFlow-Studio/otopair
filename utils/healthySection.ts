/**
 * Chip label for the tracker's two quiet sections.
 *
 * HEALTHY and UNKNOWN are separate sections, not one mixed list. "Healthy"
 * is a claim — we looked and it was fine — and an item with no record on
 * file is not evidence of that, so the two must not share a heading or a
 * count. Ahmad, 2026-08-30: "I don't like healthy and unknown being bunched
 * up, they should be separate."
 */
export type QuietSectionVariant = "healthy" | "unknown";

export function healthySectionChip(
  variant: QuietSectionVariant,
  count: number,
): string {
  return `${variant === "healthy" ? "HEALTHY" : "UNKNOWN"} · ${count}`;
}

/** Split a tier's items into the two quiet sections. */
export function splitQuietItems<T extends { status: string }>(
  items: readonly T[],
): { healthy: T[]; unknown: T[] } {
  const healthy: T[] = [];
  const unknown: T[] = [];
  for (const item of items) {
    (item.status === "unknown" ? unknown : healthy).push(item);
  }
  return { healthy, unknown };
}
