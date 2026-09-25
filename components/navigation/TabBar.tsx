import { View, StyleSheet, LayoutChangeEvent, Platform } from "react-native";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import TabBarButton from "./TabBarButton";
import { useState, useEffect, useCallback } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  runOnJS 
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
// Tab taps intentionally do not fire haptics — see docs/notifications/PLAN.md §B.4.
import { useTabBarVisibilityStore } from "@/stores/useTabBarVisibilityStore";
import { useSettingsOverlayStore } from "@/stores/useSettingsOverlayStore";
import { useTabBlurTargetStore } from "@/stores/useTabBlurTargetStore";
import { ANDROID_REAL_BLUR } from "@/components/shared-ui/AndroidBlurTarget";

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [dimensions, setDimensions] = useState({ height: 0, width: 0 });

  const TAB_ROUTES = ["home", "bookings", "cars", "ai-chat"];
  const visibleRoutes = state.routes.filter((route) => TAB_ROUTES.includes(route.name));
  
  const onTabbarLayout = (e: LayoutChangeEvent) => {
    setDimensions({
      height: e.nativeEvent.layout.height,
      width: e.nativeEvent.layout.width,
    });
  };

  const tabWidth = (dimensions.width - 12) / visibleRoutes.length;
  const translateX = useSharedValue(0);
  const isDragging = useSharedValue(false);

  // Function to handle navigation from the gesture (must be called via runOnJS)
  const handleNavigate = useCallback((index: number) => {
    const route = visibleRoutes[index];
    const isFocused = state.index === state.routes.findIndex(r => r.name === route.name);
    
    if (!isFocused) {
      navigation.navigate(route.name, route.params);
    }
  }, [navigation, state.index, state.routes, visibleRoutes]);

  // Update position when navigation state changes (only if not dragging)
  useEffect(() => {
    const activeIndex = visibleRoutes.findIndex(r => r.name === state.routes[state.index].name);
    if (activeIndex !== -1 && tabWidth > 0 && !isDragging.value) {
      translateX.value = withTiming(activeIndex * tabWidth, {
        duration: 250,
      });
    }
  }, [state.index, tabWidth, visibleRoutes, isDragging]);

  // Pan Gesture for sliding the capsule
  const panGesture = Gesture.Pan()
    .onStart(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      // Constrain movement within the tab bar bounds
      const maxTranslate = (visibleRoutes.length - 1) * tabWidth;
      const activeIndex = visibleRoutes.findIndex(r => r.name === state.routes[state.index].name);
      const startPos = activeIndex * tabWidth;
      
      let nextTranslate = startPos + event.translationX;
      translateX.value = Math.max(0, Math.min(nextTranslate, maxTranslate));
    })
    .onEnd((event) => {
      const maxTranslate = (visibleRoutes.length - 1) * tabWidth;
      const finalTranslate = translateX.value;
      
      // Calculate nearest tab index
      const nearestIndex = Math.round(finalTranslate / tabWidth);
      const clampedIndex = Math.max(0, Math.min(nearestIndex, visibleRoutes.length - 1));
      
      // Snap to the nearest tab
      translateX.value = withTiming(clampedIndex * tabWidth, { duration: 200 }, () => {
        isDragging.value = false;
      });
      
      // Trigger navigation
      runOnJS(handleNavigate)(clampedIndex);
    });

  const animatedCapsuleStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }],
      width: tabWidth,
    };
  });
  
  // Get options for the currently focused route
  const focusedOptions = descriptors[state.routes[state.index].key].options;

  // Check if tab bar should be hidden based on options OR via the
  // `useTabBarVisibilityStore` flag (set by nested screens like
  // home/map that can't reach this navigator's descriptor via setOptions).
  const hiddenByStore = useTabBarVisibilityStore((s) => s.hidden);
  // Android 12+: the focused screen's blur target (see TabBlurTarget).
  // Undefined until that screen has mounted, and while Settings is open:
  // Settings frosts the whole screen itself, and a live blur inside its
  // source would be re-rendered inside that blur every frame.
  const focusedBlurTarget = useTabBlurTargetStore((s) => s.targets[state.routes[state.index].key]);
  const settingsOpen = useSettingsOverlayStore((s) => s.isOpen);
  const blurTarget = settingsOpen ? undefined : focusedBlurTarget;
  const tabBarStyle = StyleSheet.flatten(focusedOptions.tabBarStyle) as any;
  if (hiddenByStore || tabBarStyle?.display === 'none') {
    return null;
  }
  
  return (
    <View style={[styles.container, { bottom: insets.bottom + 8 }]}>
      <GestureDetector gesture={panGesture}>
        <BlurView
          intensity={80}
          tint="light"
          style={styles.blurContainer}
          // Without a target, asking for the blur method only logs a warning
          // and falls back to a flat tint, so ask only once there is one.
          blurMethod={blurTarget ? "dimezisBlurViewSdk31Plus" : undefined}
          blurTarget={blurTarget}
        >
          <View onLayout={onTabbarLayout} style={styles.tabbar}>
            {/* Sliding Capsule */}
            {dimensions.width > 0 && (
              <Animated.View style={[styles.activeCapsuleWrapper, animatedCapsuleStyle]}>
                <View style={styles.activeCapsule} />
              </Animated.View>
            )}

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
        </BlurView>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 100,
    alignItems: 'center',
  },
  blurContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 35,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 24,
      },
      // Not `elevation`: Android pooled it into a dark rim at the rounded
      // ends. `boxShadow` blurs evenly, like the iOS shadow, and draws
      // outside the bounds, so `overflow: 'hidden'` doesn't clip it.
      android: {
        boxShadow: '0px 6px 20px rgba(0, 0, 0, 0.10)',
      },
    }),
  },
  tabbar: {
    flexDirection: 'row',
    padding: 6,
    alignItems: 'center',
    justifyContent: 'space-between',
    // Android 12+ really blurs (the BlurView's light tint is the frost), so it
    // needs no fill. Older Android can't blur, and at 65% the page showed
    // through sharply where iOS frosts it out, so it keeps a near-opaque fill.
    backgroundColor:
      Platform.OS === 'ios'
        ? 'rgba(255, 255, 255, 0.65)'
        : ANDROID_REAL_BLUR
          ? 'transparent'
          : 'rgba(255, 255, 255, 0.92)',
  },
  activeCapsuleWrapper: {
    position: 'absolute',
    height: '100%',
    top: 6,
    left: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeCapsule: {
    width: '105%',
    height: '110%',
    // Neutral, not tinted. This was rgba(37, 99, 235, 0.1) — brand blue at
    // 10% — which composites to #E2E8F6 over the #F7F7F7 bar and reads as a
    // blue wash. iOS uses a plain grey capsule (#E5E5E5), so the selected tab
    // is signalled by the icon and label turning blue, not by the pill itself.
    // Black at 7.3% over #F7F7F7 lands on #E5E5E5 and matches.
    backgroundColor: 'rgba(0, 0, 0, 0.073)',
    borderRadius: 28,
  }
})
