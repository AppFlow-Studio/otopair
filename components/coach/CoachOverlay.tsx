/**
 * CoachOverlay — the dimmed screen with a real hole in it.
 *
 * WHY A REAL HOLE: the alternative is redrawing the target on top of the
 * scrim, which is what the Figma mock does because Figma has no other
 * option. In the app that would be a copy — it would drift from the live
 * element the moment either changes, and it would be a picture of a button
 * rather than the button. One <Path> with fillRule="evenodd" cuts the scrim
 * instead, so what shows through IS the screen.
 *
 * The hole travels between steps on the UI thread: the rect lives in shared
 * values and the path `d` is rebuilt in a worklet, so a step change never
 * waits on JS. The tooltip crossfades separately and slightly behind, the
 * same lead/lag the phone-mock tour uses.
 *
 * DESIGN: Figma `kI9Em7mHSzkgAwDCtCNJYi` → C1…C4 + Spec.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { haptics } from "@/lib/haptics";

import { Text } from "@/components/shared-ui";
import { FontFamily } from "@/constants/theme";
import { OtoEasing } from "@/constants/animations";
import { useReducedMotion } from "@/lib/accessibility";
import type { CoachRect } from "./CoachContext";
import type { CoachMark } from "./coachMarks";

const AnimatedPath = Animated.createAnimatedComponent(Path);

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const INK = "#141C24";
const ACCENT = "#5299FE";
const MUTED = "#5A6675";
const DIM = "#D0D7E1";

/** Breathing room between the element and the edge of the hole. */
const PAD_DEFAULT = 6;
/** Gap between the hole and the tooltip, enough for the caret plus air. */
const GAP = 22;
const TIP_W = 313;
/** Below this much room on the preferred side, the tooltip flips. */
const MIN_ROOM = 210;
/** Anything taller than this share of the screen is a container, not a target. */
const MAX_TARGET_FRACTION = 0.45;
/** Keep the hole off the screen edges. */
const VIEWPORT_INSET = 8;
/** Less of the element than this on screen and there is nothing to point at. */
const MIN_VISIBLE = 44;
/** Keep the tooltip this far from the screen edges. */
const TIP_MARGIN = 56;

const HOLE_MS = 420;
const FADE_IN_MS = 260;

/**
 * Rounded-rect hole punched out of a full-screen rect.
 * A worklet: it runs on the UI thread every frame while the hole travels.
 */
function holePath(x: number, y: number, w: number, h: number, r: number) {
  "worklet";
  const outer = `M0 0 H${SCREEN_W} V${SCREEN_H} H0 Z`;
  // No hole: a plain full-screen scrim. Without this branch the path kept the
  // PREVIOUS step's cutout — the shared values still held it — so navigating
  // to a tab whose target had not reported left a circle from the last screen
  // floating over the new one.
  if (w <= 0 || h <= 0) return outer;
  const rr = Math.max(0, Math.min(r, Math.min(w, h) / 2));
  const inner =
    `M${x + rr} ${y}` +
    ` H${x + w - rr} A${rr} ${rr} 0 0 1 ${x + w} ${y + rr}` +
    ` V${y + h - rr} A${rr} ${rr} 0 0 1 ${x + w - rr} ${y + h}` +
    ` H${x + rr} A${rr} ${rr} 0 0 1 ${x} ${y + h - rr}` +
    ` V${y + rr} A${rr} ${rr} 0 0 1 ${x + rr} ${y} Z`;
  return `${outer} ${inner}`;
}

interface CoachOverlayProps {
  visible: boolean;
  /** The single hint being shown. */
  mark: CoachMark;
  /** Its target's measured rect, already settled by the caller. */
  rect: CoachRect | null;
  onDismiss: () => void;
}

