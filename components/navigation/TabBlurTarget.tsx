/**
 * TabBlurTarget
 *
 * PURPOSE: Wraps a tab screen in a <BlurTargetView> so the Android tab bar can
 *          really blur it, the way the iOS bar frosts whatever scrolls under
 *          it. Registers the target under its route key once mounted — see
 *          stores/useTabBlurTargetStore.ts for why only mounted refs go in.
 *          Only mounted on Android 12+ (see ANDROID_REAL_BLUR).
 *
 * USED IN: app/(main-tabs)/_layout.tsx (the navigator's `screenLayout`)
 */

import React, { useLayoutEffect, useRef } from "react";
import { StyleSheet, type View } from "react-native";
import { BlurTargetView } from "expo-blur";

import { useTabBlurTargetStore } from "@/stores/useTabBlurTargetStore";

interface TabBlurTargetProps {
  routeKey: string;
  children: React.ReactNode;
}

export function TabBlurTarget({ routeKey, children }: TabBlurTargetProps) {
  const ref = useRef<View>(null);
  const register = useTabBlurTargetStore((s) => s.register);
  const unregister = useTabBlurTargetStore((s) => s.unregister);

  // A layout effect runs after the target's own ref is attached (children
  // commit first), so the tab bar only ever receives a mounted target.
  useLayoutEffect(() => {
    register(routeKey, ref);
    return () => unregister(routeKey);
  }, [routeKey, register, unregister]);

  return (
    <BlurTargetView ref={ref} style={styles.fill}>
      {children}
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
