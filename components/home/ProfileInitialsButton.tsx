/**
 * ProfileInitialsButton
 *
 * PURPOSE: Circular orange initials button that sits in the Home
 *          header where the OtoPair logo used to be. Tapping it
 *          captures its on-screen rect and triggers the
 *          SettingsOverlay's shared-element open animation
 *          (settings page grows from this button to fullscreen).
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useMemo, useRef } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "convex/react";
import { useShallow } from "zustand/react/shallow";

import { Text } from "@/components/shared-ui";
import { OtoPairIcon } from "@/components/icons/oto-pair";
import { AvatarSlider } from "@/components/settings/AvatarSlider";
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSettingsOverlayStore } from "@/stores/useSettingsOverlayStore";
import type { SettingsOverlayRect } from "@/stores/useSettingsOverlayStore";
import { computeInitials } from "@/utils/userInitials";

const BUTTON_SIZE = 40;

export function ProfileInitialsButton() {
  const viewRef = useRef<View>(null);
  const measuredRectRef = useRef<SettingsOverlayRect | null>(null);
  const me = useQuery(api.users.getMe);
  const { firstName, lastName, profilePhotoUri: storedPhoto } =
    useOnboardingStore(
      useShallow((s) => ({
        firstName: s.data.firstName,
        lastName: s.data.lastName,
        profilePhotoUri: s.data.profilePhotoUri,
      })),
    );
  const open = useSettingsOverlayStore((s) => s.open);
  const isOpen = useSettingsOverlayStore((s) => s.isOpen);

  const initials = useMemo(
    () =>
      computeInitials({
        first: me?.first_name ?? firstName,
        last: me?.last_name ?? lastName,
      }),
    [me?.first_name, me?.last_name, firstName, lastName],
  );

  // Same fallback chain as SettingsContent's avatar so the two surfaces
  // never disagree. `profile_photo_url` from Convex is only trusted
  // when `profile_photo_storage_id` is set — otherwise it's just the
  // Clerk OAuth default (purple gradient) that got synced on signup,
  // and we'd rather show our branded gradient initials placeholder.
  const photoUri = useMemo(() => {
    if (me?.profile_photo_storage_id && me?.profile_photo_url)
      return me.profile_photo_url;
    if (storedPhoto) return storedPhoto;
    return null;
  }, [me?.profile_photo_storage_id, me?.profile_photo_url, storedPhoto]);

  const updateMeasuredRect = useCallback(() => {
    viewRef.current?.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) {
        return;
      }
      measuredRectRef.current = { x, y, width, height };
    });
  }, []);

  const handlePress = useCallback(() => {
    // Ignore taps while the overlay is already open / animating in.
    if (isOpen) return;

    const measuredRect = measuredRectRef.current;
    if (measuredRect) {
      open(measuredRect);
      return;
    }

    viewRef.current?.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(x) || !Number.isFinite(y) || width <= 0 || height <= 0) {
        return;
      }
      const rect = { x, y, width, height };
      measuredRectRef.current = rect;
      open(rect);
    });
  }, [isOpen, open]);

  return (
    <View
      ref={viewRef}
      collapsable={false}
      pointerEvents={isOpen ? "none" : "auto"}
      style={[styles.measureWrap, isOpen && styles.hiddenWrap]}
      onLayout={updateMeasuredRect}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        hitSlop={6}
      >
        {photoUri ? (
          <Image source={{ uri: photoUri }} style={styles.image} />
        ) : (
          <LinearGradient
            colors={["#5299FE", "#C5DAFF"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.placeholder}
          >
            <AvatarSlider
              size={BUTTON_SIZE}
              panels={[
                <Text
                  key="initials"
                  weight="semiBold"
                  size="sm"
                  color="#FFFFFF"
                  style={styles.text}
                >
                  {initials}
                </Text>,
                <OtoPairIcon key="logo" size={26} />,
              ]}
            />
          </LinearGradient>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  measureWrap: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  hiddenWrap: {
    opacity: 0,
  },
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    overflow: "hidden",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  image: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
  },
  placeholder: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    letterSpacing: 0.5,
  },
});

export default ProfileInitialsButton;
