/**
 * ProfileInitialsButton
 *
 * PURPOSE: Circular orange initials button that sits in the Home
 *          header where the OtoPair logo used to be. Tapping it
 *          captures its on-screen rect, writes it to the overlay
 *          store as the morph anchor, and pushes the
 *          `/profile-overlay` route which renders SettingsOverlay's
 *          shared-element open animation.
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useMemo, useRef } from "react";
import { Image, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "convex/react";
import { useShallow } from "zustand/react/shallow";
import { usePathname, useRouter } from "expo-router";

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
  const router = useRouter();
  const pathname = usePathname();
  const me = useQuery(api.users.getMe);
  const { firstName, lastName, profilePhotoUri: storedPhoto } =
    useOnboardingStore(
      useShallow((s) => ({
        firstName: s.data.firstName,
        lastName: s.data.lastName,
        profilePhotoUri: s.data.profilePhotoUri,
      })),
    );
  const setFromRect = useSettingsOverlayStore((s) => s.setFromRect);

  // The avatar must stay hidden whenever the overlay is somewhere on
  // the stack — either focused (/profile-overlay) OR underneath a
  // destination pushed from it (/settings/*, /payments, etc.). The
  // home screen is mounted the whole time below the overlay route, so
  // without this the original avatar would peek through the overlay's
  // floating animated avatar and visually double.
  //
  // Heuristic: hide on the overlay route itself AND any route that's
  // commonly pushed from inside it. Simpler than tracking history
  // ourselves — pathname is always current to the focused route.
  const overlayLifecycleActive =
    pathname === "/profile-overlay" ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/payments") ||
    pathname.startsWith("/membership");

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
    // Ignore taps while the overlay (or one of its destinations) is
    // already up — re-pushing the route would stack a duplicate.
    if (overlayLifecycleActive) return;
    viewRef.current?.measureInWindow((x, y, width, height) => {
      setFromRect({ x, y, width, height });
      router.push("/profile-overlay");
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

  // Cross-fade the button content while the overlay is alive, rather
  // than conditionally unmounting it. The overlay's floating avatar
  // renders the SAME `AvatarSlider` (paused on the same panel) at the
  // SAME on-screen position at progress=0 — so a brief overlap during
  // the 90 ms fade is invisible. The fade-out replaces the previous
  // hard pop the user saw as a button glitch.
  const contentOpacity = useSharedValue(1);
  useEffect(() => {
    contentOpacity.value = withTiming(overlayLifecycleActive ? 0 : 1, {
      duration: 90,
    });
  }, [overlayLifecycleActive, contentOpacity]);
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  return (
    <GestureDetector gesture={tap}>
    <View ref={viewRef} style={styles.button}>
      <Animated.View style={[StyleSheet.absoluteFill, contentStyle]}>
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
              paused={overlayLifecycleActive}
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
        )}
      </Animated.View>
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
