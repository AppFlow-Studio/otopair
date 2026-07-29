import { describe, expect, it } from "vitest";

import { resolveThemeColorScheme } from "./themeColorScheme";

describe("resolveThemeColorScheme", () => {
  it.each([
    ["dark", "dark"],
    ["light", "light"],
    ["unspecified", "light"],
    [null, "light"],
    [undefined, "light"],
  ] as const)("normalizes %s to %s", (input, expected) => {
    expect(resolveThemeColorScheme(input)).toBe(expected);
  });
});
