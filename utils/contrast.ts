/**
 * contrast — utilities for picking readable text colors against a
 * dynamically-themed background.
 *
 * The cars page picks a different gradient per car paint color, so any
 * static "always black" or "always white" text choice ends up
 * unreadable on at least some of them. This helper returns whether
 * a background hex is dark enough that we should switch to light text.
 */

/**
 * Returns true if the given hex color (`#rgb` or `#rrggbb`) is dark
 * enough that white/light text reads better on it than black/dark
 * text. Uses the Rec. 709 relative-luminance formula with a 0.72
 * threshold — generous on purpose so medium and even fairly light
 * tones (silver, beige, light blue) still flip to white text. The
 * underlying gradient also fades to deep-dark at the bottom, so most
 * of the page sits well below the threshold; biasing toward "treat
 * it as dark" keeps text consistently readable across all palettes.
 */
export function isDarkColor(hex: string): boolean {
  const cleaned = hex.replace("#", "");
  const expanded =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((c) => c + c)
          .join("")
      : cleaned;
  if (expanded.length !== 6) return false;

  const r = parseInt(expanded.slice(0, 2), 16) / 255;
  const g = parseInt(expanded.slice(2, 4), 16) / 255;
  const b = parseInt(expanded.slice(4, 6), 16) / 255;
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance < 0.72;
}
