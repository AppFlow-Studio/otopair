/**
 * FloatingSheet
 *
 * PURPOSE: Reusable Flighty-style floating bottom sheet. Same chrome as
 *          BookingDetailsSheet — floating side/bottom insets, rounded
 *          corners on all four sides at non-full snaps, draggable grabber,
 *          drag-to-dismiss. Supports 1+ snap heights. Optional blur backdrop
 *          (off by default).
 *
 * DEFAULT STYLE (project standard):
 *          - 10pt side inset at small/mid, 0 at full
 *          - 12pt bottom inset at small/mid, 0 at full
 *          - 46pt border radius at small/mid, bottom flattens to 0 near full
 *          - 36×5 grabber, #D1D5DB
 *
 * USAGE:
 *   const ref = useRef<FloatingSheetRef>(null);
 *   <FloatingSheet
 *     ref={ref}
 *     snapHeights={[SCREEN_HEIGHT * 0.55]}
 *     onClose={() => console.log("closed")}
 *   >
 *     <MyContent />
 *   </FloatingSheet>
 *   // ref.current?.open()  /  ref.current?.close()
 */

import { BlurView } from "expo-blur";
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ============================================================================
// CONSTANTS (mirrors BookingDetailsSheet so the whole app feels consistent)
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const SIDE_INSET_MAX = 10;
const FLOAT_BOTTOM = 12;
const CORNER_RADIUS = 46;

const FLING_VELOCITY = 550;
const DISMISS_OVERSHOOT = 80;

// ============================================================================
// TYPES
// ============================================================================

export interface FloatingSheetRef {
  open: () => void;
  close: () => void;
}

