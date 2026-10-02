// Checks on Oto's finished reply for slips that the long #434 / #425 test
// conversations still produced on 2026-10-01 (Haiku 4.5, prompt v0.64). The
// prompt and the tool descriptions ask for the right behavior; these fix the
// reply when the model slips anyway.

import { KNOWN_MAKES } from "../../utils/formatMake";
import { OTO_TOOL_NAMES } from "./tools";

// ── A car that isn't in the garage ───────────────────────────────────────
// "My wife has a 2019 Honda Civic too, can you book her an oil change?" got
// "start a new chat from the car picker for your wife's Civic" in 8 of 10
// checked turns. The car picker lists only the garage and can't add a car,
// so that sends the user nowhere.

// Makes that are also everyday words ("had to dodge a pothole").
const AMBIGUOUS_MAKES = new Set(["dodge", "ram", "mini", "genesis", "lincoln"]);
const MAKE_ALIASES: Record<string, string> = {
  chevy: "Chevrolet",
  benz: "Mercedes-Benz",
  "range rover": "Land Rover",
};
// Models people name without the make ("her civic").
const MODELS: Record<string, readonly [make: string, model: string]> = {
  civic: ["Honda", "Civic"],
  accord: ["Honda", "Accord"],
  "cr-v": ["Honda", "CR-V"],
  camry: ["Toyota", "Camry"],
  corolla: ["Toyota", "Corolla"],
  rav4: ["Toyota", "RAV4"],
  prius: ["Toyota", "Prius"],
  tacoma: ["Toyota", "Tacoma"],
  highlander: ["Toyota", "Highlander"],
  "f-150": ["Ford", "F-150"],
  mustang: ["Ford", "Mustang"],
  silverado: ["Chevrolet", "Silverado"],
  altima: ["Nissan", "Altima"],
  forester: ["Subaru", "Forester"],
  crosstrek: ["Subaru", "Crosstrek"],
  wrangler: ["Jeep", "Wrangler"],
  "model s": ["Tesla", "Model S"],
  "model 3": ["Tesla", "Model 3"],
  "model x": ["Tesla", "Model X"],
  "model y": ["Tesla", "Model Y"],
  elantra: ["Hyundai", "Elantra"],
  sorento: ["Kia", "Sorento"],
  jetta: ["Volkswagen", "Jetta"],
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const MAKE_BY_KEY = new Map<string, string>();
for (const [key, make] of Object.entries(KNOWN_MAKES)) {
  if (!AMBIGUOUS_MAKES.has(key)) MAKE_BY_KEY.set(norm(key), make);
}
for (const [key, make] of Object.entries(MAKE_ALIASES)) MAKE_BY_KEY.set(norm(key), make);
const MODEL_BY_KEY = new Map(Object.entries(MODELS).map(([key, value]) => [norm(key), value]));

// A hyphen is optional ("crv", "f150"); a space needs some separator, so
// "model s" doesn't match "models".
const MENTION_RE = new RegExp(
  `\\b(${[...Object.keys(KNOWN_MAKES).filter((k) => !AMBIGUOUS_MAKES.has(k)), ...Object.keys(MAKE_ALIASES), ...Object.keys(MODELS)]
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[- ]/g, (c) => (c === "-" ? "[- ]?" : "[- ]")))
    .join("|")})\\b`,
  "gi",
);

interface CarMention {
  year?: string;
  make: string;
  model?: string;
}

/** Cars named in a piece of text, with a year written right before them. */
export function carMentions(text: string): CarMention[] {
  const out: CarMention[] = [];
  let lastEnd = -1;
  for (const match of text.matchAll(MENTION_RE)) {
    const key = norm(match[1]);
    const start = match.index ?? 0;
    const model = MODEL_BY_KEY.get(key);
    const previous = out[out.length - 1];
    // "honda civic": a model right after its make belongs to that mention.
    if (model && previous && !previous.model && previous.make === model[0] && /^\s*$/.test(text.slice(lastEnd, start))) {
      previous.model = model[1];
      lastEnd = start + match[0].length;
      continue;
    }
    const year = text.slice(Math.max(0, start - 5), start).match(/\b((?:19|20)\d{2})\s$/)?.[1];
    out.push({ ...(year ? { year } : {}), make: model?.[0] ?? MAKE_BY_KEY.get(key) ?? "", ...(model ? { model: model[1] } : {}) });
    lastEnd = start + match[0].length;
  }
  return out.filter((m) => m.make);
}

const inGarage = (m: CarMention, garage: readonly string[]) =>
  garage.some((car) => norm(car).includes(norm(m.make)) && (!m.model || norm(car).includes(norm(m.model))));

const garageMake = (car: string) =>
  [...new Set(Object.values(KNOWN_MAKES))].find((make) => norm(car).includes(norm(make)));

// Every garage car must name a make we know; otherwise "not in your garage"
// could be wrong about a car shown only as "Your vehicle".
const garageReadable = (garage: readonly string[]) => garage.every((car) => garageMake(car) !== undefined);

// "book my m5 too" names a garage car by the word after its make, which the
// list above doesn't know.
function namesGarageModel(message: string, garage: readonly string[]): boolean {
  const words = message.split(/\s+/).map((w) => norm(w.replace(/['’]s\b/i, "")));
  return garage.some((car) => {
    const make = garageMake(car);
    const at = make ? car.toLowerCase().indexOf(make.toLowerCase()) : -1;
    if (!make || at < 0) return false;
    const model = norm(car.slice(at + make.length).trim().split(/\s+/)[0] ?? "");
    return model.length >= 2 && words.includes(model);
  });
}

const SENDS_TO_PICKER = /\bcar[- ]?picker\b|\b(?:new|fresh|separate|another) chat\b/i;
// The add-a-car screen is the real way in.
const NAMES_ADD_SCREEN =
  /\badd-a-(?:car|vehicle)\b|\bonboarding\b|\badd (?:it|her|him|them|(?:the|your|that|this) [\w-]+) (?:to|in) (?:your|the) (?:garage|account)\b/i;
// "go to the car picker, tap to add a vehicle" / "added to yours through the
// car-picker" / "I can't add vehicles to your account — that's something you
// or your wife would need to do through the car picker": the picker can't add
// a car, whatever else the reply says.
const PICKER_ADDS =
  /\bcar[- ]?picker\b[^.!?]{0,80}?\b(?:add|adding|register|registering)\b|\b(?:add|added|adding|register|registered)\b[^.!?]{0,120}?\b(?:through|via) the car[- ]?picker\b/i;

/**
 * When the reply sends the user to the car picker for a car that isn't in
 * the garage, the car's name for the not-in-garage reply; otherwise null.
 * The car is the one named in the reply or the user's message. Only when
 * neither names any car ("just put it under my account") does the user's
 * previous message count, and not when the reply names a garage car, so an
 * earlier mention can't misfire on a legitimate redirect to another garage car.
 * A reply saying the picker adds a car is wrong whatever else it names ("add
 * it through the car picker first … this chat stays anchored to your M5"), so
 * there the previous message counts anyway.
 */
export function carPickerDeadEnd(args: {
  reply: string;
  message: string;
  previousMessage?: string;
  garage: readonly string[];
  linkDestination?: string;
}): string | null {
  const { reply, message, garage } = args;
  if (!SENDS_TO_PICKER.test(reply)) return null;
  if (NAMES_ADD_SCREEN.test(reply) && !PICKER_ADDS.test(reply)) return null;
  if (args.linkDestination === "vehicle_onboarding" || !garageReadable(garage)) return null;
  const named = carMentions(message);
  if (named.some((m) => inGarage(m, garage)) || namesGarageModel(message, garage)) return null;
  const thisTurn = [...named, ...carMentions(reply)];
  const earlier = carMentions(args.previousMessage ?? "");
  const missing =
    thisTurn.find((m) => !inGarage(m, garage)) ??
    (PICKER_ADDS.test(reply) || (thisTurn.length === 0 && !namesGarageModel(reply, garage))
      ? earlier.find((m) => !inGarage(m, garage))
      : undefined);
  if (!missing) return null;
  // The user's own words usually carry the year ("a 2019 Honda Civic").
  const car =
    [...named, ...earlier].find(
      (m) => m.make === missing.make && (!missing.model || m.model === missing.model),
    ) ?? missing;
  const name = [car.year, car.make, car.model].filter(Boolean).join(" ");
  return `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`;
}

// "just put it under my account" means the car they just named; "book mine
// friday" or "book my oil change" means their own.
const POINTS_BACK = /\b(?:it|her|she|his|him|they|them|that one)\b/i;
const OWN_CAR = /\bmine\b|\bmy own\b/i;

/**
 * A car the user asked about that isn't in the garage: named in the message,
 * or in the previous message when this one names no car and points back to
 * it. Asked to "book her an oil change" for the wife's Civic, the model
 * opened the card, which books the chat's own car (1 of 10 runs, 2026-10-01).
 */
export function carNotInGarage(args: { message: string; previousMessage?: string; garage: readonly string[] }): string | null {
  const { message, garage } = args;
  if (!garageReadable(garage)) return null;
  const named = carMentions(message);
  if (named.some((m) => inGarage(m, garage)) || namesGarageModel(message, garage)) return null;
  const pointsBack = named.length === 0 && POINTS_BACK.test(message) && !OWN_CAR.test(message);
  const earlier = pointsBack ? carMentions(args.previousMessage ?? "") : [];
  const car = [...named, ...earlier].find((m) => !inGarage(m, garage));
  if (!car) return null;
  const name = [car.year, car.make, car.model].filter(Boolean).join(" ");
  return `${/^[aeiou]/i.test(name) ? "an" : "a"} ${name}`;
}

export function notInGarageReply(car: string): string {
  return `I don't see ${car} in your garage, and the car picker only shows cars you've added. If you'd like to add it, tap below to open the add-a-car screen.`;
}

/**
 * True when the user's message names a car other than the chat's own, or,
 * when it names no car, the previous message did ("my wife has a 2019 Honda
 * Civic", then "just book it friday at 10"). The booking card only books the
 * chat's own car.
 */
export function namesAnotherCar(args: {
  message: string;
  previousMessage?: string;
  chatCar: string;
  garage: readonly string[];
}): boolean {
  const others = args.garage.filter((car) => car !== args.chatCar);
  const another = (text: string) =>
    carMentions(text).some((m) => !inGarage(m, [args.chatCar])) || namesGarageModel(text, others);
  const namesACar = carMentions(args.message).length > 0 || namesGarageModel(args.message, args.garage);
  return another(namesACar ? args.message : (args.previousMessage ?? ""));
}

// ── A booking turned down because it isn't due ───────────────────────────
// Asked to "set up that first service" at 5,000 miles, Oto said "let me pump
// the brakes here … booking it now would just be money out of pocket" in 3 of
// 20 runs on 2026-10-01, after the tool description said it's the user's call.

const NOT_DUE = /\b(?:isn['’]?t|is not|not|aren['’]?t|are not)\s+(?:actually\s+|even\s+|yet\s+)?due\b/i;
const TALKS_THEM_OUT_OF_IT =
  /\b(?:booking|scheduling|setting (?:it |one |this |that )?up)\b[^.!?]{0,80}\bwould\b|\bpremature\b|\bpump the brakes\b|\bcan(?:no|['’])?t book\b[^.!?]{0,40}\byet\b|\bno need to book\b|\bnothing to (?:book|schedule)\b|\bhold off\b|\bwait (?:until|till)\b/i;

/** True when the reply turns a booking down because the service isn't due. */
export function refusesNotDue(reply: string): boolean {
  return NOT_DUE.test(reply) && TALKS_THEM_OUT_OF_IT.test(reply);
}

// ── A warning light the user never mentioned ─────────────────────────────
// A temperature light from the M5's Sep 27 inspection came back a turn later
// as "earlier in this chat you mentioned a temperature warning light".

// Broad on the user's side, so anything near a light leaves the reply alone;
// narrow on the reply's side, so "you mentioned a warning from the shop"
// isn't touched.
const USER_LIGHT_WORDS =
  /\b(?:lights?|lamps?|warning|dash(?:board)?|gauge|temp(?:erature)?|overheat\w*|coolant|hot|heat\w*|steam\w*|cel|tpms|abs|srs|airbags?)\b/i;
const REPLY_LIGHT_WORDS = /\b(?:lights?|lamps?|gauge|temp(?:erature)?|overheat\w*)\b/i;

/** True when the user named a dash light anywhere in this conversation. */
export function userNamedALight(userMessages: readonly string[], symptomCategories: readonly string[]): boolean {
  return (
    symptomCategories.some((c) => /^(?:tracked:light:|warning_light:)/.test(c)) ||
    userMessages.some((m) => USER_LIGHT_WORDS.test(m))
  );
}

const YOU_MENTIONED =
  /\b(?:earlier(?: in (?:this|our) (?:chat|conversation))?,?\s+)?you(?:'d|\s+had)?\s+(?:mentioned|said|told me about|told me|brought up|noted|reported)(?:\s+(?:earlier|before))?(?:\s+in (?:this|our) (?:chat|conversation))?(?:\s+that)?/i;
const IN_THIS_CHAT = /\s+(?:earlier|before)\s+in (?:this|our) (?:chat|conversation)\b/i;

/**
 * "You mentioned a temperature light" → "Your car's record shows a
 * temperature light". Only call this when the user never named a light.
 */
export function rewriteFalseLightAttribution(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      if (!YOU_MENTIONED.test(line)) return line;
      return line
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => {
          const m = sentence.match(YOU_MENTIONED);
          if (!m || m.index === undefined) return sentence;
          const before = sentence.slice(0, m.index);
          const after = sentence.slice(m.index + m[0].length);
          // Only when the light is what "you mentioned": not "You mentioned
          // the clunk, and the record shows a temp light", not "if you said".
          const clause = after.split(/[,;:—–]|\s(?:and|but)\s/)[0];
          if (!REPLY_LIGHT_WORDS.test(clause) || /\b(?:if|when|unless|whether)\s+$/i.test(before)) return sentence;
          const subject = before.trim() ? "your car's record shows" : "Your car's record shows";
          return (before + subject + after).replace(IN_THIS_CHAT, "");
        })
        .join(" ");
    })
    .join("\n");
}

// ── Saved before the user confirms ───────────────────────────────────────
// A card is a proposal until the user confirms it, yet Oto said "Sunday at
// 10am at Anesa Shop is locked in", "Anesa has you down for Friday" and
// "just logged that" on the turn the card appeared.

const atSentenceStart = (offset: number, whole: string) => /(?:^|[.!?]\s+)$/.test(whole.slice(0, offset));
const capitalizeAtSentenceStart = (replacement: string, offset: number, whole: string) =>
  atSentenceStart(offset, whole) ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;

export function rewritePrematureSaveClaims(text: string, cards: { booking: boolean; vehicleUpdate: boolean }): string {
  let out = text;
  if (cards.booking) {
    out = out
      // "Once you confirm, it's locked in" is already right; "That's locked in
      // and ready" on the card's turn is not.
      .replace(
        /(?<!\b(?:once|after|when|if|as soon as)\b[^.!?]{0,80})(\b(?:is|are)|['’](?:s|re))\s+(?:all\s+)?locked in(?:\s+and ready)?\b/gi,
        "$1 ready to book",
      )
      .replace(/\bI(?:'ve got| have got| have| got)\s+you\s+down\s+for\b/gi, (_m, offset: number, whole: string) =>
        capitalizeAtSentenceStart("the shop can take you", offset, whole),
      )
      .replace(/\b(?:has|have)\s+you\s+down\s+for\b/gi, "can take you")
      // "Anesa Shop has you at 10:00 AM on Sunday", but not "your record has you at 91,000 miles".
      .replace(
        /\b(?:has|have)\s+you\s+at(?=\s+(?:\d{1,2}(?::\d{2})?\s*[ap]\.?m\b|\d{1,2}:\d{2}|noon|(?:mon|tue|wed|thu|fri|sat|sun)))/gi,
        "can take you at",
      );
  }
  if (cards.vehicleUpdate) {
    out = out
      .replace(
        /(,?\s+and\s+)?\b(?:I've|I have|I)\s+(?:just\s+)?(?:logged|saved|recorded|added|updated)\s+(?:it|that|this)(?:\s+for you)?/gi,
        (_m, conjunction: string | undefined, offset: number, whole: string) =>
          conjunction ? ". Tap Confirm to save it" : capitalizeAtSentenceStart("tap Confirm to save it", offset, whole),
      )
      .replace(/\bjust logged (?:it|that|this)(?:\s+(?:for you|from your dash))?/gi, "tap Confirm on the card to save it")
      .replace(
        /\bI'?m (?:logging|saving|recording|adding) (.{1,60}?) (?:to|on|in) your ((?:[\w-]+'s )?)record(?: now)?/gi,
        (_m, what: string, owner: string, offset: number, whole: string) =>
          capitalizeAtSentenceStart(`tap Confirm and I'll add ${what} to your ${owner}record`, offset, whole),
      )
      .replace(
        /\bI'?m (?:logging|saving|recording) (.{1,60}?)(?: for you)?(?: now)?(?=[.!?,;:—–]|$)/gi,
        (_m, what: string, offset: number, whole: string) =>
          capitalizeAtSentenceStart(`tap Confirm and I'll log ${what}`, offset, whole),
      );
  }
  return out;
}

// ── A tool call written into the reply ───────────────────────────────────
// Twice in the 2026-10-01 runs Oto ended a reply with an
// "<update_conversation_state> {…} </update_conversation_state>" block, and
// the user saw the raw state. A block the model never closed runs to the end.

const TOOL_BLOCK = new RegExp(`<(${OTO_TOOL_NAMES.join("|")})\\b[^>]*>[\\s\\S]*?(?:</\\1\\s*>|$)`, "g");

export function stripLeakedToolMarkup(text: string): string {
  const out = text.replace(TOOL_BLOCK, "");
  return out === text ? text : out.replace(/\n{3,}/g, "\n\n").trim();
}
