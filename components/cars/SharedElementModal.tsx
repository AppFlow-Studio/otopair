/**
 * SharedElementModal
 *
 * PURPOSE: A modal component that provides a "shared element transition" effect.
 *          When triggered, it animates from the source element's position to a
 *          full-screen view with a glassy blur background.
 *
 * USED IN: ServiceHistory, LoyaltyPoints components on My Car page
 *
 * PROPS:
 *   - visible (boolean): Whether the modal is visible
 *   - layoutInfo (LayoutInfo): Position and size of the source element
 *   - onClose (() => void): Called when modal should close
 *   - title (string): Title to display in the modal header
 *   - children (ReactNode): Content to display in the expanded modal
 *
 * EXAMPLE:
 *   <SharedElementModal
 *     visible={showModal}
 *     layoutInfo={{ x: 50, y: 200, width: 300, height: 100 }}
 *     onClose={() => setShowModal(false)}
 *     title="Service History"
 *   >
 *     <ExpandedContent />
 *   </SharedElementModal>
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect } from 'react';
import {
    Dimensions,
    Modal,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';

// 2. Expo & Third-party
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
    Easing,
    runOnJS,
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { Colors, Spacing } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface LayoutInfo {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SharedElementModalProps {
  visible: boolean;
  layoutInfo: LayoutInfo | null;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Final position values for the expanded card
const FINAL_X = 16;
const FINAL_Y = 80;
const FINAL_WIDTH = SCREEN_WIDTH - 32;
const FINAL_HEIGHT = SCREEN_HEIGHT - 160;

// Spring configuration for smooth animations
const springConfig = {
  damping: 20,
  stiffness: 200,
  mass: 0.8,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function SharedElementModal({
  visible,
  layoutInfo,
  onClose,
  title,
  children,
}: SharedElementModalProps) {
  // Animated values for the card
  const cardX = useSharedValue(layoutInfo?.x ?? 0);
  const cardY = useSharedValue(layoutInfo?.y ?? 0);
  const cardWidth = useSharedValue(layoutInfo?.width ?? FINAL_WIDTH);
  const cardHeight = useSharedValue(layoutInfo?.height ?? 100);
  const borderRadius = useSharedValue(12);
  const overlayOpacity = useSharedValue(0);
  const contentOpacity = useSharedValue(0);

  // Handle opening animation
  useEffect(() => {
    if (visible && layoutInfo) {
      // Reset to starting position
      cardX.value = layoutInfo.x;
      cardY.value = layoutInfo.y;
      cardWidth.value = layoutInfo.width;
      cardHeight.value = layoutInfo.height;
      borderRadius.value = 12;
      overlayOpacity.value = 0;
      contentOpacity.value = 0;

      // Animate to final position
      cardX.value = withSpring(FINAL_X, springConfig);
      cardY.value = withSpring(FINAL_Y, springConfig);
      cardWidth.value = withSpring(FINAL_WIDTH, springConfig);
      cardHeight.value = withSpring(FINAL_HEIGHT, springConfig);
      borderRadius.value = withSpring(20, springConfig);
      overlayOpacity.value = withTiming(1, { duration: 300 });
      contentOpacity.value = withTiming(1, { duration: 400, easing: Easing.out(Easing.ease) });
    }
  }, [visible, layoutInfo]);

  // Handle closing animation
  const handleClose = () => {
    if (!layoutInfo) {
      onClose();
      return;
    }

    // Animate content fade out first
    contentOpacity.value = withTiming(0, { duration: 200 });

    // Then animate card back to original position
    cardX.value = withSpring(layoutInfo.x, springConfig);
    cardY.value = withSpring(layoutInfo.y, springConfig);
    cardWidth.value = withSpring(layoutInfo.width, springConfig);
    cardHeight.value = withSpring(layoutInfo.height, springConfig);
    borderRadius.value = withSpring(12, springConfig);
    overlayOpacity.value = withTiming(0, { duration: 300 }, (finished) => {
      if (finished) {
        runOnJS(onClose)();
      }
    });
  };

  // Animated styles for the card
  const animatedCardStyle = useAnimatedStyle(() => ({
    position: 'absolute',
    left: cardX.value,
    top: cardY.value,
    width: cardWidth.value,
    height: cardHeight.value,
    borderRadius: borderRadius.value,
    overflow: 'hidden',
  }));

  // Animated styles for the overlay
  const animatedOverlayStyle = useAnimatedStyle(() => ({
    opacity: overlayOpacity.value,
  }));

  // Animated styles for the content
  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      {/* Background Overlay */}
      <Animated.View style={[styles.overlay, animatedOverlayStyle]}>
        <Pressable style={styles.overlayPressable} onPress={handleClose} />
      </Animated.View>

      {/* Animated Card */}
      <Animated.View style={animatedCardStyle}>
        <BlurView intensity={20} tint="light" style={styles.blurView}>
          <View style={styles.glassBackground} />
          <View style={styles.glassBorder} />
          
          {/* Header with close button */}
          <Animated.View style={[styles.header, animatedContentStyle]}>
            <Text weight="bold" size="xl" color={Colors.light.text}>
              {title}
            </Text>
            <Pressable
              onPress={handleClose}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && styles.closeButtonPressed,
              ]}
            >
              <Ionicons name="close" size={24} color={Colors.light.text} />
            </Pressable>
          </Animated.View>

          {/* Content */}
          <Animated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View style={animatedContentStyle}>
              {children}
            </Animated.View>
          </Animated.ScrollView>
        </BlurView>
      </Animated.View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  overlayPressable: {
    flex: 1,
  },
  blurView: {
    flex: 1,
    overflow: 'hidden',
  },
  glassBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  glassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    paddingBottom: Spacing.xl,
  },
});

export default SharedElementModal;

