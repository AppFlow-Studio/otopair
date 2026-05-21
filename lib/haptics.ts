/**
 * Centralized haptics. This is the ONLY file in the app that imports
 * `expo-haptics`. Every other call site goes through these named helpers.
 *
 * Policy (docs/notifications/PLAN.md §B.4):
 *  - Haptics confirm, they do not announce.
 *  - When Reduce Motion is on, every helper becomes a no-op.
 *  - Tab taps, scroll, keystrokes, modal open/close, info toasts → no haptic.
 *
 * If you need a new haptic intent, add a helper here — do not import
 * expo-haptics elsewhere. The ESLint rule in .eslintrc enforces this.
 */
// eslint-disable-next-line no-restricted-imports
import * as Haptics from "expo-haptics";

import { isReduceMotionEnabledSync } from "./accessibility";

function gate(): boolean {
  return !isReduceMotionEnabledSync();
}

function silent<T>(p: Promise<T>): void {
  p.catch(() => {});
}

export const haptics = {
  /** Primary CTA that commits to a server mutation (chosen project-wide). */
  cta() {
    if (!gate()) return;
    silent(Haptics.selectionAsync());
  },
  /** Toast Success / Trust-Moment appear. */
  success() {
    if (!gate()) return;
    silent(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
  },
  /** Toast Warning appear. */
  warning() {
    if (!gate()) return;
    silent(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
  },
  /** Toast Error appear. */
  error() {
    if (!gate()) return;
    silent(Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
  },
  /** Destructive confirmation tap (cancel booking, delete vehicle/address). */
  confirmDestructive() {
    if (!gate()) return;
    silent(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy));
  },
  /** Pull-to-refresh release, toggle change, picker detent, menu selection. */
  selection() {
    if (!gate()) return;
    silent(Haptics.selectionAsync());
  },
  /**
   * Step-advance / sub-CTA tap (not server-committing). Use sparingly —
   * prefer `selection` for most cases. Kept distinct so existing
   * Light-impact intents migrate cleanly without overusing notification.
   */
  step() {
    if (!gate()) return;
    silent(Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
  },
};

export type HapticIntent = keyof typeof haptics;
