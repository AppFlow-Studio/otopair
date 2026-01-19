/**
 * AIToast
 *
 * PURPOSE: ChatGPT-style top toast notification for action feedback
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shows feedback when user interacts with message actions)
 *
 * PROPS:
 *   - message (string): The message to display
 *   - visible (boolean): Whether the toast is visible
 *   - onDismiss (() => void): Callback when toast is dismissed
 *   - duration (number): Auto-dismiss duration in ms (default: 3000)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useEffect } from 'react';
import { View, Pressable, StyleSheet } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { Spacing, FontFamily, BorderRadius } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

interface AIToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  duration?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SPRING_CONFIG = { damping: 20, stiffness: 300 };

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIToast({
  message,
  visible,
  onDismiss,
  duration = 3000,
}: AIToastProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(-100);
  const opacity = useSharedValue(0);
  const [shouldRender, setShouldRender] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setShouldRender(true);
      // Animate in
      translateY.value = withSpring(0, SPRING_CONFIG);
      opacity.value = withTiming(1, { duration: 200 });

      // Auto dismiss
      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Animate out
      translateY.value = withSpring(-100, SPRING_CONFIG);
      opacity.value = withTiming(0, { duration: 150 }, () => {
        runOnJS(setShouldRender)(false);
      });
    }
  }, [visible, duration]);

  const handleDismiss = () => {
    translateY.value = withSpring(-100, SPRING_CONFIG);
    opacity.value = withTiming(0, { duration: 150 }, () => {
      runOnJS(onDismiss)();
      runOnJS(setShouldRender)(false);
    });
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!shouldRender) {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        { top: insets.top + 8 },
        animatedStyle,
      ]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <View style={styles.toast}>
        <Pressable
          style={({ pressed }) => [
            styles.dismissBtn,
            pressed && styles.dismissBtnPressed,
          ]}
          onPress={handleDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <X size={16} color="#6B7280" strokeWidth={2} />
        </Pressable>
        
        <Text style={styles.message} numberOfLines={2}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    zIndex: 1000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  dismissBtnPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  message: {
    flex: 1,
    color: '#1F2937',
    fontSize: 14,
    fontFamily: FontFamily.medium,
    lineHeight: 20,
  },
});
