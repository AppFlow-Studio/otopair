/**
 * HomeSearchOverlay
 *
 * PURPOSE: Full-screen search overlay that appears when the home search bar is focused.
 *          Shows service suggestions and recently booked shops (Uber-style).
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - visible (boolean): Whether the overlay is visible
 *   - onClose (() => void): Called when overlay should close
 *   - onSelectService ((serviceId: string) => void): Called when a service is selected
 *   - onSelectCategory ((category: ServiceCategory) => void): Called when a category is selected
 *   - onSelectShop ((shopId: number) => void): Called when a shop is selected
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// 2. Expo & Third-party
import { ArrowLeft, Clock, MapPin, Search, Star, Wrench, X } from "lucide-react-native";
import Animated, { FadeIn, FadeOut, SlideInUp, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, FontFamily, FontSize } from "@/constants/theme";
import type { ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useSearchStore, type SearchSuggestion } from "@/stores/useSearchStore";
import { useShopStore } from "@/stores/useShopStore";

// ============================================================================
// TYPES
// ============================================================================

interface HomeSearchOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Called when overlay should close */
  onClose: () => void;
  /** Called when a service is selected */
  onSelectService?: (serviceId: string) => void;
  /** Called when a category is selected */
  onSelectCategory?: (category: ServiceCategory) => void;
  /** Called when a shop is selected */
  onSelectShop?: (shopId: number) => void;
  /** Called when search is submitted (navigates to map with query) */
  onSearchSubmit?: (query: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HomeSearchOverlay({
  visible,
  onClose,
  onSelectService,
  onSelectCategory,
  onSelectShop,
  onSearchSubmit,
}: HomeSearchOverlayProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);

  // ═══════════════ LOCAL STATE ═══════════════
  const [localQuery, setLocalQuery] = useState("");

  // ═══════════════ STORES ═══════════════
  const availableServices = useBookingStore((state) => state.availableServices);
  const getRecentShopIds = useSearchStore((state) => state.getRecentShopIds);
  const getSearchSuggestions = useSearchStore((state) => state.getSearchSuggestions);
  const removeRecentShop = useSearchStore((state) => state.removeRecentShop);
  const shops = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const getShopById = useShopStore((state) => state.getShopById);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const recentShopIds = useMemo(() => getRecentShopIds(), [getRecentShopIds]);

  // Get all shops as array
  const allShops = useMemo(() => {
    return shopIds.map((id) => shops[id]).filter(Boolean);
  }, [shops, shopIds]);

  // Recent shops for when there's no query
  const recentShops = useMemo(() => {
    return recentShopIds
      .map((id) => getShopById(id))
      .filter((shop): shop is NonNullable<typeof shop> => shop !== undefined);
  }, [recentShopIds, getShopById]);

  // Service suggestions (top 3 only)
  const serviceSuggestions = useMemo(() => {
    if (!localQuery.trim()) return [];
    return getSearchSuggestions(localQuery, availableServices).slice(0, 3);
  }, [localQuery, getSearchSuggestions, availableServices]);

  // Shop search results - search ALL shops by name/address
  const matchingShops = useMemo(() => {
    if (!localQuery.trim()) return [];
    const lowerQuery = localQuery.toLowerCase().trim();
    
    return allShops
      .map((shop) => {
        const nameLower = shop.name.toLowerCase();
        const addressLower = shop.address.toLowerCase();
        
        let score = 0;
        // Exact name match = highest score
        if (nameLower === lowerQuery) score = 100;
        // Name starts with query = high score
        else if (nameLower.startsWith(lowerQuery)) score = 80;
        // Name contains query = medium score
        else if (nameLower.includes(lowerQuery)) score = 60;
        // Address contains query = lower score
        else if (addressLower.includes(lowerQuery)) score = 40;
        
        return { shop, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10) // Top 10 matching shops
      .map((item) => item.shop);
  }, [allShops, localQuery]);

  // Recent shops filtered by query (when typing, use matchingShops instead)
  const filteredRecentShops = useMemo(() => {
    if (localQuery.trim()) return []; // Don't show recent when searching
    return recentShops;
  }, [recentShops, localQuery]);

  // ═══════════════ EFFECTS ═══════════════
  // Focus input when overlay becomes visible
  useEffect(() => {
    if (visible) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      setLocalQuery("");
    }
  }, [visible]);

  // ═══════════════ HANDLERS ═══════════════
  const handleClose = useCallback(() => {
    setLocalQuery("");
    onClose();
  }, [onClose]);

  const handleClear = useCallback(() => {
    setLocalQuery("");
    inputRef.current?.focus();
  }, []);

  const handleSuggestionPress = useCallback(
    (suggestion: SearchSuggestion) => {
      if (suggestion.type === "service") {
        onSelectService?.(suggestion.service.id);
      } else {
        onSelectCategory?.(suggestion.category);
      }
      handleClose();
    },
    [onSelectService, onSelectCategory, handleClose]
  );

  const handleShopPress = useCallback(
    (shopId: number) => {
      onSelectShop?.(shopId);
      handleClose();
    },
    [onSelectShop, handleClose]
  );

  const handleRemoveRecentShop = useCallback(
    (shopId: number) => {
      removeRecentShop(shopId);
    },
    [removeRecentShop]
  );

  const handleSearchSubmit = useCallback(() => {
    if (localQuery.trim()) {
      onSearchSubmit?.(localQuery.trim());
      handleClose();
    }
  }, [localQuery, onSearchSubmit, handleClose]);

  // ═══════════════ RENDER ═══════════════
  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { paddingTop: insets.top }]}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      {/* Search Header */}
      <Animated.View
        style={styles.header}
        entering={SlideInUp.duration(250)}
        exiting={SlideOutUp.duration(150)}
      >
        <TouchableOpacity
          onPress={handleClose}
          style={styles.backButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <ArrowLeft size={24} color={BrandColors.primary} />
        </TouchableOpacity>

        <View style={styles.searchInputContainer}>
          <Search size={20} color="#9CA3AF" />
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder="Search services or shops..."
            placeholderTextColor="#9CA3AF"
            value={localQuery}
            onChangeText={setLocalQuery}
            onSubmitEditing={handleSearchSubmit}
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
      </Animated.View>

      {/* Search Results */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* SHOPS FIRST (Shop-dominant search) */}
        {matchingShops.length > 0 && (
          <View style={styles.section}>
            <Text size="sm" weight="bold" color="#9CA3AF" style={styles.sectionTitle}>
              SHOPS
            </Text>
            {matchingShops.map((shop) => (
              <TouchableOpacity
                key={`match-shop-${shop.id}`}
                style={styles.shopRow}
                onPress={() => handleShopPress(shop.id)}
                activeOpacity={0.7}
              >
                <View style={styles.shopIcon}>
                  <MapPin size={18} color={BrandColors.secondary} />
                </View>
                <View style={styles.shopContent}>
                  <View style={styles.shopHeader}>
                    <Text size="md" weight="semiBold" color={BrandColors.primary}>
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
                  <Text size="sm" color="#6B7280" numberOfLines={1}>
                    {shop.address}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Service Suggestions (Top 3 only) */}
        {serviceSuggestions.length > 0 && (
          <View style={styles.section}>
            <Text size="sm" weight="bold" color="#9CA3AF" style={styles.sectionTitle}>
              SERVICES
            </Text>
            {serviceSuggestions.map((suggestion, index) => (
              <TouchableOpacity
                key={`suggestion-${index}`}
                style={styles.suggestionRow}
                onPress={() => handleSuggestionPress(suggestion)}
                activeOpacity={0.7}
              >
                <View style={styles.suggestionIcon}>
                  <Wrench size={18} color={BrandColors.secondary} />
                </View>
                <View style={styles.suggestionContent}>
                  <Text size="md" weight="semiBold" color={BrandColors.primary}>
                    {suggestion.type === "service"
                      ? suggestion.service.name
                      : suggestion.label}
                  </Text>
                  {suggestion.type === "service" && (
                    <Text size="sm" color="#6B7280">
                      {suggestion.service.description}
                    </Text>
                  )}
                  {suggestion.type === "category" && (
                    <Text size="sm" color="#6B7280">
                      Service Category
                    </Text>
                  )}
                </View>
                {suggestion.type === "service" && (
                  <Text size="md" weight="bold" color={BrandColors.secondary}>
                    ${suggestion.service.price}
                  </Text>
                )}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Shops (when not searching) */}
        {filteredRecentShops.length > 0 && (
          <View style={styles.section}>
            <Text size="sm" weight="bold" color="#9CA3AF" style={styles.sectionTitle}>
              RECENTLY BOOKED
            </Text>
            {filteredRecentShops.map((shop) => (
              <TouchableOpacity
                key={`recent-shop-${shop.id}`}
                style={styles.shopRow}
                onPress={() => handleShopPress(shop.id)}
                activeOpacity={0.7}
              >
                <View style={styles.shopIcon}>
                  <Clock size={18} color="#6B7280" />
                </View>
                <View style={styles.shopContent}>
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
                  <X size={16} color="#9CA3AF" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty State */}
        {localQuery.length === 0 && filteredRecentShops.length === 0 && (
          <View style={styles.emptyState}>
            <Text size="md" weight="medium" color="#9CA3AF" center>
              Start typing to search for services or shops
            </Text>
          </View>
        )}

        {/* No Results */}
        {localQuery.length > 0 && matchingShops.length === 0 && serviceSuggestions.length === 0 && (
          <View style={styles.emptyState}>
            <Text size="md" weight="medium" color="#9CA3AF" center>
              No results found for "{localQuery}"
            </Text>
          </View>
        )}
      </ScrollView>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#FFFFFF",
    zIndex: 100,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  backButton: {
    padding: Spacing.xs,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: BrandColors.primary,
    padding: 0,
    margin: 0,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingVertical: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.xl,
  },
  sectionTitle: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    letterSpacing: 0.5,
  },
  suggestionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  suggestionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F0F7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  suggestionContent: {
    flex: 1,
  },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  shopIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  shopContent: {
    flex: 1,
  },
  shopHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  ratingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  removeButton: {
    padding: Spacing.xs,
  },
  emptyState: {
    paddingVertical: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
});

export default HomeSearchOverlay;
