import { describe, expect, it } from "vitest";

import {
  buildInspectionFindingRows,
  type CustomerInspectionSnapshot,
} from "../../lib/inspection-findings";

describe("buildInspectionFindingRows", () => {
  it("formats all four tire minimums and present rotor readings", () => {
    const snapshot: CustomerInspectionSnapshot = {
      tire_tread_32nds: {
        front_left: 6,
        front_right: 7,
        rear_left: 8,
        rear_right: 9,
      },
      rotor_thickness: {
        front_left: { entered_value: 1.027, entered_unit: "in" },
        front_right: { entered_value: 26.09, entered_unit: "mm" },
      },
    };

    expect(buildInspectionFindingRows(snapshot)).toEqual([
      {
        title: "Tire tread",
        values: [
          { label: "Front left", value: '6/32"' },
          { label: "Front right", value: '7/32"' },
          { label: "Rear left", value: '8/32"' },
          { label: "Rear right", value: '9/32"' },
        ],
      },
      {
        title: "Rotor thickness",
        values: [
          { label: "Front left", value: "1.027 in" },
          { label: "Front right", value: "26.09 mm" },
        ],
      },
    ]);
  });

  it("returns no sections for legacy approvals", () => {
    expect(buildInspectionFindingRows(null)).toEqual([]);
  });
});
