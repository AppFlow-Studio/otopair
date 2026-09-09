import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("message sheet returns to booking details when its booking has no shop", () => {
  const details = source("components/bookings/BookingDetailsSheet.tsx");
  const messageSheet = source("components/bookings/MessageShopSheet.tsx");

  expect(details).toContain("if (!booking?.shopId) return;");
  expect(details).toContain("shopId: booking.shopId");
  expect(messageSheet).toContain("shopId?: string");
  expect(messageSheet).toContain("if (visible && !params?.shopId)");
  expect(messageSheet).toContain("close();");
});
