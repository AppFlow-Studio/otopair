/**
 * #434 (Kareem, Sep 27): Oto opened a booking card for an oil change "at
 * Kareem-Shop tomorrow at 8:00 PM" (the shop closes at 5:00 PM), for a time
 * already taken, and for a "2019 Honda Civic" he doesn't own. Reproduced on
 * Android 2026-10-01: Oto can't see shop hours or open slots, and only knows
 * the chat's own car, not the rest of the garage.
 */
import { describe, expect, it } from "vitest";
import { internal } from "../convex/_generated/api";
import { buildEnvelope } from "../convex/oto/envelope";
import {
  asksToBook,
  BOOKABLE_AVAILABILITY,
  namedTimes,
  namesATime,
  shopsNamedIn,
  talksShopTimes,
} from "../convex/oto/shopAvailability";
import { makeT } from "./helpers";

// Thursday Oct 1 2026, 3:00 PM in New York.
const NOW = Date.UTC(2026, 9, 1, 19, 0);
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// One-mechanic shop open 9–5 on weekdays; Friday 10:00 is booked.
async function seedShop(t: ReturnType<typeof makeT>) {
  await t.run(async (ctx: any) => {
    const ownerId = await ctx.db.insert("users", {
      clerkUserId: "owner_434", onboardingCompleted: true, createdAt: NOW,
    });
    const shopId = await ctx.db.insert("shops", {
      name: "Waleedservicecenter",
      owner_user_id: ownerId,
      is_active: true,
      onboarding_complete: true,
      stripe_connect_account_id: "acct_test",
      stripe_charges_enabled: true,
      stripe_payouts_enabled: true,
      stripe_requirements_currently_due: [],
      labor_rate: 120,
      timezone: "America/New_York",
    } as any);
    const mechanicId = await ctx.db.insert("mechanics", {
      shop_id: shopId, first_name: "Waleed", last_name: "Mechanic", is_active: true,
    } as any);
    const serviceId = await ctx.db.insert("services", { name: "Oil Change" } as any);
    await ctx.db.insert("shop_services", { shop_id: shopId, service_id: serviceId, is_offered: true } as any);
    for (let day = 0; day < 7; day++) {
      const weekend = day === 0 || day === 6;
      await ctx.db.insert("shops_hours", {
        shop_id: shopId,
        day_of_week: day,
        day_name: DAY_NAMES[day],
        ...(weekend ? { is_closed: true } : { open_time: "09:00", close_time: "17:00", is_closed: false }),
      } as any);
    }
    const customerId = await ctx.db.insert("users", {
      clerkUserId: "customer_434", onboardingCompleted: true, createdAt: NOW,
    });
    await ctx.db.insert("bookings", {
      user_id: customerId,
      vin: "1FMSK8FH4MGA53887",
      service_ids: [serviceId],
      shop_id: shopId,
      mechanic_id: mechanicId,
      scheduled_date: "2026-10-02",
      scheduled_time: "10:00",
      status: "confirmed",
      created_at: NOW,
      updated_at: NOW,
    } as any);
  });
}

async function check(t: ReturnType<typeof makeT>, args: { shop_name: string; date: string; time?: string; weekday?: string }) {
  return (await t.query(internal.oto.shopAvailability.checkShopAvailability, { ...args, now: NOW } as never)) as any;
}

