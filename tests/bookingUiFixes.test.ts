import { describe, expect, it } from "vitest";

import { formatPadTypeLabel } from "../constants/rotorFlow";
import { calculateBookingConfirmLayout } from "../lib/bookingConfirmSheet";

describe("booking UI fixes", () => {
  it("keeps tall wide Android screens on the full responsive sheet height", () => {
    const layout = calculateBookingConfirmLayout({ width: 418, height: 916 });
    expect(layout.sheetHeight).toBe(513);
    expect(layout.lottieTranslateY).toBe(-12);
    // copyTop replaced copyTopPercent in #243 — it is derived from the pin's
    // bottom edge rather than a per-bucket percentage, so assert the gap the
    // fix guarantees instead of a literal that would have to be recomputed.
    expect(layout.copyTop).toBe(Math.round(916 * 0.31) + layout.lottieTranslateY + 38);
  });

  it("can label brake pads when the shop response has a pad type but no brand", () => {
    expect(formatPadTypeLabel("oem_recommended")).toBe("OEM recommended");
  });
});
