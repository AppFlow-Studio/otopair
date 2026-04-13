/**
 * SettingsHomeScreen
 *
 * PURPOSE: Main settings screen providing user profile overview and access to various app settings.
 *
 * USED IN: app/(main-tabs)/_layout.tsx (as a tab screen)
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <SettingsHomeScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Image,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  LogOut,
  Pencil,
  Car,
  Award,
  UserPlus,
  CreditCard,
  Receipt,
  Bell,
  Headset,
  HelpCircle,
  Star,
  ShieldCheck,
  Fingerprint,
  ScanFace,
  Shield,
  Lock,
  FileText,
  MapPin,
  MessageSquare,
  RotateCcw,
  ChevronRight,
  Sliders,
  CircleDollarSign,
  Users,
  Trash2,
} from "lucide-react-native";
import { CarIcon } from "phosphor-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
} from "react-native-reanimated";
import { useShallow } from "zustand/react/shallow";
import { LinearGradient } from "expo-linear-gradient";
import * as LocalAuthentication from "expo-local-authentication";
import * as StoreReview from "expo-store-review";

import {
  BrandColors,
  Button,
  FeedbackModal,
  Text,
  ScrollDrivenGradientBackground,
} from "@/components/shared-ui";
import { useAuth, useUser } from "@clerk/clerk-expo";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { useTransactionsFromConvex } from "@/hooks/useTransactionsFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const AnimatedText = Animated.createAnimatedComponent(Text);

// ============================================================================
// CONSTANTS
// ============================================================================
const HEADER_MAX_HEIGHT = 440; // Total height of the profile area
const HEADER_MIN_HEIGHT = 80; // Height of the collapsed sticky bar
const SHEET_TOP_RADIUS = 32;
const TAB_BAR_HEIGHT =
  Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26
    ? 90
    : 100;

// ============================================================================
// SETTINGS LIST ITEM COMPONENT
// ============================================================================

interface SettingsListItemProps {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  onPress: () => void;
  isLast?: boolean;
}

const SettingsListItem = ({
  icon,
  label,
  labelColor = "#1F2937",
  onPress,
  isLast,
}: SettingsListItemProps) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [
      styles.listItem,
      pressed && styles.listItemPressed,
    ]}
  >
    <View style={styles.listItemIcon}>{icon}</View>
    <Text
      weight="medium"
      size="md"
      color={labelColor}
      style={styles.listItemLabel}
    >
      {label}
    </Text>
    <ChevronRight size={20} color="#9CA3AF" />
    {!isLast && <View style={styles.listItemSeparator} />}
  </Pressable>
);

export default function SettingsHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useSharedValue(0);
  const { signOut } = useAuth();
  const { user: clerkUser } = useUser();
  const resetAuth = useAuthStore((s) => s.reset);

  // Convex: current user and user-scoped data
  const me = useQuery(api.users.getMe);
  const convexBookings = useQuery(
    api.bookings.getByUserId,
    me?._id != null ? { userId: me._id } : "skip",
  );

  // Local stores (fallbacks and payment/vehicle counts)
  const bookingIds = useBookingStore((s) => s.bookingIds);
  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const paymentMethods = usePaymentStore((s) => s.paymentMethods);
  const { transactions: convexTransactions } = useTransactionsFromConvex(
    me?._id ?? undefined,
  );
  const myVehicles = useQuery(api.vehicles.getMyVehicles);
  const convexVehicleCount = myVehicles?.length ?? 0;

  const [nameWidth, setNameWidth] = useState(0);
  const [biometricLabel, setBiometricLabel] = useState("Biometric Login");

  const handleNameLayout = useCallback((e: LayoutChangeEvent) => {
    setNameWidth(e.nativeEvent.layout.width);
  }, []);

  const {
    data,
    updateData,
    reset,
    isCreateAccountComplete,
    addFeedbackSubmission,
  } = useOnboardingStore(
    useShallow((state) => ({
      data: state.data,
      updateData: state.updateData,
      reset: state.reset,
      isCreateAccountComplete: state.isCreateAccountComplete(),
      addFeedbackSubmission: state.addFeedbackSubmission,
    })),
  );

  // ─────────────────────────────────────────────────────────────
  // Log Notification Preferences on Screen Open
  // ─────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const checkBiometrics = async () => {
        try {
          const hardware = await LocalAuthentication.hasHardwareAsync();
          const supportedTypes =
            await LocalAuthentication.supportedAuthenticationTypesAsync();

          if (hardware && supportedTypes.length > 0) {
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
              // Android often has multiple, keeping generic
              setBiometricLabel("Biometric Login");
            }
          }
        } catch (error) {
          console.error("Error checking biometrics:", error);
        }
      };

      checkBiometrics();

      console.log("Notification Preferences Status:", {
        twoFactorEmailEnabled: data.twoFactorEmailEnabled,
        twoFactorSmsEnabled: data.twoFactorSmsEnabled,
        notificationOffersEnabled: data.notificationOffersEnabled,
        notificationRewardsEnabled: data.notificationRewardsEnabled,
        notificationPassEnabled: data.notificationPassEnabled,
        notificationOtherEnabled: data.notificationOtherEnabled,
        notificationBookingsEnabled: data.notificationBookingsEnabled,
      });
    }, [
      data.twoFactorEmailEnabled,
      data.twoFactorSmsEnabled,
      data.notificationOffersEnabled,
      data.notificationRewardsEnabled,
      data.notificationPassEnabled,
      data.notificationOtherEnabled,
      data.notificationBookingsEnabled,
    ]),
  );

  // ─────────────────────────────────────────────────────────────
  // Computed Data (Convex user first, then onboarding/store fallbacks)
  // ─────────────────────────────────────────────────────────────
  const fullName = useMemo(() => {
    const fromConvex =
      me != null && (me.first_name ?? me.last_name)
        ? `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim()
        : "";
    if (fromConvex.length > 0) return fromConvex;
    const fromOnboarding =
      `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
    return fromOnboarding.length > 0 ? fromOnboarding : "John Doe";
  }, [me, data.firstName, data.lastName]);

  const initials = useMemo(() => {
    const first = (
      me != null ? (me.first_name ?? "") : (data.firstName ?? "")
    ).trim();
    const last = (
      me != null ? (me.last_name ?? "") : (data.lastName ?? "")
    ).trim();
    const a = first.length > 0 ? first[0] : "";
    const b = last.length > 0 ? last[0] : "";
    const value = `${a}${b}`.toUpperCase();
    return value.length > 0 ? value : "AJ";
  }, [me, data.firstName, data.lastName]);

  const profilePhotoUri = useMemo(() => {
    if (me?.profile_photo_url) return me.profile_photo_url;
    if (data.profilePhotoUri) return data.profilePhotoUri;
    // Fallback: Clerk profile image (e.g. Google/Apple avatar) so Settings matches sign-in identity
    return clerkUser?.imageUrl ?? null;
  }, [me?.profile_photo_url, data.profilePhotoUri, clerkUser?.imageUrl]);

  const totalBookingsText = useMemo(() => {
    if (typeof convexBookings === "object" && Array.isArray(convexBookings)) {
      return String(convexBookings.length);
    }
    const fromStore = Array.isArray(bookingIds) ? bookingIds.length : 0;
    if (fromStore > 0) return String(fromStore);
    if (isCreateAccountComplete) return "12";
    const n = Number.isFinite(data.totalBookings) ? data.totalBookings : 0;
    return String(n);
  }, [convexBookings, bookingIds, data.totalBookings, isCreateAccountComplete]);

  const pointsText = useMemo(() => {
    if (isCreateAccountComplete) return "1,240";
    const n = Number.isFinite(data.points) ? data.points : 0;
    try {
      return n.toLocaleString();
    } catch {
      return String(n);
    }
  }, [data.points, isCreateAccountComplete]);

  const membershipTier = useMemo(() => {
    if (isCreateAccountComplete) return "Gold";
    const tier = data.membershipTier ?? "No";
    return tier === "No" ? "No Member" : tier;
  }, [data.membershipTier, isCreateAccountComplete]);

  const vehicleCount = vehicleIds?.length ?? 0;
  const paymentMethodCount = paymentMethods?.length ?? 0;
  const transactionCount = convexTransactions.length;

  // ─────────────────────────────────────────────────────────────
  // Animated Styles
  // ─────────────────────────────────────────────────────────────
  const scrollDistance = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  // The sticky bar background fades in as you scroll
  const stickyBarBackgroundStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      // Fade in earlier so the collapsed header never reads as "floating over" the list
      [scrollDistance * 0.35, scrollDistance * 0.65],
      [0, 1],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Avatar scales down and moves to the top-left corner
  const avatarStyle = useAnimatedStyle(() => {
    // Base centered (left: '50%', marginLeft: -50).
    // Original center Y: insets.top + 20 (top) + 50 (half of 100) = insets.top + 70
    // Collapsed: 60px avatar centered in 80px sticky bar => center at insets.top + 40
    // translateY needed: (insets.top + 40) - (insets.top + 70) = -30
    //
    // Collapsed target X: left edge at 16px => center at 16 + 30 = 46.
    const targetAvatarCenterX = -52;
    const collapsedAvatarTranslateX = targetAvatarCenterX - SCREEN_WIDTH / 2;

    const scale = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [1, 0.6],
      Extrapolation.CLAMP,
    );
    const translateY = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [0, -50],
      Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [0, collapsedAvatarTranslateX],
      Extrapolation.CLAMP,
    );

    return {
      transform: [{ scale }, { translateY }, { translateX }],
    };
  });

  // Expanded profile details (name, email, stats, buttons) fade out
  const expandedDetailsStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, scrollDistance * 0.4],
      [1, 0],
      Extrapolation.CLAMP,
    );
    return { opacity };
  });

  // Single name instance that moves with the avatar (no fade/replace)
  const nameTransformStyle = useAnimatedStyle(() => {
    // Name starts centered.
    // Collapsed target: Sit 12px to the right of the 60px avatar (which is at 16px).
    // Target left edge = 16 + 60 + 12 = 88.
    const targetNameLeft = 88;
    const targetNameCenterX = targetNameLeft + nameWidth / 2;
    const collapsedNameTranslateX = targetNameCenterX - SCREEN_WIDTH / 2;

    const translateY = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [120, 6], // 8 yields top 28, centering ~24px text in 80px bar
      Extrapolation.CLAMP,
    );
    const translateX = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [0, collapsedNameTranslateX],
      Extrapolation.CLAMP,
    );
    const scale = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [1, 0.9],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ translateY }, { translateX }, { scale }],
    };
  });

  // Animated color for the name (transitions from black to white as header collapses)
  const nameColorStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      scrollY.value,
      [scrollDistance * 0.35, scrollDistance * 0.65], // Sync with header fade
      ["#111827", BrandColors.white],
      "RGB",
    );
    return { color };
  });

  const openEditProfile = useCallback(
    (showPhotos = false) => {
      router.push({
        pathname: "/(main-tabs)/settings/edit-profile" as any,
        params: { showPhotos: showPhotos ? "1" : "0" },
      });
    },
    [router],
  );

  // ─────────────────────────────────────────────────────────────
  // Logout confirmation
  // ─────────────────────────────────────────────────────────────
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  const handleConfirmLogout = useCallback(async () => {
    setIsLogoutVisible(false);
    try {
      await signOut();
    } catch (e) {
      console.error("Sign out error", e);
    }
    resetAuth();
    reset();
    router.replace("/(onboarding)");
  }, [signOut, resetAuth, reset, router]);

  const handleRateUs = useCallback(async () => {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      }
    } catch {
      // In-app review not available (e.g. simulator) or request failed; no-op.
    }
  }, []);

  return (
    <View style={styles.screen}>
      <ScrollDrivenGradientBackground
        scrollY={scrollY}
        scrollPerTransition={500}
        colors={[
          BrandColors.secondary,
          BrandColors.secondary,
          "#f4f1f8",
          "#f4f1f8",
        ]}
      >
        {(bgScrollHandler) => (
          <>
            {/* ═══════════════════════════════════════════════════════════════
                LAYER 10: Sticky Header Elements (Always on top)
                ═══════════════════════════════════════════════════════════════ */}
            <View
              style={[
                styles.stickyContainer,
                { height: HEADER_MIN_HEIGHT + insets.top },
              ]}
              pointerEvents="box-none"
            >
              {/* Sticky Background Bar (fades in) */}
              <Animated.View
                style={[
                  StyleSheet.absoluteFill,
                  styles.stickyBarBackground,
                  stickyBarBackgroundStyle,
                ]}
                pointerEvents="none"
              />

              {/* Transforming Avatar (no tap — use pencil to open Edit Profile) */}
              <Animated.View
                style={[
                  styles.avatarWrapper,
                  { top: insets.top + 20 },
                  avatarStyle,
                ]}
              >
                {profilePhotoUri ? (
                  <Image
                    source={{ uri: profilePhotoUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text
                      weight="semiBold"
                      size="xl"
                      color={BrandColors.secondary}
                    >
                      {initials}
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* Single Name that moves beside the avatar */}
              <Animated.View
                style={[
                  styles.movingNameContainer,
                  { top: insets.top + 20 },
                  nameTransformStyle,
                ]}
                pointerEvents="box-none"
              >
                <AnimatedText
                  weight="bold"
                  size="lg"
                  onLayout={handleNameLayout}
                  numberOfLines={1}
                  style={[{ maxWidth: SCREEN_WIDTH * 0.6 }, nameColorStyle]}
                >
                  {fullName}
                </AnimatedText>
              </Animated.View>

              {/* Edit Profile Button */}
              <View
                collapsable={false}
                style={[styles.menuAnchor, { top: insets.top + 30 }]}
              >
                <Pressable onPress={() => openEditProfile(false)} hitSlop={10}>
                  <Pencil size={24} color={BrandColors.white} />
                </Pressable>
              </View>
            </View>

            {/* ═══════════════════════════════════════════════════════════════
                LAYER 5: Scrollable Content
                ═══════════════════════════════════════════════════════════════ */}
            <Animated.ScrollView
              onScroll={bgScrollHandler}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              style={styles.scrollView}
            >
              {/* Expanded Profile Info (Will scroll up and fade out) */}
              <Animated.View
                style={[
                  styles.profileInfoArea,
                  { paddingTop: insets.top + 180 },
                  expandedDetailsStyle,
                ]}
              >
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text weight="bold" size="lg" color="#111827">
                      {totalBookingsText}
                    </Text>
                    <Text size="xs" color="#6B7280">
                      Bookings
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.centerStatItem}>
                    <Text weight="bold" size="lg" color="#111827">
                      {membershipTier}
                    </Text>
                    <Text size="xs" color="#6B7280">
                      Member
                    </Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text weight="bold" size="lg" color="#111827">
                      {pointsText}
                    </Text>
                    <Text size="xs" color="#6B7280">
                      Points
                    </Text>
                  </View>
                </View>

                <View style={styles.headerActions}>
                  <Pressable
                    onPress={() => router.push("/membership")}
                    style={styles.headerButtonPill}
                  >
                    <Award size={20} color="#374151" />
                    <Text weight="medium" size="md" color="#374151">
                      View Loyalty
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push(
                        convexVehicleCount > 0 ? "/cars" : "/add-vehicle",
                      )
                    }
                    style={styles.headerButtonPill}
                  >
                    <CarIcon size={20} color="#374151" weight="bold" />
                    <Text weight="medium" size="md" color="#374151">
                      {convexVehicleCount === 0
                        ? "Add Vehicle"
                        : convexVehicleCount === 1
                          ? "View Vehicle"
                          : "View Vehicles"}
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>

              {/* White Settings Sheet */}
              <View style={styles.sheetContainer}>
                {/* Section 1 */}
                <View style={styles.section}>
                  <Text
                    weight="bold"
                    size="sm"
                    color="#6B7280"
                    style={styles.sectionTitle}
                  >
                    MY GARAGE
                  </Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<Car size={20} color="#1F2937" />}
                      label={
                        vehicleCount > 0
                          ? `My Vehicles (${vehicleCount})`
                          : "My Vehicles"
                      }
                      onPress={() => router.push("/cars")}
                    />
                    <SettingsListItem
                      icon={<Users size={20} color="#1F2937" />}
                      label="My Mechanics"
                      onPress={() => router.push("/settings/my-mechanics")}
                    />
                    <SettingsListItem
                      icon={<MapPin size={20} color="#1F2937" />}
                      label="Saved Addresses"
                      onPress={() =>
                        router.push({
                          pathname: "/coming-soon",
                          params: { serviceName: "Saved Addresses" },
                        } as any)
                      }
                      isLast
                    />
                  </View>
                </View>
                {/* Section 2 */}
                <View style={styles.section}>
                  <Text
                    weight="bold"
                    size="sm"
                    color="#6B7280"
                    style={styles.sectionTitle}
                  >
                    PAYMENTS & REWARDS
                  </Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<CreditCard size={20} color="#1F2937" />}
                      label={
                        paymentMethodCount > 0
                          ? `Payment Methods (${paymentMethodCount})`
                          : "Payment Methods"
                      }
                      onPress={() => router.push("/payments")}
                    />
                    <SettingsListItem
                      icon={<Receipt size={20} color="#1F2937" />}
                      label={
                        transactionCount > 0
                          ? `Transactions & Receipts (${transactionCount})`
                          : "Transactions & Receipts"
                      }
                      onPress={() => router.push("/settings/transactions")}
                    />
                    <SettingsListItem
                      icon={<Award size={20} color="#1F2937" />}
                      label="Loyalty & Rewards"
                      onPress={() => router.push("/membership")}
                    />
                    <SettingsListItem
                      icon={<UserPlus size={20} color="#1F2937" />}
                      label="Refer a Friend"
                      onPress={() => router.push("/settings/refer-a-friend")}
                      isLast
                    />
                  </View>
                </View>

                {/* Section 3 */}
                <View style={styles.section}>
                  <Text
                    weight="bold"
                    size="sm"
                    color="#6B7280"
                    style={styles.sectionTitle}
                  >
                    PREFERENCES
                  </Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<Bell size={20} color="#1F2937" />}
                      label="Notification Preferences"
                      onPress={() =>
                        router.push("/settings/notification-preferences")
                      }
                    />
                    <SettingsListItem
                      icon={<Sliders size={20} color="#1F2937" />}
                      label="App Preferences"
                      onPress={() => router.push("/settings/preferences")}
                      isLast
                    />
                  </View>
                </View>

                {/* Section 4 */}
                <View style={styles.section}>
                  <Text
                    weight="bold"
                    size="sm"
                    color="#6B7280"
                    style={styles.sectionTitle}
                  >
                    SUPPORT
                  </Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<Headset size={20} color="#1F2937" />}
                      label="Contact Us"
                      onPress={() => router.push("/settings/contact-us")}
                    />
                    <SettingsListItem
                      icon={<HelpCircle size={20} color="#1F2937" />}
                      label="FAQ"
                      onPress={() => router.push("/settings/faq")}
                    />
                    <SettingsListItem
                      icon={<MessageSquare size={20} color="#1F2937" />}
                      label="Feedback"
                      onPress={() => setIsFeedbackVisible(true)}
                    />
                    <SettingsListItem
                      icon={<Star size={20} color="#1F2937" />}
                      label="Rate Us"
                      onPress={handleRateUs}
                      isLast
                    />
                  </View>
                </View>

                {/* Section 5 */}
                <View style={styles.section}>
                  <Text
                    weight="bold"
                    size="sm"
                    color="#6B7280"
                    style={styles.sectionTitle}
                  >
                    ACCOUNT
                  </Text>
                  <View style={styles.sectionCard}>
                    {clerkUser?.passwordEnabled && (
                      <SettingsListItem
                        icon={<Lock size={20} color="#1F2937" />}
                        label="Change Password"
                        onPress={() => router.push("/settings/change-password")}
                      />
                    )}
                    <SettingsListItem
                      icon={<ShieldCheck size={20} color="#1F2937" />}
                      label="Two-Factor Authentication"
                      onPress={() => router.push("/settings/two-factor-method")}
                    />
                    <SettingsListItem
                      icon={
                        biometricLabel === "Face ID" ? (
                          <ScanFace size={20} color="#1F2937" />
                        ) : (
                          <Fingerprint size={20} color="#1F2937" />
                        )
                      }
                      label={biometricLabel}
                      onPress={() => router.push("/settings/biometric-setup")}
                    />
                    <SettingsListItem
                      icon={<Shield size={20} color="#1F2937" />}
                      label="Permissions"
                      onPress={() => router.push("/settings/permissions")}
                      isLast
                    />

                    <View style={styles.accountSectionDivider} />

                    <SettingsListItem
                      icon={<CircleDollarSign size={20} color="#1F2937" />}
                      label="Pricing Transparency"
                      onPress={() =>
                        router.push("/settings/pricing-transparency")
                      }
                    />
                    <SettingsListItem
                      icon={<RotateCcw size={20} color="#1F2937" />}
                      label="How Your Data Is Used"
                      onPress={() =>
                        router.push({
                          pathname: "/coming-soon",
                          params: { serviceName: "How Your Data Is Used" },
                        } as any)
                      }
                    />
                    <SettingsListItem
                      icon={<Shield size={20} color="#1F2937" />}
                      label="Privacy Policy"
                      onPress={() => router.push("/settings/privacy-policy")}
                    />
                    <SettingsListItem
                      icon={<FileText size={20} color="#1F2937" />}
                      label="Terms and Conditions"
                      onPress={() =>
                        router.push("/settings/terms-and-conditions")
                      }
                      isLast
                    />

                    <View style={styles.accountSectionDivider} />

                    <SettingsListItem
                      icon={<Trash2 size={20} color="#EF4444" />}
                      label="Delete Account"
                      labelColor="#EF4444"
                      onPress={() => router.push("/settings/delete-account")}
                      isLast
                    />
                  </View>
                </View>

                <View style={styles.footerLinksRow}>
                  <Pressable onPress={() => router.push("/settings/about")}>
                    <Text weight="medium" size="sm" color="#6B7280">
                      About Otopair v1.0.0
                    </Text>
                  </Pressable>
                  <Text size="sm" color="#9CA3AF" style={styles.footerDot}>
                    •
                  </Text>
                  <Pressable onPress={() => setIsLogoutVisible(true)}>
                    <Text weight="medium" size="sm" color="#6B7280">
                      Logout
                    </Text>
                  </Pressable>
                </View>

                <View style={{ height: insets.bottom + TAB_BAR_HEIGHT }} />
              </View>
            </Animated.ScrollView>
          </>
        )}
      </ScrollDrivenGradientBackground>

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
                  You'll need to sign in again to access your account.
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

      {/* Feedback modal (tap outside does NOT dismiss) */}
      <FeedbackModal
        visible={isFeedbackVisible}
        onClose={() => setIsFeedbackVisible(false)}
        onSubmit={async (text) => {
          addFeedbackSubmission(text);
          const latest = useOnboardingStore
            .getState()
            .data.feedbackSubmissions.slice(-1)[0];
          console.log("Feedback submitted:", latest);
          // Small delay so the loading state is visible (feels intentional)
          await new Promise((r) => setTimeout(r, 450));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  stickyContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10, // On top of EVERYTHING
  },
  stickyBarBackground: {
    backgroundColor: BrandColors.secondary, // Matches the gray background
  },
  avatarWrapper: {
    position: "absolute",
    left: "50%",
    marginLeft: -50,
    width: 100,
    height: 100,
    borderRadius: 50,
    padding: 3,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(81, 146, 251, 0.25)",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatarTouchArea: {
    flex: 1,
    borderRadius: 47,
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 47,
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 47,
    backgroundColor: "#FFF",
    alignItems: "center",
    justifyContent: "center",
  },
  collapsedNameContainer: {
    // removed
  },
  menuAnchor: {
    position: "absolute",
    right: 20,
  },
  scrollView: {
    flex: 1,
    zIndex: 1, // Under the sticky bar
  },
  scrollContent: {
    flexGrow: 1,
  },
  profileInfoArea: {
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  userName: {
    textAlign: "center",
    marginBottom: 8,
  },
  emailPill: {
    backgroundColor: "rgba(82, 153, 254, 0.12)",
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  movingNameContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
  },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statItem: {
    alignItems: "center",
    minWidth: 80,
  },
  centerStatItem: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 10,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  headerActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
    paddingHorizontal: 20,
  },
  headerButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  headerButtonPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(107, 114, 128, 0.12)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sheetContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    paddingTop: 32,
    paddingHorizontal: 20,
    minHeight: 800,
    // Shadow to pop out against the profile info as it scrolls
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginLeft: 4,
    marginBottom: 12,
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 20,
    overflow: "hidden",
  },
  accountSectionDivider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.08)",
    marginLeft: 16,
    marginRight: 16,
  },
  footerLinksRow: {
    marginTop: -4,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  footerDot: {
    lineHeight: 16,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 18,
    position: "relative",
  },
  listItemPressed: {
    backgroundColor: "#F3F4F6",
  },
  listItemIcon: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  listItemLabel: {
    flex: 1,
  },
  listItemSeparator: {
    position: "absolute",
    bottom: 0,
    left: 56,
    right: 0,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.04)",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  editModalCard: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
  },
  editModalTitle: {
    textAlign: "center",
    marginBottom: 20,
  },
  editAvatarRow: {
    alignItems: "center",
    marginBottom: 20,
  },
  editAvatarWrapper: {
    position: "relative",
  },
  editAvatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  editAvatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: BrandColors.secondary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#FFF",
  },
  field: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    backgroundColor: "#F9FAFB",
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  phoneInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  countryCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: "rgba(0,0,0,0.12)",
  },
  flagContainer: {
    width: 24,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 6,
  },
  countryCodeText: {
    fontSize: 18,
  },
  countryCodeNumber: {
    fontSize: 16,
    color: "#111827",
    fontWeight: "500",
  },
  phoneInput: {
    flex: 1,
    fontSize: 16,
    color: "#111827",
    paddingVertical: 0,
  },
  countryPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  countryPickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  countryPickerHandle: {
    alignSelf: "center",
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    marginBottom: 10,
  },
  countryPickerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  countrySearchContainer: {
    marginBottom: 10,
  },
  countrySearchInput: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  countryList: {
    flexGrow: 0,
  },
  countryListContent: {
    paddingBottom: 12,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  countryItemSelected: {
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
  },
  countryItemFlag: {
    width: 30,
    alignItems: "center",
    marginRight: 10,
  },
  countryItemFlagText: {
    fontSize: 22,
  },
  countryItemCode: {
    width: 56,
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  countryItemName: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
  emptyCountryList: {
    paddingVertical: 18,
    alignItems: "center",
  },
  editActionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  photoModalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    alignItems: "center",
  },
  photoModalTitle: {
    marginBottom: 6,
  },
  photoModalSubtitle: {
    marginBottom: 18,
    textAlign: "center",
  },
  photoModalButtons: {
    width: "100%",
    gap: 12,
  },
  photoModalPrimaryButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  photoModalSecondaryButton: {
    backgroundColor: "#F3F4F6",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  photoModalRemoveButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmCard: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  confirmText: {
    textAlign: "center",
    marginVertical: 16,
  },
  confirmActionsRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
});
