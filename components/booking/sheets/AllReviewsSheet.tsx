/**
 * AllReviewsSheet
 *
 * PURPOSE: Full view of all customer reviews for a mechanic
 *          Shows rating summary, filter options, and scrollable list of reviews
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { MoreVertical, Star, ThumbsUp, User, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import { useMechanicStore } from "@/stores/useMechanicStore";

// ============================================================================
// TYPES
// ============================================================================

export interface AllReviewsSheetRef {
  open: (mechanicId: string) => void;
  close: () => void;
}

interface AllReviewsSheetProps {
  /** Called when sheet is closed */
  onClose?: () => void;
}

interface Review {
  id: string;
  userName: string;
  avatarUrl: string | null;
  rating: number;
  timeAgo: string;
  text: string;
  helpful?: number;
  isVerified?: boolean;
}

type FilterOption = "all" | "5" | "4" | "3" | "2" | "1";

// ============================================================================
// MOCK DATA
// ============================================================================

const mockAllReviews: Review[] = [
  {
    id: "1",
    userName: "Mathew L.",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    timeAgo: "2 Mins Ago",
    text: "Consequat velit qui adipisicing sunt do rependerit ad laborum tempor ullamco exercitation. Ullamco tempor adipisicing et voluptate duis sit esse aliqua. Absolutely fantastic service and the mechanic was super professional!",
    helpful: 12,
    isVerified: true,
  },
  {
    id: "2",
    userName: "Curt K.",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    rating: 4,
    timeAgo: "1 Hour Ago",
    text: "Consequat velit qui adipisicing sunt do rependerit ad laborum tempor ullamco. Great experience overall, would definitely recommend.",
    helpful: 8,
    isVerified: true,
  },
  {
    id: "3",
    userName: "Ramy J.",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    timeAgo: "2 Hours Ago",
    text: "Ullamco tempor adipisicing et voluptate duis sit esse aliqua esse ex. The best mechanic I've ever worked with!",
    helpful: 5,
    isVerified: false,
  },
  {
    id: "4",
    userName: "Sarah M.",
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    timeAgo: "Yesterday",
    text: "Outstanding service! Fixed my car quickly and at a fair price. The shop was clean and the staff was very friendly. Highly recommend!",
    helpful: 15,
    isVerified: true,
  },
  {
    id: "5",
    userName: "James T.",
    avatarUrl: "https://images.unsplash.com/photo-1599566150163-29194dcabd36?w=100&h=100&fit=crop&crop=face",
    rating: 4,
    timeAgo: "2 Days Ago",
    text: "Very professional and knowledgeable. They explained everything clearly before starting the work. Only minor delay in service.",
    helpful: 3,
    isVerified: false,
  },
  {
    id: "6",
    userName: "Emily R.",
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop&crop=face",
    rating: 3,
    timeAgo: "3 Days Ago",
    text: "Decent service but had to wait longer than expected. The quality of work was good though.",
    helpful: 2,
    isVerified: true,
  },
  {
    id: "7",
    userName: "Michael B.",
    avatarUrl: null,
    rating: 5,
    timeAgo: "1 Week Ago",
    text: "Absolutely phenomenal! They went above and beyond to fix my car. Will definitely be coming back for all my car needs.",
    helpful: 20,
    isVerified: true,
  },
  {
    id: "8",
    userName: "Lisa W.",
    avatarUrl: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop&crop=face",
    rating: 4,
    timeAgo: "1 Week Ago",
    text: "Great communication and fair pricing. The mechanic was very thorough in explaining what needed to be done.",
    helpful: 7,
    isVerified: false,
  },
];

// Rating distribution percentages
const ratingDistribution = {
  5: 0.85,
  4: 0.65,
  3: 0.45,
  2: 0.15,
  1: 0.05,
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/** Star rating display component */
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <View style={styles.starRatingContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          color={star <= rating ? BrandColors.secondary : "#E5E7EB"}
          fill={star <= rating ? BrandColors.secondary : "transparent"}
        />
      ))}
    </View>
  );
}

/** Rating distribution bar */
function RatingBar({ stars, percentage, count }: { stars: number; percentage: number; count: number }) {
  return (
    <View style={styles.ratingBarRow}>
      <Text size="xs" weight="medium" color="#6B7280" style={styles.ratingBarLabel}>
        {stars}
      </Text>
      <Star size={10} color={BrandColors.secondary} fill={BrandColors.secondary} />
      <View style={styles.ratingBarTrack}>
        <View style={[styles.ratingBarFill, { width: `${percentage * 100}%` }]} />
      </View>
      <Text size="xs" weight="medium" color="#9CA3AF" style={styles.ratingBarCount}>
        {count}
      </Text>
    </View>
  );
}

