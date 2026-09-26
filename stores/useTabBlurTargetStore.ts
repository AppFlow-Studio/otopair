import type { RefObject } from "react";
import type { View } from "react-native";
import { create } from "zustand";

/**
 * Blur targets for the Android tab bar, keyed by tab route key.
 *
 * expo-blur's Android BlurView can only blur a <BlurTargetView> it is pointed
 * at, and the tab bar sits outside every screen. So each tab screen is wrapped
 * in one (TabBlurTarget, via the navigator's `screenLayout`) and registers it
 * here once mounted; the tab bar blurs the focused route's target.
 *
 * Only mounted refs are ever stored: BlurView reads `ref.current` when it gets
 * a ref and never re-reads the same ref, so a ref whose view hadn't mounted
 * yet would leave the bar unblurred for good.
 */
interface TabBlurTargetState {
  targets: Record<string, RefObject<View | null>>;
  register: (routeKey: string, ref: RefObject<View | null>) => void;
  unregister: (routeKey: string) => void;
}

export const useTabBlurTargetStore = create<TabBlurTargetState>((set) => ({
  targets: {},
  register: (routeKey, ref) =>
    set((s) => ({ targets: { ...s.targets, [routeKey]: ref } })),
  unregister: (routeKey) =>
    set((s) => {
      const { [routeKey]: _unregistered, ...rest } = s.targets;
      return { targets: rest };
    }),
}));
