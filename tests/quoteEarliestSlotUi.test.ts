import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

test("tire and rotor quote cards expose conditional earliest-time actions", () => {
  for (const path of [
    "components/tire-booking/TireQuoteCard.tsx",
    "components/rotor-booking/RotorQuoteCard.tsx",
  ]) {
    const card = source(path);
    expect(card).toContain("Book earliest time");
    expect(card).toContain("Choose a different time");
    expect(card).toContain("Choose time");
    expect(card).toContain("onBookEarliest");
  }
});

test("both quote sheets pass the server availability flag into the fast path", () => {
  for (const path of [
    "components/bookings/QuoteListSheet.tsx",
    "components/bookings/RotorQuoteListSheet.tsx",
  ]) {
    const sheet = source(path);
    expect(sheet).toContain("earliest_slot_available");
    expect(sheet).toContain('autoConfirmEarliest: "1"');
    expect(sheet).toContain("handleBookEarliest");
  }
});

test("picker recovers from a stale earliest slot with the shared floating sheet", () => {
  const picker = source("app/(booking-flow)/pick-datetime.tsx");
  expect(picker).toContain("FloatingSheet");
  expect(picker).toContain("That time is no longer available");
  expect(picker).toContain("The shop's earliest appointment was just taken");
  expect(picker).toContain("autoConfirmEarliest");
  expect(picker).toContain("quote_context");
});

test("quote acceptance receives the active checkout hold", () => {
  const confirming = source("app/booking/mechanic/[id]/confirming.tsx");
  expect(confirming).toContain("hold_id");
  expect(confirming).toContain("session_id");
});
