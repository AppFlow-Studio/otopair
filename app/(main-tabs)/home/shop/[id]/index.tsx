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
 * ROUTE: /home/shop/[id]
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BorderRadius, BrandColors, ScreenContainer, Shadows, Spacing, Text } from "@/components/shared-ui";
import { FullScreenContainer } from "@/components/shared-ui/Container";

// 4. Flow-specific components
import { MechanicDetailHeader } from "@/components/booking/MechanicDetailHeader";
import { MechanicDetailTabs, type MechanicDetailTab } from "@/components/booking/MechanicDetailTabs";
import { MechanicReviewsSection } from "@/components/booking/MechanicReviewsSection";
import { AddServicesModal, AvailabilityModal } from "@/components/booking/modals";
import { ShopDetails } from "@/components/booking/ShopDetails";
import { ShopPortfolioSection } from "@/components/booking/ShopPortfolioSection";
import { ShopStaffSection } from "@/components/booking/ShopStaffSection";

// 5. Constants, hooks, types, stores
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
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [availabilityMechanicId, setAvailabilityMechanicId] = useState<number | null>(null);

  // ═══════════════ STORES ═══════════════
  const getShopById = useShopStore((state) => state.getShopById);
  const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
  const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);
  const resetBookingFlow = useBookingStore((state) => state.resetBookingFlow);
  const addRecentShop = useSearchStore((state) => state.addRecentShop);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const shopId = useMemo(() => {
    const parsed = id ? parseInt(id, 10) : null;
    return isNaN(parsed ?? 0) ? null : parsed;
  }, [id]);

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
    // Reset the booking flow to discovery state with empty service selection
    resetBookingFlow();
    router.back();
  }, [resetBookingFlow, router]);

  const handleBookNow = useCallback(
    (mechanicId: number) => {
      // Add shop to recent history
      if (shopId) {
        addRecentShop(shopId);
      }

      // Since user selected a specific time slot, this is a scheduled booking
      setBookingTypeAndProceed("schedule_later", mechanicId);
      router.push(`/home/mechanic/${mechanicId}/booking-details`);
    },
    [shopId, addRecentShop, setBookingTypeAndProceed, router]
  );

  const handleAddMoreServices = useCallback(() => {
    setShowAddServicesModal(true);
  }, []);

  const handleViewAllAvailability = useCallback((mechanicId: number) => {
    setAvailabilityMechanicId(mechanicId);
    setShowAvailabilityModal(true);
  }, []);

  const handleCloseAddServicesModal = useCallback(() => {
    setShowAddServicesModal(false);
  }, []);

  const handleCloseAvailabilityModal = useCallback(() => {
    setShowAvailabilityModal(false);
    setAvailabilityMechanicId(null);
  }, []);

  // ═══════════════ RENDER ═══════════════
  if (!shop) {
    return (
      <ScreenContainer style={styles.container}>
        <View style={styles.errorContainer}>
          <Text size="lg" weight="medium" color={BrandColors.primary}>
            Shop not found
          </Text>
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
        // Use primary mechanic for reviews, or fall back to showing shop-level content
        return primaryMechanic ? (
          <MechanicReviewsSection mechanicId={primaryMechanic.id} />
        ) : (
          <View style={styles.emptyTabContent}>
            <Text size="md" color="#6B7280">
              No reviews available
            </Text>
          </View>
        );
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
              id: 0,
              name: shop.name,
              shopId: shop.id,
              shopName: shop.name,
              specialties: [],
              rating: shop.rating ?? 0,
              reviewCount: 0,
              yearsExperience: 0,
              avatar: null,
              isAvailable: shop.availability > 0,
            }}
            shop={shop}
            onBack={handleBack}
          />
        )}

        {/* Tab Navigation */}
        <MechanicDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Tab Content */}
        <View style={styles.tabContentContainer}>{renderTabContent()}</View>
      </Animated.ScrollView>

      {/* Modal-based components - work reliably from any component hierarchy */}
      <AddServicesModal visible={showAddServicesModal} onClose={handleCloseAddServicesModal} />
      <AvailabilityModal
        visible={showAvailabilityModal}
        mechanicId={availabilityMechanicId}
        onClose={handleCloseAvailabilityModal}
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
