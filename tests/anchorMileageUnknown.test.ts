/**
 * When we don't know the mileage, we say so.
 *
 * Replaces tests/anchorVelocity.test.ts, which pinned the opposite rule.
 *
 * The history matters, because this reverses a decision twice. Quick Check v2
 * §7 step 1 specifies that a "roughly when" answer with no odometer reading
 * becomes a mileage anchor of `current miles − (months since × velocity)`.
 * That shipped, and on a 2025 G-Class reading 200,000 miles it anchored a
 * spark-plug service at 184,938 and reported the plugs healthy with 44,928
 * miles of interval left. Cross-checking the driver's stated band against the
 * odometer-derived rate narrowed the error but did not remove it — a lifetime
 * average is still a guess about one specific past interval.
 *
 * Ahmad, 2026-09-09: "in a situation like that where we have to estimate or
 * guess what the mileage was, I think it's best for us to just say we don't
 * have enough info and tell them to do a diagnostic scan instead."
 *
 * So no estimate at all. The scope is deliberately narrow — refuse only where
 * the date genuinely tells us nothing, and use the time axis wherever a
 * service has one.
 */
import { describe, expect, it } from "vitest";
import { resolveQuickCheckAnchor } from "@/utils/quickCheckAnchor";
import { computeFromOdometerStatus } from "@/utils/maintenanceStatus";
import { classInterval } from "@/utils/classIntervals";

const NOW = new Date(2026, 8, 9).getTime();
const WHEN = { answerType: "when" as const, month: 3, year: 2024 };

/** The reported car: 2025 G-Class, 200,000 miles, plugs "done March 2024". */
function statusFor(slug: string, answer: Record<string, unknown> = WHEN) {
  const anchor = resolveQuickCheckAnchor({
    answer: answer as never,
    currentOdometer: 200_000,
    avgMonthlyDriving: "light",
    vehicleYear: 2025,
    now: NOW,
  } as never);
  const iv = classInterval(slug, "B", { drivetrain: "rwd", hasDifferential: true })!;
  return computeFromOdometerStatus({
    interval_miles: iv.miles,
    interval_months: iv.months,
    currentOdometer: 200_000,
    lastServiceMileage: anchor.lastServiceMileage,
    lastServiceDate: anchor.lastServiceDate,
    now: NOW,
    serviceName: slug,
  });
}

describe("the anchor no longer invents a mileage", () => {
  it("returns a date and nothing else", () => {
    const a = resolveQuickCheckAnchor({
      answer: WHEN as never, currentOdometer: 200_000,
      avgMonthlyDriving: "light", vehicleYear: 2025, now: NOW,
    } as never);
    expect(a.lastServiceDate).toBeDefined();
    expect(a.lastServiceMileage).toBeUndefined();
  });
});

describe("miles-only services report unknown", () => {
  // Spark plugs, transmission, differential and brake pads have NO months
  // side, so a date alone leaves both axes unmeasurable. This is the case that
  // started it: the plugs were healthy on a number we made up.
  it.each(["spark_plugs", "transmission_service", "differential_service", "brake_pad_replacement"])(
    "%s -> unknown, not a guess",
    (slug) => {
      const r = statusFor(slug);
      expect(r.status).toBe("unknown");
      expect(r.description).toMatch(/scan/i);
    },
  );

  it("scores properly the moment the driver supplies the mileage", () => {
    // The optional mileage field's whole payoff.
    const r = statusFor("spark_plugs", { ...WHEN, miles: 195_000 });
    expect(r.status).not.toBe("unknown");
    expect(r.description).toBe("55,000 mi of interval remaining");
  });
});

describe("services with a time axis still measure", () => {
  it("uses the months side of the interval as real information", () => {
    // 18 months past a 12-month oil interval, known exactly from the date the
    // driver gave. Refusing to answer here would throw away a fact.
    // 30 months against a 12-month interval is 2.5x — severely overdue, which
    // displays as `overdue`. Known exactly from the date the driver gave.
    const r = statusFor("oil_change");
    expect(r.status).toBe("overdue");
    expect(r.bandStatus).toBe("severely_overdue");
    expect(r.description).toMatch(/past interval/);
  });

  it.each(["coolant_flush", "tire_replacement"])("%s scores on time alone", (slug) => {
    expect(statusFor(slug).status).not.toBe("unknown");
  });

  it("does NOT check the mileage half, and that is the known trade-off", () => {
    // Accepted with the decision: a car doing 10,000 miles a month reads its
    // six-month-old oil as fine, because the miles axis is simply not checked.
    // The alternative was a guessed anchor, which is what we just removed.
    const r = statusFor("oil_change", { answerType: "when", month: 3, year: 2026 });
    expect(r.status).toBe("on_time");
    expect(r.milesRemaining).toBeUndefined();
  });
});

describe("the other answers are untouched", () => {
  it("'Never on this car' still measures both axes", () => {
    // Zero miles at the model year is a FACT the driver gave us, not a guess,
    // so it scores exactly as before.
    const a = resolveQuickCheckAnchor({
      answer: { answerType: "never" } as never,
      currentOdometer: 200_000, vehicleYear: 2025, now: NOW,
    } as never);
    expect(a.lastServiceMileage).toBe(0);
    expect(a.lastServiceDate).toBeDefined();
    expect(statusFor("spark_plugs", { answerType: "never" }).status).not.toBe("unknown");
  });

  it("'Not sure' still writes an empty anchor", () => {
    expect(
      resolveQuickCheckAnchor({
        answer: { answerType: "unsure" } as never,
        currentOdometer: 200_000, vehicleYear: 2025, now: NOW,
      } as never),
    ).toEqual({});
  });
});

describe("an absent mileage is not zero", () => {
  it("does not report a just-serviced car as 200,000 miles overdue", () => {
    // `lastServiceMileage ?? 0` used to measure from the car being new, which
    // is the loudest possible wrong answer for a service the driver has just
    // told us about.
    const r = computeFromOdometerStatus({
      interval_miles: 60_000,
      interval_months: null,
      currentOdometer: 200_000,
      lastServiceMileage: undefined,
      lastServiceDate: new Date(2026, 5, 1).getTime(),
      now: NOW,
      serviceName: "Spark plugs",
    });
    expect(r.status).toBe("unknown");
    expect(r.description).not.toMatch(/past interval/);
  });

  it("still treats a REAL zero as a real anchor", () => {
    const r = computeFromOdometerStatus({
      interval_miles: 60_000,
      interval_months: null,
      currentOdometer: 200_000,
      lastServiceMileage: 0,
      lastServiceDate: new Date(2025, 0, 1).getTime(),
      now: NOW,
      serviceName: "Spark plugs",
    });
    expect(r.status).toBe("overdue");
  });
});
