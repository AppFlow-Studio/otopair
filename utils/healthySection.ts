/**
 * Label for the quiet bottom section of the maintenance tracker.
 *
 * "HEALTHY · N" is a claim, so N counts only items actually observed to be
 * fine. Items with no record on file share this section — they are equally
 * un-urgent, and the three-tier rule (NOW / SOON / HEALTHY) means they get no
 * heading of their own — but an absence of data is not evidence of health and
 * must not be counted as such. When the section holds nothing but blanks, the
 * chip says exactly that instead of calling them healthy.
 *
 * Lives here rather than in the component so it can be unit-tested: importing
 * MaintenanceTracker.tsx pulls in react-native, which the test runner can't
 * parse. This is a health claim, so it is worth asserting on directly.
 */
export function healthySectionChip(
  items: readonly { status: string }[],
): { label: string; knownHealthy: number } {
  const knownHealthy = items.filter((i) => i.status !== "unknown").length;
  const notOnFile = items.length - knownHealthy;
  const label =
    knownHealthy > 0
      ? `HEALTHY · ${knownHealthy}${notOnFile > 0 ? ` · ${notOnFile} NOT ON FILE` : ""}`
      : `NOT ON FILE · ${notOnFile}`;
  return { label, knownHealthy };
}
