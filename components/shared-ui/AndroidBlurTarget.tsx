/**
 * AndroidBlurTarget
 *
 * PURPOSE: Real blur on Android, to match the frosted surfaces iOS draws.
 *          expo-blur's Android BlurView can only blur a <BlurTargetView> it
 *          is pointed at, and it needs Android 12 (API 31) to do it well.
 *          On Android 12+ this wraps its children in a target; everywhere
 *          else (iOS, older Android) it renders them as-is, so those view
 *          trees stay exactly as they were.
 *
 *          A BlurView must never sit inside the target it blurs, or it
 *          would blur itself.
 *
 * USED IN: app/(main-tabs)/_layout.tsx, app/(main-tabs)/home/index.tsx
 */

import React from "react";
import { Platform, StyleSheet, type View } from "react-native";
import { BlurTargetView } from "expo-blur";

/** True where BlurViews can really blur (Android 12+ with a target). */
export const ANDROID_REAL_BLUR =
  Platform.OS === "android" && Number(Platform.Version) >= 31;

interface AndroidBlurTargetProps {
  targetRef: React.RefObject<View | null>;
  children: React.ReactNode;
}

export function AndroidBlurTarget({ targetRef, children }: AndroidBlurTargetProps) {
  if (!ANDROID_REAL_BLUR) return <>{children}</>;
  return (
    <BlurTargetView ref={targetRef} style={styles.fill}>
      {children}
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
