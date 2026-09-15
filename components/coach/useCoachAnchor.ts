/**
 * useCoachAnchor — make an element a coach-mark target without wrapping it.
 *
 * <CoachTarget> inserts a View. That is fine around a card, and not fine
 * inside Home's sheet or the Oto composer, where the surrounding layout is
 * driven by flex rules and shared values that an extra node quietly
 * changes. A tutorial that nudges the thing it is teaching is worse than no
 * tutorial.
 *
 * So this returns props to SPREAD onto a View that already exists:
 *
 *   const anchor = useCoachAnchor("home.search", 16);
 *   <View style={styles.searchWrap} {...anchor}>
 *
 * It contributes no node and no style — only a ref, an onLayout, and
 * `collapsable={false}` so Android cannot optimise the host view away and
 * leave nothing to measure.
 */

import { useCallback, useEffect, useRef } from "react";
import type { LayoutChangeEvent, View } from "react-native";

import { useCoachRegistry } from "./CoachContext";

export interface CoachAnchorProps {
  ref: (node: View | null) => void;
  onLayout: (e: LayoutChangeEvent) => void;
  collapsable: false;
}

export function useCoachAnchor(id: string, radius = 16): CoachAnchorProps {
  const reg = useCoachRegistry();
  const node = useRef<View | null>(null);

  /**
   * The registry object is rebuilt whenever ANY target reports, so anything
   * that closes over `reg` changes identity constantly. Holding it in a ref
   * keeps `measure`, the ref callback and the unmount cleanup stable.
   *
   * This is not a tidiness point. With `reg` in the cleanup's dependency
   * array, the cleanup ran on every report and unregistered this target
   * moments after it registered — the tooltip then had no rect to anchor to
   * and fell back to floating in the middle of the screen, while the hole,
   * driven by shared values that had already been set, stayed put and looked
   * perfectly correct.
   */
  const regRef = useRef(reg);
  regRef.current = reg;

  const measure = useCallback(() => {
    const n = node.current;
    const r = regRef.current;
    if (!n || !r) return;
    // A frame's grace: on a freshly pushed screen the view is laid out but
    // not yet positioned in the window, and measureInWindow returns zeros.
    requestAnimationFrame(() => {
      n.measureInWindow?.((x, y, width, height) => {
        if (!width || !height) return;
        regRef.current?.report(id, { x, y, width, height, radius });
      });
    });
  }, [id, radius]);

  const setRef = useCallback(
    (n: View | null) => {
      node.current = n;
      if (n) measure();
    },
    [measure],
  );

  const onLayout = useCallback((_e: LayoutChangeEvent) => measure(), [measure]);

  // Unmount only — see the note on regRef.
  useEffect(() => () => regRef.current?.report(id, null), [id]);

  return { ref: setRef, onLayout, collapsable: false };
}
