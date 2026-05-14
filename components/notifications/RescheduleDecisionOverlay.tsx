/**
 * RescheduleDecisionOverlay
 *
 * Shared-element open animation that lifts the Pending Customer
 * Acceptance decision UI on top of the current tab. The trigger
 * (a notification row or a booking card) measures itself and writes
 * its screen rect to `useRescheduleDecisionOverlayStore`; this
 * component animates a card from that rect to fullscreen and fades
 * in a blur backdrop.
 *
 * The body — title, before/after comparison, Accept / Decline — is
 * owned by RescheduleDecisionContent.
 *
 * Mounted once in `app/(main-tabs)/_layout.tsx` so it can open over
 * any tab.
 */

import React, { useEffect, useState } from "react";
import {
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";

import { RescheduleDecisionContent } from "./RescheduleDecisionContent";
import {
  useRescheduleDecisionOverlayStore,
  type OverlayRect,
} from "@/stores/useRescheduleDecisionOverlayStore";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const SPRING_CONFIG = { damping: 22, stiffness: 145, mass: 1.05 } as const;

export function RescheduleDecisionOverlay() {
  const insets = useSafeAreaInsets();
  const isOpen = useRescheduleDecisionOverlayStore((s) => s.isOpen);
  const fromRect = useRescheduleDecisionOverlayStore((s) => s.fromRect);
  const bookingId = useRescheduleDecisionOverlayStore((s) => s.bookingId);
  const closeStore = useRescheduleDecisionOverlayStore((s) => s.close);

  const [mounted, setMounted] = useState(false);
  const [activeRect, setActiveRect] = useState<OverlayRect | null>(null);
  const [activeBookingId, setActiveBookingId] = useState<typeof bookingId>(null);

  const progress = useSharedValue(0);

  useEffect(() => {
    if (isOpen && fromRect && bookingId) {
      setActiveRect(fromRect);
      setActiveBookingId(bookingId);
      setMounted(true);
      progress.value = 0;
      requestAnimationFrame(() => {
        progress.value = withSpring(1, SPRING_CONFIG);
      });
    } else if (mounted) {
      progress.value = withSpring(0, SPRING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(setMounted)(false);
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fromRect, bookingId]);

  const handleClose = () => {
    closeStore();
  };

  const rect = activeRect ?? { x: 0, y: 0, width: 56, height: 56 };

  const cardStyle = useAnimatedStyle(() => ({
    top: interpolate(
      progress.value,
      [0, 1],
      [rect.y, 0],
      Extrapolation.CLAMP,
    ),
    left: interpolate(
      progress.value,
      [0, 1],
      [rect.x, 0],
      Extrapolation.CLAMP,
    ),
    width: interpolate(
      progress.value,
      [0, 1],
      [rect.width, SCREEN_W],
      Extrapolation.CLAMP,
    ),
    height: interpolate(
      progress.value,
      [0, 1],
      [rect.height, SCREEN_H],
      Extrapolation.CLAMP,
    ),
    borderRadius: interpolate(
      progress.value,
      [0, 1],
      [Math.min(rect.width, rect.height) / 2, 0],
      Extrapolation.CLAMP,
    ),
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.5],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.4, 0.9],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.7, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  if (!mounted) return null;

  return (
    <Modal
      transparent
      visible={mounted}
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, backdropStyle]}
        pointerEvents="none"
      >
        <BlurView intensity={40} tint="default" style={StyleSheet.absoluteFill} />
      </Animated.View>

      <Animated.View style={[styles.card, cardStyle]}>
        <View style={styles.cardFill} />

        <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
          {activeBookingId ? (
            <RescheduleDecisionContent
              bookingId={activeBookingId}
              onClose={handleClose}
            />
          ) : null}
        </Animated.View>

        <Animated.View
          style={[styles.closeWrap, { top: insets.top + 12 }, closeStyle]}
        >
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            hitSlop={10}
          >
            <X size={20} color="#141C24" strokeWidth={2.4} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  cardFill: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
  },
  closeWrap: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(20,28,36,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
});

export default RescheduleDecisionOverlay;
