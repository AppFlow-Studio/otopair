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
import { BackHandler, Platform, Pressable, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { ArrowLeft, Store } from "lucide-react-native";
import Animated, { useAnimatedRef } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BorderRadius, BrandColors, Button, ScreenContainer, Shadows, Spacing, Text } from "@/components/shared-ui";
import { FullScreenContainer } from "@/components/shared-ui/Container";

// 4. Flow-specific components
import { MechanicDetailHeader } from "@/components/booking/MechanicDetailHeader";
import { MechanicDetailTabs, type MechanicDetailTab } from "@/components/booking/MechanicDetailTabs";
import { ShopReviewsSection } from "@/components/booking/ShopReviewsSection";
import { ShopBookingModal } from "@/components/booking/modals";
import { ShopPortfolioSection } from "@/components/booking/ShopPortfolioSection";
import { ShopMechanicsSection } from "@/components/booking/ShopMechanicsSection";
import { ShopHeroCard } from "@/components/shop/ShopHeroCard";

// 5. Constants, hooks, types, stores
import { useBookingStore } from "@/stores/useBookingStore";
import { useSearchStore } from "@/stores/useSearchStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// COMPONENT
// ============================================================================

export default function ShopDetailScreen() {
  // ═══════════════ HOOKS ═══════════════
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  // ═══════════════ STATE ═══════════════
  const [activeTab, setActiveTab] = useState<MechanicDetailTab>("reviews");
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingMechanicId, setBookingMechanicId] = useState<string | null>(null);

  // ═══════════════ STORES ═══════════════
  const getShopById = useShopStore((state) => state.getShopById);
  const resetBookingFlow = useBookingStore((state) => state.resetBookingFlow);
  const bookingStage = useBookingStore((state) => state.bookingStage);
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const setPreSelectedShop = useBookingStore((state) => state.setPreSelectedShop);
  const addRecentShop = useSearchStore((state) => state.addRecentShop);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const shopId = id && typeof id === "string" ? id : null;

  const shop = useMemo(() => {
    if (!shopId) return null;
    return getShopById(shopId);
  }, [shopId, getShopById]);

  // ═══════════════ ANIMATED VALUES ═══════════════
  // The header (map + shop card + tabs) is now fixed and only the tab
  // list scrolls, so the old scroll-driven sticky title is gone. The ref
  // is kept purely so we can programmatically control the list if needed.
  const scrollRef = useAnimatedRef<Animated.ScrollView>();

  // ═══════════════ HANDLERS ═══════════════
  const handleBack = useCallback(() => {
    // Only reset booking flow if we're NOT in mechanic selection stage
    // If we're in mechanic_selection, we came from "Choose Mechanic" screen
    // and should preserve the booking state when going back.
    //
    // ALSO preserve when the user already has services in the cart —
    // the new (booking-flow) Select Services screen builds the cart
    // BEFORE picking a mechanic (bookingStage is still "discovery"
    // here), so wiping on back was nuking the user's selection any
    // time they tapped a Closest Shop / View shop details card.
    const hasActiveCart = selectedServiceIds.length > 0;
    if (bookingStage !== "mechanic_selection" && !hasActiveCart) {
      // We came from map carousel or other source with no cart in
      // flight — safe to reset the booking flow.
      resetBookingFlow();
    }
    // Navigate back to previous screen (respects navigation history)
    router.back();
  }, [bookingStage, selectedServiceIds.length, resetBookingFlow, router]);

  const handleCloseBookingModal = useCallback(() => {
    setShowBookingModal(false);
    setBookingMechanicId(null);
  }, []);

  const handleTabChange = useCallback((tab: MechanicDetailTab) => {
    setActiveTab(tab);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android") {
        return undefined;
      }

      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (showBookingModal) {
          handleCloseBookingModal();
          return true;
        }

        handleBack();
        return true;
      });

      return () => subscription.remove();
    }, [handleBack, handleCloseBookingModal, showBookingModal])
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
      case "reviews":
        return <ShopReviewsSection shopId={shop.id} />;
      case "mechanics":
        return <ShopMechanicsSection shopId={shop.id} />;
      case "portfolio":
        return <ShopPortfolioSection shopId={shop.id} />;
      default:
        return null;
    }
  };

  const handleSchedulePress = useCallback(() => {
    // Route into the booking flow with THIS shop pre-pinned, and
    // REPLACE the shop detail in the stack instead of pushing on
    // top of it. `push` was causing the booking-flow sheet to
    // appear over the shop detail (both screens mounted, sheet
    // semi-transparent → user saw shop detail bleeding through);
    // `replace` swaps in the booking-flow cleanly so it reads as
    // a full-page navigation. Back from inside the booking flow
    // returns to whatever was below the shop detail (search,
    // home, etc.) — which is the right behavior since the user
    // already committed to booking with this shop.
    //
    // Legacy `ShopBookingModal` is still mounted below for any
    // residual call sites, but this CTA + the top "Book" pill no
    // longer open it — both flow through the new (booking-flow)
    // stack now.
    if (!shop) return;
    setPreSelectedShop(shop.id);
    router.replace("/(booking-flow)/select-services");
  }, [router, setPreSelectedShop, shop]);

  return (
    <FullScreenContainer style={styles.container}>
      {/* Fixed top block — map, shop info card, and tabs stay pinned
          so only the tab list below scrolls (per Ahmad). */}
      {/* Hero map */}
      <MechanicDetailHeader shop={shop} onBack={handleBack} />

      {/* Floating shop info card — overlaps the map bottom edge.
          Pass the same Book handler the sticky CTA uses so the
          top-of-card "Book" pill routes through the new
          (booking-flow) stack instead of the legacy modal. */}
      <ShopHeroCard shop={shop} onSchedulePress={handleSchedulePress} />

      {/* Tab Navigation */}
      <MechanicDetailTabs activeTab={activeTab} onTabChange={handleTabChange} />

      {/* Scrollable tab content ONLY — the header above is fixed. */}
      <Animated.ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
      >
        {/* Tab Content — sits on the off-white page surface */}
        <View style={styles.tabContentContainer}>{renderTabContent()}</View>
      </Animated.ScrollView>

      {/* Sticky bottom CTA */}
      <View style={[styles.stickyCta, { paddingBottom: Math.max(insets.bottom - Spacing.md, Spacing.xs) }]}>
        <Pressable
          onPress={handleSchedulePress}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaButtonPressed,
          ]}
        >
          <Text size="md" weight="semiBold" color="#FFFFFF">
            Book a Service
          </Text>
        </Pressable>
      </View>

      {/* Booking flow modal — services → mechanic → time slot. Mounted
          once; opens from the sticky Book a Service CTA. */}
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
    backgroundColor: "#F5F5F7",
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
    // Leave room for the sticky Book CTA at the bottom.
    paddingBottom: 96,
  },
  tabContentContainer: {
    paddingTop: Spacing.xs,
  },
  stickyCta: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: "rgba(245, 245, 247, 0.94)",
  },
  ctaButton: {
    height: 54,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  ctaButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
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
