/**
 * SettingsContent
 *
 * PURPOSE: The shared render tree for the Settings page. Used by both
 *          the Settings tab (`app/(main-tabs)/settings/index.tsx`) and
 *          the SettingsOverlay (the shared-element animation that lifts
 *          Settings on top of Home). Centralising the JSX here keeps
 *          the two surfaces from drifting.
 *
 *          Behaviour identical to the previous tab implementation —
 *          dark navy gradient, scroll-driven blur header, sticky title,
 *          grouped translucent cards, footer.
 *
 * PROPS:
 *   - avatarOverride? — when provided, replaces the inline avatar
 *     (the overlay passes a custom node so its animated floating
 *     avatar can occupy the slot).
 *
 * OWNER: Ahmad Hamoudeh (extraction), Daniel Chelala (data plumbing)
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  type LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

// Native iOS 26 liquid glass (optional). Mirrors the home/ai-chat pattern —
// falls back to the existing gradient pill when the lib is unavailable.
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require("@callstack/liquid-glass");
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch {
  // Not available — fall back to gradient pill
}
import { useFocusEffect } from "@react-navigation/native";
import {
  // MVP-DISABLED: loyalty/rewards — re-enable post-launch (Award, UserPlus)
  // Award,
  Bell,
  Car,
  CircleDollarSign,
  Clock,
  CreditCard,
  FileText,
  Fingerprint,
  Headset,
  HelpCircle,
  Lock,
  LogOut,
  MapPin,
  MessageSquare,
  QrCode,
  RotateCcw,
  ScanFace,
  Shield,
  ShieldCheck,
  Sliders,
  Star,
  Trash2,
  // UserPlus,
  Users,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useShallow } from "zustand/react/shallow";
import * as LocalAuthentication from "expo-local-authentication";
import * as StoreReview from "expo-store-review";

import { Button, FeedbackModal, Text } from "@/components/shared-ui";
import { AvatarSlider } from "@/components/settings/AvatarSlider";
import { SettingsCard } from "@/components/settings/SettingsCard";
// 3D OtoPair pin logo used as the second avatar-slider panel.
const OTO_LOGO_3D = require("@/assets/images/pin-logo-3d.png");
import { SettingsHeaderCard } from "@/components/settings/SettingsHeaderCard";
import { SettingsRow } from "@/components/settings/SettingsRow";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useBookingStore } from "@/stores/useBookingStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { clearUserSessionState } from "@/lib/session-state";
import { useSettingsOverlayStore } from "@/stores/useSettingsOverlayStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { computeInitials } from "@/utils/userInitials";

const AnimatedText = Animated.createAnimatedComponent(Text);
type SharedTextProps = React.ComponentProps<typeof Text>;

// ============================================================================
// CONSTANTS
// ============================================================================

const TAB_BAR_HEIGHT =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26
    ? 90
    : 100;

const BG_GRADIENT_TOP = "#1A2C4E";
const BG_GRADIENT_BOTTOM = "#0B1120";
const SCREEN_BASE = "#0B1120";

function LoadingEllipsisText(props: Omit<SharedTextProps, "children">) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withRepeat(withTiming(1, { duration: 1200 }), -1, false);
  }, [progress]);

  const dotOneStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.2, 1], [0.25, 1, 1], Extrapolation.CLAMP),
  }));
  const dotTwoStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.33, 0.5, 1], [0.25, 0.25, 1, 1], Extrapolation.CLAMP),
  }));
  const dotThreeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.66, 0.83, 1], [0.25, 0.25, 1, 1], Extrapolation.CLAMP),
  }));

  return (
    <Text {...props}>
      Loading
      <AnimatedText color={props.color} size={props.size} weight={props.weight} style={dotOneStyle}>.</AnimatedText>
      <AnimatedText color={props.color} size={props.size} weight={props.weight} style={dotTwoStyle}>.</AnimatedText>
      <AnimatedText color={props.color} size={props.size} weight={props.weight} style={dotThreeStyle}>.</AnimatedText>
    </Text>
  );
}

// ============================================================================
// TYPES
// ============================================================================

interface SettingsContentProps {
  /** Replaces the inline avatar block. The overlay passes its own
   *  animated avatar so the natural slot stays empty during the
   *  shared-element transition. Pass `undefined` to use the default. */
  avatarOverride?: React.ReactNode;
  /** When true, skips the navy LinearGradient and renders on a fully
   *  transparent screen. Used by SettingsOverlay so a BlurView of the
   *  home page can show through behind the rows. */
  translucent?: boolean;
  /** Skips the sticky blur layer while Android's overlay transition is running. */
  deferBlurHeader?: boolean;
  /** Increment to reset the Settings scroll position back to the top. */
  resetScrollSignal?: number;
  /** Reports the current vertical scroll offset to overlay transition hosts. */
  onScrollOffsetChange?: (offsetY: number) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SettingsContent({
  avatarOverride,
  translucent,
  deferBlurHeader,
  resetScrollSignal,
  onScrollOffsetChange,
}: SettingsContentProps) {
  const insets = useSafeAreaInsets();
  // Settings rows render inside the layout-mounted SettingsOverlay
  // (not a route). Normal router.push stacks destinations on top of the
  // overlay; back gestures reveal the overlay still mounted underneath.
  const router = useRouter();

  const { signOut, userId: clerkUserId } = useAuth();
  const { user: clerkUser } = useUser();

  // Convex: current user and user-scoped data.
  const me = useQuery(api.users.getMe);
  const convexBookings = useQuery(
    api.bookings.getByUserId,
    me?._id != null ? { userId: me._id } : "skip",
  );

  // Local stores (fallbacks + counts shown in row values).
  const bookingIds = useBookingStore((s) => s.bookingIds);
  const bookings = useBookingStore((s) => s.bookings);
  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  // For rows whose destination is a layout sibling of the overlay (the
  // Cars tab) — we morph closed first, then route in the spring's
  // finished callback. Pushed-route destinations don't need this; they
  // stack on top of the overlay normally.
  const requestCloseOverlay = useSettingsOverlayStore((s) => s.requestClose);
  const paymentMethods = usePaymentStore((s) => s.paymentMethods);

  const [biometricLabel, setBiometricLabel] = useState("Biometric Login");

  const {
    data,
    addFeedbackSubmission,
  } = useOnboardingStore(
    useShallow((state) => ({
      data: state.data,
      addFeedbackSubmission: state.addFeedbackSubmission,
    })),
  );

  // Biometric label detection (Face ID / Touch ID / Biometric Login)
  useFocusEffect(
    useCallback(() => {
      const checkBiometrics = async () => {
        try {
          const hardware = await LocalAuthentication.hasHardwareAsync();
          const supportedTypes =
            await LocalAuthentication.supportedAuthenticationTypesAsync();
          if (!hardware || supportedTypes.length === 0) return;
          if (Platform.OS === "ios") {
            if (
              supportedTypes.includes(
                LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
              )
            ) {
              setBiometricLabel("Face ID");
            } else if (
              supportedTypes.includes(
                LocalAuthentication.AuthenticationType.FINGERPRINT,
              )
            ) {
              setBiometricLabel("Touch ID");
            } else {
              setBiometricLabel("Biometric Login");
            }
          } else {
            setBiometricLabel("Biometric Login");
          }
        } catch (error) {
          console.error("Error checking biometrics:", error);
        }
      };
      checkBiometrics();
    }, []),
  );

  // Identity (Convex first, then onboarding store, then Clerk)
  const fullName = useMemo<string | null>(() => {
    const fromConvex =
      me != null && (me.first_name ?? me.last_name)
        ? `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim()
        : "";
    if (fromConvex.length > 0) return fromConvex;
    const fromOnboarding =
      `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
    if (fromOnboarding.length > 0) return fromOnboarding;
    const fromClerk =
      `${clerkUser?.firstName ?? ""} ${clerkUser?.lastName ?? ""}`.trim();
    if (fromClerk.length > 0) return fromClerk;
    return me === undefined ? null : "OtoPair User";
  }, [me, data.firstName, data.lastName, clerkUser?.firstName, clerkUser?.lastName]);

  const initials = useMemo(
    () =>
      computeInitials({
        first: me?.first_name ?? data.firstName,
        last: me?.last_name ?? data.lastName,
      }),
    [me, data.firstName, data.lastName],
  );

  // Only show real user-uploaded photos. `profile_photo_url` is only
  // trusted when `profile_photo_storage_id` is set — otherwise it's the
  // Clerk OAuth default (purple gradient) that got synced on signup,
  // and the branded blue→white gradient initials placeholder is better.
  const profilePhotoUri = useMemo(() => {
    if (me?.profile_photo_storage_id && me?.profile_photo_url)
      return me.profile_photo_url;
    if (data.profilePhotoUri) return data.profilePhotoUri;
    return null;
  }, [me?.profile_photo_storage_id, me?.profile_photo_url, data.profilePhotoUri]);

  // Handle = email prefix.
  const handle = useMemo<string | null>(() => {
    const email = (
      me?.email ??
      data.email ??
      clerkUser?.primaryEmailAddress?.emailAddress ??
      ""
    )
      .trim()
      .toLowerCase();
    const prefix = email.split("@")[0] ?? "";
    if (prefix.length > 0) return prefix;
    return me === undefined ? null : "user";
  }, [me, data.email, clerkUser?.primaryEmailAddress?.emailAddress]);

  // Counts surfaced as row "value" text
  const vehicleCount = vehicleIds?.length ?? 0;
  const paymentMethodCount = paymentMethods?.length ?? 0;
  const completedBookingsCount = useMemo(() => {
    if (Array.isArray(convexBookings)) {
      return convexBookings.filter((booking) => booking.status === "completed").length;
    }
    if (!Array.isArray(bookingIds)) return 0;
    return bookingIds.filter((id) => bookings[id]?.status === "completed").length;
  }, [convexBookings, bookingIds, bookings]);

  // Handlers
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);
  const submitAppFeedback = useMutation(api.app_feedback.submit);

  const handleConfirmLogout = useCallback(async () => {
    setIsLogoutVisible(false);
    try {
      await signOut();
    } catch (e) {
      console.error("Sign out error", e);
    }
    await clearUserSessionState(clerkUserId);
    router.replace("/(onboarding)");
  }, [clerkUserId, signOut, router]);

  const handleRateUs = useCallback(async () => {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      }
    } catch {
      // In-app review unavailable (simulator) or request failed; no-op.
    }
  }, []);

  const openEditProfile = useCallback(() => {
    router.push({
      pathname: "/settings/edit-profile" as any,
      params: { showPhotos: "0" },
    });
  }, [router]);

  // Scroll-driven blur header
  const scrollRef = useRef<React.ComponentRef<typeof Animated.ScrollView>>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    if (onScrollOffsetChange) {
      runOnJS(onScrollOffsetChange)(event.contentOffset.y);
    }
  });

  useLayoutEffect(() => {
    if (resetScrollSignal === undefined) return;
    scrollY.value = 0;
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [resetScrollSignal, scrollY]);
  const blurHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, 24],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Sticky title that fades in once the big name has scrolled past
  const nameY = useSharedValue(180);
  const nameHeight = useSharedValue(40);
  const onNameLayout = useCallback(
    (e: LayoutChangeEvent) => {
      nameY.value = e.nativeEvent.layout.y;
      nameHeight.value = e.nativeEvent.layout.height;
    },
    [nameY, nameHeight],
  );
  const stickyNameStyle = useAnimatedStyle(() => {
    const start = nameY.value + nameHeight.value - 4;
    const end = start + 24;
    return {
      opacity: interpolate(
        scrollY.value,
        [start, end],
        [0, 1],
        Extrapolation.CLAMP,
      ),
      transform: [
        {
          translateY: interpolate(
            scrollY.value,
            [start, end],
            [6, 0],
            Extrapolation.CLAMP,
          ),
        },
      ],
    };
  });

  // The default avatar render — used unless `avatarOverride` is set.
  const defaultAvatar = (
    <Pressable onPress={openEditProfile} hitSlop={8}>
      {profilePhotoUri ? (
        <Image source={{ uri: profilePhotoUri }} style={styles.avatarImage} />
      ) : (
        <LinearGradient
          colors={["#5299FE", "#C5DAFF"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarPlaceholder}
        >
          <AvatarSlider
            size={72}
            panels={[
              <Text key="initials" weight="semiBold" size="2xl" color="#FFFFFF">
                {initials}
              </Text>,
              <Image
                key="logo"
                source={OTO_LOGO_3D}
                style={{ width: 68, height: 68 }}
                resizeMode="contain"
              />,
            ]}
          />
        </LinearGradient>
      )}
    </Pressable>
  );

  return (
    <View style={[styles.screen, translucent && styles.screenTranslucent]}>
      {translucent ? null : (
        <LinearGradient
          colors={[BG_GRADIENT_TOP, BG_GRADIENT_BOTTOM]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
        />
      )}

      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 32,
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT,
          },
        ]}
      >
        {/* Identity block */}
        <View style={styles.identity}>
          {avatarOverride !== undefined ? avatarOverride : defaultAvatar}

          <View onLayout={onNameLayout} style={styles.nameWrapper}>
            {fullName ? (
              <Text
                weight="bold"
                size="3xl"
                color="#FFFFFF"
                numberOfLines={1}
              >
                {fullName}
              </Text>
            ) : (
              <LoadingEllipsisText
                weight="bold"
                size="3xl"
                color="#FFFFFF"
                numberOfLines={1}
              />
            )}
          </View>

          <View style={styles.handleRow}>
            {handle ? (
              <Text weight="regular" size="md" color="rgba(255,255,255,0.6)">
                {`@${handle}`}
              </Text>
            ) : (
              <LoadingEllipsisText weight="regular" size="md" color="rgba(255,255,255,0.6)" />
            )}
            <QrCode
              size={14}
              color="rgba(255,255,255,0.6)"
              style={styles.handleIcon}
            />
          </View>
        </View>

        {/* Two header cards — primary entries into the user's garage */}
        <View style={styles.headerCardsRow}>
          <SettingsHeaderCard
            variant="plan"
            title="My Vehicles"
            subtitle={
              vehicleCount > 0
                ? `${vehicleCount} ${vehicleCount === 1 ? "vehicle" : "vehicles"}`
                : "View & manage"
            }
            icon={<Car size={22} color="#FFFFFF" />}
            // The Cars tab is a sibling of the overlay in (main-tabs)/_layout,
            // so a plain tab switch wouldn't cover the overlay — request a
            // close morph first, then route once the spring lands.
            onPress={() =>
              requestCloseOverlay(() => router.push("/cars"))
            }
          />
          <SettingsHeaderCard
            variant="action"
            title="My Mechanics"
            subtitle="Saved & recent"
            icon={<Users size={22} color="#FFFFFF" />}
            onPress={() => router.push("/settings/my-mechanics")}
          />
        </View>

        {/* MY GARAGE — addresses, history, preferences, payment methods */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<MapPin size={18} color="#FFFFFF" />}
            label="Saved Addresses"
            onPress={() => router.push("/settings/saved-addresses")}
          />
          <SettingsRow
            icon={<Clock size={18} color="#FFFFFF" />}
            label="Past Services"
            value={completedBookingsCount > 0 ? completedBookingsCount : undefined}
            onPress={() => router.push("/settings/transactions")}
          />
          <SettingsRow
            icon={<Bell size={18} color="#FFFFFF" />}
            label="Notification Preferences"
            onPress={() =>
              router.push("/settings/notification-preferences")
            }
          />
          <SettingsRow
            icon={<Sliders size={18} color="#FFFFFF" />}
            label="App Preferences"
            onPress={() => router.push("/settings/preferences")}
          />
          <SettingsRow
            icon={<CreditCard size={18} color="#FFFFFF" />}
            label="Payment Methods"
            value={paymentMethodCount > 0 ? paymentMethodCount : undefined}
            onPress={() => router.push("/payments")}
            isLast
          />
        </SettingsCard>

        {/* MVP-DISABLED: loyalty/rewards — re-enable post-launch.
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<Award size={18} color="#FFFFFF" />}
            label="Loyalty & Rewards"
            onPress={() => router.push("/membership")}
          />
          <SettingsRow
            icon={<UserPlus size={18} color="#FFFFFF" />}
            label="Refer a Friend"
            onPress={() => router.push("/settings/refer-a-friend")}
            isLast
          />
        </SettingsCard>
        */}

        {/* SUPPORT */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<Headset size={18} color="#FFFFFF" />}
            label="Contact Us"
            onPress={() => router.push("/settings/contact-us")}
          />
          <SettingsRow
            icon={<HelpCircle size={18} color="#FFFFFF" />}
            label="FAQ"
            onPress={() => router.push("/settings/faq")}
          />
          <SettingsRow
            icon={<MessageSquare size={18} color="#FFFFFF" />}
            label="Feedback"
            onPress={() => setIsFeedbackVisible(true)}
          />
          <SettingsRow
            icon={<Star size={18} color="#FFFFFF" />}
            label="Rate Us"
            onPress={handleRateUs}
            isLast
          />
        </SettingsCard>

        {/* ACCOUNT */}
        <SettingsCard style={styles.cardSpacing}>
          {clerkUser?.passwordEnabled ? (
            <SettingsRow
              icon={<Lock size={18} color="#FFFFFF" />}
              label="Change Password"
              onPress={() => router.push("/settings/change-password")}
            />
          ) : null}
          <SettingsRow
            icon={<ShieldCheck size={18} color="#FFFFFF" />}
            label="Two-Factor Authentication"
            onPress={() => router.push("/settings/two-factor-method")}
          />
          <SettingsRow
            icon={
              biometricLabel === "Face ID" ? (
                <ScanFace size={18} color="#FFFFFF" />
              ) : (
                <Fingerprint size={18} color="#FFFFFF" />
              )
            }
            label={biometricLabel}
            onPress={() => router.push("/settings/biometric-setup")}
          />
          <SettingsRow
            icon={<Shield size={18} color="#FFFFFF" />}
            label="Permissions"
            onPress={() => router.push("/settings/permissions")}
            isLast
          />
        </SettingsCard>

        {/* LEGAL & PRICING */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<CircleDollarSign size={18} color="#FFFFFF" />}
            label="Pricing Transparency"
            onPress={() => router.push("/settings/pricing-transparency")}
          />
          <SettingsRow
            icon={<RotateCcw size={18} color="#FFFFFF" />}
            label="How Your Data Is Used"
            onPress={() =>
              router.push({
                pathname: "/coming-soon",
                params: { serviceName: "How Your Data Is Used" },
              } as any)
            }
          />
          <SettingsRow
            icon={<Shield size={18} color="#FFFFFF" />}
            label="Privacy Policy"
            onPress={() => router.push("/settings/privacy-policy")}
          />
          <SettingsRow
            icon={<FileText size={18} color="#FFFFFF" />}
            label="Terms and Conditions"
            onPress={() => router.push("/settings/terms-and-conditions")}
            isLast
          />
        </SettingsCard>

        {/* Log out + Delete Account — standard row styling, own card. */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<LogOut size={18} color="#FFFFFF" />}
            label="Log out"
            onPress={() => setIsLogoutVisible(true)}
          />
          <SettingsRow
            icon={<Trash2 size={18} color="#FFFFFF" />}
            label="Delete Account"
            onPress={() => router.push("/settings/delete-account")}
            isLast
          />
        </SettingsCard>
        <Pressable onPress={() => router.push("/settings/about")} style={styles.footerRow}>
          <Text weight="medium" size="sm" color="rgba(255,255,255,0.55)">
            About OtoPair v1.1.0
          </Text>
        </Pressable>
      </Animated.ScrollView>

      {/* Frosted top header */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.blurHeader,
          { height: insets.top + 56 },
          blurHeaderStyle,
        ]}
      >
        {deferBlurHeader ? null : (
          <MaskedView
            style={StyleSheet.absoluteFill}
            maskElement={
              <LinearGradient
                colors={["#000", "#000", "transparent"]}
                locations={[0, 0.7, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            }
          >
            <BlurView
              intensity={35}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.blurHeaderTint} />
          </MaskedView>
        )}
      </Animated.View>

      {/* Sticky top row — Upgrade pill + animated centered title */}
      <View
        style={[
          styles.stickyTopRow,
          { paddingTop: insets.top + 6, height: insets.top + 52 },
        ]}
        pointerEvents="box-none"
      >
        <View style={styles.stickySide} />
        <View style={styles.stickyCenter} pointerEvents="none">
          {fullName ? (
            <AnimatedText
              weight="semiBold"
              size="md"
              color="#FFFFFF"
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[styles.stickyName, stickyNameStyle]}
            >
              {fullName}
            </AnimatedText>
          ) : (
            <Animated.View style={stickyNameStyle}>
              <LoadingEllipsisText
                weight="semiBold"
                size="md"
                color="#FFFFFF"
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.stickyName}
              />
            </Animated.View>
          )}
        </View>
        <View style={styles.stickySide} />
      </View>

      {/* Logout confirmation */}
      <Modal
        transparent
        visible={isLogoutVisible}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
      >
        <TouchableWithoutFeedback onPress={() => setIsLogoutVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.confirmCard}>
                <Text weight="semiBold" size="lg" color="#111827">
                  Logout?
                </Text>
                <Text size="sm" color="#6B7280" style={styles.confirmText}>
                  You&apos;ll need to sign in again to access your account.
                </Text>
                <View style={styles.confirmActionsRow}>
                  <Button
                    variant="ghost"
                    fullWidth
                    style={styles.modalActionButton}
                    onPress={() => setIsLogoutVisible(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    style={[
                      styles.modalActionButton,
                      { backgroundColor: "#EF4444" },
                    ]}
                    onPress={handleConfirmLogout}
                  >
                    Logout
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <FeedbackModal
        visible={isFeedbackVisible}
        onClose={() => setIsFeedbackVisible(false)}
        onSubmit={async (text) => {
          // Persist to Convex `app_feedback` so the director-side queue
          // sees it under status="new". Also stash a local copy in the
          // onboarding store for the existing UI surfaces that read from
          // there (keeps any history-display behavior working offline).
          addFeedbackSubmission(text);
          try {
            await submitAppFeedback({
              text,
              source: Platform.OS === "ios" ? "consumer_ios" : "consumer_android",
            });
          } catch (err) {
            console.warn("[settings] app_feedback.submit failed:", err);
            // Re-throw so the modal stays open and surfaces the failure to
            // the user (its own catch keeps `isSubmitting` cleared).
            throw err;
          }
        }}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: SCREEN_BASE,
  },
  screenTranslucent: {
    backgroundColor: "transparent",
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  blurHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 5,
    overflow: "hidden",
  },
  blurHeaderTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(11,17,32,0.18)",
  },
  stickyTopRow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  stickySide: {
    width: 110,
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  stickyCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  stickyName: {
    textAlign: "center",
  },
  identity: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 24,
  },
  nameWrapper: {
    marginTop: 16,
    alignItems: "center",
  },
  avatarImage: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  handleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },
  handleIcon: {
    marginLeft: 6,
  },
  headerCardsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },
  cardSpacing: {
    marginTop: 12,
  },
  footerRow: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    marginBottom: 12,
  },
  footerDot: {
    marginHorizontal: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  confirmCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  confirmText: {
    marginTop: 8,
    textAlign: "center",
  },
  confirmActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    width: "100%",
  },
  modalActionButton: {
    flex: 1,
  },
});

export default SettingsContent;
