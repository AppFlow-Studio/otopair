import { View, StyleSheet, LayoutChangeEvent, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import TabBarButton from "./TabBarButton";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useState, useEffect } from "react";
import { BrandColors } from "@/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState({ height: 20, width: 100 });

  const visibleRoutes = state.routes.filter(route => !['_sitemap', '+not-found', 'index'].includes(route.name));
  const buttonWidth = dimensions.width / visibleRoutes.length;

  const onTabbarLayout = (e: LayoutChangeEvent) => {
    setDimensions({
      height: e.nativeEvent.layout.height,
      width: e.nativeEvent.layout.width,
    });
  };
  
  const tabPositionX = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: tabPositionX.value }],
    };
  });

  // Calculate the bar position based on focused index among visible routes
  useEffect(() => {
    const visibleIndex = visibleRoutes.findIndex(r => r.name === state.routes[state.index].name);
    if (visibleIndex !== -1) {
        tabPositionX.value = withTiming(buttonWidth * visibleIndex, {
            duration: 300,
        });
    }
  }, [state.index, buttonWidth, visibleRoutes]);
  
  return (
    <View onLayout={onTabbarLayout} style={[styles.tabbar, { paddingBottom: insets.bottom + 12 }]}>
      <Animated.View style={[animatedStyle, {
        position: 'absolute',
        backgroundColor: BrandColors.secondary,
        top: 0,
        left: 20, // Adjust offset to center under the button icon
        height: 3,
        borderRadius: 2,
        width: buttonWidth - 40, // Adjust width of the indicator
      }]} />
      {visibleRoutes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.routes[state.index].name === route.name;

        const onPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: "tabLongPress",
            target: route.key,
          });
        };

        return (
          <TabBarButton
            key={route.name}
            onPress={onPress}
            onLongPress={onLongPress}
            isFocused={isFocused}
            routeName={route.name}
            label={label.toString()}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabbar: {
    flexDirection: 'row',
    paddingTop: 12,
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 10,
  }
})
