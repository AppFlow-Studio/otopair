/**
 * HomeHeaderBar
 *
 * PURPOSE: The Home top row — profile avatar, "Otopair" + location, and the
 *          notification bell. Extracted from app/(main-tabs)/home/index.tsx so
 *          it can render in two positions:
 *            - `onGradient` (no upcoming booking): in-flow at the top of the
 *              scroll content, scrolling away like it always has.
 *            - `onHero` (upcoming booking): inside the fixed top chrome, where
 *              it stays put for the whole scroll while the appointment hero
 *              slides underneath it.
 *
 *          In the `onHero` position the header outlives the banner it started
 *          on: it begins over the dark navy banner and ends over the light
 *          content sheet. So its copy and bell cross-fade between a light-on-
 *          dark and a dark-on-light treatment, driven by the `tone` value.
 *          The design-system `Text` is a plain function component (no
 *          forwardRef), so it can't be driven by Reanimated directly — each
 *          tinted leaf is rendered twice and the two copies are cross-faded.
 *
 *          The location subline also collapses away once the pinned search bar
 *          appears, so the fixed chrome doesn't eat half the viewport.
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, withTiming, type SharedValue } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Bell } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { ProfileInitialsButton } from "@/components/home/ProfileInitialsButton";

// Native iOS 26 liquid glass (optional)
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require("@callstack/liquid-glass");
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch {
  // Not available — fall back to BlurView style
}

/** Height of the location subline, incl. its lead. Mirrored in home/index.tsx
 *  when sizing the fixed chrome. */
export const HOME_HEADER_SUBLINE_HEIGHT = 18;

// Copy treatment over a dark surface (the navy banner, or the blue page
// gradient when there's no banner) …
const TITLE_ON_DARK = "#FFFFFF";
const SUBTITLE_ON_DARK = "rgba(255,255,255,0.72)";
// … and over a light one (the content sheet, once the banner has scrolled by).
const TITLE_ON_LIGHT = "#0F172A";
const SUBTITLE_ON_LIGHT = "#5B6B7F";

interface HomeHeaderBarProps {
  /** `onHero` = sits in the fixed chrome and cross-fades with `tone`;
   *  `onGradient` = in-flow over the blue page gradient, always light copy. */
  variant: "onHero" | "onGradient";
  locationName: string;
  hasUnreadNotifications: boolean;
  onBellPress: () => void;
  /** 0 = full height, 1 = collapsed (location subline hidden). Driven on the
   *  UI thread by the parent's scroll position; only passed in the `onHero`
   *  position. */
  collapse?: SharedValue<number>;
  /** 0 = header is over the dark banner, 1 = over the light content sheet.
   *  Only passed in the `onHero` position; without it the header stays in its
   *  light-copy treatment, which is what `onGradient` wants. */
  tone?: SharedValue<number>;
}

