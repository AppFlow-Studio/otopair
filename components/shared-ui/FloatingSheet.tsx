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
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Dimensions, Modal, Pressable, StyleSheet, View } from "react-native";
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
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";

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
  /** Backdrop style when `showBackdrop` is true. `"blur"` (default)
   *  combines a BlurView with a dark tint. `"dim"` skips the blur and
   *  uses just the dark tint — better when the content behind should
   *  remain readable. */
  backdropMode?: "blur" | "dim";
  /** Called after the sheet finishes closing. */
  onClose?: () => void;
  /** Corner radius at small/mid snaps. Defaults to 46. Flattens to 0 near
   *  the full snap (unchanged behavior). */
  cornerRadius?: number;
  /** Override the BOTTOM corner radius at small/mid snaps. Defaults to
   *  `cornerRadius`. Pass a larger value (e.g. 32) when only the top
   *  should stay tight and the bottom should curve more visibly.
   *  Still flattens to 0 near the full snap, same as cornerRadius. */
  bottomCornerRadius?: number;
  /** When true, the sheet rises by the keyboard height so an input near the
   *  bottom stays visible. Default false (no change for input-less sheets). */
  liftWithKeyboard?: boolean;
  /** Override the bottom inset at the smallest detent (multi-snap mode).
   *  Defaults to 12pt. Pass `insets.bottom + N` if the sheet should clearly
   *  float above the home indicator. Ignored in single-snap mode. */
  floatBottomInset?: number;
  /** Override the side inset (left/right) at all detents. Defaults to
   *  interpolating SIDE_INSET_MAX (10pt) → 0 across snap progress.
   *  Pass `0` to keep the sheet pinned edge-to-edge at every detent
   *  (Vehicle-Health-overlay look). */
  sideInset?: number;
  /** Sheet body content (rendered below the grabber). */
  children?: React.ReactNode;
  /** Replaces the default solid-white sheet fill. Renders
   *  absoluteFill INSIDE the sheet chrome (below the handle and
   *  body), so callers can supply a glass / gradient / blurred
   *  background without modifying FloatingSheet's shadow + corner
   *  geometry. When set, the sheetInner background goes
   *  transparent so this element shows through. */
  backgroundElement?: React.ReactNode;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const FloatingSheet = forwardRef<FloatingSheetRef, FloatingSheetProps>(
  (
    {
      snapHeights,
      initialSnapIndex = 0,
      showBackdrop = false,
      backdropMode = "blur",
      onClose,
      cornerRadius = CORNER_RADIUS,
      bottomCornerRadius,
      liftWithKeyboard = false,
      floatBottomInset,
      sideInset: sideInsetOverride,
      children,
      backgroundElement,
    },
    ref,
  ) => {
    const insets = useSafeAreaInsets();
    const { height: keyboardHeight } = useReanimatedKeyboardAnimation();
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

    // Phase ref distinguishes "just opened, animate up from 0" from
    // "already open, snap-points changed because content grew" from
    // "mid-close, ignore everything." Without this, a snap-points
    // change during the close timeout (common when an upstream picker
    // selection invalidates a cascading data dep) re-fires the
    // entrance animation and the sheet visibly re-opens before
    // shutting again.
    const phaseRef = useRef<"closed" | "opening" | "open" | "closing">("closed");

    const unmount = useCallback(() => {
      setMounted(false);
      onClose?.();
    }, [onClose]);

    const close = useCallback(() => {
      phaseRef.current = "closing";
      sheetHeight.value = withTiming(0, { duration: 260 });
      setTimeout(() => {
        phaseRef.current = "closed";
        unmount();
      }, 280);
    }, [sheetHeight, unmount]);

    const open = useCallback(() => {
      phaseRef.current = "opening";
      setMounted(true);
    }, []);

    useImperativeHandle(ref, () => ({ open, close }));

    useEffect(() => {
      if (!mounted || phaseRef.current === "closing") return;
      const target = snaps[Math.max(0, Math.min(initialSnapIndex, snaps.length - 1))];
      if (phaseRef.current === "opening") {
        sheetHeight.value = 0;
        const id = requestAnimationFrame(() => {
          sheetHeight.value = withTiming(target, { duration: 420 });
          phaseRef.current = "open";
        });
        return () => cancelAnimationFrame(id);
      }
      // Already open — snap-points changed (e.g. content grew). Resize
      // smoothly without resetting to 0 first.
      sheetHeight.value = withTiming(target, { duration: 240 });
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

    // With a single snap, there's no "pull up to full" transition to
    // interpolate through — so the progress range would collapse (H_MIN ===
    // H_MAX) and pin the sheet to the screen edges with sharp corners. Lock
    // it to the floating chrome instead.
    const isSingleSnap = snaps.length === 1;
    // Resolved bottom radius — falls back to cornerRadius when the
    // caller doesn't override. Lets consumers (e.g. ReceiptSheet)
    // keep the top tight while making the bottom curve more visible.
    const resolvedBottomRadius = bottomCornerRadius ?? cornerRadius;

    // Animated sheet chrome — insets + radius respond to how close we are
    // to the max snap. At max, bottom corners flatten and the sheet pins to
    // screen edges (if H_MAX is tall enough).
    // Single-snap floating bottom — partial home-indicator clearance so the
    // sheet tucks close to the bottom edge. Full `insets.bottom` felt too
    // lifted on the requesting sheet; half gives a tight tuck while still
    // floating visibly above the edge.
    const singleSnapBottomInset = Math.max(insets.bottom / 2, 4);

    const sheetAnimStyle = useAnimatedStyle(() => {
      if (isSingleSnap) {
        const singleSide = sideInsetOverride ?? SIDE_INSET_MAX;
        return {
          left: singleSide,
          right: singleSide,
          bottom: singleSnapBottomInset + (liftWithKeyboard ? Math.abs(keyboardHeight.value) : 0),
          height: sheetHeight.value,
          borderBottomLeftRadius: resolvedBottomRadius,
          borderBottomRightRadius: resolvedBottomRadius,
        };
      }
      const progress = interpolate(
        sheetHeight.value,
        [H_MIN, H_MAX],
        [0, 1],
        Extrapolation.CLAMP,
      );
      const sideInset = sideInsetOverride ?? interpolate(progress, [0, 1], [SIDE_INSET_MAX, 0], Extrapolation.CLAMP);
      const restingBottom = floatBottomInset ?? FLOAT_BOTTOM;
      const bottomInset = interpolate(
        progress,
        [0, 0.85, 1],
        [restingBottom, restingBottom, 0],
        Extrapolation.CLAMP,
      );
      const bottomRadius = interpolate(
        progress,
        [0.85, 1],
        [resolvedBottomRadius, 0],
        Extrapolation.CLAMP,
      );
      return {
        left: sideInset,
        right: sideInset,
        bottom: bottomInset + (liftWithKeyboard ? Math.abs(keyboardHeight.value) : 0),
        height: sheetHeight.value,
        borderBottomLeftRadius: bottomRadius,
        borderBottomRightRadius: bottomRadius,
      };
    });

    const innerAnimStyle = useAnimatedStyle(() => {
      if (isSingleSnap) {
        return {
          borderBottomLeftRadius: resolvedBottomRadius,
          borderBottomRightRadius: resolvedBottomRadius,
        };
      }
      const progress = interpolate(
        sheetHeight.value,
        [H_MIN, H_MAX],
        [0, 1],
        Extrapolation.CLAMP,
      );
      const bottomRadius = interpolate(
        progress,
        [0.85, 1],
        [resolvedBottomRadius, 0],
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

    // Wrap in a native <Modal> so the sheet renders above the global
    // bottom tab bar (matches the membership-page bottom-sheet pattern).
    // Without this, the absolute-positioned sheet sits underneath the
    // floating TabBar and the user sees the tab bar peek through the
    // dim/blur backdrop.
    return (
      <Modal
        visible={mounted}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={close}
      >
      <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
        {showBackdrop ? (
          <Animated.View style={[StyleSheet.absoluteFill, backdropAnimStyle]} pointerEvents="auto">
            <Pressable style={StyleSheet.absoluteFill} onPress={close}>
              {backdropMode === "blur" && (
                <BlurView intensity={28} tint="dark" style={StyleSheet.absoluteFill} />
              )}
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

        <Animated.View
          style={[
            styles.sheetShadow,
            {
              borderTopLeftRadius: cornerRadius,
              borderTopRightRadius: cornerRadius,
              borderBottomLeftRadius: resolvedBottomRadius,
              borderBottomRightRadius: resolvedBottomRadius,
            },
            sheetAnimStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.sheetInner,
              backgroundElement ? styles.sheetInnerTransparent : null,
              { borderRadius: cornerRadius },
              innerAnimStyle,
            ]}
          >
            {backgroundElement ? (
              <View style={StyleSheet.absoluteFill} pointerEvents="none">
                {backgroundElement}
              </View>
            ) : null}
            <GestureDetector gesture={dragGesture}>
              <View style={styles.dragRegion}>
                <View style={styles.handle} />
              </View>
            </GestureDetector>
            <View style={styles.content}>{children}</View>
          </Animated.View>
        </Animated.View>
      </View>
      </Modal>
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
    backgroundColor: "rgba(0,0,0,0.4)",
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
  sheetInnerTransparent: {
    backgroundColor: "transparent",
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
