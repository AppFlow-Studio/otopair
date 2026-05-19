/**
 * ShopMechanicsSection
 *
 * PURPOSE: Renders every mechanic at a shop with their per-mechanic
 *          rating + review count. Tapping a mechanic opens a sheet
 *          showing only that mechanic's reviews (queried via
 *          api.reviews.getByMechanicId).
 *
 * USED IN: app/booking/shop/[id]/index.tsx (MECHANICS tab)
 *
 * PROPS:
 *   - shopId: Convex shops _id as string
 */

import React, { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, View } from "react-native";

import { ChevronRight, Star, User } from "lucide-react-native";
import { useQuery } from "convex/react";

import { BrandColors, Spacing, Text } from "@/components/shared-ui";
import { BorderRadius, Shadows } from "@/constants/theme";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useMechanicStore } from "@/stores/useMechanicStore";

import { RatingSummaryCard, type RatingDistribution } from "./shared/RatingSummaryCard";
import { ReviewCard, type Review as SharedReview } from "./shared/ReviewCard";

interface Props {
  shopId: string;
}

const SNAP_HEIGHTS = [640];

export function ShopMechanicsSection({ shopId }: Props) {
  const getMechanicsByShopId = useMechanicStore((s) => s.getMechanicsByShopId);
  const mechanics = useMemo(
    () => getMechanicsByShopId(shopId),
    [shopId, getMechanicsByShopId],
  );

  const [activeMechanicId, setActiveMechanicId] = useState<string | null>(null);
  const sheetRef = React.useRef<FloatingSheetRef>(null);

  const openMechanicReviews = (mechanicId: string) => {
    setActiveMechanicId(mechanicId);
    sheetRef.current?.open();
  };

  if (mechanics.length === 0) {
    return (
      <View style={styles.empty}>
        <Text size="md" weight="medium" color="#9CA3AF" center>
          No mechanics listed for this shop yet.
        </Text>
      </View>
    );
  }

  const activeMechanic = activeMechanicId
    ? mechanics.find((m) => m.id === activeMechanicId)
    : null;

  return (
    <View style={styles.container}>
      <Text size="lg" weight="bold" color={BrandColors.primary} style={styles.heading}>
        Mechanics ({mechanics.length})
      </Text>

      <View style={styles.list}>
        {mechanics.map((m) => (
          <Pressable
            key={m.id}
            onPress={() => openMechanicReviews(m.id)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          >
            <View style={styles.avatarWrap}>
              {m.photoUrl ? (
                <Image source={{ uri: m.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}>
                  <User size={28} color="#9CA3AF" strokeWidth={1.5} />
                </View>
              )}
            </View>

            <View style={styles.cardBody}>
              <Text size="md" weight="semiBold" color={BrandColors.primary}>
                {m.name}
              </Text>
              {m.title ? (
                <Text size="xs" weight="regular" color="#6B7280">
                  {m.title}
                </Text>
              ) : null}
              <View style={styles.ratingRow}>
                <Star
                  size={14}
                  color={BrandColors.secondary}
                  fill={BrandColors.secondary}
                />
                <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                  {(m.rating ?? 0).toFixed(1)}
                </Text>
                <Text size="xs" weight="regular" color="#6B7280">
                  ({m.reviewCount ?? 0} {m.reviewCount === 1 ? "review" : "reviews"})
                </Text>
              </View>
            </View>

            <ChevronRight size={20} color="#9CA3AF" />
          </Pressable>
        ))}
      </View>

      <FloatingSheet ref={sheetRef} snapHeights={SNAP_HEIGHTS} showBackdrop>
        {activeMechanic ? (
          <MechanicReviewsContent mechanic={activeMechanic} />
        ) : null}
      </FloatingSheet>
    </View>
  );
}

interface MechanicReviewsContentProps {
  mechanic: {
    id: string;
    name: string;
    title?: string;
    rating?: number;
    reviewCount?: number;
    photoUrl?: string | null;
  };
}

function MechanicReviewsContent({ mechanic }: MechanicReviewsContentProps) {
  const reviews = useQuery(api.reviews.getByMechanicId, {
    mechanicId: mechanic.id as Id<"mechanics">,
  });

  const distribution = useMemo<RatingDistribution>(() => {
    const dist: RatingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (reviews ?? []).forEach((r: any) => {
      const k = Math.round(r.rating) as 1 | 2 | 3 | 4 | 5;
      if (k >= 1 && k <= 5) dist[k] += 1;
    });
    return dist;
  }, [reviews]);

  const sharedReviews: SharedReview[] = useMemo(() => {
    if (!reviews) return [];
    return reviews.map((r: any) => {
      const user = r.user;
      const fullName = user
        ? [user.first_name, user.last_name].filter(Boolean).join(" ").trim() ||
          user.email ||
          "Customer"
        : "Customer";
      return {
        id: String(r._id),
        userName: fullName,
        avatarUrl: user?.profile_photo_url ?? null,
        rating: r.rating,
        timeAgo: formatTimeAgo(r.created_at),
        text: r.comment,
      };
    });
  }, [reviews]);

  const rating = mechanic.rating ?? 0;
  const ratingCount = mechanic.reviewCount ?? sharedReviews.length;

  return (
    <ScrollView
      contentContainerStyle={styles.sheetContent}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.sheetHeader}>
        <View style={styles.sheetAvatarWrap}>
          {mechanic.photoUrl ? (
            <Image source={{ uri: mechanic.photoUrl }} style={styles.sheetAvatar} />
          ) : (
            <View style={styles.sheetAvatarFallback}>
              <User size={32} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          )}
        </View>
        <Text size="xl" weight="bold" color={BrandColors.primary}>
          {mechanic.name}
        </Text>
        {mechanic.title ? (
          <Text size="sm" weight="regular" color="#6B7280">
            {mechanic.title}
          </Text>
        ) : null}
      </View>

      <RatingSummaryCard
        rating={rating}
        ratingCount={ratingCount}
        distribution={distribution}
      />

      <View style={styles.reviewList}>
        {sharedReviews.length === 0 ? (
          <Text size="sm" weight="medium" color="#9CA3AF" center>
            No reviews yet for {mechanic.name.split(/\s+/)[0]}.
          </Text>
        ) : (
          sharedReviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))
        )}
      </View>
    </ScrollView>
  );
}

function formatTimeAgo(ts: number | undefined): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  const day = 24 * 60 * 60 * 1000;
  const days = Math.floor(diff / day);
  if (days < 1) return "today";
  if (days === 1) return "1 day ago";
  if (days < 7) return `${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "1 week ago";
  if (weeks < 5) return `${weeks} weeks ago`;
  const months = Math.floor(days / 30);
  if (months <= 1) return "1 month ago";
  if (months < 12) return `${months} months ago`;
  const years = Math.floor(days / 365);
  return years === 1 ? "1 year ago" : `${years} years ago`;
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: Spacing.lg,
  },
  heading: {
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  list: {
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.md,
    ...Shadows.sm,
  },
  cardPressed: {
    opacity: 0.85,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarFallback: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  empty: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  sheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xl,
    gap: Spacing.lg,
  },
  sheetHeader: {
    alignItems: "center",
    gap: 6,
  },
  sheetAvatarWrap: {
    marginBottom: Spacing.xs,
  },
  sheetAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  sheetAvatarFallback: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewList: {
    gap: Spacing.md,
  },
});
