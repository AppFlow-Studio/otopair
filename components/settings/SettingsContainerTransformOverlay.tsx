/**
 * SettingsContainerTransformOverlay
 *
 * PURPOSE: Android-friendly Settings transition restored from the
 *          pre-route overlay implementation. It avoids the iOS blur-card
 *          treatment and uses a container transform from the measured
 *          profile-avatar rect into the full Settings surface.
 *
 * USED IN: components/settings/SettingsOverlay.tsx (Android branch)
 */

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BackHandler,
  Image,
  type LayoutChangeEvent,
  Platform,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "convex/react";
import { useShallow } from "zustand/react/shallow";
import { X } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";

import { SettingsContent } from "@/components/settings/SettingsContent";
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import {
  useSettingsOverlayStore,
  type SettingsOverlayRect,
} from "@/stores/useSettingsOverlayStore";
import { computeInitials } from "@/utils/userInitials";

const AVATAR_TARGET_SIZE = 72;
const OPEN_DURATION = Platform.OS === "android" ? 390 : 430;
const CLOSE_DURATION = Platform.OS === "android" ? 300 : 330;
const SETTINGS_GRADIENT_TOP = "#1A2C4E";
const SETTINGS_GRADIENT_BOTTOM = "#0B1120";

type RootMetrics = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function SettingsContainerTransformOverlay() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const window = useWindowDimensions();
  const rootRef = useRef<View>(null);
  const rootMetricsRef = useRef<RootMetrics>({
    x: 0,
    y: 0,
    width: window.width,
    height: window.height,
  });
  const [rootMetrics, setRootMetrics] = useState<RootMetrics>(
    rootMetricsRef.current,
  );

  const initialRect = useSettingsOverlayStore.getState().fromRect;
  const activeRectRef = useRef<SettingsOverlayRect>(
    initialRect ?? {
      x: window.width / 2 - 28,
      y: window.height / 2 - 28,
      width: 56,
      height: 56,
    },
  );

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
    if (me?.profile_photo_storage_id && me?.profile_photo_url)
      return me.profile_photo_url;
    if (storedPhoto) return storedPhoto;
    return null;
  }, [me?.profile_photo_storage_id, me?.profile_photo_url, storedPhoto]);

  const [settled, setSettled] = useState(false);
  const [openSequence, setOpenSequence] = useState(0);
  const isClosingRef = useRef(false);
  const progress = useSharedValue(0);
  const expandedAvatarTop = useSharedValue(insets.top + 40);
  const currentSettingsScrollYRef = useRef(0);

  const resetClosing = useCallback(() => {
    isClosingRef.current = false;
  }, []);

  const measureRoot = useCallback(() => {
    rootRef.current?.measureInWindow((x, y, width, height) => {
      if (!Number.isFinite(width) || !Number.isFinite(height)) return;
      if (width <= 0 || height <= 0) return;
      const next = { x, y, width, height };
      rootMetricsRef.current = next;
      setRootMetrics(next);
    });
  }, []);

  const handleRootLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      if (width > 0 && height > 0) {
        const current = rootMetricsRef.current;
        const next = { ...current, width, height };
        rootMetricsRef.current = next;
        setRootMetrics(next);
      }
      requestAnimationFrame(measureRoot);
    },
    [measureRoot],
  );

  useEffect(() => {
    const next = {
      ...rootMetricsRef.current,
      width: window.width,
      height: window.height,
    };
    rootMetricsRef.current = next;
    setRootMetrics(next);
    requestAnimationFrame(measureRoot);
  }, [measureRoot, window.width, window.height]);

  useLayoutEffect(() => {
    measureRoot();
    currentSettingsScrollYRef.current = 0;
    expandedAvatarTop.value = insets.top + 40;
    setSettled(false);
    setOpenSequence((value) => value + 1);
    progress.value = 0;
    const frame = requestAnimationFrame(() => {
      progress.value = withTiming(
        1,
        {
          duration: OPEN_DURATION,
          easing: Easing.out(Easing.cubic),
        },
        (finished) => {
          if (finished) {
            runOnJS(setSettled)(true);
          }
        },
      );
    });
    return () => cancelAnimationFrame(frame);
    // mount-only: route mount is the open lifecycle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setSettled(false);
    expandedAvatarTop.value =
      insets.top + 40 - currentSettingsScrollYRef.current;
    progress.value = withTiming(
      0,
      {
        duration: CLOSE_DURATION,
        easing: Easing.inOut(Easing.cubic),
      },
      (finished) => {
        if (finished) {
          runOnJS(router.back)();
        } else {
          runOnJS(resetClosing)();
        }
      },
    );
  }, [expandedAvatarTop, insets.top, progress, resetClosing, router]);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") return undefined;
      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        () => {
          handleClose();
          return true;
        },
      );
      return () => subscription.remove();
    }, [handleClose]),
  );

  const rect = activeRectRef.current;
  const localRect = {
    x: rect.x - rootMetrics.x,
    y: rect.y - rootMetrics.y,
    width: rect.width,
    height: rect.height,
  };
  const overlayWidth = rootMetrics.width || window.width;
  const overlayHeight = rootMetrics.height || window.height;

  const handleSettingsScrollOffsetChange = useCallback((offsetY: number) => {
    currentSettingsScrollYRef.current = offsetY;
  }, []);

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.65], [0, 1], Extrapolation.CLAMP),
  }));

  const surfaceStyle = useAnimatedStyle(() => {
    const left = interpolate(
      progress.value,
      [0, 1],
      [localRect.x, 0],
      Extrapolation.CLAMP,
    );
    const top = interpolate(
      progress.value,
      [0, 1],
      [localRect.y, 0],
      Extrapolation.CLAMP,
    );
    const width = interpolate(
      progress.value,
      [0, 1],
      [localRect.width, overlayWidth],
      Extrapolation.CLAMP,
    );
    const height = interpolate(
      progress.value,
      [0, 1],
      [localRect.height, overlayHeight],
      Extrapolation.CLAMP,
    );

    return {
      left,
      top,
      width,
      height,
      borderRadius: interpolate(
        progress.value,
        [0, 0.82, 1],
        [localRect.width / 2, 26, 0],
        Extrapolation.CLAMP,
      ),
      opacity: interpolate(
        progress.value,
        [0, 0.08, 0.16],
        [0, 0, 1],
        Extrapolation.CLAMP,
      ),
    };
  });

  const surfaceContentStyle = useAnimatedStyle(() => {
    const width = interpolate(
      progress.value,
      [0, 1],
      [localRect.width, overlayWidth],
      Extrapolation.CLAMP,
    );
    const height = interpolate(
      progress.value,
      [0, 1],
      [localRect.height, overlayHeight],
      Extrapolation.CLAMP,
    );

    return {
      width: overlayWidth,
      height: overlayHeight,
      transformOrigin: "top left",
      transform: [
        { scaleX: width / overlayWidth },
        { scaleY: height / overlayHeight },
      ],
    };
  });

  const contentStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.08, 0.42],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const avatarStyle = useAnimatedStyle(() => {
    const size = interpolate(
      progress.value,
      [0, 1],
      [localRect.width, AVATAR_TARGET_SIZE],
      Extrapolation.CLAMP,
    );
    const left = interpolate(
      progress.value,
      [0, 1],
      [localRect.x, (overlayWidth - AVATAR_TARGET_SIZE) / 2],
      Extrapolation.CLAMP,
    );
    const top = interpolate(
      progress.value,
      [0, 1],
      [localRect.y, expandedAvatarTop.value],
      Extrapolation.CLAMP,
    );
    const openOpacity = interpolate(
      progress.value,
      [0, 0.18, 0.36],
      [0, 0, 1],
      Extrapolation.CLAMP,
    );
    return {
      width: size,
      height: size,
      borderRadius: size / 2,
      opacity: openOpacity,
      transform: [{ translateX: left }, { translateY: top }],
    };
  });

  const initialsTextStyle = useAnimatedStyle(() => ({
    fontSize: interpolate(progress.value, [0, 1], [14, 24], Extrapolation.CLAMP),
    lineHeight: interpolate(progress.value, [0, 1], [21, 36], Extrapolation.CLAMP),
  }));

  const closeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      progress.value,
      [0.72, 1],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  const avatarPlaceholder = useMemo(
    () => (
      <View
        style={{
          width: AVATAR_TARGET_SIZE,
          height: AVATAR_TARGET_SIZE,
        }}
      />
    ),
    [],
  );

  const settingsContent = useMemo(
    () => (
      <SettingsContent
        deferBlurHeader={!settled}
        avatarOverride={settled ? undefined : avatarPlaceholder}
        resetScrollSignal={openSequence}
        onScrollOffsetChange={handleSettingsScrollOffsetChange}
      />
    ),
    [
      avatarPlaceholder,
      handleSettingsScrollOffsetChange,
      openSequence,
      settled,
    ],
  );

  return (
    <View
      ref={rootRef}
      collapsable={false}
      style={styles.root}
      onLayout={handleRootLayout}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.backdrop, backdropStyle]}
      />

      <Animated.View pointerEvents="auto" style={[styles.surface, surfaceStyle]}>
        <Animated.View style={surfaceContentStyle}>
          <LinearGradient
            colors={[SETTINGS_GRADIENT_TOP, SETTINGS_GRADIENT_BOTTOM]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            pointerEvents={settled ? "auto" : "none"}
            style={[StyleSheet.absoluteFill, contentStyle]}
          >
            {settingsContent}
          </Animated.View>
        </Animated.View>
      </Animated.View>

      {!settled ? (
        <Animated.View
          pointerEvents="none"
          style={[styles.floatingAvatar, avatarStyle]}
        >
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} />
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
        pointerEvents={settled ? "auto" : "none"}
        style={[styles.closeWrap, { top: insets.top + 12 }, closeStyle]}
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
  },
  backdrop: {
    backgroundColor: "rgba(3,7,18,0.28)",
  },
  surface: {
    position: "absolute",
    left: 0,
    top: 0,
    overflow: "hidden",
    backgroundColor: "#0B1120",
  },
  floatingAvatar: {
    position: "absolute",
    left: 0,
    top: 0,
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

export default SettingsContainerTransformOverlay;
