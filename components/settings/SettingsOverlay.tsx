/**
 * SettingsOverlay
 *
 * PURPOSE: Shared-element open animation that lifts the Settings page
 *          on top of Home. The Home initials button measures itself
 *          and writes its screen rect to `useSettingsOverlayStore`;
 *          this component animates a card from that rect to fullscreen,
 *          fades a blur backdrop in over Home, and slides a floating
 *          avatar from the button position to the natural Settings
 *          avatar slot.
 *
 *          As of the Revolut-style refactor, this lives at the
 *          `/profile-overlay` route (presented as `transparentModal`,
 *          `animation: 'none'`) so that destination screens pushed
 *          from inside settings rows stack ON TOP of the overlay
 *          rather than under it. Back gestures return the user here
 *          with the overlay still mounted in its same state.
 *
 *          Visually identical to the Settings tab once open — the
 *          settings render tree is reused via <SettingsContent />.
 *
 * USED IN: app/profile-overlay.tsx (single mount, route-driven)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
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
import { useFocusEffect, useRouter } from "expo-router";

import { SettingsContent } from "@/components/settings/SettingsContent";
import { SettingsContainerTransformOverlay } from "@/components/settings/SettingsContainerTransformOverlay";
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import {
  useSettingsOverlayStore,
  type SettingsOverlayRect,
} from "@/stores/useSettingsOverlayStore";
import { computeInitials } from "@/utils/userInitials";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Settings avatar's natural target size (matches SettingsContent's
// avatar block: 72×72 circular). The animation interpolates the
// floating avatar's size FROM the button's size TO this value.
const AVATAR_TARGET_SIZE = 72;

// Lighter, slightly snappier spring with imperceptible overshoot —
// reads as a fluid Revolut-style shared-element morph rather than a
// deliberate "expand". Combined with the matched AvatarSlider content
// and cross-fade handoffs, the motion feels like a single continuous
// element.
const SPRING_CONFIG = { damping: 20, stiffness: 130, mass: 1.0 } as const;

// Fallback morph anchor if the screen is reached without the avatar
// having written its rect (e.g. deep link to /profile-overlay). A
// centered 56×56 spot keeps the morph looking intentional rather than
// flying in from {0,0}.
const FALLBACK_RECT: SettingsOverlayRect = {
  x: SCREEN_W / 2 - 28,
  y: SCREEN_H / 2 - 28,
  width: 56,
  height: 56,
};

const isIOS26OrNewer =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

export function SettingsOverlay() {
  if (!isIOS26OrNewer) {
    return <SettingsContainerTransformOverlay />;
  }

  return <IOSSettingsOverlay />;
}

function IOSSettingsOverlay() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Capture the rect ONCE at mount. After this, the floating-avatar
  // morph anchor is fixed — even if the user scrolls or rotates,
  // close-morph still lands at the original spot.
  const initialRect = useSettingsOverlayStore.getState().fromRect;
  const rectRef = useRef<SettingsOverlayRect>(initialRect ?? FALLBACK_RECT);
  const rect = rectRef.current;

  // Identity for the floating avatar — sourced exactly like the home
  // button + Settings avatar so the three never disagree.
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
  // Trust `profile_photo_url` only when `profile_photo_storage_id` is
  // set; otherwise it's Clerk's default OAuth gradient that got synced
  // at signup. Matches the chain in ProfileInitialsButton +
  // SettingsContent so all three avatars agree.
  const photoUri = useMemo(() => {
    if (me?.profile_photo_storage_id && me?.profile_photo_url)
      return me.profile_photo_url;
    if (storedPhoto) return storedPhoto;
    return null;
  }, [me?.profile_photo_storage_id, me?.profile_photo_url, storedPhoto]);

  // `settled` is true only when the open spring has fully landed at
  // progress=1. While settled, we hand off the avatar from the floating
  // animated copy (sibling of the ScrollView, can't scroll) to the
  // natural copy inside SettingsContent (scrolls with content). Reset
  // to false the moment a close starts so the floating copy can take
  // over for the close animation.
  const [settled, setSettled] = useState(false);

  const progress = useSharedValue(0);

  // OPEN morph runs on mount. Defer the spring one frame so the first
  // paint lands at progress=0 (card sitting at the avatar rect) before
  // animating outward — otherwise the very first frame could draw a
  // partially-grown card.
  useEffect(() => {
    setSettled(false);
    progress.value = 0;
    const raf = requestAnimationFrame(() => {
      progress.value = withSpring(1, SPRING_CONFIG, (finished) => {
        if (finished) {
          runOnJS(setSettled)(true);
        }
      });
    });
    return () => cancelAnimationFrame(raf);
    // mount-only: re-running this would replay the open animation
    // mid-session, which is wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // CLOSE: reverse the spring then pop the route. Triggered by X
  // button or hardware back. Swipe-back gestures bypass this and use
  // the default pop (no morph) — acceptable per the plan.
  const handleClose = useCallback(() => {
    setSettled(false);
    progress.value = withSpring(0, SPRING_CONFIG, (finished) => {
      if (finished) {
        runOnJS(router.back)();
      }
    });
  }, [progress, router]);

  // Intercept Android hardware back so the close morph plays before
  // pop. Without this, hardware back would instantly unmount the
  // screen with no morph. Only active while this route is focused
  // (i.e. user is on /profile-overlay itself, not on a destination
  // pushed on top of it).
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        handleClose();
        return true;
      });
      return () => sub.remove();
    }, [handleClose]),
  );

  // ── Animated styles ────────────────────────────────────────────────

  // Card grows from the button rect to fullscreen. `overflow: hidden`
  // clips the SettingsContent inside while it's still small.
  const cardStyle = useAnimatedStyle(() => ({
    top: interpolate(
      progress.value,
      [0, 1],
      [rect.y, 0],
      Extrapolation.CLAMP,
    ),
    left: interpolate(
      progress.value,
      [0, 1],
      [rect.x, 0],
      Extrapolation.CLAMP,
    ),
    width: interpolate(
      progress.value,
      [0, 1],
      [rect.width, SCREEN_W],
      Extrapolation.CLAMP,
    ),
    height: interpolate(
      progress.value,
      [0, 1],
      [rect.height, SCREEN_H],
      Extrapolation.CLAMP,
    ),
    borderRadius: interpolate(
      progress.value,
      [0, 1],
      [rect.width / 2, 0],
      Extrapolation.CLAMP,
    ),
  }));

  // Backdrop blur fades in as the card grows.
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0, 0.5],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Floating avatar is absolutely positioned inside the card. At
  // progress=0 it fills the card (so visually replaces the home
  // button); at progress=1 it lands EXACTLY where the natural avatar
  // sits inside SettingsContent — `insets.top + 32` (ScrollView
  // paddingTop) + `8` (identity block marginTop) = `insets.top + 40`.
  // Matching this lets us hand off cleanly from the floating copy
  // (sibling of the ScrollView) to the natural copy (inside, scrolls
  // with content) once the open animation settles.
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

  // Initials font size scales smoothly from the home button (14px,
  // matches `size="sm"` in ProfileInitialsButton) to the settled
  // Settings avatar (24px, matches `size="2xl"` in SettingsContent).
  // Without this, the text would snap from sm→2xl at the spring's end
  // and again at close time.
  const initialsTextStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(
      progress.value,
      [0, 1],
      [14, 24],
      Extrapolation.CLAMP,
    ),
    lineHeight: interpolate(
      progress.value,
      [0, 1],
      [14 * 1.5, 24 * 1.5],
      Extrapolation.CLAMP,
    ),
  }));

  // SettingsContent body fades in midway through the morph so the
  // settings rows appear *with* the avatar settling into place, not
  // after it. Earlier overlap reads as a more layered, Revolut-style
  // reveal.
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.45, 0.9],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Floating avatar cross-fades to the natural avatar inside
  // SettingsContent at the very end of the morph — no unmount, no
  // 1-frame blank, the two copies overlap during the handoff. Same
  // range used on `naturalAvatarOpacityStyle` below (inverted) so the
  // visual transfer is symmetric.
  const floatingAvatarOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.95, 1],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  const naturalAvatarOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.95, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // X close button is the last thing to appear.
  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.85, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={StyleSheet.absoluteFillObject}>
      {/* Backdrop blur over Home */}
      <Animated.View
        style={[StyleSheet.absoluteFill, backdropStyle]}
        pointerEvents="none"
      >
        <BlurView intensity={40} tint="default" style={StyleSheet.absoluteFill} />
      </Animated.View>

      {/* The growing card. overflow:hidden clips Settings content while
          the card is still smaller than the screen. The card itself is
          transparent — a BlurView of the home page sits inside, with a
          subtle navy tint on top so text remains readable. */}
      {/* Static rect values inline so the FIRST paint lands at the
          button rect even before the Reanimated worklet for cardStyle
          has applied. Without these, `position: absolute` with no
          top/left would default to (0,0) for one frame — that was the
          "button jumps to top-left" flash. `cardStyle` immediately
          takes over and drives the grow animation. */}
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
          // Once the open spring lands, drop `overflow: hidden` so
          // descendant LiquidGlassView surfaces (e.g. the Upgrade pill)
          // can composite their native UIVisualEffectView correctly —
          // iOS won't render the glass through a parent that's
          // clipping its bounds. During open/close we still need the
          // clip so the fullscreen SettingsContent doesn't spill while
          // the card grows from a small rect.
          settled && { overflow: "visible" as const },
        ]}
      >
        {/* Frosted backdrop — blurs the home page visible through the
            card's transparent fill. */}
        <BlurView
          intensity={60}
          tint="default"
          style={StyleSheet.absoluteFill}
        />
        {/* Subtle navy tint to keep the white row text legible against
            the blurred home content. */}
        <View style={styles.cardTint} />

        {/* Settings render tree. While the spring is animating we
            render a blank placeholder in the avatar slot so the
            floating animated avatar can occupy that screen position
            without visually doubling. Once `settled` flips true (open
            spring finished), we drop the override so the natural
            avatar takes over — and that copy scrolls with the
            content. The `translucent` flag drops Settings' gradient
            so the blur above shows through. */}
        <Animated.View style={[StyleSheet.absoluteFill, bodyStyle]}>
          <SettingsContent
            translucent
            avatarOverride={
              settled ? undefined : (
                <Animated.View
                  style={[
                    {
                      width: AVATAR_TARGET_SIZE,
                      height: AVATAR_TARGET_SIZE,
                      borderRadius: AVATAR_TARGET_SIZE / 2,
                      overflow: "hidden",
                    },
                    naturalAvatarOpacityStyle,
                  ]}
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
                      <Text style={styles.naturalOverrideInitials}>
                        {initials}
                      </Text>
                    </LinearGradient>
                  )}
                </Animated.View>
              )
            }
          />
        </Animated.View>

        {/* Floating avatar — animates from button rect to Settings slot.
            Cross-fades into the natural avatar at the tail of the
            spring (progress 0.95 → 1) rather than unmounting on
            `settled`, so there's no 1-frame blank during the handoff.
            Mirrors the home button's image-or-initials choice so the
            shared element is visually identical at progress=0. */}
        <Animated.View
          style={[styles.floatingAvatar, avatarStyle, floatingAvatarOpacityStyle]}
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

        {/* X close — top-left, fades in last */}
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
    </View>
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
  // Static initials rendered into the natural-avatar slot during the
  // overlay's open animation — fades in at progress 0.95→1 right as
  // the floating avatar fades out. Matches the natural slider's
  // "initials" panel exactly so the handoff is visually invisible.
  naturalOverrideInitials: {
    fontFamily: "Urbanist-SemiBold",
    fontSize: 24,
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
