import { Pressable, StyleSheet, Text as RNText, View } from "react-native";
import React, { useEffect } from "react";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Home, Calendar, MessageSquare, LucideIcon, Settings } from "lucide-react-native";
import { CarIcon } from "phosphor-react-native";
import { OtoPairIcon } from "@/components/icons/oto-pair";
import { useUnseenBookingsCount } from "@/hooks/useUnseenBookingsCount";
import { BrandColors } from "../shared-ui";

const icon: Record<string, any> = {
  home: OtoPairIcon,
  bookings: Calendar,
  cars: CarIcon,
  settings: Settings,
  "ai-chat": MessageSquare,
};

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
  const IconComponent = icon[routeName] || Home;
  const activeColor = BrandColors.secondary;
  const inactiveColor = "#86868B";

  const isOtoPair = routeName === 'home';
  const isPhosphor = routeName === 'cars';

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
            {isOtoPair ? (
              <IconComponent size={24} />
            ) : (
              <IconComponent
                size={24}
                color={isFocused ? activeColor : inactiveColor}
                strokeWidth={1.5}
                weight="regular"
              />
            )}
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
