import { describe, expect, it } from "vitest";

import { getRotorAxleCenters, ROTOR_AXLE_ICON_SIZE } from "./rotorAxleLayout";

describe("rotor axle selector layout", () => {
  it.each([320, 356, 390])(
    "keeps visible rotor centers inside the measured hit surface at %dpx",
    (surfaceWidth) => {
      const centers = getRotorAxleCenters(surfaceWidth);
      const iconRadius = ROTOR_AXLE_ICON_SIZE / 2;

      expect(centers.left).toBeGreaterThanOrEqual(iconRadius);
      expect(centers.right).toBeLessThanOrEqual(surfaceWidth - iconRadius);
    },
  );
});
