/**
 * Warning-light copy must not stutter.
 *
 * LIGHT_LABELS entries are bare nouns/adjectives because every consumer
 * appends its own noun — `${label} warning light is on`. `not_sure_which`
 * shipped as "Unknown warning", which rendered on the Cars tab as
 * "Unknown warning warning light is on — diagnostic scan recommended."
 */
import { describe, expect, it } from "vitest";
import { LIGHT_LABELS, buildWarningLightItem } from "@/lib/warningLightItems";

describe("warning light copy", () => {
  it("no label carries the word the template adds", () => {
    for (const [id, label] of Object.entries(LIGHT_LABELS)) {
      expect(label.toLowerCase(), `LIGHT_LABELS.${id}`).not.toContain("warning");
      expect(label.toLowerCase(), `LIGHT_LABELS.${id}`).not.toContain("light");
    }
  });

  it("an unidentified light reads cleanly", () => {
    // `not_sure_which` — the follow-up answer, where a light IS confirmed on.
    // Plain `not_sure` produces no item at all; see warningLightVocab.test.ts.
    const item = buildWarningLightItem({ knownIssues: ["not_sure_which"], scopeId: "v1" });
    expect(item).not.toBeNull();
    expect(item!.serviceName).toBe("Unidentified warning light");
    expect(item!.description).toBe(
      "Unidentified warning light is on — diagnostic scan recommended.",
    );
    for (const text of [item!.serviceName, item!.description]) {
      expect(/\b(\w+)\s+\1\b/i.test(text), `stutter in "${text}"`).toBe(false);
    }
  });
})
