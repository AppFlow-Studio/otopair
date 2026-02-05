/**
 * ShopStaffSection
 *
 * PURPOSE: Displays all mechanics/staff members at a shop in a beautifully
 *          styled grid/list layout
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id].tsx (Staff tab)
 *
 * PROPS:
 *   - shopId (number): The shop ID to get staff for
 *
 * EXAMPLE:
 *   <ShopStaffSection shopId={shop.id} />
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

// 2. Third-party libraries
import { BadgeCheck, Star, User } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius } from "@/constants/theme";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

interface ShopStaffSectionProps {
  /** The shop ID to get staff for (Convex _id as string) */
  shopId: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ShopStaffSection({ shopId }: ShopStaffSectionProps) {
  // ═══════════════ STORES ═══════════════
  const getMechanicsByShopId = useMechanicStore((state) => state.getMechanicsByShopId);
  const availableServices = useBookingStore((state) => state.availableServices);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const mechanics = useMemo(() => getMechanicsByShopId(shopId), [shopId, getMechanicsByShopId]);

  // Map specialty IDs to service names for each mechanic
  const mechanicsWithSpecialties = useMemo(() => {
    const serviceMap = new Map<string, string>();
    availableServices.forEach((service) => {
      serviceMap.set(service.id, service.name);
    });

    return mechanics.map((mechanic) => {
      const specialtyNames = mechanic.specialties
        .map((specialtyId) => serviceMap.get(specialtyId))
        .filter((name): name is string => !!name);

      return {
        ...mechanic,
        specialtyNames,
      };
    });
  }, [mechanics, availableServices]);

  // ═══════════════ RENDER ═══════════════
  if (mechanics.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text size="md" weight="medium" color="#9CA3AF" center>
          No staff members available
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text size="lg" weight="bold" color={BrandColors.primary}>
          Our Team ({mechanics.length})
        </Text>
      </View>

      <View style={styles.staffList}>
        {mechanicsWithSpecialties.map((mechanic) => (
          <View key={mechanic.id} style={styles.staffCard}>
            {/* Avatar */}
            <View style={styles.avatarContainer}>
              {mechanic.photoUrl ? (
                <Image source={{ uri: mechanic.photoUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <User size={32} color="#9CA3AF" strokeWidth={1.5} />
                </View>
              )}
              {mechanic.isAvailable && <View style={styles.availableIndicator} />}
            </View>

            {/* Info */}
            <View style={styles.infoContainer}>
              <View style={styles.nameRow}>
                <Text size="md" weight="bold" color={BrandColors.primary}>
                  {mechanic.name}
                </Text>
                {mechanic.isVerified && <BadgeCheck size={18} color="#10B981" style={styles.verifiedIcon} />}
              </View>

              {/* Rating */}
              <View style={styles.ratingRow}>
                <Star size={14} color={BrandColors.secondary} fill={BrandColors.secondary} />
                <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                  {mechanic.rating.toFixed(1)}
                </Text>
                <Text size="xs" weight="regular" color="#6B7280">
                  ({mechanic.reviewCount ?? 0} reviews)
                </Text>
              </View>

              {/* Experience */}
              <View style={styles.experienceRow}>
                <Text size="xs" weight="medium" color="#6B7280">
                  {mechanic.yearsExperience}+ years experience
                </Text>
              </View>

              {/* Specialties */}
              {mechanic.specialtyNames.length > 0 && (
                <View style={styles.specialtiesContainer}>
                  {mechanic.specialtyNames.slice(0, 2).map((specialty, index) => (
                    <View key={index} style={styles.specialtyTag}>
                      <Text size="xs" weight="medium" color={BrandColors.primary}>
                        {specialty}
                      </Text>
                    </View>
                  ))}
                  {mechanic.specialtyNames.length > 2 && (
                    <Text size="xs" weight="medium" color="#6B7280">
                      +{mechanic.specialtyNames.length - 2} more
                    </Text>
                  )}
                </View>
              )}

              {/* Availability Status */}
              <View style={styles.statusRow}>
                {mechanic.isAvailable ? (
                  <View style={styles.availableStatus}>
                    <View style={styles.availableDot} />
                    <Text size="xs" weight="medium" color="#10B981">
                      Available Now
                    </Text>
                  </View>
                ) : (
                  <View style={styles.unavailableStatus}>
                    <Text size="xs" weight="medium" color="#6B7280">
                      Currently Unavailable
                    </Text>
                  </View>
                )}
                <Text size="xs" weight="medium" color="#6B7280">
                  {mechanic.responseTime} Response
                </Text>
              </View>
            </View>
          </View>
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
  header: {
    marginBottom: Spacing.lg,
  },
  staffList: {
    gap: Spacing.lg,
  },
  staffCard: {
    flexDirection: "row",
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  avatarContainer: {
    marginRight: Spacing.md,
    position: "relative",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  availableIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
    borderWidth: 2,
    borderColor: BrandColors.white,
  },
  infoContainer: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.xs,
    gap: Spacing.xs,
  },
  verifiedIcon: {
    marginLeft: Spacing.xs,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.xs,
  },
  experienceRow: {
    marginBottom: Spacing.sm,
  },
  specialtiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  specialtyTag: {
    backgroundColor: "#F0F7FF",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: BrandColors.secondary + "30",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing.xs,
  },
  availableStatus: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  availableDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.full,
    backgroundColor: "#10B981",
  },
  unavailableStatus: {
    flexDirection: "row",
    alignItems: "center",
  },
  emptyContainer: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});
