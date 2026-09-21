/**
 * Vehicle display names.
 *
 * Bookings carry the vehicle as one string — "Make Model Trim …" — because
 * that is what the booking payload denormalises. Surfaces that show a car in a
 * confined space want just the make and model: "Mercedes-Benz G-Class Amg G63"
 * wraps to two lines on a booking card and pushes everything below it down,
 * and the trim is not what identifies the car to its owner. The Cars tab
 * already shows make + model this way, from separate fields.
 *
 * The parsing is not a naive `slice(0, 2)`. Three cases break that:
 *   - two-word makes            "Land Rover Range Rover Sport" → Land Rover Range Rover
 *   - models that start with a word that looks like a trim
 *                               "Tesla Model 3 Long Range"     → Tesla Model 3
 *   - numeric model lines       "BMW 7 Series 750i xDrive"     → BMW 7 Series
 */

/** Makes whose name is two words, so the model starts at the third token. */
const TWO_WORD_MAKES = new Set(["land rover", "alfa romeo", "aston martin"]);

/**
 * Models whose name is two words.
 *
 * Without this "Land Rover Range Rover Sport" becomes "Land Rover Range" — a
 * two-word model under a two-word make, which is the case that breaks every
 * simpler rule. The list is deliberately short: these are parsed from a
 * denormalised string, and the real fix is for the booking payload to carry
 * make and model separately the way `vehicle_configs` already does.
 */
const TWO_WORD_MODELS = new Set([
  "range rover",
  "grand cherokee",
  "grand wagoneer",
  "santa fe",
  "santa cruz",
]);

/** "Make Model Trim …" → "Make Model", trim dropped. */
export function vehicleMakeModel(carModel: string): string {
  const tokens = carModel.trim().split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) return carModel.trim();

  const makeLen = TWO_WORD_MAKES.has(`${tokens[0]} ${tokens[1]}`.toLowerCase())
    ? 2
    : 1;
  const make = tokens.slice(0, makeLen).join(" ");
  const rest = tokens.slice(makeLen);
  if (rest.length === 0) return make;

  const first = rest[0];
  const second = rest[1];
  let model = first;
  if (second) {
    const pair = `${first} ${second}`.toLowerCase();
    // "Tesla Model 3" and "BMW 7 Series" are the same shape as the explicit
    // list: a first word that means nothing on its own.
    if (
      TWO_WORD_MODELS.has(pair) ||
      first.toLowerCase() === "model" ||
      (/^\d+$/.test(first) && second.toLowerCase() === "series")
    ) {
      model = `${first} ${second}`;
    }
  }
  return `${make} ${model}`;
}

/** Same, with the year in front: "2025 Mercedes-Benz G-Class". */
export function vehicleYearMakeModel(
  year: string | undefined,
  carModel: string,
): string {
  return [(year ?? "").trim(), vehicleMakeModel(carModel)]
    .filter(Boolean)
    .join(" ");
}

/**
 * Brands that are initialisms rather than words, so they survive casing.
 * Longer than the 3-character rule below, or ambiguous without the list.
 */
const BRAND_ACRONYMS = new Set(["BMW", "GMC", "MG", "RAM", "FIAT", "SRT", "BYD", "AMG"]);

/** Title-case one alphanumeric run, preserving designators. */
function titleCaseSegment(segment: string): string {
  if (!segment) return segment;
  const upper = segment.toUpperCase();
  if (BRAND_ACRONYMS.has(upper)) return upper;

  // Already mixed case — the source made a choice; do not overrule it.
  // Keeps "Class" in "SL-Class" and "iM" in "Scion iM".
  if (segment !== upper && segment !== segment.toLowerCase()) return segment;

  // A short all-caps run is a designator, not a word: SL, GT, CX, Q7, XSE.
  if (segment === upper && upper.length <= 3) return upper;

  // A very short all-lowercase run is the same designator arriving from a
  // source that lost its casing ("sl-class"). Capped at two characters: a
  // mixed-case source is preserved above, so a real two-letter model name
  // like Ford's "Ka" never reaches here.
  if (segment === segment.toLowerCase() && segment.length <= 2) return upper;

  return segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase();
}

/**
 * Casing for a vehicle make/model, consistent across every screen.
 *
 * Two different implementations were in the app and they disagreed, which is
 * what #259 reported: setup showed the raw "MERCEDES-BENZ SL-Class" while Cars
 * and Oto showed "Mercedes-benz Sl-class".
 *
 *   - the Cars copy split on SPACES only, so a hyphen never started a new word
 *     and "MERCEDES-BENZ" collapsed to "Mercedes-benz"
 *   - the bookings copy used /\b\w/ which does break on hyphens, but lowercased
 *     first, so "SL-Class" came out "Sl-Class" — the designator was destroyed
 *
 * This replaces alphanumeric runs in place, so every separator the source had
 * survives, and each run is judged on its own.
 */
export function titleCaseVehicleName(str: string): string {
  return str.replace(/[A-Za-z0-9]+/g, titleCaseSegment);
}
