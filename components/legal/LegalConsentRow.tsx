/**
 * LegalConsentRow
 *
 * PURPOSE: The signup consent gate — one unchecked box the user must tap
 *          before an account can be created, with both document titles as
 *          visibly tappable links into the full text.
 *
 * USED IN: components/onboarding/steps/SignupStep.tsx
 *
 * WHY IT LOOKS LIKE THIS (from counsel, via the PM):
 *   - never pre-checked, so `checked` is owned by the caller and starts false;
 *   - the user cannot proceed without tapping it — the caller gates every
 *     account-creating action on it and calls `nudge()` when one is attempted
 *     while unchecked, which is what the `nudgeKey` prop drives;
 *   - it sits immediately above the action buttons, not below the fold and not
 *     on an earlier screen;
 *   - the links are coloured AND underlined. "Grey-on-grey" link styling is
 *     one of the things that loses these cases, so it is not a style choice
 *     to be tidied up later.
 *
 * The links open the same screens Settings does; there is no auth guard on
 * app/settings/_layout.tsx, so they work while signed out.
 */

import React, { useCallback, useEffect, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Check } from "lucide-react-native";
import { useRouter } from "expo-router";

import { FontFamily, FontSize, Spacing, Text } from "@/components/shared-ui";
import { useReducedMotion } from "@/lib/accessibility";

const ACCENT = "#5299FE";
const INK = "#0F172A";

interface LegalConsentRowProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  /**
   * Increment to shake the row. Any change to this value that is not the
   * first render triggers the animation, so the caller can just bump a
   * counter each time a gated button is pressed while unchecked.
   */
  nudgeKey?: number;
}

export function LegalConsentRow({ checked, onChange, nudgeKey = 0 }: LegalConsentRowProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const shake = useSharedValue(0);

  /**
   * A <Text onPress> nested inside a <Pressable> claims the touch on iOS but
   * can still fire the parent on Android. Opening a document and silently
   * toggling consent in the same tap is exactly the kind of thing that makes
   * the checkbox worthless, so the link press flags itself and the row skips
   * that toggle.
   */
  const linkPressed = useRef(false);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion) return;
    shake.value = withSequence(
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(-4, { duration: 50 }),
      withTiming(0, { duration: 50 }),
    );
  }, [nudgeKey, reduceMotion, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const toggle = useCallback(() => {
    if (linkPressed.current) {
      linkPressed.current = false;
      return;
    }
    onChange(!checked);
  }, [checked, onChange]);

  const openDoc = useCallback(
    (path: "/settings/terms-and-conditions" | "/settings/privacy-policy") => () => {
      linkPressed.current = true;
      router.push(path);
    },
    [router],
  );

  return (
    <Animated.View style={shakeStyle}>
      <Pressable
        onPress={toggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="I agree to the Terms of Use and Privacy Policy"
        accessibilityHint="Required before you can create an account"
        hitSlop={8}
        style={styles.row}
      >
        <View style={[styles.box, checked && styles.boxChecked]}>
          {checked ? <Check size={14} color="#FFFFFF" strokeWidth={3} /> : null}
        </View>

        <Text style={styles.label}>
          I agree to the{" "}
          <Text
            style={styles.link}
            suppressHighlighting
            onPress={openDoc("/settings/terms-and-conditions")}
            accessibilityRole="link"
          >
            Terms of Use
          </Text>
          {" "}and{" "}
          <Text
            style={styles.link}
            suppressHighlighting
            onPress={openDoc("/settings/privacy-policy")}
            accessibilityRole="link"
          >
            Privacy Policy
          </Text>
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "rgba(15, 23, 42, 0.30)",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  boxChecked: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  label: {
    flex: 1,
    color: INK,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    lineHeight: 20,
  },
  link: {
    color: ACCENT,
    fontFamily: FontFamily.semiBold,
    textDecorationLine: "underline",
  },
});

export default LegalConsentRow;
