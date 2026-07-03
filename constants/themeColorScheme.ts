export type ThemeColorScheme = "light" | "dark";

export function resolveThemeColorScheme(colorScheme: unknown): ThemeColorScheme {
  return colorScheme === "dark" ? "dark" : "light";
}
