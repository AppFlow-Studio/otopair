import { describe, expect, it } from "vitest";

import { formatLocationLabel } from "@/lib/locationLabel";

describe("formatLocationLabel", () => {
  it("THE BUG: Android's Staten Island reads like iOS — borough and ST", () => {
    // What Google's geocoder returned on the Android emulator.
    expect(
      formatLocationLabel({
        city: null,
        district: "Staten Island",
        subregion: "Richmond County",
        region: "New York",
        isoCountryCode: "US",
      }).label,
    ).toBe("Staten Island, NY");
  });

  it("leaves an iOS-style address as it was", () => {
    expect(
      formatLocationLabel({ city: "New York", region: "NY", isoCountryCode: "US" }),
    ).toEqual({ label: "New York, NY", city: "New York", state: "NY" });
  });

  it("falls back to the county when there is no city or district", () => {
    expect(
      formatLocationLabel({ subregion: "Richmond County", region: "New York", isoCountryCode: "US" }).label,
    ).toBe("Richmond County, NY");
  });

  it("keeps the provider's region text outside the US", () => {
    expect(
      formatLocationLabel({ city: "Al Farafra", region: "The New Valley Governorate", isoCountryCode: "EG" }).label,
    ).toBe("Al Farafra, The New Valley Governorate");
  });

  it("says Current Location when the address has no place name", () => {
    expect(formatLocationLabel({}).label).toBe("Current Location");
  });
});
