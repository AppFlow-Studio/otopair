import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import React, { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useUnseenBookingsCount } from "@/hooks/useUnseenBookingsCount";
import { tabItem } from "./tabItems";

interface TabBarButtonProps {
  onPress: () => void;
  onLongPress: () => void;
  isFocused: boolean;
  routeName: string;
  label: string;
}

const TabBarButton = ({
  onPress,
  onLongPress,
  isFocused,
  routeName,
  label,
}: TabBarButtonProps) => {
  // Glyph and label come from tabItems.ts, which the iOS NativeTabs bar
  // reads too — that shared list is what keeps the two bars from drifting.
  // Settings isn't a tab route (it opens as an overlay), so it falls back
  // rather than occupying a row in TAB_ITEMS.
  const item = tabItem(routeName);
  const iconName = item?.ion ?? (routeName === "settings" ? "settings" : "home");
  // Sampled off the iOS bar (Display P3 converted to sRGB), two captures:
  //   inactive icon + label  #181919 / #191918   -> near-black, NOT grey
  //   active   icon + label  #0075F0 / #027BF2   -> iOS system blue
  // Android was #86868B inactive, which reads washed out beside iOS, and
  // BrandColors.secondary (#5299FE) active, which is lighter than the blue
  // iOS actually paints. iOS gets these from the native tab bar rather than
  // the brand palette, so matching it means matching the system values.
  const activeColor = "#007AFF";
  const inactiveColor = "#181919";
  const tint = isFocused ? activeColor : inactiveColor;

  // Only the Bookings tab consumes this — the hook returns 0 for every
  // other route, so reading it here is fine. We show a plain red dot
  // (no count) so the bookings indicator visually matches the trophy
  // and bell indicators elsewhere in the app.
  const unseenBookingsCount = useUnseenBookingsCount();
  const showBookingsBadge = routeName === "bookings" && unseenBookingsCount > 0;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.container}
    >
      <View style={styles.buttonWrapper}>
        <View style={styles.content}>
          <View style={styles.iconWrapper}>
            {/* Ionicons for every tab. Solid-vs-hollow is chosen by the
                glyph NAME in tabItems.ts ("home" vs "home-outline"), the
                same way SF pairs house.fill with house — never by painting
                an outline icon's interior, which is what broke the first
                attempt. Colour is the only thing focus changes. */}
            <Ionicons name={iconName} size={24} color={tint} />
            {showBookingsBadge ? <View style={styles.badgeDot} /> : null}
          </View>
          <Animated.Text
            style={[
              styles.label,
              {
                color: isFocused ? activeColor : inactiveColor,
                fontWeight: isFocused ? "700" : "500",
              },
            ]}
          >
            {label}
          </Animated.Text>
        </View>
      </View>
    </Pressable>
  );
};

export default TabBarButton;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonWrapper: {
    width: 64,
    height: 56,
    alignItems: "center",
    justifyContent: "center",
  },
  activeCapsule: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 1)",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  iconWrapper: {
    position: "relative",
  },
  label: {
    fontSize: 10,
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FF3B30",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
});
