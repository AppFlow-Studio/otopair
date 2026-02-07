/**
 * MechanicReviewsSection
 *
 * PURPOSE: Displays reviews and rating summary for a mechanic from Convex (api.reviews.getByMechanicId).
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id].tsx (Reviews tab)
 *
 * OWNER: Temurbek Sayfutdinov
 */

import React, { useMemo } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { RatingSummaryCard, ReviewCard } from "@/components/booking/shared";
import type { Review } from "@/components/booking/shared";
import { useMechanicStore } from "@/stores/useMechanicStore";

function formatTimeAgo(createdAt: number): string {
  const diff = Date.now() - createdAt;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins} mins ago`;
  if (hours < 24) return `${hours} hr${hours !== 1 ? "s" : ""} ago`;
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`;
  return new Date(createdAt).toLocaleDateString();
}

function buildDistribution(reviews: { rating: number }[]): Record<1 | 2 | 3 | 4 | 5, number> {
  const counts: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  reviews.forEach((r) => {
    const star = Math.min(5, Math.max(1, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
    counts[star] = (counts[star] ?? 0) + 1;
  });
  const total = reviews.length || 1;
  return {
    1: (counts[1] ?? 0) / total,
    2: (counts[2] ?? 0) / total,
    3: (counts[3] ?? 0) / total,
    4: (counts[4] ?? 0) / total,
    5: (counts[5] ?? 0) / total,
  };
}

interface MechanicReviewsSectionProps {
  mechanicId: string;
}

export function MechanicReviewsSection({ mechanicId }: MechanicReviewsSectionProps) {
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);
  const mechanic = useMemo(() => getMechanicById(mechanicId), [mechanicId, getMechanicById]);

  const convexReviews = useQuery(
    api.reviews.getByMechanicId,
    mechanicId ? { mechanicId: mechanicId as Id<"mechanics"> } : "skip",
  );

  const { reviews, rating, ratingCount, distribution } = useMemo(() => {
    if (!convexReviews || !Array.isArray(convexReviews)) {
      return {
        reviews: [] as Review[],
        rating: mechanic?.rating ?? 0,
        ratingCount: 0,
        distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>,
      };
    }
    const mapped: Review[] = convexReviews.map((r) => {
      const u = r.user as { first_name?: string; last_name?: string } | null;
      const userName = u ? [u.first_name, u.last_name].filter(Boolean).join(" ").trim() || "Customer" : "Customer";
      return {
        id: r._id,
        userName,
        avatarUrl: null,
        rating: r.rating,
        timeAgo: formatTimeAgo(r.created_at),
        text: r.comment,
      };
    });
    const avg = mapped.length ? mapped.reduce((s, x) => s + x.rating, 0) / mapped.length : (mechanic?.rating ?? 0);
    const dist = buildDistribution(convexReviews);
    return { reviews: mapped, rating: avg, ratingCount: mapped.length, distribution: dist };
  }, [convexReviews, mechanic]);

  if (!mechanic) {
    return (
      <View style={styles.emptyContainer}>
        <Text size="md" weight="medium" color="#9CA3AF" center>
          Mechanic not found
        </Text>
      </View>
    );
  }

  if (convexReviews === undefined) {
    return (
      <View style={styles.emptyContainer}>
        <Text size="md" weight="medium" color="#9CA3AF" center>
          Loading reviews…
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <RatingSummaryCard rating={rating} ratingCount={ratingCount} distribution={distribution} />
      <View style={styles.reviewsHeader}>
        <Text size="lg" weight="bold" color={BrandColors.primary}>
          Customer Reviews ({reviews.length})
        </Text>
      </View>
      {reviews.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text size="md" weight="medium" color="#9CA3AF" center>
            No reviews yet for this mechanic
          </Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.reviewsList}>
            {reviews.map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: { paddingVertical: Spacing.lg },
  reviewsHeader: { marginTop: Spacing.xl, marginBottom: Spacing.lg },
  scroll: { flex: 1 },
  reviewsList: { gap: Spacing.md, paddingBottom: Spacing.xl },
  emptyContainer: { paddingVertical: Spacing.xl, alignItems: "center" },
});