describe("checking a requested shop and time before booking", () => {
  it("refuses 8 PM when the shop closes at 5, and offers that day's latest times", async () => {
    const t = makeT();
    await seedShop(t);
    const r = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-02", time: "20:00" });
    expect(r.status).toBe("outside_hours");
    expect(r.hours).toBe("9:00 AM to 5:00 PM");
    expect(r.alternatives).toContain("Fri, Oct 2, 4:30 PM");
  });

  it("refuses a time that is already booked, and offers the nearest free ones", async () => {
    const t = makeT();
    await seedShop(t);
    const r = await check(t, { shop_name: "waleed service center", date: "2026-10-02", time: "10:00" });
    expect(r.status).toBe("taken");
    expect(r.alternatives.length).toBeGreaterThan(0);
    expect(r.alternatives).not.toContain("Fri, Oct 2, 10:00 AM");
  });

  it("says when the shop is closed that day", async () => {
    const t = makeT();
    await seedShop(t);
    const r = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-03", time: "10:00" });
    expect(r.status).toBe("closed_that_day");
    expect(r.alternatives[0]).toMatch(/^Mon, Oct 5/);
  });

  // Checked as Sunday Oct 4, "Saturday at 10" came back available and Oto told
  // the user a closed day was open. Naming the day lets the model catch it.
  it("names the day it checked", async () => {
    const t = makeT();
    await seedShop(t);
    const r = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-03", time: "10:00" });
    expect(r.day).toBe("Sat, Oct 3");
  });

  // Told "sunday at 1400", the model checked Tue, Oct 6 and said the time was
  // open (2 of 250 checks went to a Tuesday, 2026-10-01).
  it("checks the weekday the user named when the date falls on another day", async () => {
    const t = makeT();
    await seedShop(t);
    const sunday = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-06", time: "14:00", weekday: "Sunday" });
    expect(sunday.day).toBe("Sun, Oct 4");
    expect(sunday.status).toBe("closed_that_day");
    const friday = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-03", time: "10:00", weekday: "friday" });
    expect(friday.day).toBe("Fri, Oct 2");
    expect(friday.status).toBe("taken");
  });

  it("never moves the check before today, and leaves a matching date alone", async () => {
    const t = makeT();
    await seedShop(t);
    const wednesday = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-01", time: "10:00", weekday: "Wednesday" });
    expect(wednesday.day).toBe("Wed, Oct 7");
    expect(wednesday.status).toBe("available");
    const friday = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-02", time: "13:00", weekday: "Friday" });
    expect(friday.date).toBe("2026-10-02");
  });

  it("gives the day's latest open time, not just the first few", async () => {
    const t = makeT();
    await seedShop(t);
    const r = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-02" });
    expect(r.status).toBe("open");
    expect(r.open_times[0]).toBe("Fri, Oct 2, 9:00 AM");
    expect(r.last_open_time).toBe("Fri, Oct 2, 4:30 PM");
  });

  // Told Saturday was closed, with "Sun 9:00 to 9:45 AM" as the alternatives,
  // Oto said Sunday at 10 was taken (3 of 10 runs, 2026-10-01).
  it("gives the latest open time on the day it offers instead, and next to a taken time", async () => {
    const t = makeT();
    await seedShop(t);
    const closed = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-03", time: "10:00" });
    expect(closed.alternatives).toEqual([
      "Mon, Oct 5, 9:00 AM",
      "Mon, Oct 5, 9:15 AM",
      "Mon, Oct 5, 9:30 AM",
      "Mon, Oct 5, 9:45 AM",
    ]);
    expect(closed.last_open_time).toBe("Mon, Oct 5, 4:30 PM");
    const taken = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-02", time: "10:00" });
    expect(taken.last_open_time).toBe("Fri, Oct 2, 4:30 PM");
  });

  it("refuses a time that has already passed today", async () => {
    const t = makeT();
    await seedShop(t);
    const r = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-01", time: "11:00" });
    expect(r.status).toBe("past");
  });

  it("confirms a free time", async () => {
    const t = makeT();
    await seedShop(t);
    const r = await check(t, { shop_name: "Waleedservicecenter", date: "2026-10-02", time: "13:00" });
    expect(r.status).toBe("available");
  });

  it("reports a shop it can't find, with the shops it can book", async () => {
    const t = makeT();
    await seedShop(t);
    const r = await check(t, { shop_name: "Midas Queens", date: "2026-10-02", time: "13:00" });
    expect(r.status).toBe("shop_not_found");
    expect(r.bookable_shops).toEqual(["Waleedservicecenter"]);
  });
});