interface FloatingSheetProps {
  /** Snap heights in px, ascending. Drag up/down snaps between them. */
  snapHeights: number[];
  /** Which snap the sheet opens to. Defaults to 0 (smallest). */
  initialSnapIndex?: number;
  /** If true, render a blurred + dimmed backdrop that dismisses on tap. */
  showBackdrop?: boolean;
  /** Called after the sheet finishes closing. */
  onClose?: () => void;
  /** Sheet body content (rendered below the grabber). */
  children?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const FloatingSheet = forwardRef<FloatingSheetRef, FloatingSheetProps>(
  ({ snapHeights, initialSnapIndex = 0, showBackdrop = false, onClose, children }, ref) => {
    const insets = useSafeAreaInsets();
    const [mounted, setMounted] = useState(false);

    // Fail-fast: snapHeights must be non-empty + ascending.
    const snaps = useMemo(() => {
      const sorted = [...snapHeights].sort((a, b) => a - b);
      return sorted.length > 0 ? sorted : [SCREEN_HEIGHT * 0.5];
    }, [snapHeights]);
    const H_MIN = snaps[0];
    const H_MAX = snaps[snaps.length - 1];

    // Full-screen height cap — if the caller passes a H_MAX greater than
    // this, we still allow it (e.g. full snap pins to screen edges). The
    // floating progress interpolation is between H_MIN and H_MAX.
    const FULL_HEIGHT = SCREEN_HEIGHT - Math.max(insets.top, 12) - 8;

    const sheetHeight = useSharedValue(0);
    const startHeight = useSharedValue(0);

    const unmount = useCallback(() => {
      setMounted(false);
      onClose?.();
    }, [onClose]);

    const close = useCallback(() => {
      sheetHeight.value = withTiming(0, { duration: 260 });
      setTimeout(unmount, 280);
    }, [sheetHeight, unmount]);

    const open = useCallback(() => {
      setMounted(true);
    }, []);

    useImperativeHandle(ref, () => ({ open, close }));

    // Enter animation when mounted flips to true.
    useEffect(() => {
      if (mounted) {
        sheetHeight.value = 0;
        const target = snaps[Math.max(0, Math.min(initialSnapIndex, snaps.length - 1))];
        const id = requestAnimationFrame(() => {
          sheetHeight.value = withTiming(target, { duration: 420 });
        });
        return () => cancelAnimationFrame(id);
      }
    }, [mounted, initialSnapIndex, snaps, sheetHeight]);

    // Pan gesture: drag up to grow, drag down to shrink or dismiss.
    const dragGesture = useMemo(
      () =>
        Gesture.Pan()
          .onBegin(() => {
            startHeight.value = sheetHeight.value;
          })
          .onUpdate((e) => {
            const next = startHeight.value - e.translationY;
            sheetHeight.value = Math.max(0, Math.min(H_MAX + 20, next));
          })
          .onEnd((e) => {
            const h = sheetHeight.value;
            const vUp = -e.velocityY;

            // Fling-down or over-shrink → dismiss.
            if (vUp < -FLING_VELOCITY && h < H_MIN + 40) {
              runOnJS(close)();
              return;
            }
            if (h < H_MIN - DISMISS_OVERSHOOT) {
              runOnJS(close)();
              return;
            }

            // Snap to nearest height on the snaps list.
            let target = snaps[0];
            let bestDist = Math.abs(snaps[0] - h);
            for (let i = 1; i < snaps.length; i++) {
              const d = Math.abs(snaps[i] - h);
              if (d < bestDist) {
                bestDist = d;
                target = snaps[i];
              }
            }

            // Velocity bias: if flinging, prefer the next snap in that direction.
            if (vUp > FLING_VELOCITY) {
              const above = snaps.find((s) => s > h);
              if (above != null) target = above;
            } else if (vUp < -FLING_VELOCITY) {
              const below = [...snaps].reverse().find((s) => s < h);
              if (below != null) target = below;
            }

            sheetHeight.value = withTiming(target, { duration: 280 });
          }),
      [H_MIN, H_MAX, snaps, close, sheetHeight, startHeight],
    );

    // Animated sheet chrome — insets + radius respond to how close we are
    // to the max snap. At max, bottom corners flatten and the sheet pins to
    // screen edges (if H_MAX is tall enough).
    const sheetAnimStyle = useAnimatedStyle(() => {
      const progress = interpolate(
        sheetHeight.value,
        [H_MIN, H_MAX],
        [0, 1],
        Extrapolation.CLAMP,
      );
      const sideInset = interpolate(progress, [0, 1], [SIDE_INSET_MAX, 0], Extrapolation.CLAMP);
      const bottomInset = interpolate(
        progress,
        [0, 0.85, 1],
        [FLOAT_BOTTOM, FLOAT_BOTTOM, 0],
        Extrapolation.CLAMP,
      );
      const bottomRadius = interpolate(
        progress,
        [0.85, 1],
        [CORNER_RADIUS, 0],
        Extrapolation.CLAMP,
      );
      return {
        left: sideInset,
        right: sideInset,
        bottom: bottomInset,
        height: sheetHeight.value,
        borderBottomLeftRadius: bottomRadius,
        borderBottomRightRadius: bottomRadius,
      };
    });

    const innerAnimStyle = useAnimatedStyle(() => {
      const progress = interpolate(
        sheetHeight.value,
        [H_MIN, H_MAX],
        [0, 1],
        Extrapolation.CLAMP,
      );
      const bottomRadius = interpolate(
        progress,
        [0.85, 1],
        [CORNER_RADIUS, 0],
        Extrapolation.CLAMP,
      );
      return {
        borderBottomLeftRadius: bottomRadius,
        borderBottomRightRadius: bottomRadius,
      };
    });

    const backdropAnimStyle = useAnimatedStyle(() => {
      const opacity = interpolate(
        sheetHeight.value,
        [0, H_MIN],
        [0, 1],
        Extrapolation.CLAMP,
      );
      return { opacity };
    });

    if (!mounted) return null;

    return (
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {showBackdrop ? (
          <Animated.View style={[StyleSheet.absoluteFill, backdropAnimStyle]} pointerEvents="auto">
            <Pressable style={StyleSheet.absoluteFill} onPress={close}>
              <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.backdropTint} />
            </Pressable>
          </Animated.View>
        ) : (
          // Invisible tap-to-dismiss layer that covers the space above the
          // sheet only. We clip it by rendering it as StyleSheet.absoluteFill
          // with pointerEvents="box-none" — the sheet (which is on top)
          // catches its own touches; taps that fall outside the sheet's
          // painted area also fall through the parent wrapper (box-none),
          // so background UI stays interactive.
          null
        )}

        <Animated.View style={[styles.sheetShadow, sheetAnimStyle]}>
          <Animated.View style={[styles.sheetInner, innerAnimStyle]}>
            <GestureDetector gesture={dragGesture}>
              <View style={styles.dragRegion}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>
            <View style={styles.content}>{children}</View>
          </Animated.View>
        </Animated.View>
      </View>
    );
  },
);

FloatingSheet.displayName = "FloatingSheet";

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdropTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  sheetShadow: {
    position: "absolute",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: CORNER_RADIUS,
    borderTopRightRadius: CORNER_RADIUS,
    borderBottomLeftRadius: CORNER_RADIUS,
    borderBottomRightRadius: CORNER_RADIUS,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
  },
  sheetInner: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: CORNER_RADIUS,
    overflow: "hidden",
  },
  dragRegion: {
    paddingHorizontal: 20,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginTop: 8,
    marginBottom: 8,
  },
  content: {
    flex: 1,
  },
});