export function HomeHeaderBar({
  variant,
  locationName,
  hasUnreadNotifications,
  onBellPress,
  collapse,
  tone,
}: HomeHeaderBarProps) {
  // Collapse the location line when the pinned search takes over the chrome.
  const sublineStyle = useAnimatedStyle(() => {
    const t = collapse ? collapse.value : 0;
    return {
      height: withTiming(HOME_HEADER_SUBLINE_HEIGHT * (1 - t), { duration: 200 }),
      opacity: withTiming(1 - t, { duration: 160 }),
    };
  });

  // Every tinted leaf is the light-surface copy at full opacity with the
  // dark-surface copy fading out on top of it. Only ONE of the pair animates
  // on purpose: fading both (t and 1-t) would composite to 1-t(1-t), letting
  // up to 25% of whatever is behind leak through at the midpoint. An opaque
  // base plus one fading layer is a true blend between the two colours.
  const onDarkStyle = useAnimatedStyle(() => ({ opacity: tone ? 1 - tone.value : 1 }));

  const renderBellIcon = (color: string) => (
    <Bell size={22} color={color} fill="none" strokeWidth={2} />
  );

  const bellStack = (
    <View style={styles.bellIconContainer}>
      {renderBellIcon(TITLE_ON_LIGHT)}
      <Animated.View style={[StyleSheet.absoluteFill, onDarkStyle]} pointerEvents="none">
        {renderBellIcon(TITLE_ON_DARK)}
      </Animated.View>
      {hasUnreadNotifications ? <View style={styles.bellDot} /> : null}
    </View>
  );

  return (
    <View style={styles.header}>
      <View style={styles.locationSection}>
        <View style={styles.profileButton}>
          <ProfileInitialsButton />
        </View>
        <View style={styles.locationText}>
          <View>
            <Text size="xl" color={TITLE_ON_LIGHT} weight="bold">
              Otopair
            </Text>
            <Animated.View style={[StyleSheet.absoluteFill, onDarkStyle]} pointerEvents="none">
              <Text size="xl" color={TITLE_ON_DARK} weight="bold">
                Otopair
              </Text>
            </Animated.View>
          </View>

          <Animated.View style={[styles.subline, sublineStyle]}>
            <Text
              weight="semiBold"
              size="sm"
              color={SUBTITLE_ON_LIGHT}
              numberOfLines={1}
              // Pin the line height so the collapse animates between exactly
              // HOME_HEADER_SUBLINE_HEIGHT and 0 — a taller natural line would
              // be clipped at rest.
              style={styles.sublineText}
            >
              {locationName}
            </Text>
            <Animated.View style={[StyleSheet.absoluteFill, onDarkStyle]} pointerEvents="none">
              <Text
                weight="semiBold"
                size="sm"
                color={SUBTITLE_ON_DARK}
                numberOfLines={1}
                style={styles.sublineText}
              >
                {locationName}
              </Text>
            </Animated.View>
          </Animated.View>
        </View>
      </View>

      <View style={styles.headerRight}>
        <Pressable
          onPress={onBellPress}
          style={({ pressed }) => [styles.bellButton, pressed && styles.bellButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Notifications"
        >
          {isLiquidGlassEnabled && LiquidGlassView ? (
            <LiquidGlassView interactive effect="clear" style={styles.liquidGlassIcon}>
              {bellStack}
            </LiquidGlassView>
          ) : (
            <View style={styles.bellChip}>
              {/* Light-surface chip (base): a subtle tinted circle. */}
              <View style={[styles.bellChipFill, styles.bellChipLight]} pointerEvents="none" />

              {/* Dark-surface chip: the original smoked glass, fading off it. */}
              <Animated.View
                style={[styles.bellChipFill, styles.bellChipDark, onDarkStyle]}
                pointerEvents="none"
              >
                <BlurView intensity={10} tint="dark" style={StyleSheet.absoluteFill}>
                  <View style={styles.glassOverlay} />
                  <LinearGradient
                    colors={["rgba(255,255,255,0.25)", "rgba(255,255,255,0.05)"]}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </BlurView>
              </Animated.View>

              {bellStack}
            </View>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingRight: 16,
    paddingLeft: 0,
    marginBottom: 6,
  },
  locationSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    flex: 1,
    paddingLeft: 0,
  },
  profileButton: {
    marginLeft: 20,
    marginTop: -8,
  },
  locationText: {
    gap: 0,
    marginTop: -7,
    marginLeft: 12,
  },
  subline: {
    justifyContent: "center",
    overflow: "hidden",
  },
  sublineText: {
    lineHeight: HOME_HEADER_SUBLINE_HEIGHT,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  bellButton: {
    padding: 4,
  },
  bellButtonPressed: {
    opacity: 0.7,
  },
  liquidGlassIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  bellChip: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  // The two chip treatments stack behind the icon and cross-fade. Each owns its
  // own border, since border colour can't be cross-faded on a single view.
  bellChipFill: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
  },
  bellChipDark: {
    borderColor: "rgba(255,255,255,0.5)",
  },
  bellChipLight: {
    backgroundColor: "rgba(15,23,42,0.05)",
    borderColor: "rgba(15,23,42,0.08)",
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  bellIconContainer: {
    position: "relative",
  },
  bellDot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FF3B30",
  },
});
