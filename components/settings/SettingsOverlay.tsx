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
 *          Visually identical to the Settings tab once open — the
 *          settings render tree is reused via <SettingsContent />.
 *
 * USED IN: app/(main-tabs)/home/index.tsx (mounted once)
 *
 * OWNER: Ahmad Hamoudeh
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

// Settings avatar's natural target size (matches SettingsContent's
// avatar block: 72×72 circular). The animation interpolates the
// floating avatar's size FROM the button's size TO this value.
const AVATAR_TARGET_SIZE = 72;

// Settle ~520ms, no overshoot — feels like a deliberate expand
// instead of a slam. Tightening damping + lowering stiffness gives
// the card room to "grow" rather than snap to size.
const SPRING_CONFIG = { damping: 26, stiffness: 110, mass: 1.05 } as const;

export function SettingsOverlay() {
  const insets = useSafeAreaInsets();
  // Pull all three open/mount/rect values in a single subscription so
  // we never re-render with a partially-applied state combo (e.g.
  // isMounted=true but fromRect=null, which used to paint the card at
  // the fallback {0,0,56,56} rect for one frame — that's what looked
  // like the button "jumping to the top-left corner.")
  const { isOpen, isMounted, fromRect } = useSettingsOverlayStore(
    useShallow((s) => ({
      isOpen: s.isOpen,
      isMounted: s.isMounted,
      fromRect: s.fromRect,
    })),
  );
  const closeStore = useSettingsOverlayStore((s) => s.close);
  const finishClose = useSettingsOverlayStore((s) => s.finishClose);

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

  // Drive the open/close springs in response to store changes. Mount
  // state is owned by the store (isMounted) so the home button hide and
  // the overlay render flip on the same frame — no gap where neither is
  // visible, no late "fall in" once the spring kicks in.
  useEffect(() => {
    if (isOpen && fromRect) {
      setSettled(false);
      progress.value = 0;
      // Defer the spring until after this render commits so the first
      // frame paints at progress=0 (card at button rect) before
      // animating outward.
      requestAnimationFrame(() => {
        progress.value = withSpring(1, SPRING_CONFIG, (finished) => {
          if (finished) {
            runOnJS(setSettled)(true);
          }
        });
      });
    } else if (isMounted) {
      // Re-instate the floating avatar before reversing the spring so
      // the user sees the avatar shrink back into the home button.
      setSettled(false);
      progress.value = withSpring(
        0,
        SPRING_CONFIG,
        (finished) => {
          if (finished) {
            runOnJS(finishClose)();
          }
        },
      );
    }
    // isMounted intentionally not in deps — we only react to store
    // open/close changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fromRect]);

  const handleClose = () => {
    closeStore();
  };

  const rect = fromRect ?? { x: 0, y: 0, width: 56, height: 56 };

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

  // SettingsContent body fades in once the card has mostly opened.
  // Pushing the fade window later (was 0.4→0.9) lets the user see the
  // card grow first, then the rows appear — feels less like everything
  // is happening at once.
  const bodyStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.65, 1],
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

  // Belt-and-suspenders: also gate on fromRect being set. With the
  // combined useShallow selector above this should never trip, but
  // returning null here guarantees we never paint the card at the
  // fallback {0,0,56,56} top-left rect even if a race ever did slip
  // through.
  if (!isMounted || !fromRect) return null;

  return (
    <Modal
      transparent
      visible={isMounted}
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
    >
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

        {/* Floating avatar — animates from button rect to Settings slot.
            Hidden once `settled` because the natural copy inside
            SettingsContent is now in charge (and scrolls correctly).
            Mirrors the home button's image-or-initials choice so the
            shared element is visually identical at progress=0. */}
        {settled ? null : (
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
        )}

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