// In long chats the model still opened a card under "8 PM won't work", and the
// diagnostic fallback opened one under "let me check that time" (#434).
describe("when a booking card may go out", () => {
  it("only after an answer that leaves a bookable time", () => {
    expect(BOOKABLE_AVAILABILITY.has("available")).toBe(true);
    expect(BOOKABLE_AVAILABILITY.has("open")).toBe(true);
    for (const refused of ["outside_hours", "taken", "closed_that_day", "past", "fully_booked", "shop_not_found"]) {
      expect(BOOKABLE_AVAILABILITY.has(refused)).toBe(false);
    }
  });

  it("knows when the user is naming a time", () => {
    expect(namesATime("can i bring it to anesa shop tonight at 8?")).toBe(true);
    expect(namesATime("how about 4:30")).toBe(true);
    expect(namesATime("Saturday at 10 AM")).toBe(true);
    expect(namesATime("20:00 at the G-Class shop")).toBe(true);
    expect(namesATime("it clunks at 80 mph")).toBe(false);
    expect(namesATime("it's been getting worse over the last month")).toBe(false);
    expect(namesATime("the battery reads 5 amps")).toBe(false);
  });

  it("reads 24-hour times written without a colon, but not revs or miles", () => {
    expect(namesATime("let's set up that first service at Temur Auto & Motor this sunday at 1400")).toBe(true);
    expect(namesATime("monday at 0800 then?")).toBe(true);
    expect(namesATime("it hesitates at 1500 rpm")).toBe(false);
    expect(namesATime("the light came on at 1000 miles")).toBe(false);
  });

  // The booking repair counts only a check of the user's own time: asked to
  // check "just book 8pm", the model checked 3:45 to 4:30 instead and opened
  // the card on 3:45 (2 of 10 runs, 2026-10-01).
  it("reads the time the user named as HH:MM, both ways when it could be either", () => {
    expect(namedTimes("i talked to the owner and he said he'd stay late for me, just book 8pm")).toEqual(["20:00"]);
    expect(namedTimes("fine, sunday at 10am then")).toEqual(["10:00"]);
    expect(namedTimes("Saturday at 10 AM")).toEqual(["10:00"]);
    expect(namedTimes("anesa shop friday at 4:45pm?")).toEqual(["16:45"]);
    expect(namedTimes("12pm or 12am?")).toEqual(["12:00", "00:00"]);
    expect(namedTimes("let's set up that first service at Temur Auto & Motor this sunday at 1400")).toEqual(["14:00"]);
    expect(namedTimes("20:00 at the G-Class shop")).toEqual(["20:00"]);
    expect(namedTimes("monday 9:30 works")).toEqual(["09:30", "21:30"]);
    expect(namedTimes("can i bring it to anesa shop tonight at 8?")).toEqual(["08:00", "20:00"]);
    expect(namedTimes("noon works")).toEqual(["12:00"]);
    expect(namedTimes("it hesitates at 1500 rpm, worse at 80 mph")).toEqual([]);
    expect(namedTimes("can i bring it in tonight?")).toEqual([]);
    expect(namesATime("can i bring it in tonight?")).toBe(true);
  });

  it("knows when the user is asking to book", () => {
    expect(asksToBook("let's set up that first service at Temur Auto & Motor this sunday at 1400")).toBe(true);
    expect(asksToBook("monday at 0800 then?")).toBe(true);
    expect(asksToBook("monday 9:30 works")).toBe(true);
    expect(asksToBook("can you book my g wagon's first service?")).toBe(true);
    expect(asksToBook("how many miles until the first scheduled service?")).toBe(false);
    expect(asksToBook("my g wagon only has about 5k miles on it. when is its first service due?")).toBe(false);
    expect(asksToBook("should i book an oil change now?")).toBe(false);
  });
});

describe("the <user> block lists the garage", () => {
  it("names every car the user owns, so an unowned Civic stands out", () => {
    const envelope = buildEnvelope({
      userFirstName: "Waleed",
      vehicle: { id: "veh_m5", display: "2020 BMW M5 Competition", vin: "WBSJF0C03LCD42488" },
      history: [],
      userMessage: "Book an oil change for my 2019 Honda Civic",
      garage: ["2020 BMW M5 Competition", "2022 Mercedes-Benz SL-Class"],
    });
    expect(envelope).toContain("garage: 2020 BMW M5 Competition; 2022 Mercedes-Benz SL-Class");
  });
});

