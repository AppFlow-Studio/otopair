/**
 * Back inside the booking flow must return the user to the screen they were
 * actually just on.
 *
 * The flow's entry points deliberately SKIP Screen 1: Home and Cars push
 * straight to Choose Mechanic when the tapped maintenance item pre-resolves
 * to a catalog service, the Bookings tab's quote sheets push straight to Pick
 * Date & Time, and Quick Book / category cards push straight to a category
 * tab. Because no navigator under app/ sets `initialRouteName`, each of those
 * lands the user in a (booking-flow) stack exactly one route deep.
 *
 * The three mid-flow screens used to read "one route deep" as a signal to
 * rebuild the stack to a single select-services route. Composed with the entry
 * points above, back therefore dropped the user on a service picker they had
 * never seen and discarded the real previous screen. Ahmad reported it as:
 * "it takes us back to the service selector screen when that isn't the most
 * recent page we are on."
 *
 * These are source assertions rather than behavioural ones: the bug lives in
 * navigator state that a unit test can't stand up faithfully, but the shape
 * that caused it is easy to spot and worth failing on.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const APP = join(dirname(fileURLToPath(import.meta.url)), "..", "app");
const read = (p: string) => readFileSync(join(APP, p), "utf8");

/** Strip comments so the docs explaining the old bug don't trip the checks. */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("//"))
    .join("\n");
}

const MID_FLOW: Record<string, string> = {
  "category/[tab].tsx": code(read("(booking-flow)/category/[tab].tsx")),
  "choose-mechanic.tsx": code(read("(booking-flow)/choose-mechanic.tsx")),
  "pick-datetime.tsx": code(read("(booking-flow)/pick-datetime.tsx")),
};

describe("booking-flow back navigation", () => {
  it("no mid-flow screen rebuilds the stack to select-services", () => {
    for (const [name, body] of Object.entries(MID_FLOW)) {
      expect(
        /routes:\s*\[\s*\{\s*name:\s*"select-services"/.test(body),
        `${name} resets the booking-flow stack to select-services`,
      ).toBe(false);
      expect(
        body.includes("navigation.reset"),
        `${name} calls navigation.reset — that discards the entry point the user came from`,
      ).toBe(false);
    }
  });

  it("mid-flow back handlers delegate to router.back", () => {
    for (const [name, body] of Object.entries(MID_FLOW)) {
      // Deliberately NOT anchored to the first statement of the handler.
      // pick-datetime clears its quote-accept context on the way out before
      // deciding where to go, which is unrelated bookkeeping and fine. What
      // this guards is the DESTINATION rule — canGoBack/back, never a rebuilt
      // stack — so it asserts both calls are present, and the sibling test
      // below asserts stack depth is not consulted.
      expect(
        /const onBack = \(\) => \{[\s\S]*?if \(router\.canGoBack\(\)\) \{\s*router\.back\(\);/.test(body),
        `${name} should route back through router.canGoBack() / router.back()`,
      ).toBe(true);
    }
  });

  it("stack depth is not used to pick a back destination", () => {
    // routes.length was the tell: it cannot distinguish "entered mid-flow"
    // from "has somewhere real to go back to", because the previous screen
    // lives in the PARENT navigator, which this stack's route list never sees.
    for (const [name, body] of Object.entries(MID_FLOW)) {
      expect(
        /stackLength|state\?\.routes\?\.length/.test(body),
        `${name} still branches on booking-flow stack depth`,
      ).toBe(false);
    }
  });

  it("the shopId bounce cannot fire from a backgrounded pick-datetime", () => {
    // pick-datetime stays mounted under payment / confirming / confirmation,
    // so an unfocused re-render firing this replace would teleport the user
    // off Review & Pay and onto the service picker.
    const body = MID_FLOW["pick-datetime.tsx"];
    const bounce = body.indexOf('router.replace("/(booking-flow)/select-services")');
    expect(bounce, "expected the shopId recovery bounce to still exist").not.toBe(-1);
    expect(
      body.slice(Math.max(0, bounce - 400), bounce).includes("if (!isFocused) return;"),
      "pick-datetime's shopId bounce must be gated on isFocused",
    ).toBe(true);
  });

  it("the flow still has no initialRouteName, which is why entries land one deep", () => {
    // If someone later sets initialRouteName on the booking-flow Stack, Screen 1
    // gets synthesized beneath every mid-flow entry and back would quietly go
    // through the picker again — by a different mechanism than the one fixed here.
    expect(code(read("(booking-flow)/_layout.tsx")).includes("initialRouteName")).toBe(false);
  });
});
