import { describe, expect, test } from "vitest";
import {
  canSelectServiceForVehicle,
  canSelectVehicleForService,
  filterSelectableServicesForVehicle,
} from "../lib/serviceBookability";

describe("canSelectServiceForVehicle", () => {
  test("blocks non-bookable services for a selected vehicle", () => {
    expect(
      canSelectServiceForVehicle({
        ownershipId: "owner_1",
        serviceId: "svc_air_filter",
        serviceSlug: "air_cabin_filters",
        bookableIds: new Set(["svc_battery_test"]),
      }),
    ).toBe(false);
  });

  test("allows bookable, handoff, and no-vehicle services", () => {
    expect(
      canSelectServiceForVehicle({
        ownershipId: "owner_1",
        serviceId: "svc_battery_test",
        serviceSlug: "battery_test",
        bookableIds: new Set(["svc_battery_test"]),
      }),
    ).toBe(true);

    expect(
      canSelectServiceForVehicle({
        ownershipId: "owner_1",
        serviceId: "svc_tire_replacement",
        serviceSlug: "tire_replacement",
        bookableIds: new Set(),
      }),
    ).toBe(true);

    expect(
      canSelectServiceForVehicle({
        ownershipId: null,
        serviceId: "svc_air_filter",
        serviceSlug: "air_cabin_filters",
        bookableIds: new Set(),
      }),
    ).toBe(true);
  });

  test("filters a bundle to only services bookable for the selected vehicle", () => {
    const services = [
      { id: "svc_battery_test", slug: "battery_test" },
      { id: "svc_coolant_flush", slug: "coolant_flush" },
      { id: "svc_tire_replacement", slug: "tire_replacement" },
    ];

    expect(
      filterSelectableServicesForVehicle(services, {
        ownershipId: "owner_1",
        bookableIds: new Set(["svc_battery_test"]),
      }).map((service) => service.id),
    ).toEqual(["svc_battery_test", "svc_tire_replacement"]);
  });
});

describe("canSelectVehicleForService", () => {
  test("blocks a vehicle when the selected dedicated service is not bookable", () => {
    expect(
      canSelectVehicleForService({
        ownershipId: "owner_1",
        serviceId: "svc_tire_replacement",
        bookableIds: new Set(["svc_battery_test"]),
      }),
    ).toBe(false);
  });

  test("blocks while bookability is loading for a known vehicle and service", () => {
    expect(
      canSelectVehicleForService({
        ownershipId: "owner_1",
        serviceId: "svc_rotor_replacement",
        bookableIds: null,
        isLoading: true,
      }),
    ).toBe(false);
  });

  test("blocks owned vehicles while the selected dedicated service is unresolved", () => {
    expect(
      canSelectVehicleForService({
        ownershipId: "owner_1",
        serviceId: null,
        bookableIds: new Set(["svc_rotor_replacement"]),
      }),
    ).toBe(false);
  });

  test("allows a vehicle when the selected dedicated service is bookable", () => {
    expect(
      canSelectVehicleForService({
        ownershipId: "owner_1",
        serviceId: "svc_rotor_replacement",
        bookableIds: new Set(["svc_rotor_replacement"]),
      }),
    ).toBe(true);
  });
});
