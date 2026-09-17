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
