import { describe, expect, test } from "vitest";

import { getCarouselHeightTransition } from "./actionCardsCarouselHeight";

describe("getCarouselHeightTransition", () => {
  test("does not apply a height before the active card has measured", () => {
    expect(getCarouselHeightTransition(undefined, false)).toBeNull();
  });

  test("applies the first measured height directly", () => {
    expect(getCarouselHeightTransition(284, false)).toEqual({
      mode: "direct",
      height: 284,
    });
  });

  test("animates later height changes", () => {
    expect(getCarouselHeightTransition(320, true)).toEqual({
      mode: "animated",
      height: 320,
      duration: 280,
    });
  });
});
