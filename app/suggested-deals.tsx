/**
 * SuggestedDealsPage
 *
 * PURPOSE: Displays all suggested deals in a vertical scrollable list
 *
 * USED IN: Navigated from Membership page "View all" button
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ReAnimated from "react-native-reanimated";

// 2. Expo & Third-party
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { ArrowLeft, Star } from "lucide-react-native";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

// 3. Shared UI
import { ScrollDrivenGradientBackground, Text } from "@/components/shared-ui";

// 4. Constants
import { Spacing } from "@/constants/theme";

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// ============================================================================
// COMPONENT
// ============================================================================

export default function SuggestedDealsPage() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const allDeals = useQuery(api.rewards.getAllDeals, {});
  const deals = (allDeals ?? []).map((d) => ({
    id: d._id,
    title: d.title,
    description: d.description,
    credit: d.credit_amount,
    price: d.price,
    isSpecial: d.is_special,
  }));

  const handleBack = () => {
    router.back();
  };

  return (
    <ScrollDrivenGradientBackground colors={["#5BA3D9", "#8FC4E8", "#d9e8f5"]}>
      {(scrollHandler) => (
        <View style={styles.container}>
          <ReAnimated.ScrollView
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 },
            ]}
            showsVerticalScrollIndicator={false}
            onScroll={scrollHandler}
            scrollEventThrottle={16}
          >
            {/* Header */}
            <View style={styles.header}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
                hitSlop={12}
              >
                <ArrowLeft size={24} color="#1F2937" strokeWidth={2} />
              </Pressable>
              <Text weight="bold" size="xl" color="#1F2937">
                Suggested Deals
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            {deals.map((deal) => (
              <View key={deal.id} style={styles.dealCard}>
                {/* Image Placeholder */}
                <View style={styles.dealImageContainer}>
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
          </ReAnimated.ScrollView>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  dealCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  dealImageContainer: {
    width: "100%",
    height: 140,
    position: "relative",
  },
  dealImagePlaceholder: {
    width: "100%",
    height: "100%",
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
  },
  dealContent: {
    padding: Spacing.md,
  },
  dealDescription: {
    marginTop: 4,
    marginBottom: Spacing.sm,
  },
  dealBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
});
