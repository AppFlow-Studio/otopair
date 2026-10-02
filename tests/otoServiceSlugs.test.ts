import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  bookingCardRejection,
  canonicalServiceSlug,
  canonicalServiceSlugs,
  chipServiceSlug,
  isServicePicker,
} from "../convex/oto/serviceSlugs";
import { OTO_TOOLS, OTOPAIR_SERVICE_SLUGS } from "../convex/oto/tools";
import { executeTool } from "../convex/oto/dispatcher";

// Haiku names services its own way on both cards. In the 2026-10-01 stress
// runs 78 of 215 save-card claims (every air filter) wrote no maintenance
// record while the card said "logged", and 57 of 466 booking-card slugs
// (mostly "first_service") pre-checked nothing.

async function render(name: string, input: Record<string, unknown>) {
  const res = await executeTool({ type: "tool_use", id: "t1", name, input }, {});
  return (JSON.parse(res.content) as { data: { value: Record<string, unknown> } }).data.value;
}

type Claim = { service_slug: string; kind: string; service_date?: unknown };

describe("canonicalServiceSlug", () => {
  it("keeps every catalog slug as it is", () => {
    for (const slug of OTOPAIR_SERVICE_SLUGS) expect(canonicalServiceSlug(slug)).toBe(slug);
  });

  it("maps the names Haiku used in the stress runs to their catalog service", () => {
    expect(canonicalServiceSlug("engine_air_filter_replacement")).toBe("filter_replacement");
    expect(canonicalServiceSlug("cabin_air_filter_replacement")).toBe("filter_replacement");
    expect(canonicalServiceSlug("air_filter_replacement")).toBe("filter_replacement");
    expect(canonicalServiceSlug("brake_fluid_replacement")).toBe("brake_fluid_flush");
    expect(canonicalServiceSlug("brake_fluid_change")).toBe("brake_fluid_flush");
  });

  it("maps the older vocabulary the booking card still accepts", () => {
    expect(canonicalServiceSlug("air_filter")).toBe("filter_replacement");
    expect(canonicalServiceSlug("brake_pads")).toBe("brake_pad_replacement");
    expect(canonicalServiceSlug("wheel_balance")).toBe("tire_balance");
  });

  it("reads kebab-case, spaces and capitals as the same slug", () => {
    expect(canonicalServiceSlug("oil-change")).toBe("oil_change");
    expect(canonicalServiceSlug(" Cabin Air Filter Replacement ")).toBe("filter_replacement");
  });

  it("returns null for a service the catalog doesn't have", () => {
    expect(canonicalServiceSlug("wiper_blade_replacement")).toBeNull();
    expect(canonicalServiceSlug("")).toBeNull();
  });

  it("maps no scheduled-service name to a service: the user picks", () => {
    for (const name of [
      "first_service",
      "initial_service",
      "scheduled_service",
      "scheduled_maintenance",
      "first_scheduled_service",
      "scheduled_service_first",
    ]) {
      expect(canonicalServiceSlug(name)).toBeNull();
    }
  });
});

describe("canonicalServiceSlugs", () => {
  it("maps, drops what it can't map, and keeps the first of a repeat", () => {
    expect(
      canonicalServiceSlugs(["air_filter", "oil_change", "wiper_blade_replacement", "filter_replacement"]),
    ).toEqual(["filter_replacement", "oil_change"]);
  });

  it("returns an empty list for anything that isn't a list", () => {
    expect(canonicalServiceSlugs(undefined)).toEqual([]);
    expect(canonicalServiceSlugs("oil_change")).toEqual([]);
  });
});