/** Filter chip component */
function FilterChip({ label, isSelected, onPress }: { label: string; isSelected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.filterChip, isSelected && styles.filterChipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {label !== "All" && (
        <Star
          size={12}
          color={isSelected ? BrandColors.secondary : "#6B7280"}
          fill={isSelected ? BrandColors.secondary : "transparent"}
        />
      )}
      <Text size="sm" weight={isSelected ? "bold" : "medium"} color={isSelected ? BrandColors.secondary : "#6B7280"}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

/** Individual review card with enhanced details */
function ReviewCard({ review }: { review: Review }) {
  return (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewAvatarContainer}>
          {review.avatarUrl ? (
            <Image source={{ uri: review.avatarUrl }} style={styles.reviewAvatar} />
          ) : (
            <View style={styles.reviewAvatarPlaceholder}>
              <User size={20} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          )}
        </View>
        <View style={styles.reviewHeaderInfo}>
          <View style={styles.reviewNameRow}>
            <Text size="sm" weight="bold" color={BrandColors.primary}>
              {review.userName}
            </Text>
            {review.isVerified && (
              <View style={styles.verifiedBadge}>
                <Text size="xs" weight="medium" color="#10B981">
                  Verified
                </Text>
              </View>
            )}
          </View>
          <View style={styles.reviewRatingRow}>
            <StarRating rating={review.rating} size={12} />
            <Text size="xs" weight="regular" color="#9CA3AF">
              {review.timeAgo}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.reviewMenuButton} activeOpacity={0.7}>
          <MoreVertical size={18} color="#9CA3AF" />
        </TouchableOpacity>
      </View>
      <Text size="sm" weight="regular" color="#6B7280" style={styles.reviewText}>
        {review.text}
      </Text>
      {review.helpful !== undefined && review.helpful > 0 && (
        <View style={styles.helpfulRow}>
          <ThumbsUp size={14} color="#9CA3AF" />
          <Text size="xs" weight="medium" color="#9CA3AF">
            {review.helpful} people found this helpful
          </Text>
        </View>
      )}
    </View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const AllReviewsSheet = forwardRef<AllReviewsSheetRef, AllReviewsSheetProps>(function AllReviewsSheet(
  { onClose },
  ref
) {
  // ═══════════════ REFS ═══════════════
  const bottomSheetModalRef = useRef<BottomSheetModal>(null);

  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

  // ═══════════════ STORES ═══════════════
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // ═══════════════ LOCAL STATE ═══════════════
  const [mechanicId, setMechanicId] = useState<number | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<FilterOption>("all");

  // ═══════════════ SNAP POINTS ═══════════════
  const snapPoints = useMemo(() => ["92%"], []);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const mechanic = useMemo(() => {
    if (!mechanicId) return null;
    return getMechanicById(mechanicId);
  }, [mechanicId, getMechanicById]);

  const ratingCount = mechanic ? Math.floor(mechanic.rating * 25 + 27) : 0;

  // Filtered reviews based on selected filter
  const filteredReviews = useMemo(() => {
    if (selectedFilter === "all") return mockAllReviews;
    const filterRating = parseInt(selectedFilter, 10);
    return mockAllReviews.filter((review) => review.rating === filterRating);
  }, [selectedFilter]);

  // Count reviews by rating
  const reviewCounts = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    mockAllReviews.forEach((review) => {
      counts[review.rating as keyof typeof counts]++;
    });
    return counts;
  }, []);

  // ═══════════════ IMPERATIVE HANDLE ═══════════════
  useImperativeHandle(ref, () => ({
    open: (id: number) => {
      setMechanicId(id);
      setSelectedFilter("all");
      bottomSheetModalRef.current?.present();
    },
    close: () => {
      bottomSheetModalRef.current?.dismiss();
    },
  }));

  // ═══════════════ HANDLERS ═══════════════
  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose?.();
      }
    },
    [onClose]
  );

  const handleClose = useCallback(() => {
    bottomSheetModalRef.current?.dismiss();
  }, []);

  const handleFilterPress = useCallback((filter: FilterOption) => {
    setSelectedFilter(filter);
  }, []);

  // ═══════════════ RENDER HELPERS ═══════════════
  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    []
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <BottomSheetModal
      ref={bottomSheetModalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      enableDynamicSizing={false}
      backdropComponent={renderBackdrop}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleContainer}
      onChange={handleSheetChange}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text size="xl" weight="bold" color={BrandColors.primary}>
            Customer Reviews
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={handleClose} activeOpacity={0.7}>
            <X size={20} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <BottomSheetScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
        >
          {/* Rating Summary Card */}
          {mechanic && (
            <View style={styles.ratingSummaryCard}>
              {/* Rating Distribution Bars */}
              <View style={styles.ratingDistributionContainer}>
                {[5, 4, 3, 2, 1].map((stars) => (
                  <RatingBar
                    key={stars}
                    stars={stars}
                    percentage={ratingDistribution[stars as keyof typeof ratingDistribution]}
                    count={reviewCounts[stars as keyof typeof reviewCounts]}
                  />
                ))}
              </View>

              {/* Overall Rating */}
              <View style={styles.overallRatingContainer}>
                <Text size="3xl" weight="bold" color={BrandColors.primary}>
                  {mechanic.rating.toFixed(1)}
                </Text>
                <StarRating rating={Math.round(mechanic.rating)} size={16} />
                <Text size="xs" weight="regular" color="#9CA3AF">
                  {ratingCount} Reviews
                </Text>
              </View>
            </View>
          )}

          {/* Filter Section */}
          <View style={styles.filterSection}>
            <Text size="sm" weight="semiBold" color="#6B7280">
              Filter by Rating
            </Text>
            <View style={styles.filterRow}>
              <FilterChip label="All" isSelected={selectedFilter === "all"} onPress={() => handleFilterPress("all")} />
              {[5, 4, 3, 2, 1].map((rating) => (
                <FilterChip
                  key={rating}
                  label={rating.toString()}
                  isSelected={selectedFilter === rating.toString()}
                  onPress={() => handleFilterPress(rating.toString() as FilterOption)}
                />
              ))}
            </View>
          </View>

          {/* Reviews Count */}
          <View style={styles.reviewsHeader}>
            <Text size="md" weight="bold" color={BrandColors.primary}>
              {filteredReviews.length} {filteredReviews.length === 1 ? "Review" : "Reviews"}
            </Text>
          </View>

          {/* Review Cards */}
          {filteredReviews.length > 0 ? (
            filteredReviews.map((review) => <ReviewCard key={review.id} review={review} />)
          ) : (
            <View style={styles.emptyState}>
              <Star size={48} color="#E5E7EB" />
              <Text size="md" weight="medium" color="#9CA3AF" center style={{ marginTop: Spacing.md }}>
                No reviews found for this rating
              </Text>
            </View>
          )}
        </BottomSheetScrollView>
      </View>
    </BottomSheetModal>
  );
});

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  bottomSheetBackground: {
    backgroundColor: BrandColors.white,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    ...Shadows.lg,
  },
  handleContainer: {
    paddingVertical: Spacing.sm,
  },
  handleIndicator: {
    backgroundColor: "#E5E7EB",
    width: 36,
    height: 4,
    borderRadius: BorderRadius.full,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.full,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },

  // Rating Summary Card
  ratingSummaryCard: {
    flexDirection: "row",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  ratingDistributionContainer: {
    flex: 1,
    gap: 6,
  },
  ratingBarRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingBarLabel: {
    width: 12,
    textAlign: "right",
  },
  ratingBarTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: BorderRadius.full,
    overflow: "hidden",
  },
  ratingBarFill: {
    height: "100%",
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.full,
  },
  ratingBarCount: {
    width: 20,
    textAlign: "right",
  },
  overallRatingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingLeft: Spacing.lg,
    minWidth: 90,
  },
  starRatingContainer: {
    flexDirection: "row",
    gap: 2,
    marginVertical: 4,
  },

  // Filter Section
  filterSection: {
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: "transparent",
    gap: 4,
  },
  filterChipSelected: {
    backgroundColor: "#EFF6FF",
    borderColor: BrandColors.secondary,
  },

  // Reviews Header
  reviewsHeader: {
    marginBottom: Spacing.md,
  },

  // Review Card
  reviewCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: "#F3F4F6",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  reviewAvatarContainer: {
    marginRight: Spacing.sm,
  },
  reviewAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
  },
  reviewAvatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewHeaderInfo: {
    flex: 1,
  },
  reviewNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  verifiedBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  reviewRatingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: 2,
  },
  reviewMenuButton: {
    padding: 4,
  },
  reviewText: {
    lineHeight: 20,
  },
  helpfulRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
  },

  // Empty State
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["3xl"],
  },
});




