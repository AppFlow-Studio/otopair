/**
 * Shop Detail Screen
 *
 * PURPOSE: Full-screen detail page for a selected shop showing location,
 *          services, reviews, portfolio, and staff. Displays a blurred map header
 *          with shop location pin and shop information.
 *
 * FLOW: search/carousel → shop detail → booking-details → payment → confirmation
 *
 * USED IN: Navigation from HomeSearchOverlay or MechanicCarouselSheet
 *
 * ROUTE: /booking/shop/[id]
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
import { BackHandler, Platform, Pressable, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { BlurView } from "expo-blur";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Store } from "lucide-react-native";
import Animated, { interpolate, useAnimatedRef, useAnimatedStyle, useScrollOffset } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BorderRadius, BrandColors, Button, ScreenContainer, Shadows, Spacing, Text } from "@/components/shared-ui";
import { FullScreenContainer } from "@/components/shared-ui/Container";

// 4. Flow-specific components
import { MechanicDetailHeader } from "@/components/booking/MechanicDetailHeader";
import { MechanicDetailTabs, type MechanicDetailTab } from "@/components/booking/MechanicDetailTabs";
import { ShopReviewsSection } from "@/components/booking/ShopReviewsSection";
import { AddServicesModal, ShopBookingModal } from "@/components/booking/modals";
import { ShopDetails } from "@/components/booking/ShopDetails";
import { ShopPortfolioSection } from "@/components/booking/ShopPortfolioSection";
import { ShopStaffSection } from "@/components/booking/ShopStaffSection";

// 5. Constants, hooks, types, stores
import { calculateDistanceMiles } from "@/utils/geo";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useSearchStore } from "@/stores/useSearchStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Height of the header section (excluding safe area) */
const HEADER_CONTENT_HEIGHT = 280;

// ============================================================================
// COMPONENT
// ============================================================================

