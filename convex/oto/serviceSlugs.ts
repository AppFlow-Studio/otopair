// =============================================================================
// Oto service slugs — the catalog slug Haiku meant
// =============================================================================
//
// render_book_service and render_vehicle_update take service slugs as free
// strings, and Haiku names services its own way. In the 2026-10-01 stress
// runs 78 of 215 save-card claims and 57 of 466 booking-card slugs were not in
// OTOPAIR_SERVICE_SLUGS. A save-card claim the catalog doesn't know writes no
// maintenance record — every air-filter log was lost while the card said
// "logged" — and a booking-card slug it doesn't know pre-checks nothing. The
// dispatcher maps both cards' slugs through here, and vehicleTruth does too,
// for cards saved before this existed.
//
// "first_service", "scheduled_maintenance", "scheduled_service" … (54 of the
// 57 stray booking-card slugs) name no catalog service, so they map to
// nothing: Oto asks which services the user wants instead of picking for
// them. chat.ts sends such a card back to the model (bookingCardRejection)
// and treats the question that follows as a drill-down (isServicePicker).

import { OTOPAIR_SERVICE_SLUGS, type OtopairServiceSlug } from "./tools";
import { TAXONOMY_LIST } from "../../constants/serviceTaxonomy";

const isCatalogSlug = (slug: string): slug is OtopairServiceSlug =>
  (OTOPAIR_SERVICE_SLUGS as readonly string[]).includes(slug);

/** Other names for catalog services: the ones Haiku used in those runs, and
 *  the older vocabulary lib/bookServicePrefill.ts still accepts. */
const ALIASES: Readonly<Record<string, OtopairServiceSlug>> = {
  engine_air_filter_replacement: "filter_replacement",
  cabin_air_filter_replacement: "filter_replacement",
  air_filter_replacement: "filter_replacement",
  air_filter: "filter_replacement",
  brake_fluid_replacement: "brake_fluid_flush",
  brake_fluid_change: "brake_fluid_flush",
  brake_fluid: "brake_fluid_flush",
  brake_pads: "brake_pad_replacement",
  wheel_balance: "tire_balance",
};

/** The catalog slug Haiku meant, or null when it names no catalog service. */
export function canonicalServiceSlug(raw: string): OtopairServiceSlug | null {
  const slug = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (isCatalogSlug(slug)) return slug;
  return ALIASES[slug] ?? null;
}

/** A booking card's slugs as catalog slugs, in order, without repeats. */
export function canonicalServiceSlugs(raw: unknown): OtopairServiceSlug[] {
  if (!Array.isArray(raw)) return [];
  const slugs: OtopairServiceSlug[] = [];
  for (const entry of raw) {
    const slug = typeof entry === "string" ? canonicalServiceSlug(entry) : null;
    if (slug && !slugs.includes(slug)) slugs.push(slug);
  }
  return slugs;
}

/** The name the booking grid shows for a catalog service ("Air & cabin filters"). */
const serviceLabel = (slug: OtopairServiceSlug): string =>
  TAXONOMY_LIST.find((entry) => entry.slug === slug)?.label ?? slug;

/**
 * The tool result that sends a booking card back to the model when a name on
 * it isn't a catalog service, or it names none — the card would open with
 * nothing picked under "Everything's set up for the first service". Null
 * when the card can go out.
 */
export function bookingCardRejection(serviceSlugs: unknown): string | null {
  const names = Array.isArray(serviceSlugs) ? serviceSlugs : [];
  const strays = names.filter((name) => typeof name !== "string" || !canonicalServiceSlug(name));
  if (names.length > 0 && strays.length === 0) return null;
  const problem = strays.length
    ? `${strays.map((name) => JSON.stringify(name)).join(", ")} ${strays.length === 1 ? "is not a service" : "are not services"} the app books.`
    : "The card needs at least one service.";
  const catalog = OTOPAIR_SERVICE_SLUGS.map((slug) => `${slug} (${serviceLabel(slug)})`).join(", ");
  return (
    `Not shown: the user hasn't seen this reply. ${problem} The card takes only these services: ${catalog}. ` +
    "Don't choose for the user. If they named services from this list in other words, or said yes when you offered them by name, open the card with those slugs. " +
    'Otherwise ask which services they want: write the question and call render_quick_replies with the services that fit (each chip\'s id the slug, its text the service\'s name) plus "Something else", then open the card with exactly what they pick.'
  );
}

// Booking-grid labels, lowercased with punctuation dropped, for chips that
// use the label ("Air & cabin filters") instead of the slug.
const labelKey = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const SLUG_BY_LABEL = new Map<string, OtopairServiceSlug>();
for (const slug of OTOPAIR_SERVICE_SLUGS) SLUG_BY_LABEL.set(labelKey(serviceLabel(slug)), slug);

/** The catalog service a render_quick_replies chip names — by its id
 *  ("oil_change"), value or text ("Oil change", "Air & cabin filters") — or
 *  null ("Something else", "Mostly when I first brake"). */
export function chipServiceSlug(chip: unknown): OtopairServiceSlug | null {
  if (!chip || typeof chip !== "object") return null;
  const { id, value, text } = chip as Record<string, unknown>;
  for (const field of [id, value, text]) {
    if (typeof field !== "string") continue;
    const slug = canonicalServiceSlug(field) ?? SLUG_BY_LABEL.get(labelKey(field));
    if (slug) return slug;
  }
  return null;
}

// Chips naming a diagnosis belong to symptom narrowing, which the polite exit
// exists to end, so they never make a row a service picker.
const DIAGNOSES: ReadonlySet<OtopairServiceSlug> = new Set(["diagnostic_scan", "check_engine_light"]);

/**
 * True when a reply's chips ask the user which service to book: the
 * drill-down question for "set up that first service" or "book my scheduled
 * maintenance". On that turn chat.ts holds the polite-exit count (two of
 * these questions must not force a diagnostic scan onto a maintenance
 * booking) and skips the booking repair (which would push the model to pick
 * a service after all).
 *
 * `chips` is the reply's render_quick_replies list ({ id, text, value? }),
 * undefined when it has none. chipServiceSlug tells which catalog service a
 * chip names, or null.
 */
export function isServicePicker(chips: readonly unknown[] | undefined): boolean {
  const services = new Set<OtopairServiceSlug>();
  for (const chip of chips ?? []) {
    const slug = chipServiceSlug(chip);
    if (slug && !DIAGNOSES.has(slug)) services.add(slug);
  }
  // Two different services: a single one is a yes/no on that service ("Book
  // the oil change" / "Not now"), and skipping the booking repair there would
  // drop a card the user already asked for.
  return services.size >= 2;
}
