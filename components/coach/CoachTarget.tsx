/**
 * CoachTarget — wraps an element so a coach mark can point at it.
 *
 * Deliberately inert: it renders a plain View and reports where that View
 * landed. It does not change layout (no padding, no flex of its own beyond
 * what the caller passes) because it wraps live production UI, and a
 * tutorial must never move the thing it is teaching.
 *
 * `measureInWindow` rather than the onLayout rect: onLayout gives
 * parent-relative coordinates, and the overlay is full-screen. The layout
 * event is only the trigger for re-measuring.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useCoachInstanceId, useCoachRegistry } from "./CoachContext";

interface CoachTargetProps {
  /** Must match the `target` of a step in coachSteps.ts. */
  id: string;
  /** Radius of the hole. Match the element's own corner radius. */
  radius?: number;
  /**
   * Shrink the reported rect horizontally, in points.
   *
   * For wrappers that stretch edge to edge while the thing you can actually
   * see sits inside them — the Oto composer is full-width with the pill
   * inset — this trims the hole to the visible control WITHOUT touching the
   * real layout, which a margin here would.
   */
  insetX?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function CoachTarget({ id, radius = 16, insetX = 0, style, children }: CoachTargetProps) {
  const reg = useCoachRegistry();
  const instance = useCoachInstanceId();
  const ref = useRef<View | null>(null);
  // Held in a ref because the registry object is rebuilt on every report —
  // see the note in useCoachAnchor.ts. With `reg` in a dependency array the
  // cleanup below unregisters the target almost as soon as it registers.
  const regRef = useRef(reg);
  regRef.current = reg;

  const measure = useCallback(() => {
    const node = ref.current;
    if (!node || !regRef.current) return;
    node.measureInWindow((x, y, width, height) => {
      if (!width || !height) return;
      regRef.current?.report(id, instance, {
        x: x + insetX,
        y,
        width: Math.max(0, width - insetX * 2),
        height,
        radius,
      });
    });
  }, [id, radius, insetX, instance]);

  // Unregister on unmount so a stale rect from a tab we have left cannot be
  // spotlit — that would cut a hole over whatever now occupies those pixels.
  useEffect(() => {
    return () => regRef.current?.report(id, instance, null);
  }, [id, instance]);

  // Re-measure when the tour asks. See CoachRegistry.nudge.
  const nudge = reg?.nudge ?? 0;
  useEffect(() => {
    if (nudge > 0) measure();
  }, [nudge, measure]);

  if (!reg) return <View style={style}>{children}</View>;

  return (
    <View ref={ref} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
}

export default CoachTarget;
