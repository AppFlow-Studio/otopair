/**
 * themedAlert, themedPrompt + ThemedAlertHost.
 *
 * `themedAlert` takes Alert.alert's arguments. On iOS 26 it IS Alert.alert:
 * the native alert there is Liquid Glass and already looks right. Android's
 * system dialog (and iOS before 26) looked out of place next to the app's
 * themed toasts and modals, so there it shows ThemedAlertModal instead.
 * Mount <ThemedAlertHost /> once, at the root.
 */

import React, { useSyncExternalStore } from "react";
import { Alert, type AlertButton, type AlertOptions, Platform } from "react-native";
import type { LucideIcon } from "lucide-react-native";

import { ThemedAlertModal } from "@/components/shared-ui";

// Same optional probe as the Cars / Oto screens: false off iOS 26, and when
// the native module is missing.
let nativeAlertFits = false;
try {
  nativeAlertFits = !!require("@callstack/liquid-glass").isLiquidGlassSupported;
} catch {
  // Not available — use the themed modal.
}

export interface ThemedAlertOptions extends AlertOptions {
  /** Icon chip above the title. The native iOS 26 alert has none. */
  icon?: LucideIcon;
}

/** A themedPrompt button: onPress gets the text in the field. */
export interface PromptButton {
  text: string;
  style?: AlertButton["style"];
  onPress?: (value?: string) => void;
}

interface ThemedAlertRequest {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: ThemedAlertOptions;
  /** Set by themedPrompt: a text field seeded with `defaultValue`. */
  prompt?: { defaultValue: string; buttons: PromptButton[] };
}

let current: ThemedAlertRequest | null = null;
// Still drawn while the modal fades out after `current` clears.
let lastShown: ThemedAlertRequest | null = null;
const listeners = new Set<() => void>();

function setCurrent(next: ThemedAlertRequest | null) {
  if (next) lastShown = next;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function themedAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: ThemedAlertOptions,
): void {
  if (nativeAlertFits) {
    Alert.alert(title, message, buttons, options);
    return;
  }
  setCurrent({ title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }], options });
}

/**
 * Alert.prompt's arguments (plain text only). iOS keeps the native prompt.
 * Android has no Alert.prompt (the call does nothing there), so it gets
 * ThemedAlertModal with a text field; each button's onPress receives the text.
 */
export function themedPrompt(
  title: string,
  message: string | undefined,
  buttons: PromptButton[],
  defaultValue = "",
): void {
  if (Platform.OS === "ios") {
    Alert.prompt(title, message, buttons, "plain-text", defaultValue);
    return;
  }
  setCurrent({ title, message, buttons, prompt: { defaultValue, buttons } });
}

export function ThemedAlertHost() {
  const request = useSyncExternalStore(subscribe, () => current);
  const alert = request ?? lastShown;
  if (!alert) return null;

  const press = (button: AlertButton, value?: string) => {
    setCurrent(null);
    // A prompt's buttons take the field's text. Same objects as `buttons`,
    // kept typed: AlertButton's onPress may also expect a login/password pair.
    const promptButton = alert.prompt?.buttons.find((b) => b === button);
    if (promptButton) promptButton.onPress?.(value);
    else button.onPress?.();
  };
  // Back (or a tap outside, when cancelable) acts as Cancel when there is one.
  const dismiss = () => {
    const cancel = alert.buttons.find((b) => b.style === "cancel");
    if (cancel) return press(cancel);
    if (!alert.options?.cancelable) return;
    setCurrent(null);
    alert.options.onDismiss?.();
  };

  return (
    <ThemedAlertModal
      visible={request !== null}
      title={alert.title}
      message={alert.message}
      buttons={alert.buttons}
      icon={alert.options?.icon}
      input={alert.prompt}
      onPress={press}
      onDismiss={dismiss}
      dismissible={!!alert.options?.cancelable}
    />
  );
}
