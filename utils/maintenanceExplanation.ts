/**
 * Plain-English "why this service is due" copy for the detail sheet.
 * Ties the mileage math to the user's actual odometer + a warm
 * per-service consequence line. No "OEM" / "interval" jargon.
 */

import type { MaintenanceItem } from "@/components/cars/MaintenanceTracker";
import { formatMileage } from "@/lib/vehicle-passport";

export interface MaintenanceExplanation {
  fact: string;
  consequence: string;
}

// ─── Per-service consequence copy ──────────────────────────────────
// Keyed on the item's slug/id-prefix. Anchored items use short ids
// ("oil", "brakes", "tires", "battery", "inspection"); catalog items
// use v5 slugs like "spark_plugs", "coolant_flush".
const SERVICE_CONSEQUENCE: Record<string, string> = {
  oil: "Clean oil keeps your engine cool and reduces wear on moving parts.",
  oil_change: "Clean oil keeps your engine cool and reduces wear on moving parts.",
  brakes: "Worn pads increase stopping distance — replacing them keeps braking sharp and protects the rotors underneath.",
  brake_pad_replacement: "Worn pads increase stopping distance — replacing them keeps braking sharp and protects the rotors underneath.",
  brake_fluid_flush: "Brake fluid absorbs moisture over time; fresh fluid keeps the pedal firm and the system safe under heat.",
  rotor_replacement: "Warped or worn rotors cause vibration when braking — fresh ones restore smooth stops.",
  tires: "Rotating tires evens out wear so all four last longer and grip the road consistently.",
  tire_rotation: "Rotating tires evens out wear so all four last longer and grip the road consistently.",
  tire_replacement: "Fresh tires shorten stopping distance and grip better in rain and snow.",
  tire_balance: "Balanced wheels eliminate vibration and stop uneven tire wear.",
  wheel_alignment: "Proper alignment prevents your tires from wearing unevenly and keeps steering straight.",
  battery: "A fresh battery starts reliably in cold weather and avoids surprise dead-battery mornings.",
  battery_replacement: "A fresh battery starts reliably in cold weather and avoids surprise dead-battery mornings.",
  battery_test: "A quick test catches a weak battery before it strands you.",
  inspection: "Staying current avoids fines and keeps your registration valid.",
  state_inspection: "Staying current avoids fines and keeps your registration valid.",
  emissions_test: "Passing keeps your registration valid and confirms your engine's running cleanly.",
  spark_plugs: "Fresh plugs help your engine start reliably and burn fuel efficiently.",
  timing_belt: "A worn belt can snap and cause major engine damage — replacing it on schedule is the cheapest form of insurance.",
  serpentine_belt: "This belt drives your alternator, water pump, and A/C — replacing it before it snaps prevents a roadside breakdown.",
  coolant_flush: "Fresh coolant prevents your engine from overheating in summer and freezing in winter.",
  transmission_service: "Fresh transmission fluid keeps gear shifts smooth and prevents expensive transmission wear.",
  differential_service: "Fresh differential fluid keeps power delivery smooth and prevents expensive rear-end wear.",
  power_steering_flush: "Fresh fluid keeps steering light and responsive, especially at low speed.",
  fuel_system_cleaning: "A clean fuel system restores smooth idling and helps recover any lost fuel economy.",
  filter_replacement: "Fresh filters let your engine breathe cleanly and keep the cabin air comfortable.",
  diagnostic_scan: "A scan reads any hidden codes so small issues get caught before they grow.",
  check_engine_light: "A scan reads any hidden codes so small issues get caught before they grow.",
  pre_purchase_inspection: "A pro inspection can flag hidden problems before you commit to buying.",
};

// ─── Signal parsers ────────────────────────────────────────────────
// `signals` are pre-formatted UI strings (e.g. "60,890 mi (current)",
// "9 mo since last service"). We strip the label + units and read the
// leading number. Return null when nothing usable comes out — the
// caller falls back to a friendlier phrase.