export default function ShopDetailScreen() {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ═══════════════ STATE ═══════════════
  const [activeTab, setActiveTab] = useState<MechanicDetailTab>("services");
  const [showAddServicesModal, setShowAddServicesModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingMechanicId, setBookingMechanicId] = useState<string | null>(null);

  // ═══════════════ STORES ═══════════════
  const getShopById = useShopStore((state) => state.getShopById);
  const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
  const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);
  const resetBookingFlow = useBookingStore((state) => state.resetBookingFlow);
  const bookingStage = useBookingStore((state) => state.bookingStage);
  const addRecentShop = useSearchStore((state) => state.addRecentShop);
  const userLocation = useBookingStore((state) => state.userLocation);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const shopId = id && typeof id === "string" ? id : null;

  const shop = useMemo(() => {
    if (!shopId) return null;
    return getShopById(shopId);
  }, [shopId, getShopById]);

  // Get the first mechanic at this shop for reviews and booking
  const mechanics = useMemo(() => {
    if (!shopId) return [];
    return getMechanicsByShopId(shopId);
  }, [shopId, getMechanicsByShopId]);

  const primaryMechanic = mechanics[0] ?? null;

  // ═══════════════ ANIMATED VALUES ═══════════════
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollOffset(scrollRef);

  // Calculate total header height including safe area
  const totalHeaderHeight = HEADER_CONTENT_HEIGHT + insets.top;

  // Threshold where shop name scrolls out of view (header height minus some padding)
  const scrollThreshold = totalHeaderHeight - 100;

  // ═══════════════ ANIMATED STYLES ═══════════════
  // Animated style for sticky header title
  const stickyHeaderStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollOffset.value, [scrollThreshold - 20, scrollThreshold], [0, 1], "clamp");
    const translateY = interpolate(scrollOffset.value, [scrollThreshold - 20, scrollThreshold], [-10, 0], "clamp");

    return {
      opacity,
      transform: [{ translateY }],
    };
  });

  // Animated style for blur overlay (native iOS-like effect)
  const blurOverlayStyle = useAnimatedStyle(() => {
    const opacity = interpolate(scrollOffset.value, [scrollThreshold - 20, scrollThreshold], [0, 0.95], "clamp");

    return {
      opacity,
    };
  });

  // ═══════════════ HANDLERS ═══════════════
  const handleBack = useCallback(() => {
    // Only reset booking flow if we're NOT in mechanic selection stage
    // If we're in mechanic_selection, we came from "Choose Mechanic" screen
    // and should preserve the booking state when going back
    if (bookingStage !== "mechanic_selection") {
      // We came from map carousel or other source, reset the booking flow
      resetBookingFlow();
    }
    // Navigate back to previous screen (respects navigation history)
    router.back();
  }, [bookingStage, resetBookingFlow, router]);

  const handleBookNow = useCallback(
    (mechanicId: string) => {
      // Add shop to recent history
      if (shopId) {
        addRecentShop(shopId);
      }

      // Since user selected a specific time slot, this is a scheduled booking
      setBookingTypeAndProceed("schedule_later", mechanicId);
      router.push(`/booking/mechanic/${mechanicId}/booking-details`);
    },
    [shopId, addRecentShop, setBookingTypeAndProceed, router],
  );

  const handleAddMoreServices = useCallback(() => {
    setShowAddServicesModal(true);
  }, []);

  const handleViewAllAvailability = useCallback((mechanicId: string) => {
    setBookingMechanicId(mechanicId);
    setShowBookingModal(true);
  }, []);

  const handleCloseAddServicesModal = useCallback(() => {
    setShowAddServicesModal(false);
  }, []);

  const handleCloseBookingModal = useCallback(() => {
    setShowBookingModal(false);
    setBookingMechanicId(null);
  }, []);

  // Handle tab change - open booking modal for "schedule" tab
  const handleTabChange = useCallback((tab: MechanicDetailTab) => {
    if (tab === "schedule") {
      // Open the booking modal instead of switching tabs
      setBookingMechanicId(null); // null = "Any" mechanic
      setShowBookingModal(true);
    } else {
      setActiveTab(tab);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return undefined;
      }

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (showAddServicesModal) {
          setShowAddServicesModal(false);
          return true;
        }

        if (showBookingModal) {
          handleCloseBookingModal();
          return true;
        }

        handleBack();
        return true;
      });

      return () => subscription.remove();
    }, [handleBack, handleCloseBookingModal, showAddServicesModal, showBookingModal])
  );

  // ═══════════════ RENDER ═══════════════
  if (!shop) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.errorContainer}>
          <View style={styles.errorIconCircle}>
            <Store size={36} color={BrandColors.primary} strokeWidth={1.75} />
          </View>
          <Text size="xl" weight="semiBold" color={BrandColors.primary} style={styles.errorTitle}>
            Shop not found
          </Text>
          <Text size="md" color={BrandColors.primary} style={styles.errorMessage}>
            This shop is no longer available or the link is invalid.
          </Text>
          <Button
            onPress={handleBack}
            variant="primary"
            size="lg"
            leftIcon={<ArrowLeft size={18} color={BrandColors.white} />}
            style={styles.errorButton}
          >
            Go back
          </Button>
        </View>
      </ScreenContainer>
    );
  }

  // ═══════════════ RENDER TAB CONTENT ═══════════════
  const renderTabContent = () => {
    switch (activeTab) {
      case "services":
        return (
          <ShopDetails
            shopId={shop.id}
            onBookNow={handleBookNow}
            onAddMoreServices={handleAddMoreServices}
            onViewAllAvailability={handleViewAllAvailability}
          />
        );
      case "reviews":
        return <ShopReviewsSection shopId={shop.id} />;
      case "portfolio":
        return <ShopPortfolioSection shopId={shop.id} />;
      case "staff":
        return <ShopStaffSection shopId={shop.id} />;
      default:
        return null;
    }
  };

  return (
    <FullScreenContainer style={styles.container}>
      {/* Sticky Header Title - Appears when scrolling past shop name */}
      <Animated.View
        style={[
          styles.stickyHeader,
          { paddingTop: insets.top + Spacing.sm, paddingBottom: Spacing.sm },
          stickyHeaderStyle,
        ]}
      >
        {/* Blur Overlay for native iOS-like effect */}
        <Animated.View style={[styles.blurOverlay, blurOverlayStyle]} pointerEvents="none">
          <BlurView intensity={80} tint="light" style={styles.blurViewFill} />
        </Animated.View>

        <View style={styles.stickyHeaderContent}>
          <Pressable onPress={handleBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <View style={styles.backButton}>
              <ArrowLeft size={24} color={BrandColors.primary} />
            </View>
          </Pressable>

          <View style={styles.titleContainer}>
            <Text size="lg" weight="bold" color={BrandColors.primary} numberOfLines={1}>
              {shop.name}
            </Text>
          </View>

          {/* Spacer to balance the back button */}
          <View style={styles.spacer} />
        </View>
      </Animated.View>

      {/* Scrollable Content */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* Header with Map - Part of scroll content */}
        {primaryMechanic ? (
          <MechanicDetailHeader mechanic={primaryMechanic} shop={shop} onBack={handleBack} />
        ) : (
          <MechanicDetailHeader
            mechanic={{
              id: "0",
              shopId: shop.id,
              name: shop.name,
              shopName: shop.name,
              photoUrl: null,
              rating: shop.rating ?? 0,
              reviewCount: shop.reviewCount,
              isVerified: false,
              distanceMi:
                userLocation && shop.latitude != null && shop.longitude != null
                  ? calculateDistanceMiles(userLocation.latitude, userLocation.longitude, shop.latitude, shop.longitude)
                  : 0,
              services: [],
              specialties: [],
              yearsExperience: 0,
              isAvailable: shop.availability > 0,
              responseTime: "Normal",
              availability: shop.availability,
              nextAvailability: [],
            }}
            shop={shop}
            onBack={handleBack}
          />
        )}

        {/* Tab Navigation */}
        <MechanicDetailTabs activeTab={activeTab} onTabChange={handleTabChange} />

        {/* Tab Content */}
        <View style={styles.tabContentContainer}>{renderTabContent()}</View>
      </Animated.ScrollView>

      {/* Modal-based components - work reliably from any component hierarchy */}
      <AddServicesModal visible={showAddServicesModal} onClose={handleCloseAddServicesModal} />
      <ShopBookingModal
        visible={showBookingModal}
        shopId={shop.id}
        mechanicId={bookingMechanicId}
        onClose={handleCloseBookingModal}
      />
    </FullScreenContainer>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BrandColors.white,
  },
  stickyHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: BrandColors.white,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    zIndex: 100,
    overflow: "hidden",
  },
  blurOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  blurViewFill: {
    ...StyleSheet.absoluteFillObject,
  },
  stickyHeaderContent: {
    paddingHorizontal: Spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleContainer: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: Spacing.md,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
  },
  tabContentContainer: {
    paddingTop: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  errorIconCircle: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.sm,
  },
  errorTitle: {
    textAlign: "center",
  },
  errorMessage: {
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  errorButton: {
    minWidth: 180,
  },
  spacer: {
    width: 40,
    height: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  emptyTabContent: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});
