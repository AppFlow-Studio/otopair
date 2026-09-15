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

import { useCoachRegistry } from "./CoachContext";

interface CoachTargetProps {
  /** Must match the `target` of a step in coachSteps.ts. */
  id: string;
  /** Radius of the hole. Match the element's own corner radius. */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function CoachTarget({ id, radius = 16, style, children }: CoachTargetProps) {
  const reg = useCoachRegistry();
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
      regRef.current?.report(id, { x, y, width, height, radius });
    });
  }, [id, radius]);

  // Unregister on unmount so a stale rect from a tab we have left cannot be
  // spotlit — that would cut a hole over whatever now occupies those pixels.
  useEffect(() => {
    return () => regRef.current?.report(id, null);
  }, [id]);

  if (!reg) return <View style={style}>{children}</View>;

  return (
    <View ref={ref} style={style} onLayout={measure} collapsable={false}>
      {children}
    </View>
  );
}

export default CoachTarget;
