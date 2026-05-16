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

import React, { useCallback, useMemo, useState } from "react";
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
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { BlurView } from "expo-blur";
import MaskedView from "@react-native-masked-view/masked-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import {
  Award,
  BadgeCheck,
  Bell,
  Car,
  CircleDollarSign,
  Clock,
  CreditCard,
  FileText,
  Fingerprint,
  Gem,
  Headset,
  HelpCircle,
  Lock,
  MapPin,
  MessageSquare,
  QrCode,
  Receipt,
  RotateCcw,
  ScanFace,
  Shield,
  ShieldCheck,
  Sliders,
  Star,
  Trash2,
  UserPlus,
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
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthStore } from "@/stores/useAuthStore";
import { useSettingsOverlayStore } from "@/stores/useSettingsOverlayStore";
import { useBookingStore } from "@/stores/useBookingStore";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { useTransactionsFromConvex } from "@/hooks/useTransactionsFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { computeInitials } from "@/utils/userInitials";

const AnimatedText = Animated.createAnimatedComponent(Text);

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
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SettingsContent({ avatarOverride, translucent }: SettingsContentProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useAuth();
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
  const paymentMethods = usePaymentStore((s) => s.paymentMethods);
  const { transactions: convexTransactions } = useTransactionsFromConvex(
    me?._id ?? undefined,
  );

  const resetAuth = useAuthStore((s) => s.reset);

  // When rendered inside the Home → Settings overlay, navigating to a
  // sub-page should dismiss the overlay first so the destination isn't
  // hidden behind the lifted Settings card.
  const navigate = useCallback(
    (href: Parameters<typeof router.push>[0]) => {
      if (useSettingsOverlayStore.getState().isOpen) {
        useSettingsOverlayStore.getState().closeInstant();
      }
      router.push(href);
    },
    [router],
  );

  const [biometricLabel, setBiometricLabel] = useState("Biometric Login");

  const {
    data,
    reset,
    isCreateAccountComplete,
    addFeedbackSubmission,
  } = useOnboardingStore(
    useShallow((state) => ({
      data: state.data,
      reset: state.reset,
      isCreateAccountComplete: state.isCreateAccountComplete(),
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
  const handle = useMemo(() => {
    const email = (me?.email ?? data.email ?? "").trim().toLowerCase();
    const prefix = email.split("@")[0] ?? "";
    return prefix.length > 0 ? prefix : "user";
  }, [me?.email, data.email]);

  // Counts surfaced as row "value" text
  const vehicleCount = vehicleIds?.length ?? 0;
  const paymentMethodCount = paymentMethods?.length ?? 0;
  const transactionCount = convexTransactions.length;
  const completedBookingsCount = useMemo(() => {
    if (Array.isArray(convexBookings)) {
      return convexBookings.filter((booking) => booking.status === "completed").length;
    }
    if (!Array.isArray(bookingIds)) return 0;
    return bookingIds.filter((id) => bookings[id]?.status === "completed").length;
  }, [convexBookings, bookingIds, bookings]);

  const planTitle = useMemo(() => {
    if (isCreateAccountComplete) return "Gold";
    const tier = data.membershipTier ?? "Standard";
    return tier === "No" ? "Standard" : tier;
  }, [data.membershipTier, isCreateAccountComplete]);

  // Handlers
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
      // In-app review unavailable (simulator) or request failed; no-op.
    }
  }, []);

  const openEditProfile = useCallback(() => {
    navigate({
      pathname: "/(main-tabs)/settings/edit-profile" as any,
      params: { showPhotos: "0" },
    });
  }, [router]);

  // Scroll-driven blur header
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
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
            <Text
              weight="bold"
              size="3xl"
              color="#FFFFFF"
              numberOfLines={1}
            >
              {fullName}
            </Text>
          </View>

          <View style={styles.handleRow}>
            <Text weight="regular" size="md" color="rgba(255,255,255,0.6)">
              @{handle}
            </Text>
            <QrCode
              size={14}
              color="rgba(255,255,255,0.6)"
              style={styles.handleIcon}
            />
          </View>
        </View>

        {/* Two header cards */}
        <View style={styles.headerCardsRow}>
          <SettingsHeaderCard
            variant="plan"
            title={planTitle}
            subtitle="Your plan"
            icon={<BadgeCheck size={22} color="#FFFFFF" />}
            onPress={() => navigate("/membership")}
          />
          <SettingsHeaderCard
            variant="action"
            title="Invite friends"
            subtitle="Earn $60 or more"
            icon={<UserPlus size={22} color="#FFFFFF" />}
            onPress={() => navigate("/settings/refer-a-friend")}
          />
        </View>

        {/* MY GARAGE */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<Car size={18} color="#1F2937" />}
            label="My Vehicles"
            value={vehicleCount > 0 ? vehicleCount : undefined}
            onPress={() => navigate("/cars")}
          />
          <SettingsRow
            icon={<Users size={18} color="#1F2937" />}
            label="My Mechanics"
            onPress={() => navigate("/settings/my-mechanics")}
          />
          <SettingsRow
            icon={<MapPin size={18} color="#1F2937" />}
            label="Saved Addresses"
            onPress={() =>
              navigate({
                pathname: "/coming-soon",
                params: { serviceName: "Saved Addresses" },
              } as any)
            }
          />
          <SettingsRow
            icon={<Clock size={18} color="#1F2937" />}
            label="Booking History"
            value={completedBookingsCount > 0 ? completedBookingsCount : undefined}
            onPress={() => navigate("/settings/booking-history")}
            isLast
          />
        </SettingsCard>

        {/* PAYMENTS & REWARDS */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<CreditCard size={18} color="#1F2937" />}
            label="Payment Methods"
            value={paymentMethodCount > 0 ? paymentMethodCount : undefined}
            onPress={() => navigate("/payments")}
          />
          <SettingsRow
            icon={<Receipt size={18} color="#1F2937" />}
            label="Transactions & Receipts"
            value={transactionCount > 0 ? transactionCount : undefined}
            onPress={() => navigate("/settings/transactions")}
          />
          <SettingsRow
            icon={<Award size={18} color="#1F2937" />}
            label="Loyalty & Rewards"
            onPress={() => navigate("/membership")}
          />
          <SettingsRow
            icon={<UserPlus size={18} color="#1F2937" />}
            label="Refer a Friend"
            onPress={() => navigate("/settings/refer-a-friend")}
            isLast
          />
        </SettingsCard>

        {/* PREFERENCES */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<Bell size={18} color="#1F2937" />}
            label="Notification Preferences"
            onPress={() =>
              navigate("/settings/notification-preferences")
            }
          />
          <SettingsRow
            icon={<Sliders size={18} color="#1F2937" />}
            label="App Preferences"
            onPress={() => navigate("/settings/preferences" as any)}
            isLast
          />
        </SettingsCard>

        {/* SUPPORT */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<Headset size={18} color="#1F2937" />}
            label="Contact Us"
            onPress={() => navigate("/settings/contact-us")}
          />
          <SettingsRow
            icon={<HelpCircle size={18} color="#1F2937" />}
            label="FAQ"
            onPress={() => navigate("/settings/faq")}
          />
          <SettingsRow
            icon={<MessageSquare size={18} color="#1F2937" />}
            label="Feedback"
            onPress={() => setIsFeedbackVisible(true)}
          />
          <SettingsRow
            icon={<Star size={18} color="#1F2937" />}
            label="Rate Us"
            onPress={handleRateUs}
            isLast
          />
        </SettingsCard>

        {/* ACCOUNT */}
        <SettingsCard style={styles.cardSpacing}>
          {clerkUser?.passwordEnabled ? (
            <SettingsRow
              icon={<Lock size={18} color="#1F2937" />}
              label="Change Password"
              onPress={() => navigate("/settings/change-password")}
            />
          ) : null}
          <SettingsRow
            icon={<ShieldCheck size={18} color="#1F2937" />}
            label="Two-Factor Authentication"
            onPress={() => navigate("/settings/two-factor-method")}
          />
          <SettingsRow
            icon={
              biometricLabel === "Face ID" ? (
                <ScanFace size={18} color="#1F2937" />
              ) : (
                <Fingerprint size={18} color="#1F2937" />
              )
            }
            label={biometricLabel}
            onPress={() => navigate("/settings/biometric-setup")}
          />
          <SettingsRow
            icon={<Shield size={18} color="#1F2937" />}
            label="Permissions"
            onPress={() => navigate("/settings/permissions")}
            isLast
          />
        </SettingsCard>

        {/* LEGAL & PRICING */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<CircleDollarSign size={18} color="#1F2937" />}
            label="Pricing Transparency"
            onPress={() => navigate("/settings/pricing-transparency")}
          />
          <SettingsRow
            icon={<RotateCcw size={18} color="#1F2937" />}
            label="How Your Data Is Used"
            onPress={() =>
              navigate({
                pathname: "/coming-soon",
                params: { serviceName: "How Your Data Is Used" },
              } as any)
            }
          />
          <SettingsRow
            icon={<Shield size={18} color="#1F2937" />}
            label="Privacy Policy"
            onPress={() => navigate("/settings/privacy-policy")}
          />
          <SettingsRow
            icon={<FileText size={18} color="#1F2937" />}
            label="Terms and Conditions"
            onPress={() => navigate("/settings/terms-and-conditions")}
            isLast
          />
        </SettingsCard>

        {/* DELETE ACCOUNT */}
        <SettingsCard style={styles.cardSpacing}>
          <SettingsRow
            icon={<Trash2 size={18} color="#F87171" />}
            label="Delete Account"
            labelColor="#F87171"
            iconBg="rgba(248,113,113,0.15)"
            onPress={() => navigate("/settings/delete-account" as any)}
            isLast
          />
        </SettingsCard>

        {/* Footer */}
        <View style={styles.footerRow}>
          <Pressable onPress={() => navigate("/settings/about")}>
            <Text weight="medium" size="sm" color="rgba(255,255,255,0.55)">
              About OtoPair v1.0.0
            </Text>
          </Pressable>
          <Text size="sm" color="rgba(255,255,255,0.35)" style={styles.footerDot}>
            •
          </Text>
          <Pressable onPress={() => setIsLogoutVisible(true)}>
            <Text weight="medium" size="sm" color="#F87171">
              Log out
            </Text>
          </Pressable>
        </View>
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
            intensity={50}
            tint="dark"
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.blurHeaderTint} />
        </MaskedView>
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
        </View>
        <View style={styles.stickySide}>
          <Pressable
            onPress={() => navigate("/membership")}
            style={({ pressed }) => [
              styles.upgradePill,
              pressed && { opacity: 0.85 },
            ]}
          >
            <LinearGradient
              colors={["#5299FE", "#3A78D6"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Gem size={14} color="#FFFFFF" />
            <Text weight="semiBold" size="sm" color="#FFFFFF">
              Upgrade
            </Text>
          </Pressable>
        </View>
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
          addFeedbackSubmission(text);
          const latest = useOnboardingStore
            .getState()
            .data.feedbackSubmissions.slice(-1)[0];
          console.log("Feedback submitted:", latest);
          await new Promise((r) => setTimeout(r, 450));
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
    backgroundColor: "rgba(11,17,32,0.35)",
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
  upgradePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    overflow: "hidden",
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
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
