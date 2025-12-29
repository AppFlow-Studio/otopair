/**
 * MechanicReviewsSection
 *
 * PURPOSE: Displays reviews and rating summary for a mechanic/shop
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id].tsx (Reviews tab)
 *
 * PROPS:
 *   - mechanicId (number): The mechanic ID to show reviews for
 *
 * EXAMPLE:
 *   <MechanicReviewsSection mechanicId={mechanic.id} />
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

// 2. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 3. Flow-specific components
import { RatingSummaryCard, ReviewCard } from "@/components/booking/shared";

// 4. Constants, hooks, types, stores
import { useMechanicStore } from "@/stores/useMechanicStore";
import { mockReviews, ratingDistribution } from "@/stores/data/mockReviews";

// ============================================================================
// TYPES
// ============================================================================

interface MechanicReviewsSectionProps {
    /** The mechanic ID to show reviews for */
    mechanicId: number;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicReviewsSection({ mechanicId }: MechanicReviewsSectionProps) {
    // ═══════════════ STORES ═══════════════
    const getMechanicById = useMechanicStore((state) => state.getMechanicById);

    // ═══════════════ COMPUTED VALUES ═══════════════
    const mechanic = useMemo(() => getMechanicById(mechanicId), [mechanicId, getMechanicById]);

    // Calculate rating count (mock - in production this would come from API)
    const ratingCount = useMemo(() => {
        if (!mechanic) return 0;
        return Math.floor(mechanic.rating * 25 + 27);
    }, [mechanic]);

    // Use mock reviews (in production, filter by mechanicId)
    const reviews = useMemo(() => mockReviews, []);

    // ═══════════════ RENDER ═══════════════
    if (!mechanic) {
        return (
            <View style={styles.emptyContainer}>
                <Text size="md" weight="medium" color="#9CA3AF" center>
                    Mechanic not found
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Rating Summary */}
            <RatingSummaryCard
                rating={mechanic.rating}
                ratingCount={ratingCount}
                distribution={ratingDistribution}
            />

            {/* Reviews List */}
            <View style={styles.reviewsHeader}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                    Customer Reviews ({reviews.length})
                </Text>
            </View>

            <View style={styles.reviewsList}>
                {reviews.map((review) => (
                    <ReviewCard key={review.id} review={review} />
                ))}
            </View>
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        paddingVertical: Spacing.lg,
    },
    reviewsHeader: {
        marginTop: Spacing.xl,
        marginBottom: Spacing.lg,
    },
    reviewsList: {
        gap: Spacing.md,
    },
    emptyContainer: {
        paddingVertical: Spacing.xl,
        alignItems: "center",
    },
});

