import { Pressable, StyleSheet } from "react-native";
import React, { useEffect } from "react";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { BrandColors, Colors } from "@/constants/theme";
import { Home, Calendar, Car, Gamepad, MessageSquare, LucideIcon, Settings } from "lucide-react-native";

const icon: Record<string, LucideIcon> = {
  home: Home,
  bookings: Calendar,
  cars: Car,
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
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(
      isFocused ? 1 : 0,
      { duration: 350 }
    );
  }, [scale, isFocused]);

  const animatedTextStyle = useAnimatedStyle(() => {
    const opacityValue = interpolate(scale.value, [0, 1], [1, 0]);

    return {
      opacity: opacityValue,
    };
  });

  const animatedIconStyle = useAnimatedStyle(() => {
    const scaleValue = interpolate(scale.value, [0, 1], [1, 1.2]);
    const top = interpolate(scale.value, [0, 1], [0, 9]);

    return {
      transform: [{ scale: scaleValue }],
      top,
    };
  });

  const IconComponent = icon[routeName] || Gamepad;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={styles.tabbarBtn}
    >
      <Animated.View style={animatedIconStyle}>
        <IconComponent
          size={24}
          color={isFocused ? BrandColors.secondary : Colors.light.tabIconDefault}
        />
      </Animated.View>
      <Animated.Text
        style={[
          {
            color: isFocused ? BrandColors.secondary : Colors.light.tabIconDefault,
            fontSize: 11,
          },
          animatedTextStyle,
        ]}
      >
        {label}
      </Animated.Text>
    </Pressable>
  );
};

export default TabBarButton;

const styles = StyleSheet.create({
  tabbarBtn: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 5,
  },
});
