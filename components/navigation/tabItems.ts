/**
 * tabItems.ts — the ONE definition of the bottom tab bar.
 *
 * WHY THIS EXISTS
 * ---------------
 * The app renders two different tab bars: `NativeTabs` (SF Symbols) on
 * iOS 26+, and the custom `<TabBar>` everywhere else — see
 * app/(main-tabs)/_layout.tsx. They were declared as two independent
 * lists, so they drifted: the Cars tab read "Cars" on iOS and "My Cars"
 * on Android, Home was a house on iOS and the OtoPair brand mark on
 * Android, and Oto was two speech bubbles on iOS but one on Android.
 *
 * Both bars now read label, order and glyph from this file.
 *
 * WHY IONICONS
 * ------------
 * SF Symbols cannot ship on Android — Apple's license restricts them to
 * Apple platforms — so Android needs a lookalike. Ionicons is the closest
 * legal match: it was drawn to sit inside iOS, and it uses the SAME
 * filled/outline naming convention as SF (`home` / `home-outline`, the
 * way SF pairs `house.fill` / `house`). That makes each row below a
 * direct translation rather than an approximation.
 *
 * A first pass used Lucide with a `fill` flag. That was wrong: Lucide is
 * outline-first, its structure lives in the strokes, and painting the
 * interior erased the detail — Home collapsed into a featureless blob and
 * Oto's two bubbles merged. Icons that are meant to read as solid have to
 * come from a family that DRAWS a solid variant, which is what `home` and
 * `chatbubbles` are here.
 *
 * Ionicons ships inside `@expo/vector-icons`, already a dependency, so
 * this costs nothing at runtime or in bundle size.
 */
import type Ionicons from "@expo/vector-icons/Ionicons";

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

export interface TabItem {
  /** Route segment under app/(main-tabs)/. */
  name: string;
  /** Shown under the glyph on both platforms. */
  label: string;
  /** iOS 26+ NativeTabs glyph. */
  sf: string;
  /** Ionicons counterpart of `sf`, for Android and iOS ≤25. */
  ion: IoniconName;
}

export const TAB_ITEMS: TabItem[] = [
  // house.fill → the solid Ionicons "home" (its outline sibling is "home-outline").
  { name: "home", label: "Home", sf: "house.fill", ion: "home" },
  // calendar → solid; iOS renders this one filled in the tab bar.
  { name: "bookings", label: "Bookings", sf: "calendar", ion: "calendar" },
  // car → outline. The only glyph iOS leaves hollow in this bar.
  { name: "cars", label: "Cars", sf: "car", ion: "car-outline" },
  // bubble.left.and.bubble.right.fill → "chatbubbles" is genuinely TWO
  // overlapping bubbles, not one. Singular would be "chatbubble".
  {
    name: "ai-chat",
    label: "Oto",
    sf: "bubble.left.and.bubble.right.fill",
    ion: "chatbubbles",
  },
];

export function tabItem(routeName: string): TabItem | undefined {
  return TAB_ITEMS.find((t) => t.name === routeName);
}