function parseLeadingNumber(s: string | undefined): number | null {
  if (!s) return null;
  const match = s.match(/[\d,]+/);
  if (!match) return null;
  const n = parseInt(match[0].replace(/,/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

/** "6 mo / 5,000 mi" → { months: 6, miles: 5000 }. The anchored interval pill
 *  carries both axes in one string; either side may be absent. */
function parseIntervalAxes(s: string | undefined): { months: number | null; miles: number | null } {
  if (!s) return { months: null, miles: null };
  const num = (re: RegExp) => {
    const m = s.match(re);
    if (!m) return null;
    const n = parseInt(m[1].replace(/,/g, ""), 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return { months: num(/([\d,]+)\s*mo/), miles: num(/([\d,]+)\s*mi/) };
}

// ─── Freshness ─────────────────────────────────────────────────────
// A service this recent cannot be why anything is due: no real interval is
// used up inside a month and a thousand miles. Bug #428 — "You had brakes done
// about 0 months and 0 mi ago — you're getting close to when it's due again."
const FRESH_SERVICE_MS = 30 * 24 * 60 * 60 * 1000;
const FRESH_SERVICE_MILES = 1_000;

function isFreshlyServiced(
  item: MaintenanceItem,
  milesSince: number | null,
  monthsSince: number | null,
  now: number,
): boolean {
  if (milesSince != null && milesSince >= FRESH_SERVICE_MILES) return false;
  if (typeof item.lastServiceAt === "number") return now - item.lastServiceAt < FRESH_SERVICE_MS;
  return monthsSince === 0;
}

/** Who raised a flag on an item — for copy that names the real reason. */
function flaggedBy(item: MaintenanceItem): string | null {
  const p = item.mechanicProvenance;
  if (p?.mechanicName && p?.shopName) return `${p.mechanicName} at ${p.shopName}`;
  if (p?.mechanicName) return p.mechanicName;
  if (p?.shopName) return p.shopName;
  return item.mechanicFlag?.shopName ?? null;
}

// ─── Item type detection ───────────────────────────────────────────
// Item ids come in shapes: "oil" / "user-oil" / "unknown-oil"
// (anchored), "catalog-spark_plugs" (inference), "rec-<id>" (mechanic).
// Extract the canonical slug/type key used to look up copy.
function slugKey(item: MaintenanceItem): string {
  const id = item.id;
  if (id.startsWith("catalog-")) return id.slice("catalog-".length);
  if (id.startsWith("user-")) return id.slice("user-".length);
  if (id.startsWith("unknown-")) return id.slice("unknown-".length);
  if (id.startsWith("rec-")) {
    // Mechanic recs — best guess from serviceName; caller usually
    // falls through to the generic tier copy anyway.
    return item.serviceName.toLowerCase().replace(/\s+/g, "_");
  }
  return id;
}

function serviceNameLower(item: MaintenanceItem): string {
  // Lowercase form used inline in sentences ("your spark plugs is at...").
  // Fall back to the raw label if it's already short.
  return item.serviceName.toLowerCase();
}

// ─── Fact-sentence builder ─────────────────────────────────────────

function buildFact(item: MaintenanceItem, vehicleLabel: string, now: number): string {
  const service = serviceNameLower(item);
  const currentMiles = parseLeadingNumber(item.signals?.mileage);
  const intervalMiles = parseLeadingNumber(item.signals?.interval);
  const rawMonths = parseLeadingNumber(item.signals?.time);

  const isAnchorless = item.triggeredBy === "none";
  if (isAnchorless) {
    return `We don't have enough data on this yet. Book a diagnostic scan and a mechanic can firm it up.`;
  }

  // From-odometer inference (catalog): mileage carries CURRENT odometer.
  // Sentences use the noun phrase "the usual mileage for X" to sidestep
  // subject-verb agreement across singular ("brake fluid flush") and
  // plural ("spark plugs") service labels.
  if (item.triggeredBy === "inference" && currentMiles != null && intervalMiles != null) {
    if (item.status === "overdue") {
      const over = Math.max(0, currentMiles - intervalMiles);
      return `${vehicleLabel} is at ${formatMileage(currentMiles)}, which is about ${formatMileage(over)} past the usual mileage for ${service}.`;
    }
    if (item.status === "due_soon" || item.status === "needs_attention") {
      const left = Math.max(0, intervalMiles - currentMiles);
      return `${vehicleLabel} is at ${formatMileage(currentMiles)}. The usual mileage for ${service} is around ${formatMileage(intervalMiles)}, so you have about ${formatMileage(left)} to go.`;
    }
    // On time — reassuring
    return `${vehicleLabel} is at ${formatMileage(currentMiles)}. The usual mileage for ${service} is around ${formatMileage(intervalMiles)} — you're in good shape.`;
  }

  // Anchored records (oil / brakes / tires / battery / inspection):
  // signals.mileage = "X mi since last service", signals.time = "N mo since last service"

  // Just serviced. The interval can't be the reason for anything here, so
  // never say it is: either it's simply done, or something newer than the
  // service (a mechanic's follow-up, a fresh report) raised it — say that.
  if (isFreshlyServiced(item, currentMiles, rawMonths, now)) {
    if (item.status === "on_time" || item.status === "unknown") {
      return `You had ${service} done recently — nothing to do until the next one.`;
    }
    const who = flaggedBy(item);
    if (who) {
      return `You had ${service} done recently, and ${who} flagged it for a follow-up.`;
    }
    const why = item.description?.trim().replace(/\.$/, "");
    return why
      ? `You had ${service} done recently, but there's a newer note on it: ${why}.`
      : `You had ${service} done recently, but there's a newer note on it.`;
  }

  // Name only the axis that explains the status. Both used to be quoted
  // together whatever they said, which produced "45 months and 38 mi ago —
  // getting close": the months were the reason, the 38 mi were noise from an
  // odometer typo, and together they read as nonsense (#428).
  let months = rawMonths;
  let milesSince = currentMiles;
  if (months != null && milesSince != null) {
    const iv = parseIntervalAxes(item.signals?.interval);
    const timeRatio = iv.months ? months / iv.months : null;
    const mileRatio = iv.miles ? milesSince / iv.miles : null;
    if (timeRatio != null && mileRatio != null) {
      // Keep both only when they tell the same story.
      if (mileRatio < timeRatio * 0.5) milesSince = null;
      else if (timeRatio < mileRatio * 0.5) months = null;
    } else if (milesSince < FRESH_SERVICE_MILES) {
      milesSince = null;
    } else if (months === 0) {
      months = null;
    }
  }
  const hasMiles = milesSince != null;
  const hasMonths = months != null;

  if (item.status === "overdue") {
    if (hasMiles && hasMonths) {
      return `You had ${service} done about ${months} months and ${formatMileage(milesSince)} ago — that's past when it's usually due again.`;
    }
    if (hasMonths) {
      return `It's been about ${months} months since your last ${service}. That's past when most cars need this again.`;
    }
    if (hasMiles) {
      return `You've driven about ${formatMileage(milesSince)} since your last ${service}. That's past when it's usually due again.`;
    }
    return `Your ${service} is past due.`;
  }

  if (item.status === "due_soon" || item.status === "needs_attention") {
    if (hasMiles && hasMonths) {
      return `You had ${service} done about ${months} months and ${formatMileage(milesSince)} ago — you're getting close to when it's due again.`;
    }
    if (hasMonths) {
      return `It's been about ${months} months since your last ${service} — getting close to when it's due again.`;
    }
    if (hasMiles) {
      return `You've driven about ${formatMileage(milesSince)} since your last ${service} — getting close to when it's due again.`;
    }
    return `Your ${service} is getting close to due.`;
  }

  // Nothing on file. "Looks fine" would claim a finding we don't have — and
  // after a rotation the Tires card lands here, where it used to read as
  // healthy for a tread life nobody has recorded (#413).
  if (item.status === "unknown" && !hasMiles && !hasMonths) {
    return `We don't have a record of your last ${service} yet — add it if you know it, or a mechanic can check at your next visit.`;
  }

  // On time (anchored)
  if (hasMiles && hasMonths) {
    return `You had ${service} done about ${months} months and ${formatMileage(milesSince)} ago — you've got plenty of time before the next one.`;
  }
  if (hasMonths) {
    return `You had ${service} done about ${months} months ago — you've got plenty of time.`;
  }
  if (hasMiles) {
    return `You've only driven about ${formatMileage(milesSince)} since your last ${service} — you're in good shape.`;
  }
  // No signal at all (mechanic rec or sparse record)
  return `Your ${service} looks fine right now.`;
}

// ─── Consequence-sentence builder ──────────────────────────────────

function buildConsequence(item: MaintenanceItem): string {
  const key = slugKey(item);
  const specific = SERVICE_CONSEQUENCE[key];
  if (specific) return specific;
  // Fallback per-tier
  switch (item.status) {
    case "overdue":
      return "It's worth addressing soon to avoid bigger repairs down the line.";
    case "due_soon":
      return "Planning ahead beats getting stuck when it's convenient.";
    case "needs_attention":
      return "Catching this early is cheaper than waiting.";
    case "on_time":
      return "Nothing to do right now — we'll flag it as it gets closer.";
    default:
      return "Book a diagnostic scan and a mechanic can firm it up.";
  }
}

export function explainMaintenanceItem(
  item: MaintenanceItem,
  vehicleLabel?: string,
  now: number = Date.now(),
): MaintenanceExplanation {
  const label = vehicleLabel && vehicleLabel.trim().length > 0
    ? `Your ${vehicleLabel}`
    : "Your car";
  return {
    fact: buildFact(item, label, now),
    consequence: buildConsequence(item),
  };
}
