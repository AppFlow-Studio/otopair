/**
 * SettingsOverlay
 *
 * PURPOSE: iOS 26 shared-element open animation that lifts the Settings
 *          page on top of Home. Android and iOS <= 25 use
 *          SettingsContainerTransformOverlay instead.
 */

import React, { useEffect, useMemo, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { useShallow } from "zustand/react/shallow";
import { X } from "lucide-react-native";

import { SettingsContent } from "@/components/settings/SettingsContent";
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import {
  useSettingsOverlayStore,
  type SettingsOverlayRect,
} from "@/stores/useSettingsOverlayStore";
import { computeInitials } from "@/utils/userInitials";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const AVATAR_TARGET_SIZE = 72;

// Settle ~520ms with no overshoot so the card visibly expands from the button.
const SPRING_CONFIG = { damping: 26, stiffness: 110, mass: 1.05 } as const;

export function SettingsOverlay() {
  const insets = useSafeAreaInsets();
  const { isOpen, isMounted, fromRect } = useSettingsOverlayStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      isMounted: s.isMounted,
      fromRect: s.fromRect,
    })),
  );
  const closeStore = useSettingsOverlayStore((s) => s.close);
  const finishClose = useSettingsOverlayStore((s) => s.finishClose);

  const me = useQuery(api.users.getMe);
  const { firstName, lastName, storedPhoto } = useOnboardingStore(
    useShallow((s) => ({
      firstName: s.data.firstName,
      lastName: s.data.lastName,
      storedPhoto: s.data.profilePhotoUri,
    })),
  );

  const initials = useMemo(
    () =>
      computeInitials({
        first: me?.first_name ?? firstName,
        last: me?.last_name ?? lastName,
      }),
    [me?.first_name, me?.last_name, firstName, lastName],
  );

  const photoUri = useMemo(() => {
    if (me?.profile_photo_storage_id && me?.profile_photo_url) {
      return me.profile_photo_url;
    }
    if (storedPhoto) return storedPhoto;
    return null;
  }, [me?.profile_photo_storage_id, me?.profile_photo_url, storedPhoto]);

  const [settled, setSettled] = useState(false);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (isOpen && fromRect) {
      setSettled(false);
      progress.value = 0;

      const frame = requestAnimationFrame(() => {
        progress.value = withSpring(1, SPRING_CONFIG, (finished) => {
          if (finished) {
            runOnJS(setSettled)(true);
          }
        });
      });

      return () => cancelAnimationFrame(frame);
    }

    if (isMounted) {
      setSettled(false);
      progress.value = withSpring(0, SPRING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(finishClose)();
        }
      });
    }
  }, [finishClose, fromRect, isMounted, isOpen, progress]);

  const handleClose = () => {
    closeStore();
  };

  const rect: SettingsOverlayRect = fromRect ?? {
    x: 0,
    y: 0,
    width: 40,
    height: 40,
  };

  const cardStyle = useAnimatedStyle(() => {
    const top = interpolate(progress.value, [0, 1], [rect.y, 0], Extrapolation.CLAMP);
    const left = interpolate(progress.value, [0, 1], [rect.x, 0], Extrapolation.CLAMP);
    const width = interpolate(
      progress.value,
      [0, 1],
      [rect.width, SCREEN_W],
      Extrapolation.CLAMP,
    );
    const height = interpolate(
      progress.value,
      [0, 1],
      [rect.height, SCREEN_H],
      Extrapolation.CLAMP,
    );
    const borderRadius = interpolate(
      progress.value,
      [0, 1],
      [rect.width / 2, 0],
      Extrapolation.CLAMP,
    );

    return {
      top,
      left,
      width,
      height,
      borderRadius,
    };
  });

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5], [0, 1], Extrapolation.CLAMP),
  }));

  const NATURAL_AVATAR_TOP = insets.top + 40;
  const avatarStyle = useAnimatedStyle(() => {
    const cardW = interpolate(
      progress.value,
      [0, 1],
      [rect.width, SCREEN_W],
      Extrapolation.CLAMP,
    );
    const size = interpolate(
      progress.value,
      [0, 1],
      [rect.width, AVATAR_TARGET_SIZE],
      Extrapolation.CLAMP,
    );
    const left = (cardW - size) / 2;
    const top = interpolate(
      progress.value,
      [0, 1],
      [0, NATURAL_AVATAR_TOP],
      Extrapolation.CLAMP,
    );

    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      left,
      top,
    };
  });

  const initialsTextStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(progress.value, [0, 1], [14, 24], Extrapolation.CLAMP),
    lineHeight: interpolate(
      progress.value,
      [0, 1],
      [14 * 1.5, 24 * 1.5],
      Extrapolation.CLAMP,
    ),
  }));

  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.65, 1], [0, 1], Extrapolation.CLAMP),
  }));

  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.85, 1], [0, 1], Extrapolation.CLAMP),
  }));

  if (!isMounted || !fromRect) return null;

  return (
    <Modal
      transparent
      visible={isMounted}
      animationType="none"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View
        style={[StyleSheet.absoluteFill, backdropStyle]}
        pointerEvents="none"
      >
        <BlurView
          intensity={40}
          tint="default"
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View
        style={[
          styles.card,
          {
            top: rect.y,
            left: rect.x,
            width: rect.width,
            height: rect.height,
            borderRadius: rect.width / 2,
          },
          cardStyle,
        ]}
      >
        <BlurView
          intensity={60}
          tint="default"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.cardTint} />

        <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
          <SettingsContent
            translucent
            avatarOverride={
              settled ? undefined : (
                <View
                  style={{
                    width: AVATAR_TARGET_SIZE,
                    height: AVATAR_TARGET_SIZE,
                  }}
                />
              )
            }
          />
        </Animated.View>

        {!settled ? (
          <Animated.View
            style={[styles.floatingAvatar, avatarStyle]}
            pointerEvents="none"
          >
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <LinearGradient
                colors={["#5299FE", "#C5DAFF"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, styles.floatingAvatarFill]}
              >
                <Animated.Text style={[styles.initialsText, initialsTextStyle]}>
                  {initials}
                </Animated.Text>
              </LinearGradient>
            )}
          </Animated.View>
        ) : null}

        <Animated.View
          style={[
            styles.closeWrap,
            { top: insets.top + 12 },
            closeStyle,
          ]}
        >
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            hitSlop={10}
          >
            <X size={20} color="#FFFFFF" strokeWidth={2.4} />
          </Pressable>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    overflow: "hidden",
    backgroundColor: "transparent",
  },
  cardTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,17,32,0.25)",
  },
  floatingAvatar: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  floatingAvatarFill: {
    alignItems: "center",
    justifyContent: "center",
  },
  initialsText: {
    fontFamily: "Urbanist-SemiBold",
    color: "#FFFFFF",
    letterSpacing: 0.5,
    includeFontPadding: false,
    textAlignVertical: "center",
  },
  closeWrap: {
    position: "absolute",
    left: 16,
    zIndex: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
});

export default SettingsOverlay;