describe("the polite-exit block", () => {
  const base = {
    userFirstName: "Waleed",
    vehicle: { id: "veh_m5", display: "2020 BMW M5 Competition", vin: "WBSJF0C03LCD42488" },
    history: [],
    diagnosticTurnCount: 3,
  };

  it("still asks a stalled diagnosis to conclude", () => {
    expect(buildEnvelope({ ...base, userMessage: "it only clunks on rough roads" })).toContain("<polite_exit_required>");
  });

  // Told "just book 8pm" after 8 PM was refused, the model opened the card
  // because the block said to (1 of 10 runs, 2026-10-01).
  it("stays out of a turn where the user picks a time", () => {
    expect(
      buildEnvelope({ ...base, userMessage: "i talked to the owner and he said he'd stay late for me, just book 8pm" }),
    ).not.toContain("<polite_exit_required>");
  });
});

// Told "can i bring it to anesa shop tonight at 8?", Oto asked "which shop is
// it?" and "is it Anesa Service Center?" for three turns in 4 of 12 checked
// conversations, then 2 of 5 after the tool description told it not to.
describe("the <user> block names the shops the user mentioned", () => {
  const SHOPS = ["Anesa Shop", "Kareem-Shop", "Temur Auto & Motor", "Waleedservicecenter", "Auto Shop"];

  it("finds a shop by its name however it's typed, or by its first word", () => {
    expect(shopsNamedIn(["can i bring it to anesa shop tonight at 8?"], SHOPS)).toEqual(["Anesa Shop"]);
    expect(shopsNamedIn(["book my m5 for an oil change at kareem-shop friday at 11am"], SHOPS)).toEqual(["Kareem-Shop"]);
    expect(shopsNamedIn(["what does Temur have saturday?"], SHOPS)).toEqual(["Temur Auto & Motor"]);
    expect(shopsNamedIn(["at waleed service center tomorrow"], SHOPS)).toEqual(["Waleedservicecenter"]);
  });

  it("doesn't take a generic word for a shop", () => {
    expect(shopsNamedIn(["any auto place near me open saturday?"], SHOPS)).toEqual([]);
    expect(shopsNamedIn(["ok what's the latest i can get in today?"], SHOPS)).toEqual([]);
  });

  it("keeps the shop from an earlier message in view", () => {
    expect(
      shopsNamedIn(["ok what's the latest i can get in today?", "can i bring it to anesa shop tonight at 8?"], SHOPS),
    ).toEqual(["Anesa Shop"]);
  });

  it("only looks shops up when the chat is about shops, days or times", () => {
    expect(talksShopTimes("can i bring it to anesa shop tonight at 8?")).toBe(true);
    expect(talksShopTimes("what about saturday")).toBe(true);
    expect(talksShopTimes("how about 4:30")).toBe(true);
    expect(talksShopTimes("my m5 is making a clunk over bumps on the front left")).toBe(false);
  });

  it("puts them on a shops named line", () => {
    const envelope = buildEnvelope({
      userFirstName: "Waleed",
      vehicle: { id: "veh_m5", display: "2020 BMW M5 Competition", vin: "WBSJF0C03LCD42488" },
      history: [],
      userMessage: "can i bring it to anesa shop tonight at 8?",
      shopsNamed: ["Anesa Shop"],
    });
    expect(envelope).toContain("shops named: Anesa Shop");
  });

  it("lists only shops that can take a booking", async () => {
    const t = makeT();
    await seedShop(t);
    await t.run((ctx: any) => ctx.db.insert("shops", { name: "Not Set Up Yet", is_active: true } as any));
    expect(await t.query(internal.oto.shopAvailability.bookableShopNames, {})).toEqual(["Waleedservicecenter"]);
  });
});
