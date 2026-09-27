/**
 * Chip label for the tracker's two quiet sections.
 *
 * HEALTHY and UNKNOWN are separate sections, not one mixed list. "Healthy"
 * is a claim — we looked and it was fine — and an item with no record on
 * file is not evidence of that, so the two must not share a heading or a
 * count. Ahmad, 2026-08-30: "I don't like healthy and unknown being bunched
 * up, they should be separate."
 */
export type QuietSectionVariant = "healthy" | "unknown" | "needsInfo";

const CHIP_LABEL: Record<QuietSectionVariant, string> = {
  healthy: "HEALTHY",
  unknown: "UNKNOWN",
  // Not "one more detail": the count is not always one, and a label that
  // promises a single field is a promise the section cannot keep (Ahmad,
  // 2026-09-14). "Needs more info" is plain, says what to do rather than how
  // it feels, and stays true whether one field is missing or several.
  needsInfo: "NEEDS MORE INFO",
};

export function healthySectionChip(
  variant: QuietSectionVariant,
  count: number,
): string {
  return `${CHIP_LABEL[variant]} · ${count}`;
}

/** Split a tier's items into the two quiet sections. */
export function splitQuietItems<T extends { status: string; unknownReason?: string }>(
  items: readonly T[],
): { healthy: T[]; unknown: T[]; needsInfo: T[] } {
  const healthy: T[] = [];
  const unknown: T[] = [];
  const needsInfo: T[] = [];
  for (const item of items) {
    if (item.status !== "unknown") {
      healthy.push(item);
      continue;
    }
    // An answered-but-incomplete service is its own state, not a flavour of
    // "we know nothing". Splitting it out is what makes answering VISIBLY do
    // something: the row leaves the unknown list and lands somewhere new
    // (Yassin via Ahmad, 2026-09-14 — "nothing really changes on the screen").
    if (item.unknownReason === "missing_mileage") needsInfo.push(item);
    else unknown.push(item);
  }
  return { healthy, unknown, needsInfo };
}
