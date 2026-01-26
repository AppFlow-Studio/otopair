/**
 * Mechanic Detail Screen
 *
 * PURPOSE: Full-screen detail page for a selected mechanic showing shop location,
 *          specialties, and booking options. Displays a blurred map header with
 *          shop location pin and shop information.
 *
 * FLOW: mechanic_selection (ServiceBottomSheet) → mechanic detail → booking-details → payment → confirmation
 *
 * USED IN: Navigation from components/booking/sheets/MechanicSelectionContent.tsx
 *
 * ROUTE: /home/mechanic/[id]
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useCallback, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { BlurView } from "expo-blur";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, {
    interpolate,
    useAnimatedRef,
    useAnimatedStyle,
    useScrollOffset,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BorderRadius, BrandColors, ScreenContainer, Shadows, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { MechanicDetailHeader } from "@/components/booking/MechanicDetailHeader";
import { MechanicDetailTabs, type MechanicDetailTab } from "@/components/booking/MechanicDetailTabs";
import { ShopDetails } from "@/components/booking/ShopDetails";
import { MechanicReviewsSection } from "@/components/booking/MechanicReviewsSection";
import { ShopPortfolioSection } from "@/components/booking/ShopPortfolioSection";
import { ShopStaffSection } from "@/components/booking/ShopStaffSection";
import { AddServicesModal, AvailabilityModal } from "@/components/booking/modals";

// 5. Constants, hooks, types, stores
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { FullScreenContainer } from "@/components/shared-ui/Container";
import { ArrowLeft } from "lucide-react-native";

// ============================================================================
// CONSTANTS
// ============================================================================

/** Height of the header section (excluding safe area) */
const HEADER_CONTENT_HEIGHT = 280;

// ============================================================================
// COMPONENT
// ============================================================================

export default function MechanicDetailScreen() {
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
    const getMechanicById = useMechanicStore((state) => state.getMechanicById);
    const getShopById = useShopStore((state) => state.getShopById);
    const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);
    const resetBookingFlow = useBookingStore((state) => state.resetBookingFlow);
    const bookingStage = useBookingStore((state) => state.bookingStage);

    // ═══════════════ COMPUTED VALUES ═══════════════
    const mechanicId = useMemo(() => {
        const parsed = id ? parseInt(id, 10) : null;
        return isNaN(parsed ?? 0) ? null : parsed;
    }, [id]);

    const mechanic = useMemo(() => {
        if (!mechanicId) return null;
        return getMechanicById(mechanicId);
    }, [mechanicId, getMechanicById]);

    const shop = useMemo(() => {
        if (!mechanic?.shopId) return null;
        return getShopById(mechanic.shopId);
    }, [mechanic?.shopId, getShopById]);

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
            // We came from elsewhere, reset the booking flow
            resetBookingFlow();
        }
        router.back();
    }, [bookingStage, resetBookingFlow, router]);

    const handleBookNow = useCallback(
        (mechanicId: number) => {
            // Since user selected a specific time slot, this is a scheduled booking
            setBookingTypeAndProceed("schedule_later", mechanicId);
            router.push(`/home/mechanic/${id}/booking-details`);
        },
        [setBookingTypeAndProceed, router, id]
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
    if (!mechanic || !shop) {
        return (
            <ScreenContainer style={styles.container}>
                <View style={styles.errorContainer}>
                    <Text size="lg" weight="medium" color={BrandColors.primary}>
                        Mechanic not found
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
                return <MechanicReviewsSection mechanicId={mechanic.id} />;
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
                            {mechanic.shopName}
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
                <MechanicDetailHeader mechanic={mechanic} shop={shop} onBack={handleBack} />

                {/* Tab Navigation */}
                <MechanicDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />

                {/* Tab Content */}
                <View style={styles.tabContentContainer}>{renderTabContent()}</View>
            </Animated.ScrollView>

            {/* Modal-based components - work reliably from any component hierarchy */}
            <AddServicesModal
                visible={showAddServicesModal}
                onClose={handleCloseAddServicesModal}
            />
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
});
