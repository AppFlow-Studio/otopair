/**
 * SearchSuggestions
 *
 * PURPOSE: Dropdown suggestions that appear below SearchBar when typing.
 *          Shows matching shops (primary) and top 3 services.
 *          Uses same strategy as HomeSearchOverlay.
 *
 * USED IN: TopBar (discovery mode when search query is active)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useMemo } from "react";
import { Keyboard, Pressable, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { Clock, MapPin, Star, User, Wrench, X } from "lucide-react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import type { ServiceCategory, Shop } from "@/stores/types/store.types";
import { useRecentlyBookedMechanicIdsFromConvex } from "@/hooks/useRecentlyBookedMechanicIdsFromConvex";
import { useRecentlyBookedShopIdsFromConvex } from "@/hooks/useRecentlyBookedShopIdsFromConvex";
import { useSmartPricing } from "@/hooks/useSmartPricing";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useSearchStore, type SearchSuggestion } from "@/stores/useSearchStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// ============================================================================
// TYPES
// ============================================================================

export interface SearchSuggestionsProps {
  /** Current search query */
  query: string;
  /** Called when a shop is selected */
  onSelectShop?: (shopId: number) => void;
  /** Called when a mechanic is selected */
  onSelectMechanic?: (mechanicId: string) => void;
  /** Called when a service is selected */
  onSelectService?: (serviceId: string) => void;
  /** Called when a category is selected */
  onSelectCategory?: (category: ServiceCategory) => void;
  /** Called after any selection (to clear search, etc.) */
  onSelectionMade?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SearchSuggestions({
  query,
  onSelectShop,
  onSelectMechanic,
  onSelectService,
  onSelectCategory,
  onSelectionMade,
}: SearchSuggestionsProps) {
  // ═══════════════ STORES ═══════════════
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedVehicle = useVehicleStore((state) => state.getSelectedVehicle());
  const allServiceIds = useMemo(() => availableServices.map((s) => s.id), [availableServices]);
  const smartPricing = useSmartPricing(selectedVehicle?.engineId, allServiceIds);
  const getSearchSuggestions = useSearchStore((state) => state.getSearchSuggestions);
  const getRecentShopIds = useSearchStore((state) => state.getRecentShopIds);
  const removeRecentShop = useSearchStore((state) => state.removeRecentShop);
  const shops = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const getShopById = useShopStore((state) => state.getShopById);
  const mechanics = useMechanicStore((state) => state.mechanics);
  const mechanicIds = useMechanicStore((state) => state.mechanicIds);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);
  const { recentlyBookedShopIds } = useRecentlyBookedShopIdsFromConvex(5);
  const { recentlyBookedMechanicIds } = useRecentlyBookedMechanicIdsFromConvex(5);

  // ═══════════════ COMPUTED VALUES ═══════════════
  // Get all shops as array
  const allShops = useMemo(() => {
    return shopIds.map((id) => shops[id]).filter(Boolean);
  }, [shops, shopIds]);

  // Get all mechanics as array
  const allMechanics = useMemo(() => {
    return mechanicIds.map((id) => mechanics[id]).filter(Boolean);
  }, [mechanics, mechanicIds]);

  // Recent shop IDs (recently booked from Convex first, then in-memory recent)
  const recentShopIds = useMemo(() => getRecentShopIds(), [getRecentShopIds]);
  const recentShopIdsForDisplay = useMemo(() => {
    const inMemory = recentShopIds.filter((id) => !recentlyBookedShopIds.includes(id));
    return [...recentlyBookedShopIds, ...inMemory].slice(0, 5);
  }, [recentlyBookedShopIds, recentShopIds]);

  // Recent shops (recently booked from Convex first, then in-memory recent)
  const recentShops = useMemo(() => {
    return recentShopIdsForDisplay
      .map((id) => getShopById(id))
      .filter((shop): shop is NonNullable<typeof shop> => shop !== undefined);
  }, [recentShopIdsForDisplay, getShopById]);

  // Recent mechanics (from Convex booking history)
  const recentMechanics = useMemo(() => {
    return recentlyBookedMechanicIds
      .map((id) => getMechanicById(id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined);
  }, [recentlyBookedMechanicIds, getMechanicById]);

  // Service suggestions (top 1 only for card display)
  const serviceSuggestion = useMemo(() => {
    if (!query.trim()) return null;
    const suggestions = getSearchSuggestions(query, availableServices);
    // Only return service type, not category
    const serviceOnly = suggestions.find((s) => s.type === "service");
    return serviceOnly || null;
  }, [query, getSearchSuggestions, availableServices]);

  // Combined shop and mechanic results - sorted by score, take top 3
  const topMatches = useMemo(() => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase().trim();

    // Score shops
    const shopScores = allShops.map((shop) => {
      const nameLower = shop.name.toLowerCase();
      const addressLower = shop.address.toLowerCase();

      let score = 0;
      if (nameLower === lowerQuery) score = 100;
      else if (nameLower.startsWith(lowerQuery)) score = 80;
      else if (nameLower.includes(lowerQuery)) score = 60;
      else if (addressLower.includes(lowerQuery)) score = 40;

      return { type: "shop" as const, data: shop, score };
    });

    // Score mechanics
    const mechanicScores = allMechanics.map((mechanic) => {
      const nameLower = mechanic.name.toLowerCase();
      const shopNameLower = mechanic.shopName.toLowerCase();

      let score = 0;
      if (nameLower === lowerQuery) score = 100;
      else if (nameLower.startsWith(lowerQuery)) score = 80;
      else if (nameLower.includes(lowerQuery)) score = 60;
      else if (shopNameLower.includes(lowerQuery)) score = 40;

      return { type: "mechanic" as const, data: mechanic, score };
    });

    // Combine, filter, sort, take top 3
    return [...shopScores, ...mechanicScores]
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [allShops, allMechanics, query]);

  // Recently booked shops and mechanics (show even while searching)
  const filteredRecentShops = useMemo(() => recentShops.slice(0, 3), [recentShops]);
  const filteredRecentMechanics = useMemo(() => recentMechanics.slice(0, 3), [recentMechanics]);
  const hasRecentlyBooked = filteredRecentShops.length > 0 || filteredRecentMechanics.length > 0;

  // ═══════════════ HANDLERS ═══════════════
  const handleShopPress = useCallback(
    (shopId: number) => {
      onSelectShop?.(shopId);
      onSelectionMade?.();
    },
    [onSelectShop, onSelectionMade],
  );

  const handleMechanicPress = useCallback(
    (mechanicId: string) => {
      onSelectMechanic?.(mechanicId);
      onSelectionMade?.();
    },
    [onSelectMechanic, onSelectionMade],
  );

  const handleSuggestionPress = useCallback(
    (suggestion: SearchSuggestion) => {
      if (suggestion.type === "service") {
        onSelectService?.(suggestion.service.id);
      } else {
        onSelectCategory?.(suggestion.category);
      }
      onSelectionMade?.();
    },
    [onSelectService, onSelectCategory, onSelectionMade],
  );

  const handleRemoveRecentShop = useCallback(
    (shopId: number) => {
      removeRecentShop(shopId);
    },
    [removeRecentShop],
  );

  const handleDismiss = useCallback(() => {
    Keyboard.dismiss();
    onSelectionMade?.();
  }, [onSelectionMade]);

  // ═══════════════ RENDER ═══════════════
  const hasSearchResults = topMatches.length > 0 || serviceSuggestion !== null;
  const hasQuery = query.trim().length > 0;
  const hasContent = hasSearchResults || hasRecentlyBooked || hasQuery;

  if (!hasContent) return null;

  return (
    <>
      {/* Backdrop to dismiss when tapping outside */}
      <Pressable style={styles.backdrop} onPress={handleDismiss} />
      <Animated.View style={styles.container} entering={FadeIn.duration(150)} exiting={FadeOut.duration(100)}>
        <View style={styles.suggestionsContent}>
          {/* Service Suggestion Card (1 card at top) */}
          {serviceSuggestion && serviceSuggestion.type === "service" && (
            <TouchableOpacity
              style={styles.serviceCard}
              onPress={() => handleSuggestionPress(serviceSuggestion)}
              activeOpacity={0.7}
            >
              <View style={styles.serviceCardIcon}>
                <Wrench size={20} color={BrandColors.secondary} />
              </View>
              <View style={styles.serviceCardContent}>
                <Text size="md" weight="bold" color={BrandColors.primary}>
                  {serviceSuggestion.service.name}
                </Text>
                <Text size="xs" color="#6B7280" numberOfLines={1}>
                  {serviceSuggestion.service.description}
                </Text>
              </View>
              {(() => {
                const sp = smartPricing[serviceSuggestion.service.id];
                if (sp?.hasEngineData && sp.result.tier !== "contact") {
                  return (
                    <View style={{ alignItems: "flex-end" }}>
                      <Text size="lg" weight="bold" color={BrandColors.secondary}>
                        {sp.formatted}
                      </Text>
                      <Text size="xs" weight="medium" color="#9CA3AF">
                        {sp.result.label}
                      </Text>
                    </View>
                  );
                }
                if (sp?.hasEngineData && sp.result.tier === "contact") {
                  return (
                    <Text size="xs" weight="medium" color="#9CA3AF">
                      Contact for Quote
                    </Text>
                  );
                }
                return (
                  <Text size="lg" weight="bold" color={BrandColors.secondary}>
                    ${serviceSuggestion.service.price}
                  </Text>
                );
              })()}
            </TouchableOpacity>
          )}

          {/* Top 3 Matches (shops/mechanics in card style) */}
          {topMatches.length > 0 && (
            <View style={styles.matchesSection}>
              <Text size="xs" weight="bold" color="#9CA3AF" style={styles.sectionLabel}>
                TOP MATCHES
              </Text>
              {topMatches.map((match, index) => {
                if (match.type === "shop") {
                  const shop = match.data;
                  return (
                    <TouchableOpacity
                      key={`match-shop-${shop.id}`}
                      style={styles.matchCard}
                      onPress={() => handleShopPress(shop.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.matchIcon}>
                        <MapPin size={18} color={BrandColors.secondary} />
                      </View>
                      <View style={styles.matchContent}>
                        <View style={styles.matchHeader}>
                          <Text
                            size="sm"
                            weight="semiBold"
                            color={BrandColors.primary}
                            numberOfLines={1}
                            style={styles.matchName}
                          >
                            {shop.name}
                          </Text>
                          {shop.rating && (
                            <View style={styles.ratingBadge}>
                              <Star size={12} color="#F5C254" fill="#F5C254" />
                              <Text size="xs" weight="semiBold" color={BrandColors.primary}>
                                {shop.rating.toFixed(1)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text size="xs" color="#6B7280" numberOfLines={1}>
                          {shop.address}
                        </Text>
                      </View>
                      {shop.hasAvailableSlots && (
                        <View style={styles.availableBadge}>
                          <Text size="xs" weight="semiBold" color="#22C55E">
                            Open
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                } else {
                  const mechanic = match.data;
                  return (
                    <TouchableOpacity
                      key={`match-mech-${mechanic.id}`}
                      style={styles.matchCard}
                      onPress={() => handleMechanicPress(mechanic.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.mechanicIcon}>
                        <User size={18} color={BrandColors.secondary} />
                      </View>
                      <View style={styles.matchContent}>
                        <View style={styles.matchHeader}>
                          <Text
                            size="sm"
                            weight="semiBold"
                            color={BrandColors.primary}
                            numberOfLines={1}
                            style={styles.matchName}
                          >
                            {mechanic.name}
                          </Text>
                          {mechanic.rating && (
                            <View style={styles.ratingBadge}>
                              <Star size={12} color="#F5C254" fill="#F5C254" />
                              <Text size="xs" weight="semiBold" color={BrandColors.primary}>
                                {mechanic.rating.toFixed(1)}
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text size="xs" color="#6B7280" numberOfLines={1}>
                          {mechanic.title ?? mechanic.shopName} • {mechanic.yearsExperience} yrs
                        </Text>
                      </View>
                      {mechanic.isAvailable && (
                        <View style={styles.availableBadge}>
                          <Text size="xs" weight="semiBold" color="#22C55E">
                            Available
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                }
              })}
            </View>
          )}

          {/* Recently booked (shops + mechanics; show even while searching) */}
          {hasRecentlyBooked && (
            <View style={styles.matchesSection}>
              <Text size="xs" weight="bold" color="#9CA3AF" style={styles.sectionLabel}>
                RECENTLY BOOKED
              </Text>
              {filteredRecentShops.map((shop) => (
                <TouchableOpacity
                  key={`recent-shop-${shop.id}`}
                  style={styles.matchCard}
                  onPress={() => handleShopPress(shop.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recentIcon}>
                    <MapPin size={18} color={BrandColors.secondary} />
                  </View>
                  <View style={styles.matchContent}>
                    <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                      {shop.name}
                    </Text>
                    <Text size="xs" color="#6B7280" numberOfLines={1}>
                      {shop.address}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveRecentShop(shop.id)}
                    style={styles.removeButton}
                    hitSlop={8}
                  >
                    <X size={14} color="#9CA3AF" />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
              {filteredRecentMechanics.map((mechanic) => (
                <TouchableOpacity
                  key={`recent-mech-${mechanic.id}`}
                  style={styles.matchCard}
                  onPress={() => handleMechanicPress(mechanic.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recentIcon}>
                    <User size={18} color={BrandColors.secondary} />
                  </View>
                  <View style={styles.matchContent}>
                    <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                      {mechanic.name}
                    </Text>
                    <Text size="xs" color="#6B7280" numberOfLines={1}>
                      {mechanic.shopName}
                      {mechanic.title ? ` • ${mechanic.title}` : ""}
                    </Text>
                  </View>
                  {mechanic.isAvailable && (
                    <View style={styles.availableBadge}>
                      <Text size="xs" weight="semiBold" color="#22C55E">
                        Available
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* No Results */}
          {query.trim() && !hasSearchResults && (
            <View style={styles.emptyState}>
              <Text size="sm" weight="medium" color="#9CA3AF" center>
                No results for "{query}"
              </Text>
            </View>
          )}
        </View>
      </Animated.View>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: -1000,
    right: -1000,
    bottom: -2000,
    zIndex: -1,
  },
  container: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    ...Shadows.lg,
  },
  suggestionsContent: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  // Service card (featured at top)
  serviceCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F7FF",
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  serviceCardIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  serviceCardContent: {
    flex: 1,
  },
  // Matches section
  matchesSection: {
    marginBottom: Spacing.sm,
  },
  sectionLabel: {
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
    paddingHorizontal: Spacing.xs,
  },
  matchCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  matchIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E0EDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  mechanicIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  recentIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  matchContent: {
    flex: 1,
  },
  matchHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  matchName: {
    flex: 1,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  availableBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
});