describe("the cards go out with catalog slugs", () => {
  it("booking card: a stray slug is mapped and an unknown one dropped", async () => {
    const value = await render("render_book_service", {
      service_slugs: ["brake_fluid_change", "wiper_blade_replacement"],
    });
    expect(value.service_slugs).toEqual(["brake_fluid_flush"]);
  });

  it("save card: an air-filter claim becomes filter_replacement and keeps its date", async () => {
    const value = await render("render_vehicle_update", {
      service_claims: [{ service_slug: "cabin_air_filter_replacement", kind: "completed", service_date: "2026-08-30" }],
    });
    const claims = value.service_claims as Claim[];
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ service_slug: "filter_replacement", kind: "completed" });
    expect(typeof claims[0].service_date).toBe("number");
  });

  it("save card: a claim the catalog has nothing for stays off the card", async () => {
    const value = await render("render_vehicle_update", {
      mileage: 92000,
      service_claims: [
        { service_slug: "wiper_blade_replacement", kind: "completed" },
        { service_slug: "oil_change", kind: "completed" },
      ],
    });
    expect((value.service_claims as Claim[]).map((c) => c.service_slug)).toEqual(["oil_change"]);
    expect(value.mileage).toBe(92000);
  });
});

describe("Haiku sees the catalog", () => {
  const schema = (tool: string) => {
    const found = OTO_TOOLS.find((t) => t.name === tool);
    if (!found) throw new Error(`${tool} is not in OTO_TOOLS`);
    return found;
  };

  it("booking card: service_slugs takes only catalog slugs", () => {
    const slugs = schema("render_book_service").input_schema.properties.service_slugs as {
      items: { enum: readonly string[] };
    };
    expect(slugs.items.enum).toEqual(OTOPAIR_SERVICE_SLUGS);
  });

  it("save card: service_slug takes only catalog slugs", () => {
    const claims = schema("render_vehicle_update").input_schema.properties.service_claims as {
      items: { properties: { service_slug: { enum: readonly string[] } } };
    };
    expect(claims.items.properties.service_slug.enum).toEqual(OTOPAIR_SERVICE_SLUGS);
  });

  it("the booking card tells the model to ask instead of picking", () => {
    const { description } = schema("render_book_service");
    expect(description).toContain("BOOK ONLY WHAT THE USER CHOSE");
    expect(description).toContain("Never fill in oil_change");
  });
});

describe("bookingCardRejection", () => {
  it("lets a card of catalog services (or their aliases) through", () => {
    expect(bookingCardRejection(["oil_change", "tire_rotation"])).toBeNull();
    expect(bookingCardRejection(["brake_fluid_change"])).toBeNull();
  });

  it("sends back a card that names no catalog service, listing the catalog", () => {
    const message = bookingCardRejection(["first_service"]);
    expect(message).not.toBeNull();
    expect(message).toContain('"first_service" is not a service');
    for (const slug of OTOPAIR_SERVICE_SLUGS) expect(message).toContain(slug);
    expect(message).toContain("Air & cabin filters");
    expect(message).toContain("render_quick_replies");
    expect(message).toContain("hasn't seen this reply");
  });

  it("sends back a card with any stray name, even next to a real one", () => {
    expect(bookingCardRejection(["oil_change", "scheduled_maintenance"])).toContain(
      '"scheduled_maintenance" is not a service',
    );
  });

  it("sends back a card with no services at all", () => {
    expect(bookingCardRejection([])).toContain("needs at least one service");
    expect(bookingCardRejection(undefined)).toContain("needs at least one service");
    expect(bookingCardRejection([42])).toContain("42 is not a service");
  });
});

describe("chipServiceSlug", () => {
  it("reads the service from the chip's id, value or text", () => {
    expect(chipServiceSlug({ id: "oil_change", text: "Oil change" })).toBe("oil_change");
    expect(chipServiceSlug({ id: "opt_1", text: "Tire rotation" })).toBe("tire_rotation");
    expect(chipServiceSlug({ id: "opt_2", text: "Air & cabin filters" })).toBe("filter_replacement");
    expect(chipServiceSlug({ id: "opt_3", text: "Brakes", value: "brake_pad_replacement" })).toBe(
      "brake_pad_replacement",
    );
  });

  it("returns null for a chip that names no service", () => {
    expect(chipServiceSlug({ id: "other", text: "Something else" })).toBeNull();
    expect(chipServiceSlug({ id: "first_stop", text: "Mostly when I first brake" })).toBeNull();
    expect(chipServiceSlug("oil_change")).toBeNull();
    expect(chipServiceSlug(null)).toBeNull();
  });
});

