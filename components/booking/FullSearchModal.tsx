/**
 * FullSearchModal
 *
 * PURPOSE: Search sheet that matches ServiceBottomSheet exactly.
 *          Uses BottomSheet with same snap points and styling for seamless transition.
 *
 * USED IN: app/(booking)/map.tsx
 *
 * PROPS:
 *   - visible (boolean): Whether the modal is visible
 *   - onClose (() => void): Called when modal should close (minimizes to preview)
 *   - offsetY (number): Vertical offset matching ServiceBottomSheet
 *   - onSelectService ((serviceId: string) => void): Called when a service is selected
 *   - onSelectCategory ((category: ServiceCategory) => void): Called when a category is selected
 *   - onSelectShop ((shopId: number) => void): Called when a shop is selected
 *   - onSelectMechanic ((mechanicId: number) => void): Called when a mechanic is selected
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dimensions, Keyboard, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import BottomSheet from "@gorhom/bottom-sheet";
import { Clock, MapPin, Search, Star, User, Wrench, X } from "lucide-react-native";
import Animated, { useAnimatedStyle, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, FontFamily, FontSize, Shadows } from "@/constants/theme";
import type { ServiceCategory } from "@/stores/types/store.types";
import { useRecentlyBookedMechanicIdsFromConvex } from "@/hooks/useRecentlyBookedMechanicIdsFromConvex";
import { useRecentlyBookedShopIdsFromConvex } from "@/hooks/useRecentlyBookedShopIdsFromConvex";
import { useServiceVehicleSpecsForEngine } from "@/hooks/useServiceVehicleSpecsForEngine";
import { formatDurationForCar } from "@/lib/formatDuration";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useSearchStore, type SearchSuggestion } from "@/stores/useSearchStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// ============================================================================
// TYPES
// ============================================================================

export interface FullSearchModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal should close (minimizes to preview stage) */
  onClose: () => void;
  /** Vertical offset to match ServiceBottomSheet */
  offsetY?: number;
  /** Called when a service is selected */
  onSelectService?: (serviceId: string) => void;
  /** Called when a category is selected */
  onSelectCategory?: (category: ServiceCategory) => void;
  /** Called when a shop is selected */
  onSelectShop?: (shopId: number) => void;
  /** Called when a mechanic is selected */
  onSelectMechanic?: (mechanicId: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Same snap points as ServiceBottomSheet: collapsed (23%), preview (38%), mid (55%), expanded (98%)
const SNAP_POINTS_CONFIG = {
  collapsed: 23,
  preview: 38,
  mid: 55,
  expanded: 98,
};

// ============================================================================
// COMPONENT
// ============================================================================

export function FullSearchModal({
  visible,
  onClose,
  offsetY = 0,
  onSelectService,
  onSelectCategory,
  onSelectShop,
  onSelectMechanic,
}: FullSearchModalProps) {
  // ═══════════════ REFS ═══════════════
  const bottomSheetRef = useRef<BottomSheet>(null);
  const inputRef = useRef<TextInput>(null);

  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

  // ═══════════════ ANIMATION VALUES ═══════════════
  const animatedIndex = useSharedValue(3); // Start at expanded

  // ═══════════════ LOCAL STATE ═══════════════
  const [localQuery, setLocalQuery] = useState("");
  // Track if user has typed anything (to detect when they clear the input)
  const [hasTyped, setHasTyped] = useState(false);

  // ═══════════════ STORES ═══════════════
  const availableServices = useBookingStore((state) => state.availableServices);
  const engineId = useVehicleStore((state) => state.getSelectedVehicle()?.engineId);
  const allServiceIds = useMemo(() => availableServices.map((s) => s.id), [availableServices]);
  const engineSpecs = useServiceVehicleSpecsForEngine(engineId, allServiceIds);
  const getRecentShopIds = useSearchStore((state) => state.getRecentShopIds);
  const getSearchSuggestions = useSearchStore((state) => state.getSearchSuggestions);
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
  const recentShopIds = useMemo(() => getRecentShopIds(), [getRecentShopIds]);
  const recentShopIdsForDisplay = useMemo(() => {
    const inMemory = recentShopIds.filter((id) => !recentlyBookedShopIds.includes(id));
    return [...recentlyBookedShopIds, ...inMemory].slice(0, 5);
  }, [recentlyBookedShopIds, recentShopIds]);

  // Calculate snap points with offset (same as ServiceBottomSheet)
  const offsetPercent = (offsetY / SCREEN_HEIGHT) * 100;
  const snapPoints = useMemo(
    () => [
      `${SNAP_POINTS_CONFIG.collapsed - offsetPercent}%`,
      `${SNAP_POINTS_CONFIG.preview - offsetPercent}%`,
      `${SNAP_POINTS_CONFIG.mid - offsetPercent}%`,
      `${SNAP_POINTS_CONFIG.expanded - offsetPercent}%`,
    ],
    [offsetPercent],
  );

  // Get all shops as array
  const allShops = useMemo(() => {
    return shopIds.map((id) => shops[id]).filter(Boolean);
  }, [shops, shopIds]);

  // Get all mechanics as array
  const allMechanics = useMemo(() => {
    return mechanicIds.map((id) => mechanics[id]).filter(Boolean);
  }, [mechanics, mechanicIds]);

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

  // Service suggestions (top 3)
  const serviceSuggestions = useMemo(() => {
    if (!localQuery.trim()) return [];
    return getSearchSuggestions(localQuery, availableServices).slice(0, 3);
  }, [localQuery, getSearchSuggestions, availableServices]);

  // Combined shop and mechanic results - sorted by score
  const topMatches = useMemo(() => {
    if (!localQuery.trim()) return [];
    const lowerQuery = localQuery.toLowerCase().trim();

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

    // Combine, filter, sort, take top 5
    return [...shopScores, ...mechanicScores]
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [allShops, allMechanics, localQuery]);

  // Recently booked shops and mechanics (show even while searching)
  const filteredRecentShops = useMemo(() => recentShops.slice(0, 3), [recentShops]);
  const filteredRecentMechanics = useMemo(() => recentMechanics.slice(0, 3), [recentMechanics]);
  const hasRecentlyBooked = filteredRecentShops.length > 0 || filteredRecentMechanics.length > 0;

  // ═══════════════ HANDLERS ═══════════════
  // X button closes and returns to service sheet immediately
  const handleClose = useCallback(() => {
    Keyboard.dismiss();
    setLocalQuery("");
    setHasTyped(false);
    onClose();
  }, [onClose]);

  // Handle text input change - also track if user has typed
  const handleQueryChange = useCallback((text: string) => {
    setLocalQuery(text);
    if (text.length > 0) {
      setHasTyped(true);
    }
  }, []);

  const handleClear = useCallback(() => {
    setLocalQuery("");
    // This will trigger auto-close via the effect
  }, []);

  // ═══════════════ EFFECTS ═══════════════
  // Focus input when visible and snap to expanded
  useEffect(() => {
    if (visible) {
      // Snap to expanded when opened
      bottomSheetRef.current?.snapToIndex(3);
      // Focus input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [visible]);

  // Reset query and hasTyped when closed
  useEffect(() => {
    if (!visible) {
      setLocalQuery("");
      setHasTyped(false);
    }
  }, [visible]);

  // Auto-close when query becomes empty after user has typed
  useEffect(() => {
    if (visible && hasTyped && localQuery === "") {
      // Small delay to allow for backspace clearing
      const timer = setTimeout(() => {
        handleClose();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [visible, hasTyped, localQuery, handleClose]);

  // ═══════════════ ANIMATED STYLES ═══════════════
  // X button is always visible on search sheet since users can't swipe to dismiss
  const closeButtonAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: 1,
      pointerEvents: "auto" as const,
    };
  });

  const handleSuggestionPress = useCallback(
    (suggestion: SearchSuggestion) => {
      if (suggestion.type === "service") {
        onSelectService?.(suggestion.service.id);
      } else {
        onSelectCategory?.(suggestion.category);
      }
      handleClose();
    },
    [onSelectService, onSelectCategory, handleClose],
  );

  const handleShopPress = useCallback(
    (shopId: number) => {
      onSelectShop?.(shopId);
      handleClose();
    },
    [onSelectShop, handleClose],
  );

  const handleMechanicPress = useCallback(
    (mechanicId: string) => {
      onSelectMechanic?.(mechanicId);
      handleClose();
    },
    [onSelectMechanic, handleClose],
  );

  const handleRemoveRecentShop = useCallback(
    (shopId: number) => {
      removeRecentShop(shopId);
    },
    [removeRecentShop],
  );

  // ═══════════════ RENDER ═══════════════
  if (!visible) return null;

  const hasSearchResults = topMatches.length > 0 || serviceSuggestions.length > 0;

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={3} // Start at expanded
      animatedIndex={animatedIndex}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableOverDrag={false}
      enableContentPanningGesture={false}
      enableHandlePanningGesture={false}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleContainer}
    >
      {/* Header - matches ServiceBottomSheet exactly */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text size="xl" weight="bold" color={BrandColors.primary}>
            Select Services
          </Text>
          {/* X button only visible when fully expanded */}
          <Animated.View style={closeButtonAnimatedStyle}>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color={BrandColors.primary} />
            </TouchableOpacity>
          </Animated.View>
        </View>

        {/* Active search input */}
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search services, shops, mech..."
            placeholderTextColor="#9CA3AF"
            value={localQuery}
            onChangeText={handleQueryChange}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {localQuery.length > 0 && (
            <TouchableOpacity onPress={handleClear} hitSlop={8}>
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Search Results */}
      <View style={styles.resultsContainer}>
        {/* Search Results */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Spacing.xl }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Service Suggestions */}
          {serviceSuggestions.length > 0 && (
            <View style={styles.section}>
              <Text size="xs" weight="bold" color="#9CA3AF" style={styles.sectionLabel}>
                SERVICES
              </Text>
              {serviceSuggestions.map((suggestion, index) => (
                <TouchableOpacity
                  key={`suggestion-${index}`}
                  style={styles.resultCard}
                  onPress={() => handleSuggestionPress(suggestion)}
                  activeOpacity={0.7}
                >
                  <View style={styles.serviceIcon}>
                    <Wrench size={18} color={BrandColors.secondary} />
                  </View>
                  <View style={styles.resultContent}>
                    <View style={styles.serviceTitleRow}>
                      <Text
                        size="md"
                        weight="semiBold"
                        color={BrandColors.primary}
                        style={styles.serviceName}
                        numberOfLines={1}
                      >
                        {suggestion.type === "service" ? suggestion.service.name : suggestion.label}
                      </Text>
                      {suggestion.type === "service" && (() => {
                        const hours =
                          engineSpecs[suggestion.service.id]?.labor_hours ??
                          suggestion.service.default_labor_hours;
                        const durationLabel = formatDurationForCar(hours);
                        if (!durationLabel) return null;
                        return (
                          <Text size="xs" weight="medium" color="#6B7280">
                            Est. Duration {durationLabel}
                          </Text>
                        );
                      })()}
                    </View>
                    {suggestion.type === "service" && (
                      <Text size="sm" color="#6B7280" numberOfLines={1}>
                        {suggestion.service.description}
                      </Text>
                    )}
                    {suggestion.type === "category" && (
                      <Text size="sm" color="#6B7280">
                        Service Category
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Top Matches (shops/mechanics) */}
          {topMatches.length > 0 && (
            <View style={styles.section}>
              <Text size="xs" weight="bold" color="#9CA3AF" style={styles.sectionLabel}>
                TOP MATCHES
              </Text>
              {topMatches.map((match, index) => {
                if (match.type === "shop") {
                  const shop = match.data;
                  return (
                    <TouchableOpacity
                      key={`match-shop-${shop.id}`}
                      style={styles.resultCard}
                      onPress={() => handleShopPress(shop.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.shopIcon}>
                        <MapPin size={18} color={BrandColors.secondary} />
                      </View>
                      <View style={styles.resultContent}>
                        <View style={styles.resultHeader}>
                          <Text
                            size="md"
                            weight="semiBold"
                            color={BrandColors.primary}
                            numberOfLines={1}
                            style={styles.resultName}
                          >
                            {shop.name}
                          </Text>
                          {shop.rating ? (
                            <View style={styles.ratingBadge}>
                              <Star size={12} color="#F5C254" fill="#F5C254" />
                              <Text size="xs" weight="semiBold" color={BrandColors.primary}>
                                {shop.rating.toFixed(1)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text size="sm" color="#6B7280" numberOfLines={1}>
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
                      style={styles.resultCard}
                      onPress={() => handleMechanicPress(mechanic.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.mechanicIcon}>
                        <User size={18} color={BrandColors.secondary} />
                      </View>
                      <View style={styles.resultContent}>
                        <View style={styles.resultHeader}>
                          <Text
                            size="md"
                            weight="semiBold"
                            color={BrandColors.primary}
                            numberOfLines={1}
                            style={styles.resultName}
                          >
                            {mechanic.name}
                          </Text>
                          {mechanic.rating ? (
                            <View style={styles.ratingBadge}>
                              <Star size={12} color="#F5C254" fill="#F5C254" />
                              <Text size="xs" weight="semiBold" color={BrandColors.primary}>
                                {mechanic.rating.toFixed(1)}
                              </Text>
                            </View>
                          ) : null}
                        </View>
                        <Text size="sm" color="#6B7280" numberOfLines={1}>
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
            <View style={styles.section}>
              <Text size="xs" weight="bold" color="#9CA3AF" style={styles.sectionLabel}>
                RECENTLY BOOKED
              </Text>
              {filteredRecentShops.map((shop) => (
                <TouchableOpacity
                  key={`recent-shop-${shop.id}`}
                  style={styles.resultCard}
                  onPress={() => handleShopPress(shop.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recentIcon}>
                    <MapPin size={18} color={BrandColors.secondary} />
                  </View>
                  <View style={styles.resultContent}>
                    <Text size="md" weight="semiBold" color={BrandColors.primary}>
                      {shop.name}
                    </Text>
                    <Text size="sm" color="#6B7280" numberOfLines={1}>
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
                  style={styles.resultCard}
                  onPress={() => handleMechanicPress(mechanic.id)}
                  activeOpacity={0.7}
                >
                  <View style={styles.recentIcon}>
                    <User size={18} color={BrandColors.secondary} />
                  </View>
                  <View style={styles.resultContent}>
                    <Text size="md" weight="semiBold" color={BrandColors.primary}>
                      {mechanic.name}
                    </Text>
                    <Text size="sm" color="#6B7280" numberOfLines={1}>
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

          {/* Empty State */}
          {localQuery.length === 0 && !hasRecentlyBooked && (
            <View style={styles.emptyState}>
              <Text size="md" weight="medium" color="#9CA3AF" center>
                Start typing to search for services, shops, or mechanics
              </Text>
            </View>
          )}

          {/* No Results */}
          {localQuery.length > 0 && !hasSearchResults && (
            <View style={styles.emptyState}>
              <Text size="md" weight="medium" color="#9CA3AF" center>
                No results found for "{localQuery}"
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
    </BottomSheet>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  // Bottom sheet background - matches ServiceBottomSheet exactly
  bottomSheetBackground: {
    backgroundColor: BrandColors.white,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    ...Shadows.lg,
  },
  handleContainer: {
    paddingVertical: Spacing.md,
  },
  handleIndicator: {
    backgroundColor: BrandColors.primary,
    width: 80,
    height: 5,
    borderRadius: BorderRadius.full,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: BrandColors.primary,
    padding: 0,
    margin: 0,
  },
  resultsContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  serviceIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  shopIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E0EDFF",
    alignItems: "center",
    justifyContent: "center",
  },
  mechanicIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E8F5E9",
    alignItems: "center",
    justifyContent: "center",
  },
  recentIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  resultContent: {
    flex: 1,
  },
  serviceTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  serviceName: {
    flex: 1,
  },
  resultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  resultName: {
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
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.lg,
  },
});