export function CoachOverlay({
  visible,
  mark,
  rect,
  onDismiss,
}: CoachOverlayProps) {
  const reduceMotion = useReducedMotion();
  const step = mark;
  const wantsTarget = !!step?.target;

  const hx = useSharedValue(SCREEN_W / 2);
  const hy = useSharedValue(SCREEN_H / 2);
  const hw = useSharedValue(0);
  const hh = useSharedValue(0);
  const hr = useSharedValue(16);
  const copy = useSharedValue(0);
  const pulse = useSharedValue(0);

  /**
   * Targets re-report on every layout pass, and a fresh object each time.
   * Keying on the NUMBERS keeps the effects below from re-running on identity
   * alone — when they did, each run restarted the fade and the tooltip never
   * reached full opacity.
   */
  const rectKey = rect
    ? `${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(rect.width)}:${Math.round(
        rect.height,
      )}:${rect.radius}`
    : null;

  /**
   * Cards run past the fold. Rejecting anything tall (the first attempt) meant
   * the NOW card — a perfectly good target — spotlit nothing at all, and
   * clamping is what coach-mark libraries actually do: cut the hole over the
   * part that is ON SCREEN. Below MIN_VISIBLE there is not enough of the
   * element showing to point at, and the step skips.
   */
  const usable = rect;

  useEffect(() => {
    if (rect && __DEV__ && rect.height > SCREEN_H * MAX_TARGET_FRACTION) {
      console.warn(
        `[coach] "${step?.target}" measured ${Math.round(rect.width)}×${Math.round(
          rect.height,
        )} — taller than ${Math.round(MAX_TARGET_FRACTION * 100)}% of the screen, so the` +
          " hole is clamped to the visible part. If that reads as a box around" +
          " several unrelated things, anchor the element rather than its container.",
      );
    }
  }, [rect, step]);

  /**
   * The hole for THIS step. Reset on every step change — retaining it across
   * steps meant that when a target failed to report, the previous step's hole
   * stayed on screen and the tour appeared to be pointing at something
   * unrelated on a completely different tab.
   */
  /** Measured tooltip height, so its position can be clamped on screen. */
  const [tipH, setTipH] = useState(0);

  const [shown, setShown] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
    r: number;
  } | null>(null);

  useEffect(() => {
    setShown(null);
    settled.current = false;
  }, [mark.id]);

  /** Per-mark halo; a card with its own padding wants less than a bare control. */
  const pad = mark.pad ?? PAD_DEFAULT;

  useEffect(() => {
    if (!usable) return;
    const rawTop = usable.y - pad;
    const rawBottom = usable.y + usable.height + pad;
    // Clamp into the viewport, leaving the status bar and the very bottom edge
    // alone so the hole never bleeds off screen.
    const top = Math.max(VIEWPORT_INSET, rawTop);
    const bottom = Math.min(SCREEN_H - VIEWPORT_INSET, rawBottom);
    setShown({
      x: usable.x - pad,
      y: top,
      w: usable.width + pad * 2,
      h: bottom - top,
      r: usable.radius + pad / 2,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rectKey, pad]);

  /** Too little of it showing to point at — scrolled away, or clipped. */
  const hole = shown && shown.h >= MIN_VISIBLE && shown.w > 0 ? shown : null;

  /** Nothing to show yet: navigating, or the target has not reported. */
  const waiting = wantsTarget && !hole;

  const below = useMemo(() => {
    if (!hole || !step) return true;
    const roomBelow = SCREEN_H - (hole.y + hole.h);
    const roomAbove = hole.y;
    if (step.placement === "below") {
      return !(roomBelow < MIN_ROOM && roomAbove > roomBelow);
    }
    return !(roomAbove < MIN_ROOM && roomBelow > roomAbove) ? false : true;
  }, [hole, step]);

  const settled = useRef(false);

  useEffect(() => {
    if (!visible) return;
    if (!hole) {
      // Collapse it, so the scrim closes over the old cutout rather than
      // leaving it behind while the next target mounts.
      hw.value = withTiming(0, { duration: 140 });
      hh.value = withTiming(0, { duration: 140 });
      settled.current = false;
      return;
    }
    const jump = !settled.current || reduceMotion;
    const t = (v: number) =>
      jump ? v : withTiming(v, { duration: HOLE_MS, easing: OtoEasing.standard });
    hx.value = t(hole.x);
    hy.value = t(hole.y);
    hw.value = t(hole.w);
    hh.value = t(hole.h);
    hr.value = t(hole.r);
    settled.current = true;
  }, [visible, hole, reduceMotion, hx, hy, hw, hh, hr]);

  // The card is hidden entirely while waiting. Showing it un-anchored was the
  // "jumps to the middle of the screen and back" bug.
  useEffect(() => {
    if (!visible) return;
    if (waiting) {
      copy.value = withTiming(0, { duration: 160 });
      return;
    }
    copy.value = 0;
    copy.value = withTiming(1, {
      duration: reduceMotion ? 120 : FADE_IN_MS,
      easing: OtoEasing.enter,
    });
  }, [visible, waiting, mark.id, reduceMotion, copy]);

  // The pulse is the affordance. Without it the highlight reads as decoration
  // and the driver waits for the tooltip to do something.
  useEffect(() => {
    if (!visible || reduceMotion || !hole) {
      pulse.value = 0;
      return;
    }
    pulse.value = 0;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200, easing: OtoEasing.standard }),
        withDelay(260, withTiming(0, { duration: 0 })),
      ),
      -1,
      false,
    );
  }, [visible, reduceMotion, hole, pulse]);

  useEffect(() => {
    if (!visible) {
      settled.current = false;
      setShown(null);
      copy.value = 0;
      pulse.value = 0;
    }
  }, [visible, copy, pulse]);

  const pathProps = useAnimatedProps(() => ({
    d: holePath(hx.value, hy.value, hw.value, hh.value, hr.value),
  }));
  const copyStyle = useAnimatedStyle(() => ({ opacity: copy.value }));
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: (1 - pulse.value) * 0.5,
    transform: [{ scale: 1 + pulse.value * 0.07 }],
  }));

  useEffect(() => {
    if (visible && !waiting && step) {
      AccessibilityInfo.announceForAccessibility?.(`${step.title}. ${step.body}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, mark.id, waiting]);

  const tap = useCallback(
    (fn: () => void) => () => {
      // `step` is the documented intent for a step-advance / sub-CTA tap.
      haptics.step();
      fn();
    },
    [],
  );

  if (!visible || !step) return null;

  const tipLeft = hole
    ? Math.max(16, Math.min(hole.x, SCREEN_W - TIP_W - 16))
    : (SCREEN_W - TIP_W) / 2;
  /**
   * Always positioned by `top`, and always clamped on screen.
   *
   * Placing an "above" hint with `bottom` meant a target that fills the
   * screen — the booking flow's sheets do — pushed the whole card off the
   * top, leaving just the "Got it" peeking over the status bar. A preference
   * for a side is not a promise there is room on it.
   */
  const tipTop = (() => {
    if (!hole) return SCREEN_H / 2 - 120;
    const h = tipH || 190;
    const wanted = below ? hole.y + hole.h + GAP : hole.y - GAP - h;
    return Math.max(TIP_MARGIN, Math.min(wanted, SCREEN_H - h - TIP_MARGIN));
  })();

  const caretLeft = hole
    ? Math.max(tipLeft + 18, Math.min(hole.x + 40, tipLeft + TIP_W - 36))
    : 0;


  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg
        width={SCREEN_W}
        height={SCREEN_H}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      >
        <AnimatedPath animatedProps={pathProps} fill={INK} fillOpacity={0.72} fillRule="evenodd" />
      </Svg>

      {/* Swallows every tap that is not on the target — unless the mark is
          non-blocking, in which case the driver is meant to keep working and
          the hint is only there to explain. */}
      {step.blocking === false ? null : (
        <Pressable style={StyleSheet.absoluteFill} onPress={() => {}} accessible={false} />
      )}

      {hole ? (
        <>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ring,
              pulseStyle,
              {
                left: hole.x - 5,
                top: hole.y - 5,
                width: hole.w + 10,
                height: hole.h + 10,
                borderRadius: hole.r + 5,
              },
            ]}
          />
          <View
            pointerEvents="none"
            style={[
              styles.ring,
              { left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: hole.r },
            ]}
          />
          {/* Tap-to-dismiss sits OVER the hole, so the real control never
              fires by accident. A non-blocking mark skips it entirely — there
              the point is that the real control DOES fire. */}
          {step.blocking === false ? null : (
          <Pressable
            onPress={tap(onDismiss)}
            style={{ position: "absolute", left: hole.x, top: hole.y, width: hole.w, height: hole.h }}
            accessibilityRole="button"
            accessibilityLabel={`${step.title}. Tap to dismiss`}
          />
          )}
        </>
      ) : null}

      <Animated.View style={[styles.copyLayer, copyStyle]} pointerEvents="box-none">
        {hole ? (
          <View
            pointerEvents="none"
            style={[
              styles.caret,
              below
                ? { top: tipTop - 10, left: caretLeft }
                : { top: tipTop + (tipH || 190) - 1, left: caretLeft, transform: [{ rotate: "180deg" }] },
            ]}
          />
        ) : null}

        <View
          onLayout={(e) => setTipH(e.nativeEvent.layout.height)}
          style={[
            styles.tip,
            { left: tipLeft, top: tipTop },
          ]}
          pointerEvents={waiting ? "none" : "auto"}
        >
          <Text style={styles.title}>{step.title}</Text>
          <Text style={styles.body}>{step.body}</Text>
          <View style={styles.rule} />
          {/* One hint, one way out. No Back and no "2 of 5" — these fire
              independently now, so a counter would be counting something the
              driver never agreed to sit through. */}
          <View style={styles.footerSingle}>
            <Pressable onPress={tap(onDismiss)} hitSlop={12} accessibilityRole="button">
              <Text style={styles.next}>Got it</Text>
            </Pressable>
          </View>
        </View>


      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  copyLayer: { ...StyleSheet.absoluteFillObject },
  ring: {
    position: "absolute",
    borderWidth: 2,
    borderColor: ACCENT,
  },
  caret: {
    position: "absolute",
    width: 0,
    height: 0,
    borderLeftWidth: 9,
    borderRightWidth: 9,
    borderBottomWidth: 11,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderBottomColor: "#FFFFFF",
  },
  tip: {
    position: "absolute",
    width: TIP_W,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 20,
    paddingBottom: 16,
    shadowColor: INK,
    shadowOpacity: 0.22,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  eyebrow: {
    fontFamily: FontFamily.bold,
    fontSize: 10.5,
    letterSpacing: 1.1,
    color: ACCENT,
  },
  title: { fontFamily: FontFamily.bold, fontSize: 18, color: INK, marginTop: 6 },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 13.5,
    lineHeight: 19,
    color: MUTED,
    marginTop: 8,
  },
  hint: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12,
    color: ACCENT,
    marginTop: 12,
  },
  rule: { height: 1, backgroundColor: DIM, marginTop: 14 },
  footerSingle: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 14,
  },
  back: { fontFamily: FontFamily.medium, fontSize: 15, color: "#99A1AB" },
  backSpacer: { width: 36 },
  count: { fontFamily: FontFamily.medium, fontSize: 13, color: "#99A1AB" },
  next: { fontFamily: FontFamily.semiBold, fontSize: 15, color: ACCENT },
  skip: { position: "absolute", right: 20, top: 58, padding: 8 },
  skipText: { fontFamily: FontFamily.medium, fontSize: 14, color: "#D6DEE8" },
});

export default CoachOverlay;
