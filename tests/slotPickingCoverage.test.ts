// Lane M3 of the commit-time re-validation program: slot picking opts into
// the hold lease + releases holds before resets (#393), and every entry point
// that pins a shop respects what it offers (#404).
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import {
  doesntOfferLabel,
  droppedServicesToast,
  joinServiceNames,
  serviceNamesFor,
  servicesShopDoesntOffer,
} from "@/lib/shopServiceCoverage";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("shopServiceCoverage (#404)", () => {
  const shop = { serviceIds: ["oil", "brakes"] };

  test("an unhydrated shop is unknown, never 'offers everything'", () => {
    expect(servicesShopDoesntOffer(undefined, ["oil"])).toBeNull();
    expect(servicesShopDoesntOffer(null, [])).toBeNull();
  });

  test("returns the cart ids the shop doesn't offer, in cart order", () => {
    expect(servicesShopDoesntOffer(shop, ["flush", "oil", "coolant"])).toEqual([
      "flush",
      "coolant",
    ]);
    expect(servicesShopDoesntOffer(shop, ["oil", "brakes"])).toEqual([]);
    expect(servicesShopDoesntOffer({ serviceIds: [] }, ["oil"])).toEqual(["oil"]);
  });

  test("names prefer the display label and never leak an id", () => {
    const catalog = [
      { id: "flush", name: "brake_fluid_flush", displayLabel: "Brake Fluid Flush" },
      { id: "oil", name: "Oil Change" },
    ];
    expect(serviceNamesFor(["flush", "oil", "gone"], catalog)).toEqual([
      "Brake Fluid Flush",
      "Oil Change",
      "a service",
    ]);
  });

  test("copy", () => {
    expect(joinServiceNames(["A"])).toBe("A");
    expect(joinServiceNames(["A", "B", "C"])).toBe("A, B and C");
    expect(doesntOfferLabel(["Brake Fluid Flush"])).toBe("Doesn't offer Brake Fluid Flush");
    expect(doesntOfferLabel(["A", "B", "C"])).toBe("Doesn't offer 3 of your services");
    expect(droppedServicesToast("Anesa Shop", ["Brake Fluid Flush"])).toEqual({
      title: "Anesa Shop doesn't offer Brake Fluid Flush",
      body: "We took it out of your booking.",
    });
    expect(droppedServicesToast(null, ["A", "B"]).title).toBe("This shop doesn't offer A and B");
  });
});

describe("slot holds (#393)", () => {
  test("regular checkouts opt into the lease; quote holds don't", () => {
    expect(source("app/(booking-flow)/choose-mechanic.tsx")).toContain("lease: true");
    expect(source("app/(booking-flow)/pick-datetime.tsx")).toContain(
      "lease: quoteHoldContext ? undefined : true",
    );
  });

  test("hold failures show the server sentence, not fixed copy", () => {
    for (const path of [
      "app/(booking-flow)/choose-mechanic.tsx",
      "app/(booking-flow)/pick-datetime.tsx",
    ]) {
      const screen = source(path);
      expect(screen).toContain('"SLOT_UNAVAILABLE"');
      expect(screen).toContain("formatBookingError(");
    }
  });

  test("every reset that can strand a hold releases it first", () => {
    const release = source("lib/releaseHeldSlot.ts");
    expect(release).toContain("api.slotHolds.releaseSlotHold");
    expect(release).toContain(".catch(() => {})");
    for (const path of [
      "lib/session-state.ts",
      "hooks/useBookingTransition.ts",
      "app/booking/shop/[id]/index.tsx",
      "app/booking/mechanic/[id]/index.tsx",
    ]) {
      const file = source(path);
      const releaseAt = file.indexOf("releaseHeldSlot();");
      expect(releaseAt, path).toBeGreaterThan(-1);
      expect(file.indexOf("resetBookingFlow()", releaseAt), path).toBeGreaterThan(releaseAt);
    }
  });
});

describe("pinned-shop entry points (#404)", () => {
  test("choose-mechanic gates the CTA and the calendar on coverage", () => {
    const screen = source("app/(booking-flow)/choose-mechanic.tsx");
    expect(screen).toContain("activeShopBlocked");
    expect(screen).toContain("doesntOfferLabel(activeMissingNames)");
    expect(screen).not.toContain("getShopById(preSelectedShopId)");
  });

  test("category tab subscribes to the shop object and never fails open", () => {
    const screen = source("app/(booking-flow)/category/[tab].tsx");
    expect(screen).toContain("s.shops[preSelectedShopId]");
    expect(screen).not.toContain("shopServiceIdSet.size > 0");
    expect(screen).toContain("pinnedShopLoading");
  });

  test("routing entry points drop services the pinned shop doesn't offer", () => {
    for (const path of [
      "components/booking-flow/QuickBookRow.tsx",
      "components/booking-flow/HeroCardMostBooked.tsx",
      "app/booking/shop/[id]/index.tsx",
      "app/(booking-flow)/category/[tab].tsx",
    ]) {
      expect(source(path), path).toContain("dropServicesShopDoesntOffer(");
    }
    expect(source("components/ai-chat/BookServiceComponent.tsx")).toContain(
      "servicesShopDoesntOffer(handoffShop",
    );
  });
});