// The contract any service-picker rule has to keep. Edge cases (one service
// chip, a "Diagnostic scan" chip next to symptom chips) are the rule's call.
describe("isServicePicker", () => {
  it("is false with no chips", () => {
    expect(isServicePicker(undefined)).toBe(false);
    expect(isServicePicker([])).toBe(false);
  });

  it("is true for a which-services question", () => {
    expect(
      isServicePicker([
        { id: "oil_change", text: "Oil & filter change" },
        { id: "filter_replacement", text: "Air & cabin filters" },
        { id: "tire_rotation", text: "Tire rotation" },
        { id: "other", text: "Something else" },
      ]),
    ).toBe(true);
  });

  it("is false for symptom narrowing and yes/no chips", () => {
    expect(
      isServicePicker([
        { id: "first_stop", text: "Mostly when I first brake" },
        { id: "whole_stop", text: "The whole time" },
        { id: "unsure", text: "Not sure" },
        { id: "just_book", text: "Just book a mechanic" },
      ]),
    ).toBe(false);
    expect(isServicePicker([{ id: "yes", text: "Yes" }, { id: "no", text: "No" }])).toBe(false);
  });

  it("is false for a yes/no on one service, or diagnoses only", () => {
    // The user already named the oil change: the booking repair must stay on.
    expect(
      isServicePicker([
        { id: "oil_change", text: "Book the oil change" },
        { id: "not_now", text: "Not now" },
      ]),
    ).toBe(false);
    // Symptom narrowing, which the polite exit still has to end.
    expect(
      isServicePicker([
        { id: "diagnostic_scan", text: "Diagnostic scan" },
        { id: "check_engine_light", text: "Check engine light" },
        { id: "other", text: "Something else" },
      ]),
    ).toBe(false);
  });
});

// chat.ts's turn loop runs against Anthropic, so these pin the wiring in the
// source; the stress harness covers the behavior.
describe("chat.ts drill-down wiring", () => {
  const chat = readFileSync(join(__dirname, "../convex/oto/chat.ts"), "utf8");
  const between = (from: string, to: string) => {
    const start = chat.indexOf(from);
    const end = chat.indexOf(to, start);
    expect(start, `missing: ${from}`).toBeGreaterThanOrEqual(0);
    expect(end, `missing after it: ${to}`).toBeGreaterThan(start);
    return chat.slice(start, end);
  };

  it("sends a stray booking card back to the model instead of rendering it", () => {
    expect(chat).toContain("bookingCardRejection(bookingCard.input.service_slugs)");
    expect(chat).toContain("if (terminalToolUses.length > 0 && cardRejection === null) {");
    expect(chat).toContain("if (dataToolUses.length === 0 && cardRejection === null) {");
    expect(chat).toContain("content: [...stateAckResults, ...dataResults, ...rejectedResults],");
  });

  it("skips the booking repair for a service picker and never takes a stray card from it", () => {
    const repair = between("const theirTimes = namedTimes(message);", "// #434 — told \"8 PM won't work");
    expect(repair).toContain("!servicePicker &&");
    const strayCheck = repair.indexOf("if (card && bookingCardRejection(card.input.service_slugs) !== null) break;");
    expect(strayCheck).toBeGreaterThanOrEqual(0);
    expect(strayCheck).toBeLessThan(repair.indexOf("if (card && cardOk) {"));
  });

  it("holds the polite-exit count on a service picker and never forces a diagnostic scan over it", () => {
    const counter = between("const renderedBooking = renderEnvelope.bookService !== undefined;", "setDiagnosticTurnCount");
    const hold = counter.indexOf("} else if (servicePicker) {");
    expect(hold).toBeGreaterThanOrEqual(0);
    expect(hold).toBeLessThan(counter.indexOf("nextCount = diagnosticTurnCount + 1;"));
    const backstop = between("diagnosticTurnCount >= POLITE_EXIT_THRESHOLD &&", "const recentUserTurns");
    expect(backstop).toContain("!servicePicker");
  });
});
