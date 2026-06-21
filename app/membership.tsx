/**
 * MembershipPage
 *
 * PURPOSE: Displays full membership/loyalty page with user stats, credit balance, and actions
 *
 * USED IN: Navigated from LoyaltyCard modal "View full loyalty page" button
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import ReAnimated from "react-native-reanimated";

// 2. Expo & Third-party
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import {
  ArrowLeft,
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  CreditCard,
  FileText,
  Gift,
  Headphones,
  History,
  Info,
  PenSquare,
  Plus,
  Star,
  UserPlus,
  Wallet,
  Wrench,
  Zap,
} from "lucide-react-native";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// 3. Shared UI
import { FadeInStagger, ScrollDrivenGradientBackground, Text } from "@/components/shared-ui";
import { useToast } from "@/hooks/useToast";

// 4. Constants & Hooks
import { Spacing } from "@/constants/theme";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";
import {
  GarageCarSelectionSheet,
  type GarageCarSheetRef,
} from "@/components/rewards/GarageCarSelectionSheet";

const FLIP_DURATION = 400;

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const AVATAR_SIZE = 56;
const ACTION_BUTTON_SIZE = 64;
const GLASS_ICON_SIZE = 40;
const DEAL_CARD_WIDTH = SCREEN_WIDTH * 0.7;
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.9;

// Sample rewards data
const EARN_REWARDS = [
  {
    id: "1",
    title: "Leave a Verified Review",
    subtitle: "+$5 Credit",
    iconBg: "#F3F4F6",
    iconColor: "#1F2937",
    icon: "review" as const,
    hasButton: false,
  },
  {
    id: "2",
    title: "Upload Service Records",
    subtitle: "+$10 Credit",
    iconBg: "#F3F4F6",
    iconColor: "#1F2937",
    icon: "upload" as const,
    hasButton: true,
    buttonText: "Upload",
  },
  {
    id: "3",
    title: "Refer a Friend",
    subtitle: "+$15 Credit",
    iconBg: "#F3F4F6",
    iconColor: "#1F2937",
    icon: "refer" as const,
    hasButton: false,
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export default function MembershipPage() {
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useUserFromConvex();

  const [viewMode, setViewMode] = useState<"pooled" | "individual">("pooled");
  const [selectedVehicleVinForIndividual, setSelectedVehicleVinForIndividual] = useState<string | null>(null);

  const wallet = useQuery(api.rewards.getWallet, userId ? { userId } : "skip");
  const stats = useQuery(api.rewards.getMembershipStats, userId ? { userId } : "skip");
  const perVehicleStats = useQuery(
    api.rewards.getMembershipStatsByVehicle,
    userId && selectedVehicleVinForIndividual ? { userId, vin: selectedVehicleVinForIndividual } : "skip"
  );
  const tierInfo = useQuery(api.rewards.getPrimaryVehicleTier, userId ? { userId } : "skip");
  const vehicleTiers = useQuery(api.rewards.getVehicleTiersByUser, userId ? { userId } : "skip");
  const suggestedDeals = useQuery(api.rewards.getSuggestedDeals, {});

  const vehicles = useVehicleStore((s) => s.vehicles);
  const vehicleIds = useVehicleStore((s) => s.vehicleIds);
  const vehicleCount = vehicleIds.length;

  const ensureWallet = useMutation(api.rewards.ensureWallet);
  const updateRedemptionPreference = useMutation(api.rewards.updateRedemptionPreference);
  const redeemSelected = useMutation(api.rewards.redeemSelected);
  const markCreditsSeen = useMutation(api.rewards.markCreditsSeen);

  useEffect(() => {
    if (userId && wallet === null) ensureWallet({ userId }).catch(() => {});
  }, [userId, wallet, ensureWallet]);

  // Clear the trophy-icon red dot whenever this page is opened. Fire
  // once on mount per session — the user has now seen their credits.
  useEffect(() => {
    if (userId) void markCreditsSeen({ userId });
  }, [userId, markCreditsSeen]);

  const isIndividual = viewMode === "individual" && selectedVehicleVinForIndividual != null;
  const walletBalance = wallet?.balance ?? 0;
  const balance = isIndividual ? (perVehicleStats?.creditEarned ?? 0) : walletBalance;
  const milesSafe = isIndividual ? (perVehicleStats?.milesSafe ?? 0) : (stats?.milesSafe ?? 0);
  const servicesCount = isIndividual ? (perVehicleStats?.services ?? 0) : (stats?.services ?? 0);
  const shopsCount = isIndividual ? (perVehicleStats?.shops ?? 0) : (stats?.shops ?? 0);

  // Tier label for badge (short form: PREFERRED, ELITE, DRIVER)
  const getTierLabel = (tier: "driver" | "preferred" | "elite") =>
    tier === "elite" ? "ELITE" : tier === "preferred" ? "PREFERRED" : "DRIVER";
  const deals = (suggestedDeals ?? []).map((d) => ({
    id: d._id,
    title: d.title,
    description: d.description,
    credit: d.credit_amount,
    price: d.price,
    isSpecial: d.is_special,
  }));

  // Redeem bottom sheet state
  const [showRedeemSheet, setShowRedeemSheet] = useState(false);
  const [selectedRedeemOption, setSelectedRedeemOption] = useState<"booking" | "giftcard">("booking");
  const [isRedeeming, setIsRedeeming] = useState(false);

  // Elite bottom sheet state
  const [showEliteSheet, setShowEliteSheet] = useState(false);
  /** When set, Driver Status modal shows this tier (from garage status badge tap) */
  const [statusModalTier, setStatusModalTier] = useState<"driver" | "preferred" | "elite" | null>(null);

  // Badge card-flip animation (rotateY: 0 = pooled/MY GARAGE, 180 = individual/tier)
  const badgeFlipAnim = useRef(new Animated.Value(0)).current;
  // Cross-fade for balance and stats when switching views
  const contentOpacity = useRef(new Animated.Value(1)).current;

  const tierByVin = React.useMemo(() => {
    const map: Record<string, "driver" | "preferred" | "elite"> = {};
    (vehicleTiers ?? []).forEach((t) => {
      map[t.vin] = t.tier;
    });
    return map;
  }, [vehicleTiers]);

  const selectedVehicleTier =
    selectedVehicleVinForIndividual != null
      ? (tierByVin[selectedVehicleVinForIndividual] ?? "driver")
      : (tierInfo?.tier ?? "driver");

  // My Garage car selection sheet (rewards context)
  const garageSheetRef = useRef<GarageCarSheetRef | null>(null);

  // Bottom sheet animation values
  const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Elite sheet animation values
  const eliteSheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const eliteBackdropOpacity = useRef(new Animated.Value(0)).current;

  const handleBack = () => {
    router.back();
  };

  // Share functions
  const handleUploadShare = async () => {
    try {
      await Share.share({
        message: "Check out my service records on Otopair!",
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  // Mirrors the "Add Service History" handler on the Cars page —
  // opens the OS document picker for PDFs/images/docs. The actual
  // $10 contribution credit fires from `maintenance.upsertRecord`
  // when the user files a record on the Cars page; this CTA exists
  // so the membership screen can shortcut into the same picker.
  const handleUploadRecords = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/*",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets.length > 0) {
        Alert.alert(
          "Got it",
          `${result.assets.length} document${result.assets.length === 1 ? "" : "s"} ready. Open the Cars page and tap Add Service History to attach them to a vehicle and earn your $10 credit.`,
          [
            { text: "Later", style: "cancel" },
            { text: "Go to Cars", onPress: () => router.push("/(main-tabs)/cars") },
          ],
        );
      }
    } catch (err) {
      console.error("Document picker error:", err);
    }
  };

  const handleReferFriend = async () => {
    try {
      await Share.share({
        message: "Join me on Otopair and get $25 credit! Download the app here: https://otopair.com",
      });
    } catch (error) {
      console.log("Error sharing:", error);
    }
  };

  // Redeem sheet functions
  const openRedeemSheet = () => {
    setSelectedRedeemOption(wallet?.auto_apply_to_booking !== false ? "booking" : "giftcard");
    setShowRedeemSheet(true);
    sheetTranslateY.setValue(SHEET_HEIGHT);
    backdropOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 40,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeRedeemSheet = () => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: SHEET_HEIGHT,
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowRedeemSheet(false);
    });
  };

  // Elite / Driver Status sheet – opens from garage status badge with specific tier
  const openEliteSheetWithTier = (tier: "driver" | "preferred" | "elite") => {
    setStatusModalTier(tier);
    setShowEliteSheet(true);
    eliteSheetTranslateY.setValue(SHEET_HEIGHT);
    eliteBackdropOpacity.setValue(0);

    Animated.parallel([
      Animated.spring(eliteSheetTranslateY, {
        toValue: 0,
        tension: 40,
        friction: 12,
        useNativeDriver: false,
      }),
      Animated.timing(eliteBackdropOpacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeEliteSheet = () => {
    Animated.parallel([
      Animated.timing(eliteSheetTranslateY, {
        toValue: SHEET_HEIGHT,
        duration: 300,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
      Animated.timing(eliteBackdropOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowEliteSheet(false);
      setStatusModalTier(null);
    });
  };

  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: FLIP_DURATION,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [viewMode, selectedVehicleVinForIndividual]);

  // Badge tap: pooled → open sheet; individual → snap back to pooled (no sheet)
  const handleBadgePress = () => {
    if (viewMode === "pooled") {
      garageSheetRef.current?.present();
    } else {
      // Individual → Pooled: flip 180→0 (tier rotates out, MY GARAGE rotates in)
      setViewMode("pooled");
      setSelectedVehicleVinForIndividual(null);
      Animated.timing(badgeFlipAnim, {
        toValue: 0,
        duration: FLIP_DURATION,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();
    }
  };

  // When user selects a car from bottom sheet → switch to individual view with flip (sheet dismisses itself)
  const handleCarSelectedFromSheet = (vin: string) => {
    setSelectedVehicleVinForIndividual(vin);
    setViewMode("individual");
    // Pooled → Individual: flip 0→180 (MY GARAGE rotates out, tier rotates in)
    Animated.timing(badgeFlipAnim, {
      toValue: 180,
      duration: FLIP_DURATION,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  // Status badge tap inside sheet → open Driver Status modal (keep existing behavior)
  const handleGarageStatusBadgePress = (tier: "driver" | "preferred" | "elite") => {
    openEliteSheetWithTier(tier);
  };

  return (
    <ScrollDrivenGradientBackground colors={["#5BA3D9", "#8FC4E8", "#d9e8f5"]}>
      {(scrollHandler) => (
        <View style={styles.container}>
          <ReAnimated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top - 10, paddingBottom: insets.bottom + 40 },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* Staggered fade-in for page sections */}
            <FadeInStagger staggerDelay={100} duration={800}>
              {/* Back Button */}
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                hitSlop={12}
              >
                <ArrowLeft size={24} color="#1F2937" strokeWidth={2} />
              </Pressable>

              {/* Flip Badge: MY GARAGE ▾ (pooled) ↔ PREFERRED ▾ (individual) */}
              <View style={styles.badgeContainer}>
                <Pressable
                  onPress={handleBadgePress}
                  style={({ pressed }) => [styles.badgePressable, pressed && { opacity: 0.7 }]}
                >
                  <View style={styles.badgeFlipContainer}>
                    {/* Sizing spacer: hug container to current visible label */}
                    <View style={styles.badgeSizer} collapsable={false}>
                      <BadgeCheck size={14} color="transparent" strokeWidth={2} />
                      <Text weight="bold" size="xs" color="transparent" style={styles.badgeText}>
                        {viewMode === "pooled" ? "MY GARAGE" : getTierLabel(selectedVehicleTier)}
                      </Text>
                      <ChevronDown size={12} color="transparent" style={styles.badgeChevron} />
                    </View>
                    {/* Front face (rotateY 0): MY GARAGE ▾ */}
                    <Animated.View
                      style={[
                        styles.badgeFace,
                        {
                          backfaceVisibility: "hidden",
                          transform: [
                            { perspective: 400 },
                            {
                              rotateY: badgeFlipAnim.interpolate({
                                inputRange: [0, 180],
                                outputRange: ["0deg", "180deg"],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <BadgeCheck size={14} color="#FFFFFF" fill="#5299FE" strokeWidth={2} />
                      <Text weight="bold" size="xs" color="#5299FE" style={styles.badgeText}>
                        MY GARAGE
                      </Text>
                      <ChevronDown size={12} color="#5299FE" style={styles.badgeChevron} />
                    </Animated.View>
                    {/* Back face (rotateY 180): Tier ▾ */}
                    <Animated.View
                      style={[
                        styles.badgeFace,
                        styles.badgeFaceBack,
                        {
                          backfaceVisibility: "hidden",
                          transform: [
                            { perspective: 400 },
                            {
                              rotateY: badgeFlipAnim.interpolate({
                                inputRange: [0, 180],
                                outputRange: ["180deg", "360deg"],
                              }),
                            },
                          ],
                        },
                      ]}
                    >
                      <BadgeCheck size={14} color="#FFFFFF" fill="#5299FE" strokeWidth={2} />
                      <Text weight="bold" size="xs" color="#5299FE" style={styles.badgeText}>
                        {getTierLabel(selectedVehicleTier)}
                      </Text>
                      <ChevronDown size={12} color="#5299FE" style={styles.badgeChevron} />
                    </Animated.View>
                  </View>
                </Pressable>
              </View>

              {/* Credit Balance — cross-fades when switching pooled ↔ individual */}
              <Animated.View style={[styles.balanceContainer, { opacity: contentOpacity }]}>
                <Text weight="bold" style={styles.balanceAmount}>
                  ${balance.toFixed(2)}
                </Text>
                <Text weight="medium" size="md" color="#6B7280">
                  {isIndividual ? "Credit earned for this vehicle" : "Ownership Credit Balance"}
                </Text>
                {viewMode === "pooled" && vehicleCount > 1 && (
                  <Text weight="medium" size="sm" color="#9CA3AF" style={styles.balanceSubtext}>
                    across {vehicleCount} vehicles
                  </Text>
                )}
              </Animated.View>

              {/* Action Buttons Row */}
              <View style={styles.actionButtonsRow}>
                {/* Add Car - Primary */}
                <View style={styles.actionButtonWrapper}>
                  <Pressable
                    onPress={() => router.replace("/(main-tabs)/cars")}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionButtonPrimary,
                      pressed && styles.actionButtonPressed,
                    ]}
                  >
                    <Plus size={28} color="#FFFFFF" strokeWidth={2.5} />
                  </Pressable>
                  <Text weight="semiBold" size="sm" color="#5299FE" style={styles.actionLabel}>
                    Add Car
                  </Text>
                </View>

                {/* History */}
                <View style={styles.actionButtonWrapper}>
                  <Pressable
                    onPress={() => router.push("/transactions")}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionButtonSecondary,
                      pressed && styles.actionButtonPressed,
                    ]}
                  >
                    <History size={26} color="#1F2937" strokeWidth={1.5} />
                  </Pressable>
                  <Text weight="medium" size="sm" color="#1F2937" style={styles.actionLabel}>
                    History
                  </Text>
                </View>

                {/* Redeem */}
                <View style={styles.actionButtonWrapper}>
                  <Pressable
                    onPress={openRedeemSheet}
                    style={({ pressed }) => [
                      styles.actionButton,
                      styles.actionButtonSecondary,
                      pressed && styles.actionButtonPressed,
                    ]}
                  >
                    <Gift size={26} color="#1F2937" strokeWidth={1.5} />
                  </Pressable>
                  <Text weight="medium" size="sm" color="#1F2937" style={styles.actionLabel}>
                    Redeem
                  </Text>
                </View>
              </View>

              {/* Stats Row — cross-fades when switching pooled ↔ individual */}
              <Animated.View style={[styles.statsRow, { opacity: contentOpacity }]}>
                {/* Miles Safe */}
                <View style={styles.statItem}>
                  <Text weight="bold" style={styles.statNumber}>
                    {milesSafe >= 1000 ? `${Math.round(milesSafe / 1000)}k` : milesSafe}
                  </Text>
                  <Text weight="semiBold" size="xs" color="#6B7280" style={styles.statLabel}>
                    MILES SAFE
                  </Text>
                </View>

                {/* Divider */}
                <View style={styles.statDivider} />

                {/* Services */}
                <View style={styles.statItem}>
                  <Text weight="bold" style={styles.statNumber}>
                    {servicesCount}
                  </Text>
                  <Text weight="semiBold" size="xs" color="#6B7280" style={styles.statLabel}>
                    SERVICES
                  </Text>
                </View>

                {/* Divider */}
                <View style={styles.statDivider} />

                {/* Shops */}
                <View style={styles.statItem}>
                  <Text weight="bold" style={styles.statNumber}>
                    {shopsCount}
                  </Text>
                  <Text weight="semiBold" size="xs" color="#6B7280" style={styles.statLabel}>
                    SHOPS
                  </Text>
                </View>
              </Animated.View>

              {/* ═══════════════════════════════════════════════════════════════════
                MIDDLE SECTION: Suggested Deals
            ═══════════════════════════════════════════════════════════════════ */}

              {/* Suggested Deals Section */}
              <View style={styles.suggestedDealsSection}>
                {/* Section Header */}
                <View style={styles.sectionHeader}>
                  <Text weight="bold" size="lg" color="#1F2937">
                    Suggested Deals
                  </Text>
                  <Pressable
                    style={({ pressed }) => pressed && { opacity: 0.7 }}
                    onPress={() => router.push("/suggested-deals")}
                  >
                    <Text weight="semiBold" size="md" color="#5299FE">
                      View all
                    </Text>
                  </Pressable>
                </View>

                {/* Horizontal Scrolling Cards */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.dealsScrollContent}
                >
                  {deals.map((deal) => (
                    <View key={deal.id} style={styles.dealCard}>
                      {/* Image Placeholder */}
                      <View style={styles.dealImageContainer}>
                        {/* Placeholder - blank for now */}
                        <View style={styles.dealImagePlaceholder} />

                        {/* Special Badge */}
                        {deal.isSpecial && (
                          <View style={styles.specialBadge}>
                            <Star size={12} color="#F59E0B" fill="#F59E0B" />
                            <Text weight="semiBold" size="xs" color="#1F2937">
                              Special
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Card Content */}
                      <View style={styles.dealContent}>
                        {/* Service Title */}
                        <Text weight="bold" size="lg" color="#1F2937" numberOfLines={1}>
                          {deal.title}
                        </Text>

                        {/* Description */}
                        <Text size="sm" color="#6B7280" numberOfLines={1} style={styles.dealDescription}>
                          {deal.description}
                        </Text>

                        {/* Bottom Row: Credit & Book Button */}
                        <View style={styles.dealBottomRow}>
                          {/* Credit Badge */}
                          <View style={styles.creditBadge}>
                            <Text weight="semiBold" size="xs" color="#22C55E">
                              + ${deal.credit} Credit
                            </Text>
                          </View>

                          {/* Book Button */}
                          <Pressable
                            onPress={() => router.push("/(main-tabs)/home")}
                            style={({ pressed }) => [styles.bookButton, pressed && styles.bookButtonPressed]}
                          >
                            <Text weight="semiBold" size="xs" color="#FFFFFF">
                              Book ${deal.price}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              </View>

              {/* ═══════════════════════════════════════════════════════════════════
                BOTTOM SECTION: Earn Rewards
            ═══════════════════════════════════════════════════════════════════ */}

              {/* Earn Rewards Section */}
              <View style={styles.earnRewardsSection}>
                {/* Section Header */}
                <Text weight="bold" size="lg" color="#1F2937" style={styles.earnRewardsTitle}>
                  Earn Rewards
                </Text>

                {/* Rewards List */}
                <View style={styles.rewardsList}>
                  {EARN_REWARDS.map((reward, index) => (
                    <View key={reward.id}>
                      <Pressable
                        onPress={() => {
                          if (reward.icon === "review") router.push("/(main-tabs)/bookings");
                          else if (reward.icon === "refer") router.push("/refer-a-friend");
                          else if (reward.icon === "upload") handleUploadRecords();
                        }}
                        style={({ pressed }) => [
                          styles.rewardRow,
                          index === 0 && styles.rewardRowFirst,
                          index === EARN_REWARDS.length - 1 && styles.rewardRowLast,
                          pressed && styles.rewardRowPressed,
                        ]}
                      >
                        {/* Icon */}
                        <View style={[styles.rewardIcon, { backgroundColor: reward.iconBg }]}>
                          {reward.icon === "review" && <PenSquare size={20} color={reward.iconColor} strokeWidth={2} />}
                          {reward.icon === "upload" && <FileText size={20} color={reward.iconColor} strokeWidth={2} />}
                          {reward.icon === "refer" && <UserPlus size={20} color={reward.iconColor} strokeWidth={2} />}
                        </View>

                        {/* Text Content */}
                        <View style={styles.rewardTextContent}>
                          <Text weight="semiBold" size="md" color="#1F2937">
                            {reward.title}
                          </Text>
                          <Text weight="bold" size="sm" color="#5299FE">
                            {reward.subtitle}
                          </Text>
                        </View>

                        {/* Right Side: Button or Chevron */}
                        {reward.hasButton ? (
                          <Pressable
                            onPress={handleUploadRecords}
                            style={({ pressed }) => [styles.uploadButton, pressed && styles.uploadButtonPressed]}
                          >
                            <Text weight="semiBold" size="sm" color="#FFFFFF">
                              {reward.buttonText}
                            </Text>
                          </Pressable>
                        ) : (
                          <ChevronRight size={20} color="#9CA3AF" strokeWidth={2} />
                        )}
                      </Pressable>
                      {/* Divider - not on last item */}
                      {index < EARN_REWARDS.length - 1 && (
                        <View style={styles.rewardDividerContainer}>
                          <View style={styles.rewardDivider} />
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              </View>
            </FadeInStagger>
          </ReAnimated.ScrollView>

          {/* Redeem Bottom Sheet Modal */}
          <Modal visible={showRedeemSheet} transparent animationType="none" onRequestClose={closeRedeemSheet}>
            {/* Backdrop */}
            <Animated.View style={[redeemStyles.backdrop, { opacity: backdropOpacity }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={closeRedeemSheet} />
            </Animated.View>

            {/* Bottom Sheet */}
            <Animated.View style={[redeemStyles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
              {/* Drag Handle */}
              <View style={redeemStyles.dragHandleContainer}>
                <View style={redeemStyles.dragHandle} />
              </View>

              {/* Content */}
              <View style={redeemStyles.sheetContent}>
                {/* Icon */}
                <View style={redeemStyles.iconContainer}>
                  <Wallet size={30} color="#5299FE" strokeWidth={2} />
                </View>

                {/* Balance Label */}
                <Text weight="bold" size="xs" color="#6B7280" style={redeemStyles.balanceLabel}>
                  OWNERSHIP CREDIT BALANCE
                </Text>

                {/* Balance Amount */}
                <Text weight="bold" style={redeemStyles.sheetBalanceAmount}>
                  ${walletBalance.toFixed(2)}
                </Text>

                {/* Subtitle */}
                <Text size="sm" color="#6B7280" style={redeemStyles.balanceSubtitle}>
                  Available balance earned from{"\n"}maintenance rewards.
                </Text>

                {/* Active Selection Card */}
                <Pressable
                  onPress={() => setSelectedRedeemOption("booking")}
                  style={[
                    redeemStyles.selectionCard,
                    selectedRedeemOption === "booking" && redeemStyles.selectionCardActive,
                  ]}
                >
                  <View style={redeemStyles.selectionHeader}>
                    <Text weight="bold" size="xs" color={selectedRedeemOption === "booking" ? "#5299FE" : "#6B7280"}>
                      ACTIVE SELECTION
                    </Text>
                    {selectedRedeemOption === "booking" ? (
                      <View style={redeemStyles.checkCircle}>
                        <Check size={15} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={redeemStyles.radioButton} />
                    )}
                  </View>
                  <View style={redeemStyles.selectionContent}>
                    <View style={redeemStyles.selectionIconContainer}>
                      <Check size={20} color="#5299FE" strokeWidth={2.5} />
                    </View>
                    <View style={redeemStyles.selectionTextContent}>
                      <Text weight="bold" size="md" color="#1F2937">
                        Auto Apply to next booking
                      </Text>
                      <Text size="sm" color="#6B7280" style={redeemStyles.selectionDescription}>
                        Automatically deducts balance from upcoming maintenance, diagnostics, or repairs.
                      </Text>
                    </View>
                  </View>
                </Pressable>

                {/* Other Redemption Options */}
                <Text weight="bold" size="md" color="#1F2937" style={redeemStyles.otherOptionsTitle}>
                  Other Redemption Options
                </Text>

                <Pressable
                  onPress={() => setSelectedRedeemOption("giftcard")}
                  style={[
                    redeemStyles.otherOptionRow,
                    selectedRedeemOption === "giftcard" && redeemStyles.otherOptionRowActive,
                  ]}
                >
                  <View style={redeemStyles.otherOptionLeft}>
                    <View
                      style={[
                        redeemStyles.otherOptionIcon,
                        selectedRedeemOption === "giftcard" && redeemStyles.otherOptionIconActive,
                      ]}
                    >
                      <CreditCard
                        size={22}
                        color={selectedRedeemOption === "giftcard" ? "#5299FE" : "#6B7280"}
                        strokeWidth={1.5}
                      />
                    </View>
                    <Text weight="medium" size="md" color="#1F2937">
                      Convert to gift card
                    </Text>
                  </View>
                  {selectedRedeemOption === "giftcard" ? (
                    <View style={redeemStyles.checkCircle}>
                      <Check size={15} color="#FFFFFF" strokeWidth={3} />
                    </View>
                  ) : (
                    <View style={redeemStyles.radioButton} />
                  )}
                </Pressable>

                {/* Disclaimer */}
                <View style={redeemStyles.disclaimerRow}>
                  <Info size={14} color="#9CA3AF" strokeWidth={2} />
                  <Text size="xs" color="#9CA3AF" style={redeemStyles.disclaimerText}>
                    Redemptions are final and cannot be reversed. Bank transfers may take 1-3 business days to process.
                  </Text>
                </View>

                {/* Redeem Button */}
                <Pressable
                  style={({ pressed }) => [redeemStyles.redeemButton, pressed && redeemStyles.redeemButtonPressed]}
                  onPress={async () => {
                    if (!userId) return;
                    setIsRedeeming(true);
                    try {
                      if (selectedRedeemOption === "booking") {
                        await updateRedemptionPreference({ userId, autoApplyToBooking: true });
                      } else {
                        await redeemSelected({ userId, option: "giftcard" });
                        toast.success(
                          "Gift card on its way — arrives within 3 business days.",
                        );
                      }
                      closeRedeemSheet();
                    } catch (e) {
                      console.error("[membership] redeem failed", e);
                      toast.error("Couldn't redeem. Try again.");
                    } finally {
                      setIsRedeeming(false);
                    }
                  }}
                  disabled={isRedeeming || (selectedRedeemOption === "giftcard" && walletBalance <= 0)}
                >
                  {isRedeeming ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text weight="bold" size="md" color="#FFFFFF">
                      Redeem Selected
                    </Text>
                  )}
                </Pressable>

                {/* Cancel Link */}
                <Pressable
                  onPress={closeRedeemSheet}
                  style={({ pressed }) => [redeemStyles.cancelButton, pressed && { opacity: 0.7 }]}
                >
                  <Text weight="medium" size="md" color="#6B7280">
                    Cancel
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Modal>

          {/* Tier Status Bottom Sheet Modal - updates based on user's tier */}
          <Modal
            visible={showEliteSheet}
            transparent
            animationType="none"
            statusBarTranslucent
            onRequestClose={closeEliteSheet}
          >
            {/* Backdrop */}
            <Animated.View style={[eliteStyles.backdrop, { opacity: eliteBackdropOpacity }]}>
              <Pressable style={StyleSheet.absoluteFill} onPress={closeEliteSheet} />
            </Animated.View>

            {/* Bottom Sheet */}
            <Animated.View style={[eliteStyles.bottomSheet, { transform: [{ translateY: eliteSheetTranslateY }] }]}>
              {/* Drag Handle */}
              <View style={eliteStyles.dragHandleContainer}>
                <View style={eliteStyles.dragHandle} />
              </View>

              {/* Content - dynamic based on tier */}
              <View style={eliteStyles.sheetContent}>
                <View style={eliteStyles.iconContainer}>
                  <BadgeCheck size={32} color="#FFFFFF" fill="#5299FE" strokeWidth={2} />
                </View>

                {(statusModalTier ?? tierInfo?.tier) === "elite" ? (
                  <>
                    <Text weight="bold" size="2xl" color="#1F2937" style={eliteStyles.title}>
                      Elite Status
                    </Text>
                    <Text size="sm" color="#6B7280" style={eliteStyles.subtitle}>
                      Elite is unlocked through consistent ownership and care.
                    </Text>
                    <View style={eliteStyles.requirementCard}>
                      <Text weight="bold" size="xs" color="#6B7280" style={eliteStyles.requirementLabel}>
                        ELIGIBILITY REQUIREMENT
                      </Text>
                      <View style={eliteStyles.requirementContent}>
                        <View style={eliteStyles.requirementIconContainer}>
                          <Calendar size={18} color="#5299FE" strokeWidth={2} />
                        </View>
                        <View style={eliteStyles.requirementTextContent}>
                          <Text weight="bold" size="md" color="#1F2937">
                            $1,500 in services booked within a year
                          </Text>
                          <Text size="sm" color="#6B7280" style={eliteStyles.requirementDescription}>
                            Includes maintenance, diagnostics, and repairs completed through Otopair.
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text weight="bold" size="md" color="#1F2937" style={eliteStyles.unlocksTitle}>
                      What Elite unlocks
                    </Text>
                    <View style={eliteStyles.benefitsList}>
                      <View style={eliteStyles.benefitRow}>
                        <View style={eliteStyles.benefitIcon}>
                          <Wrench size={18} color="#5299FE" strokeWidth={1.5} />
                        </View>
                        <Text size="md" color="#1F2937">
                          ~2% earn rate on Ownership Credit
                        </Text>
                      </View>
                      <View style={eliteStyles.benefitRow}>
                        <View style={eliteStyles.benefitIcon}>
                          <Building2 size={18} color="#5299FE" strokeWidth={1.5} />
                        </View>
                        <Text size="md" color="#1F2937">
                          $60–$100 credit target per year
                        </Text>
                      </View>
                      <View style={eliteStyles.benefitRow}>
                        <View style={eliteStyles.benefitIcon}>
                          <Zap size={18} color="#5299FE" strokeWidth={1.5} />
                        </View>
                        <Text size="md" color="#1F2937">
                          Non-expiring Ownership Credits
                        </Text>
                      </View>
                      <View style={eliteStyles.benefitRow}>
                        <View style={eliteStyles.benefitIcon}>
                          <Headphones size={18} color="#5299FE" strokeWidth={1.5} />
                        </View>
                        <Text size="md" color="#1F2937">
                          Concierge support and priority booking
                        </Text>
                      </View>
                    </View>
                  </>
                ) : (statusModalTier ?? tierInfo?.tier) === "preferred" ? (
                  <>
                    <Text weight="bold" size="2xl" color="#1F2937" style={eliteStyles.title}>
                      Preferred Status
                    </Text>
                    <Text size="sm" color="#6B7280" style={eliteStyles.subtitle}>
                      Preferred is earned through consistent care with Otopair-trusted shops.
                    </Text>
                    <View style={eliteStyles.requirementCard}>
                      <Text weight="bold" size="xs" color="#6B7280" style={eliteStyles.requirementLabel}>
                        YOU REACHED PREFERRED AT
                      </Text>
                      <View style={eliteStyles.requirementContent}>
                        <View style={eliteStyles.requirementIconContainer}>
                          <Calendar size={18} color="#5299FE" strokeWidth={2} />
                        </View>
                        <View style={eliteStyles.requirementTextContent}>
                          <Text weight="bold" size="md" color="#1F2937">
                            $750 in services booked within a year
                          </Text>
                          <Text size="sm" color="#6B7280" style={eliteStyles.requirementDescription}>
                            Includes maintenance, diagnostics, and repairs completed through Otopair.
                          </Text>
                        </View>
                      </View>
                    </View>
                    <Text weight="bold" size="md" color="#1F2937" style={eliteStyles.unlocksTitle}>
                      What Preferred unlocks
                    </Text>
                    <View style={eliteStyles.benefitsList}>
                      <View style={eliteStyles.benefitRow}>
                        <View style={eliteStyles.benefitIcon}>
                          <Wrench size={18} color="#5299FE" strokeWidth={1.5} />
                        </View>
                        <Text size="md" color="#1F2937">
                          ~1.5% earn rate on Ownership Credit
                        </Text>
                      </View>
                      <View style={eliteStyles.benefitRow}>
                        <View style={eliteStyles.benefitIcon}>
                          <Building2 size={18} color="#5299FE" strokeWidth={1.5} />
                        </View>
                        <Text size="md" color="#1F2937">
                          $40–$75 credit target per year
                        </Text>
                      </View>
                      <View style={eliteStyles.benefitRow}>
                        <View style={eliteStyles.benefitIcon}>
                          <Zap size={18} color="#5299FE" strokeWidth={1.5} />
                        </View>
                        <Text size="md" color="#1F2937">
                          Diagnostics covered or reduced
                        </Text>
                      </View>
                      <View style={eliteStyles.benefitRow}>
                        <View style={eliteStyles.benefitIcon}>
                          <Building2 size={18} color="#5299FE" strokeWidth={1.5} />
                        </View>
                        <Text size="md" color="#1F2937">
                          Soft priority on booking
                        </Text>
                      </View>
                    </View>
                    <View style={eliteStyles.requirementCard}>
                      <Text weight="bold" size="xs" color="#6B7280" style={eliteStyles.requirementLabel}>
                        REACH ELITE
                      </Text>
                      <Text size="sm" color="#1F2937" style={eliteStyles.requirementDescription}>
                        Book $1,500 in services within a year to unlock Elite.
                      </Text>
                    </View>
                  </>
                ) : (
                  <>
                    <Text weight="bold" size="2xl" color="#1F2937" style={eliteStyles.title}>
                      Driver Status
                    </Text>
                    <Text size="sm" color="#6B7280" style={eliteStyles.subtitle}>
                      Driver is your starting tier. Transparent pricing and baseline protections.
                    </Text>
                    <View style={eliteStyles.requirementCard}>
                      <Text weight="bold" size="xs" color="#6B7280" style={eliteStyles.requirementLabel}>
                        YOUR BENEFITS
                      </Text>
                      <View style={eliteStyles.benefitsList}>
                        <View style={eliteStyles.benefitRow}>
                          <View style={eliteStyles.benefitIcon}>
                            <Wrench size={18} color="#5299FE" strokeWidth={1.5} />
                          </View>
                          <Text size="md" color="#1F2937">
                            ~1% earn rate on Ownership Credit
                          </Text>
                        </View>
                        <View style={eliteStyles.benefitRow}>
                          <View style={eliteStyles.benefitIcon}>
                            <Building2 size={18} color="#5299FE" strokeWidth={1.5} />
                          </View>
                          <Text size="md" color="#1F2937">
                            $20–$40 credit target per year
                          </Text>
                        </View>
                        <View style={eliteStyles.benefitRow}>
                          <View style={eliteStyles.benefitIcon}>
                            <Zap size={18} color="#5299FE" strokeWidth={1.5} />
                          </View>
                          <Text size="md" color="#1F2937">
                            Contribution rewards enabled
                          </Text>
                        </View>
                      </View>
                    </View>
                    <View style={eliteStyles.requirementCard}>
                      <Text weight="bold" size="xs" color="#6B7280" style={eliteStyles.requirementLabel}>
                        REACH PREFERRED
                      </Text>
                      <Text size="sm" color="#1F2937" style={eliteStyles.requirementDescription}>
                        Book $750 in services within a year to unlock Preferred.
                      </Text>
                    </View>
                  </>
                )}

                <View style={eliteStyles.disclaimerRow}>
                  <Info size={14} color="#9CA3AF" strokeWidth={2} />
                  <Text size="xs" color="#9CA3AF" style={eliteStyles.disclaimerText}>
                    Your current service history contributes toward tier eligibility.
                  </Text>
                </View>

                <Pressable
                  style={({ pressed }) => [eliteStyles.gotItButton, pressed && eliteStyles.gotItButtonPressed]}
                  onPress={closeEliteSheet}
                >
                  <Text weight="bold" size="md" color="#FFFFFF">
                    Got it
                  </Text>
                </Pressable>
              </View>
            </Animated.View>
          </Modal>

          {/* My Garage car selection sheet – opened when MY GARAGE ▾ tapped (pooled view) */}
          <GarageCarSelectionSheet
            innerRef={garageSheetRef}
            onStatusBadgePress={handleGarageStatusBadgePress}
            onCarSelected={handleCarSelectedFromSheet}
            onClose={() => {}}
          />
        </View>
      )}
    </ScrollDrivenGradientBackground>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  backButtonPressed: {
    opacity: 0.7,
  },

  // Header Row
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  avatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shopInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },

  // Glassy Icon Buttons (matching Home page style)
  glassButton: {
    alignItems: "center",
    justifyContent: "center",
  },
  glassButtonPressed: {
    opacity: 0.7,
  },
  glassContainer: {
    width: GLASS_ICON_SIZE,
    height: GLASS_ICON_SIZE,
    borderRadius: GLASS_ICON_SIZE / 2,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
  },
  glassBlur: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  glassGloss: {
    ...StyleSheet.absoluteFillObject,
  },
  bellIconContainer: {
    position: "relative",
  },
  bellDot: {
    position: "absolute",
    top: 1,
    right: 1,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FF3B30",
  },

  // Flip Badge (MY GARAGE ▾ ↔ PREFERRED ▾)
  badgeContainer: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  badgePressable: {
    alignSelf: "center",
  },
  badgeFlipContainer: {
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 36,
  },
  badgeSizer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs,
    gap: Spacing.xs,
    opacity: 0,
  },
  badgeFace: {
    position: "absolute",
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EBF4FF",
    paddingHorizontal: Spacing.sm + 4,
    paddingVertical: Spacing.xs,
    borderRadius: 18,
    gap: Spacing.xs,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  badgeFaceBack: {
    left: 0,
    right: 0,
  },
  badgeText: {
    letterSpacing: 1,
  },
  badgeChevron: {
    marginLeft: 2,
  },

  // Balance
  balanceContainer: {
    alignItems: "center",
    marginBottom: Spacing["3xl"],
  },
  balanceAmount: {
    fontSize: 52,
    lineHeight: 60,
    color: "#1F2937",
    marginBottom: Spacing.xs,
  },
  balanceSubtext: {
    marginTop: 4,
  },

  // Action Buttons
  actionButtonsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    gap: Spacing["3xl"],
    marginBottom: Spacing.lg,
  },
  actionButtonWrapper: {
    alignItems: "center",
  },
  actionButton: {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    borderRadius: ACTION_BUTTON_SIZE / 2,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  actionButtonPrimary: {
    backgroundColor: "#5299FE",
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  actionButtonSecondary: {
    backgroundColor: "#F3F4F6",
  },
  actionButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  actionLabel: {
    textAlign: "center",
  },

  // Stats Row
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingVertical: Spacing.xl,
    marginHorizontal: Spacing.sm,
  },
  statItem: {
    alignItems: "center",
    flex: 1,
  },
  statNumber: {
    fontSize: 24,
    lineHeight: 30,
    color: "#1F2937",
    marginBottom: 2,
  },
  statLabel: {
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  statDivider: {
    width: 1,
    height: 56,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
  },

  // ═══════════════ SUGGESTED DEALS SECTION ═══════════════
  suggestedDealsSection: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  dealsScrollContent: {
    paddingRight: Spacing.lg,
    gap: Spacing.md,
  },
  dealCard: {
    width: DEAL_CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  dealImageContainer: {
    position: "relative",
    height: 120,
  },
  dealImagePlaceholder: {
    flex: 1,
    backgroundColor: "#E5E7EB",
  },
  specialBadge: {
    position: "absolute",
    top: Spacing.sm,
    left: Spacing.sm,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    gap: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  dealContent: {
    padding: Spacing.md,
  },
  dealDescription: {
    marginTop: 4,
    marginBottom: Spacing.md,
  },
  dealBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  creditBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#D1FAE5",
  },
  bookButton: {
    backgroundColor: "#1F2937",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 16,
  },
  bookButtonPressed: {
    opacity: 0.8,
  },

  // ═══════════════ EARN REWARDS SECTION ═══════════════
  earnRewardsSection: {
    marginTop: Spacing["2xl"],
  },
  earnRewardsTitle: {
    marginBottom: Spacing.md,
  },
  rewardsList: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginHorizontal: Spacing.xs,
  },
  rewardRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#FFFFFF",
  },
  rewardRowFirst: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  rewardRowLast: {
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  rewardRowPressed: {
    backgroundColor: "#F9FAFB",
  },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  rewardTextContent: {
    flex: 1,
    gap: 2,
  },
  rewardAmountContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  uploadButton: {
    backgroundColor: "#5299FE",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  uploadButtonPressed: {
    opacity: 0.8,
  },
  rewardDividerContainer: {
    paddingHorizontal: Spacing["5xl"] + 20,
  },
  rewardDivider: {
    height: 1,
    backgroundColor: "#F3F4F6",
  },
});

// ============================================================================
// REDEEM BOTTOM SHEET STYLES
// ============================================================================

const redeemStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  bottomSheet: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.025,
    right: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.95,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    paddingBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 2,
  },
  sheetContent: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 50,
    height: 50,
    borderRadius: 14,
    backgroundColor: "#EBF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  balanceLabel: {
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  sheetBalanceAmount: {
    fontSize: 38,
    lineHeight: 44,
    color: "#1F2937",
    marginBottom: 4,
  },
  balanceSubtitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  selectionCard: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  selectionCardActive: {
    backgroundColor: "#EBF4FF",
    borderColor: "#5299FE",
  },
  selectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#5299FE",
    justifyContent: "center",
    alignItems: "center",
  },
  selectionContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  selectionIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 9,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
    borderWidth: 1,
    borderColor: "#5299FE",
  },
  selectionTextContent: {
    flex: 1,
  },
  selectionDescription: {
    marginTop: 4,
    lineHeight: 20,
  },
  otherOptionsTitle: {
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  otherOptionRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    marginBottom: Spacing.md,
    borderWidth: 2,
    borderColor: "transparent",
  },
  otherOptionRowActive: {
    backgroundColor: "#EBF4FF",
    borderColor: "#5299FE",
  },
  otherOptionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  otherOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  otherOptionIconActive: {
    borderWidth: 1,
    borderColor: "#5299FE",
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  disclaimerText: {
    flex: 1,
    lineHeight: 18,
  },
  redeemButton: {
    width: "100%",
    backgroundColor: "#5299FE",
    borderRadius: 24,
    paddingVertical: Spacing.md,
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  redeemButtonPressed: {
    opacity: 0.9,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
  },
});

// ============================================================================
// ELITE STATUS BOTTOM SHEET STYLES
// ============================================================================

const eliteStyles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  bottomSheet: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.025,
    right: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.95,
    backgroundColor: "#FFFFFF",
    borderRadius: 40,
    paddingBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 2,
  },
  sheetContent: {
    paddingHorizontal: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EBF4FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  title: {
    marginBottom: 4,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  requirementCard: {
    width: "100%",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  requirementLabel: {
    letterSpacing: 1,
    marginBottom: Spacing.sm,
  },
  requirementContent: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  requirementIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  requirementTextContent: {
    flex: 1,
  },
  requirementDescription: {
    marginTop: 4,
    lineHeight: 20,
  },
  unlocksTitle: {
    alignSelf: "flex-start",
    marginBottom: Spacing.sm,
  },
  benefitsList: {
    width: "100%",
    marginBottom: Spacing.sm,
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  benefitIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  disclaimerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  disclaimerText: {
    flex: 1,
    lineHeight: 18,
  },
  gotItButton: {
    width: "100%",
    backgroundColor: "#5299FE",
    borderRadius: 24,
    paddingVertical: Spacing.md,
    alignItems: "center",
  },
  gotItButtonPressed: {
    opacity: 0.9,
  },
});
