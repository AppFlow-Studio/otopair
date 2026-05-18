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

import React, { useMemo, useRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "convex/react";
import { useShallow } from "zustand/react/shallow";

import { Text } from "@/components/shared-ui";
import { AvatarSlider } from "@/components/settings/AvatarSlider";
import { api } from "@/convex/_generated/api";

// 3D OtoPair pin logo used as the second avatar-slider panel.
const OTO_LOGO_3D = require("@/assets/images/pin-logo-3d.png");
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useSettingsOverlayStore } from "@/stores/useSettingsOverlayStore";
import { computeInitials } from "@/utils/userInitials";

const BUTTON_SIZE = 40;

export function ProfileInitialsButton() {
  const viewRef = useRef<View>(null);
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
  const isMounted = useSettingsOverlayStore((s) => s.isMounted);

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

  const handlePress = () => {
    // Ignore taps while the overlay is already open / animating in.
    if (isOpen) return;
    viewRef.current?.measureInWindow((x, y, width, height) => {
      open({ x, y, width, height });
    });
  };

  // Use react-native-gesture-handler's Tap gesture instead of Pressable.
  // On iOS 26, Pressable triggers a native press feedback that visually
  // shifts the view up briefly on touch-down — even with a static style
  // and no opacity feedback. Gesture.Tap uses UIGestureRecognizer
  // primitives with no built-in visual cue.
  const tap = Gesture.Tap().onEnd(() => {
    runOnJS(handlePress)();
  });

  // While the SettingsOverlay is mounted (open or animating closed), the
  // floating avatar inside the overlay sits at the same on-screen
  // position as this home button (and then slides to its settled
  // top-center position during the open animation). Rendering both at
  // once made the user see a "second AH" floating away — which they
  // described as "the button moves up then back down". Hide the
  // contents (not the wrapper, so layout + measureInWindow stay stable)
  // for the entire open + close lifecycle.
  const showContents = !isMounted;

  return (
    <GestureDetector gesture={tap}>
    <View ref={viewRef} style={styles.button}>
      {showContents && (photoUri ? (
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
                weight="semiBold"
                size="sm"
                color="#FFFFFF"
                style={styles.text}
              >
                {initials}
              </Text>,
              <Image
                source={OTO_LOGO_3D}
                style={{ width: 38, height: 38 }}
                resizeMode="contain"
              />,
            ]}
          />
        </LinearGradient>
      ))}
    </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  button: {
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    borderRadius: BUTTON_SIZE / 2,
    overflow: "hidden",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonHidden: {
    opacity: 0,
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
