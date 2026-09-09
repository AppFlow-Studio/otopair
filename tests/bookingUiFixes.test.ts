import { describe, expect, it } from "vitest";

import { formatPadTypeLabel } from "../constants/rotorFlow";
import { calculateBookingConfirmLayout } from "../lib/bookingConfirmSheet";

describe("booking UI fixes", () => {
  it("keeps tall wide Android screens on the full responsive sheet height", () => {
    expect(calculateBookingConfirmLayout({ width: 418, height: 916 })).toEqual({
      copyTopPercent: "34%",
      lottieTranslateY: -12,
      sheetHeight: 513,
    });
  });

  it("can label brake pads when the shop response has a pad type but no brand", () => {
    expect(formatPadTypeLabel("oem_recommended")).toBe("OEM recommended");
  });
});
