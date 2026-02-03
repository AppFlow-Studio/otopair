/**
 * ServiceBottomSheet
 *
 * PURPOSE: Flighty-style bottom sheet for service discovery and selection.
 *          Shows at 98% by default with title, search bar, categories, and services.
 *          Four snap points: 23% (collapsed), 38% (preview), 55% (mid), 98% (expanded).
 *          Footer only shows at 55%+ OR when a service is selected.
 *          X button minimizes to preview (38%) - does NOT navigate back.
 *          Search mode: transforms content to active search with results.
 *
 * FLOW: discovery → service_selection → mechanic_selection → [navigates to pages]
 *
 * USED IN: app/(main-tabs)/home/map.tsx
 *
 * PROPS:
 *   - offsetY (number): Vertical offset to shift bottom sheet down (pixels) [optional]
 *   - onAnimatedIndexChange ((animatedIndex: SharedValue<number>) => void): Callback to expose animated index [optional]
 *   - onSelectShop ((shopId: number) => void): Called when a shop is selected from search [optional]
 *   - onSelectMechanic ((mechanicId: number) => void): Called when a mechanic is selected from search [optional]
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

// 2. Expo & Third-party
import BottomSheet, { BottomSheetFooter, BottomSheetFooterProps } from "@gorhom/bottom-sheet";
import { useRouter } from "expo-router";
import { Car, Clock, MapPin, Search, Star, User, Wrench, X } from "lucide-react-native";
import Animated, {
  Extrapolation,
  FadeIn,
  FadeOut,
  interpolate,
  SharedValue,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Flow-specific components
import { ServiceSelectionFooter } from "./footers";
import { CarSelectionContent } from "./sheets/CarSelectionContent";
import { MechanicSelectionContent } from "./sheets/MechanicSelectionContent";
import { ServiceSelectionContent } from "./sheets/ServiceSelectionContent";
import { ShopPreviewContent } from "./sheets/ShopPreviewContent";

// 5. Constants, hooks, types, stores
import { BorderRadius, FontFamily, FontSize, Shadows } from "@/constants/theme";
import { useBookingTransition } from "@/hooks/useBookingTransition";
import { useRecentlyBookedMechanicIdsFromConvex } from "@/hooks/useRecentlyBookedMechanicIdsFromConvex";
import { useRecentlyBookedShopIdsFromConvex } from "@/hooks/useRecentlyBookedShopIdsFromConvex";
import { useServiceVehicleSpecsForEngine } from "@/hooks/useServiceVehicleSpecsForEngine";
import type { ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useSearchStore, type SearchSuggestion } from "@/stores/useSearchStore";
import { useShopStore } from "@/stores/useShopStore";
import { useVehicleStore } from "@/stores/useVehicleStore";

// ============================================================================
// TYPES
// ============================================================================

interface ServiceBottomSheetProps {
  /** Vertical offset to shift bottom sheet down (pixels) */
  offsetY?: number;
  /** Callback to expose animated index to parent */
  onAnimatedIndexChange?: (animatedIndex: SharedValue<number>) => void;
  /** Called when a shop is selected from search */
  onSelectShop?: (shopId: number) => void;
  /** Called when a mechanic is selected from search */
  onSelectMechanic?: (mechanicId: string) => void;
  /** Callback when search mode changes (for hiding/showing map controls) */
  onSearchModeChange?: (isSearching: boolean) => void;
  /** Currently selected shop ID from map pin (triggers shop preview mode) */
  selectedShopId?: number | null;
  /** Incrementing key to force shop preview when same shop is tapped again */
  shopPreviewKey?: number;
  /** Called when active shop changes in carousel (for map focus) */
  onShopChange?: (shop: { id: number; latitude: number; longitude: number }) => void;
  /** Called when shop preview is closed */
  onShopClose?: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Snap points: collapsed (23%), preview (38%), mid (55%), expanded (98%)
// Collapsed: only title + search bar visible
// Preview: title, search, categories, 1-2 services
// Mid: more services visible, footer shows
// Expanded: nearly full screen (Flighty-style) with tiny map peek
const SNAP_POINTS_CONFIG = {
  // Discovery & Service Selection: 4 snap points
  discovery: { collapsed: 23, preview: 38, mid: 55, expanded: 98 },
  service_selection: { collapsed: 23, preview: 38, mid: 55, expanded: 98 },
  // Mechanic Selection: same 4 snap points
  mechanic_selection: { collapsed: 23, preview: 38, mid: 55, expanded: 98 },
} as const;

const SNAP_POINT_COUNT = 4;

const clampSnapIndex = (index: number | null | undefined) => {
  if (index === null || index === undefined || Number.isNaN(index)) {
    return 3;
  }
  return Math.min(SNAP_POINT_COUNT - 1, Math.max(0, index));
};

// Fade footer as the sheet passes the mid snap (index 2) so it disappears before collapsing
const FOOTER_FADE_IN_INDEX = 2;
const FOOTER_FADE_OUT_INDEX = 1.1;
const FOOTER_INTERACTION_THRESHOLD = 0.05;

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBottomSheet({
  offsetY = 0,
  onAnimatedIndexChange,
  onSelectShop,
  onSelectMechanic,
  onSearchModeChange,
  selectedShopId = null,
  shopPreviewKey = 0,
  onShopChange,
  onShopClose,
}: ServiceBottomSheetProps) {
  // ═══════════════ REFS ═══════════════
  const bottomSheetRef = useRef<BottomSheet>(null);
  const searchInputRef = useRef<TextInput>(null);
  const animatedIndex = useSharedValue(3); // Start at expanded (index 3)

  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { currentStage, sheetEntering, sheetExiting } = useBookingTransition();

  // ═══════════════ SEARCH MODE STATE ═══════════════
  const [isSearchMode, setIsSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [hasTyped, setHasTyped] = useState(false);
  // Track snap index before entering search mode
  const previousSnapIndexRef = useRef(3);

  // ═══════════════ SHOP PREVIEW STATE ═══════════════
  // Toggle between shop preview and services view (only when a shop is selected from map)
  const [showShopPreview, setShowShopPreview] = useState(false);
  // Track the previous snap index before showing shop preview
  const previousShopSnapIndexRef = useRef(3);
  const showShopPreviewRef = useRef(showShopPreview);

  // ═══════════════ CAR SELECTION STATE ═══════════════
  // Toggle to show car selection carousel (user-initiated via car icon)
  const [showCarPreview, setShowCarPreview] = useState(false);
  const [mechanicFooterHeight, setMechanicFooterHeight] = useState(0);

  // ═══════════════ STORES ═══════════════
  const setBookingStage = useBookingStore((state) => state.setBookingStage);
  const selectedCount = useBookingStore((state) => state.getSelectedServicesCount());
  const selectedTotal = useBookingStore((state) => state.getSelectedServicesTotal());
  const availableServices = useBookingStore((state) => state.availableServices);
  const selectedServiceIds = useBookingStore((state) => state.selectedServiceIds);
  const selectedMechanicSlot = useBookingStore((state) => state.selectedMechanicSlot);
  const setBookingTypeAndProceed = useBookingStore((state) => state.setBookingTypeAndProceed);
  const setScheduledAppointment = useBookingStore((state) => state.setScheduledAppointment);
  const setSkippedBookingDetails = useBookingStore((state) => state.setSkippedBookingDetails);
  const getMechanicById = useMechanicStore((state) => state.getMechanicById);

  // Search stores
  const getRecentShopIds = useSearchStore((state) => state.getRecentShopIds);
  const getSearchSuggestions = useSearchStore((state) => state.getSearchSuggestions);
  const removeRecentShop = useSearchStore((state) => state.removeRecentShop);
  const shops = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const getShopById = useShopStore((state) => state.getShopById);
  const mechanics = useMechanicStore((state) => state.mechanics);
  const mechanicIds = useMechanicStore((state) => state.mechanicIds);
  const { recentlyBookedShopIds } = useRecentlyBookedShopIdsFromConvex(5);
  const { recentlyBookedMechanicIds } = useRecentlyBookedMechanicIdsFromConvex(5);

  // ═══════════════ COMPUTED ═══════════════
  const hasSelection = selectedCount > 0;
  const isServiceStage = currentStage === "discovery" || currentStage === "service_selection";
  const isMechanicStage = currentStage === "mechanic_selection";

  // Car-specific (engine-specific) labor/parts for footer price
  const selectedVehicle = useVehicleStore((state) => state.getSelectedVehicle());
  const engineSpecs = useServiceVehicleSpecsForEngine(
    selectedVehicle?.engineId,
    selectedServiceIds,
  );

  // Compute service name for mechanic selection footer
  const mechanicFooterServiceName = useMemo(() => {
    const selectedServices = availableServices.filter((s) => selectedServiceIds.includes(s.id));
    if (selectedServices.length === 0) return "";
    if (selectedServices.length === 1) return selectedServices[0].name;
    return `${selectedServices.length} Services`;
  }, [availableServices, selectedServiceIds]);

  // Mechanic footer total: use (labor_rate × time) + parts, engine-specific when available
  const mechanicFooterTotal = useMemo(() => {
    if (!selectedMechanicSlot?.shopId) return selectedTotal;
    const shop = shops[selectedMechanicSlot.shopId];
    const laborRate = shop?.labor_rate;
    const selectedServices = availableServices.filter((s) => selectedServiceIds.includes(s.id));
    // Use engine-specific labor/parts when available, else service defaults
    const getLaborHours = (s: (typeof selectedServices)[0]) =>
      engineSpecs[s.id]?.labor_hours ?? s.default_labor_hours;
    const getParts = (s: (typeof selectedServices)[0]) =>
      engineSpecs[s.id]?.parts_cost_avg ?? s.default_parts_estimate;
    const hasFormulaParams =
      laborRate != null &&
      selectedServices.every(
        (s) => getLaborHours(s) != null && getParts(s) != null,
      );
    if (!hasFormulaParams) return selectedTotal;
    const total = selectedServices.reduce(
      (sum, s) =>
        sum + laborRate! * (getLaborHours(s) ?? 0) + (getParts(s) ?? 0),
      0,
    );
    return Math.round(total);
  }, [
    selectedMechanicSlot?.shopId,
    shops,
    availableServices,
    selectedServiceIds,
    selectedTotal,
    engineSpecs,
  ]);

  // ═══════════════ SEARCH COMPUTED VALUES ═══════════════
  const recentShopIds = useMemo(() => getRecentShopIds(), [getRecentShopIds]);
  const recentShopIdsForDisplay = useMemo(() => {
    const inMemory = recentShopIds.filter((id) => !recentlyBookedShopIds.includes(id));
    return [...recentlyBookedShopIds, ...inMemory].slice(0, 5);
  }, [recentlyBookedShopIds, recentShopIds]);

  const allShops = useMemo(() => {
    return shopIds.map((id) => shops[id]).filter(Boolean);
  }, [shops, shopIds]);

  const allMechanics = useMemo(() => {
    return mechanicIds.map((id) => mechanics[id]).filter(Boolean);
  }, [mechanics, mechanicIds]);

  const recentShops = useMemo(() => {
    return recentShopIdsForDisplay
      .map((id) => getShopById(id))
      .filter((shop): shop is NonNullable<typeof shop> => shop !== undefined);
  }, [recentShopIdsForDisplay, getShopById]);

  const recentMechanics = useMemo(() => {
    return recentlyBookedMechanicIds
      .map((id) => getMechanicById(id))
      .filter((m): m is NonNullable<typeof m> => m !== undefined);
  }, [recentlyBookedMechanicIds, getMechanicById]);

  const serviceSuggestions = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return getSearchSuggestions(searchQuery, availableServices).slice(0, 3);
  }, [searchQuery, getSearchSuggestions, availableServices]);

  const topMatches = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const lowerQuery = searchQuery.toLowerCase().trim();

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

    return [...shopScores, ...mechanicScores]
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [allShops, allMechanics, searchQuery]);

  const filteredRecentShops = useMemo(() => recentShops.slice(0, 3), [recentShops]);
  const filteredRecentMechanics = useMemo(() => recentMechanics.slice(0, 3), [recentMechanics]);
  const hasRecentlyBooked = filteredRecentShops.length > 0 || filteredRecentMechanics.length > 0;

  const hasSearchResults = topMatches.length > 0 || serviceSuggestions.length > 0;

  // ═══════════════ EFFECTS ═══════════════
  // Expose animated index to parent
  useEffect(() => {
    onAnimatedIndexChange?.(animatedIndex);
  }, [animatedIndex, onAnimatedIndexChange]);

  useEffect(() => {
    showShopPreviewRef.current = showShopPreview;
  }, [showShopPreview]);

  // Expand sheet when stage changes (except discovery)
  useEffect(() => {
    if (currentStage !== "discovery" && bottomSheetRef.current && !showShopPreview && !showCarPreview) {
      bottomSheetRef.current.snapToIndex(3); // Snap to expanded
    }
  }, [currentStage, showShopPreview, showCarPreview]);

  // Special handling for mechanic_selection stage - ensure sheet is always expanded
  // This handles the case when coming back from payment page (component remounts with mechanic_selection)
  useEffect(() => {
    if (currentStage === "mechanic_selection" && !showShopPreview && !showCarPreview) {
      // Use multiple delayed snaps to ensure the sheet expands
      // This handles remount scenarios where the BottomSheet takes time to initialize
      const timer1 = setTimeout(() => {
        bottomSheetRef.current?.snapToIndex(3);
      }, 100);
      const timer2 = setTimeout(() => {
        bottomSheetRef.current?.snapToIndex(3);
      }, 300);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    }
  }, [currentStage, showShopPreview, showCarPreview]);

  // Notify parent when search mode changes
  useEffect(() => {
    onSearchModeChange?.(isSearchMode);
  }, [isSearchMode, onSearchModeChange]);

  // Focus search input when entering search mode
  useEffect(() => {
    if (isSearchMode) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isSearchMode]);

  // Auto-close search when query becomes empty after typing
  useEffect(() => {
    if (isSearchMode && hasTyped && searchQuery === "") {
      const timer = setTimeout(() => {
        exitSearchMode();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isSearchMode, hasTyped, searchQuery]);

  const dismissShopPreview = useCallback(
    (notifyParent: boolean) => {
      let wasVisible = false;

      setShowShopPreview((prev) => {
        wasVisible = prev;
        return false;
      });

      if (wasVisible) {
        const fallbackIndex = clampSnapIndex(previousShopSnapIndexRef.current);
        previousShopSnapIndexRef.current = fallbackIndex;
        bottomSheetRef.current?.snapToIndex(fallbackIndex);
      }

      if (notifyParent) {
        onShopClose?.();
      }
    },
    [onShopClose],
  );

  // Handle selected shop from map pin - show shop preview and snap to preview position
  useEffect(() => {
    if (selectedShopId === null) {
      // Shop was deselected, hide shop preview and restore snap
      dismissShopPreview(false);
      return;
    }

    if (!showShopPreviewRef.current) {
      previousShopSnapIndexRef.current = clampSnapIndex(Math.round(animatedIndex.value));
    }

    setShowShopPreview(true);
    // Snap to preview position (index 1 = 38%)
    bottomSheetRef.current?.snapToIndex(1);
  }, [selectedShopId, shopPreviewKey, animatedIndex, dismissShopPreview]);

  // ═══════════════ COMPUTED VALUES ═══════════════
  const offsetPercent = (offsetY / SCREEN_HEIGHT) * 100;

  // Get snap points config, fallback to discovery for stages handled by pages
  const stageConfig =
    currentStage === "discovery" || currentStage === "service_selection" || currentStage === "mechanic_selection"
      ? SNAP_POINTS_CONFIG[currentStage]
      : SNAP_POINTS_CONFIG.discovery;

  // Four snap points: collapsed, preview, mid, expanded
  // Shop preview mode uses the same snap points (no locking - just let user drag)
  const snapPoints = useMemo(
    () => [
      `${stageConfig.collapsed - offsetPercent}%`,
      `${stageConfig.preview - offsetPercent}%`,
      `${stageConfig.mid - offsetPercent}%`,
      `${stageConfig.expanded - offsetPercent}%`,
    ],
    [stageConfig, offsetPercent],
  );

  // Initial index: start at expanded (index 3)
  const initialIndex = 3;

  // ═══════════════ SEARCH MODE HANDLERS ═══════════════
  // Enter search mode
  const enterSearchMode = useCallback(() => {
    // Save current snap index
    previousSnapIndexRef.current = Math.round(animatedIndex.value);
    setIsSearchMode(true);
    // Ensure sheet is expanded
    bottomSheetRef.current?.snapToIndex(3);
  }, [animatedIndex]);

  // Exit search mode
  const exitSearchMode = useCallback(() => {
    Keyboard.dismiss();
    setIsSearchMode(false);
    setSearchQuery("");
    setHasTyped(false);
    // Restore to previous snap index
    bottomSheetRef.current?.snapToIndex(previousSnapIndexRef.current);
  }, []);

  // Handle search query change
  const handleSearchQueryChange = useCallback((text: string) => {
    setSearchQuery(text);
    if (text.length > 0) {
      setHasTyped(true);
    }
  }, []);

  // Clear search query
  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    // This triggers auto-close via effect
  }, []);

  // Handle service suggestion press
  const handleSuggestionPress = useCallback(
    (suggestion: SearchSuggestion) => {
      const toggleServiceSelection = useBookingStore.getState().toggleServiceSelection;
      const setSelectedServiceCategory = useBookingStore.getState().setSelectedServiceCategory;

      if (suggestion.type === "service") {
        toggleServiceSelection(suggestion.service.id);
      } else {
        setSelectedServiceCategory(suggestion.category);
      }
      exitSearchMode();
    },
    [exitSearchMode],
  );

  // Handle shop press from search
  const handleSearchShopPress = useCallback(
    (shopId: number) => {
      exitSearchMode();
      onSelectShop?.(shopId);
    },
    [exitSearchMode, onSelectShop],
  );

  // Handle mechanic press from search
  const handleSearchMechanicPress = useCallback(
    (mechanicId: string) => {
      exitSearchMode();
      onSelectMechanic?.(mechanicId);
    },
    [exitSearchMode, onSelectMechanic],
  );

  // Handle remove recent shop
  const handleRemoveRecentShop = useCallback(
    (shopId: number) => {
      removeRecentShop(shopId);
    },
    [removeRecentShop],
  );

  // ═══════════════ SHOP PREVIEW HANDLERS ═══════════════
  // Close shop preview when the card X is pressed
  const handleShopPreviewClose = useCallback(() => {
    dismissShopPreview(true);
  }, [dismissShopPreview]);

  // Handle shop change from carousel
  const handleShopPreviewChange = useCallback(
    (shop: { id: number; latitude: number; longitude: number }) => {
      onShopChange?.(shop);
    },
    [onShopChange],
  );

  const handleMechanicSearchFocus = useCallback(() => {
    bottomSheetRef.current?.snapToIndex(3);
  }, []);

  // Handle shop details press
  const handleShopPreviewDetails = useCallback(
    (shop: { id: number }) => {
      onSelectShop?.(shop.id);
    },
    [onSelectShop],
  );

  // ═══════════════ CAR SELECTION HANDLERS ═══════════════
  // Track snap index before showing car preview
  const previousCarSnapIndexRef = useRef(3);

  // Toggle car selection view
  const handleCarToggle = useCallback(() => {
    if (showCarPreview) {
      // Close car selection - restore previous snap index
      setShowCarPreview(false);
      bottomSheetRef.current?.snapToIndex(previousCarSnapIndexRef.current);
    } else {
      // When opening car view from search mode, exit search so the car UI is shown
      if (isSearchMode) {
        Keyboard.dismiss();
        setIsSearchMode(false);
        setSearchQuery("");
        setHasTyped(false);
      }
      // Save current snap index before switching to car preview
      previousCarSnapIndexRef.current = Math.round(animatedIndex.value);
      // Open car selection - snap to mid position (index 2 = 55%) for better visibility
      setShowCarPreview(true);
      bottomSheetRef.current?.snapToIndex(2);
    }
  }, [showCarPreview, isSearchMode, animatedIndex]);

  // Close car selection (called from CarSelectionContent)
  const handleCarSelectionClose = useCallback(() => {
    setShowCarPreview(false);
    // Restore previous snap index
    bottomSheetRef.current?.snapToIndex(previousCarSnapIndexRef.current);
  }, []);

  // ═══════════════ HANDLERS ═══════════════
  // Service selection complete -> go to mechanic selection
  const handleServicesSelected = useCallback(() => {
    setBookingStage("mechanic_selection", "forward");
  }, [setBookingStage]);

  // Mechanic selection complete -> navigation to pages is handled by MechanicSelectionContent
  const handleMechanicSelected = useCallback(() => {
    // Navigation is handled internally by MechanicSelectionContent
  }, []);

  // Handle book button from mechanic selection footer
  const handleMechanicBook = useCallback(() => {
    if (!selectedMechanicSlot) return;

    const { mechanicId, slot, shopId } = selectedMechanicSlot;

    // Convert slot to scheduled appointment format
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const dayNum = parseInt(slot.day, 10);

    // Construct date from slot day
    let targetDate = new Date(currentYear, currentMonth, dayNum);
    if (targetDate < now) {
      targetDate = new Date(currentYear, currentMonth + 1, dayNum);
    }

    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."];
    const displayDate = `${targetDate.getDate()} ${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
    const isoDate = targetDate.toISOString().split("T")[0];

    // Use mechanicId or find first mechanic for the shop
    const effectiveMechanicId =
      mechanicId ||
      (() => {
        // Find a mechanic from this shop
        const shopMechanic = mechanicIds.map((id) => mechanics[id]).find((m) => m?.shopId === shopId);
        return shopMechanic?.id;
      })();

    if (!effectiveMechanicId) return;

    // Set appointment in store
    setBookingTypeAndProceed("schedule_later", effectiveMechanicId);
    setScheduledAppointment({
      date: isoDate,
      time: slot.time,
      displayDate,
    });

    // Go directly to payment screen (skip booking details)
    setSkippedBookingDetails(true);
    setBookingStage("payment", "forward");

    // Navigate to payment page
    router.push(`/home/mechanic/${effectiveMechanicId}/payment`);
  }, [
    selectedMechanicSlot,
    mechanicIds,
    mechanics,
    setBookingTypeAndProceed,
    setScheduledAppointment,
    setSkippedBookingDetails,
    setBookingStage,
    router,
  ]);

  // Handle close button press
  // In search mode: exit search mode
  // In browse mode: minimize to preview stage (index 1 = 38%)
  const handleClose = useCallback(() => {
    if (isSearchMode) {
      exitSearchMode();
    } else {
      bottomSheetRef.current?.snapToIndex(1); // Snap to preview stage
    }
  }, [isSearchMode, exitSearchMode]);

  // Handle category tap - expand to mid (50%) if below mid
  const handleCategorySelect = useCallback(() => {
    // Index 2 = mid (50%), so if below that, expand to mid
    if (animatedIndex.value < 1.5) {
      bottomSheetRef.current?.snapToIndex(2); // Snap to mid (50%)
    }
  }, [animatedIndex]);

  // ═══════════════ FOOTER ANIMATED STYLE ═══════════════
  // Fade the footer once the sheet slides below the mid snap to keep the map visible
  const footerVisibility = useDerivedValue(() => {
    return interpolate(animatedIndex.value, [FOOTER_FADE_OUT_INDEX, FOOTER_FADE_IN_INDEX], [0, 1], Extrapolation.CLAMP);
  });

  const footerAnimatedStyle = useAnimatedStyle(() => {
    const opacity = footerVisibility.value;
    return {
      opacity,
      pointerEvents: opacity > FOOTER_INTERACTION_THRESHOLD ? ("auto" as const) : ("none" as const),
    };
  });

  // ═══════════════ CLOSE BUTTON ANIMATED STYLE ═══════════════
  // In search mode: always visible
  // In browse mode: only show when fully expanded (index 2.5 to 3)
  const closeButtonAnimatedStyle = useAnimatedStyle(() => {
    if (isSearchMode) {
      return {
        opacity: 1,
        pointerEvents: "auto" as const,
      };
    }

    const opacity = interpolate(animatedIndex.value, [2.5, 3], [0, 1], Extrapolation.CLAMP);

    return {
      opacity,
      pointerEvents: opacity > 0.5 ? "auto" : "none",
    };
  });

  // Bottom inset includes safe area
  const footerBottomInset = insets.bottom;
  const handleMechanicFooterLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    setMechanicFooterHeight((prev) => (Math.abs(prev - height) < 1 ? prev : height));
  }, []);

  // ═══════════════ FOOTER RENDERER ═══════════════
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => {
      // Car selection mode: single Confirm button to close sheet
      if (showCarPreview) {
        return (
          <BottomSheetFooter {...props} bottomInset={insets.bottom}>
            <View style={carConfirmFooterStyles.container}>
              <TouchableOpacity
                style={carConfirmFooterStyles.confirmButton}
                onPress={handleCarSelectionClose}
                activeOpacity={0.8}
              >
                <Text size="md" weight="semiBold" color={BrandColors.white}>
                  Confirm
                </Text>
              </TouchableOpacity>
            </View>
          </BottomSheetFooter>
        );
      }

      // Only show footer for service selection stage when NOT in car/shop preview mode
      // This ensures the footer disappears when user is viewing car selection or shop carousel
      if (isServiceStage && !showCarPreview && !showShopPreview) {
        return (
          <ServiceSelectionFooter
            {...props}
            bottomInset={footerBottomInset}
            animatedStyle={footerAnimatedStyle}
            hasSelection={hasSelection}
            selectedCount={selectedCount}
            selectedTotal={selectedTotal}
            onConfirm={handleServicesSelected}
          />
        );
      }

      // Mechanic selection footer - shows immediately even while content is loading
      if (isMechanicStage && !showCarPreview) {
        const hasSlotSelection = selectedMechanicSlot !== null;
        const displayMechanic = selectedMechanicSlot?.mechanicName || "Any mechanic";
        const displayDate = selectedMechanicSlot?.slot
          ? `${selectedMechanicSlot.slot.dayOfWeek} ${selectedMechanicSlot.slot.day} · ${selectedMechanicSlot.slot.time}`
          : "";

        return (
          <BottomSheetFooter {...props} bottomInset={0}>
            <Animated.View
              style={[footerAnimatedStyle, mechanicFooterStyles.wrapper]}
              onLayout={handleMechanicFooterLayout}
            >
              <View style={mechanicFooterStyles.container}>
                {!hasSlotSelection ? (
                  // No selection state - prompt to select time
                  <View style={mechanicFooterStyles.noSelectionContent}>
                    <View style={mechanicFooterStyles.serviceLabel}>
                      <Text size="xs" weight="bold" color="#9CA3AF" style={{ letterSpacing: 0.5, marginBottom: 2 }}>
                        SERVICE
                      </Text>
                      <Text size="sm" weight="bold" color={BrandColors.primary}>
                        {mechanicFooterServiceName.toUpperCase()}
                      </Text>
                    </View>
                    <View style={mechanicFooterStyles.promptContainer}>
                      <Text size="sm" weight="medium" color="#9CA3AF">
                        Select time to continue
                      </Text>
                      <Wrench size={16} color="#9CA3AF" />
                    </View>
                  </View>
                ) : (
                  // Selection made state - show details and book button
                  <View style={mechanicFooterStyles.selectionContent}>
                    <View style={mechanicFooterStyles.detailsContainer}>
                      <Text size="xs" weight="bold" color={BrandColors.secondary}>
                        {mechanicFooterServiceName.toUpperCase()}
                      </Text>
                      <Text size="sm" weight="bold" color={BrandColors.secondary}>
                        {displayDate}
                      </Text>
                      <Text size="xs" weight="regular" color="#6B7280" numberOfLines={1}>
                        with {displayMechanic} at {selectedMechanicSlot?.shopName}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={mechanicFooterStyles.bookButton}
                      onPress={handleMechanicBook}
                      activeOpacity={0.8}
                    >
                      <Text size="md" weight="bold" color={BrandColors.white}>
                        Book ${mechanicFooterTotal}
                      </Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
              {/* White bar below footer to cover any content behind */}
              <View style={mechanicFooterStyles.bottomBar} />
            </Animated.View>
          </BottomSheetFooter>
        );
      }

      return null;
    },
    [
      isServiceStage,
      isMechanicStage,
      showCarPreview,
      showShopPreview,
      insets.bottom,
      handleCarSelectionClose,
      footerBottomInset,
      footerAnimatedStyle,
      hasSelection,
      selectedCount,
      mechanicFooterTotal,
      handleServicesSelected,
      mechanicFooterServiceName,
      selectedMechanicSlot,
      handleMechanicBook,
      handleMechanicFooterLayout,
    ],
  );

  // ═══════════════ CONTENT RENDERER ═══════════════
  const renderStageContent = () => {
    switch (currentStage) {
      case "discovery":
      case "service_selection":
        return (
          <Animated.View key="service" entering={sheetEntering} exiting={sheetExiting} style={styles.contentWrapper}>
            <ServiceSelectionContent onCategorySelect={handleCategorySelect} />
          </Animated.View>
        );

      case "mechanic_selection":
        return (
          <Animated.View key="mechanic" entering={sheetEntering} exiting={sheetExiting} style={styles.contentWrapper}>
            <MechanicSelectionContent
              onSelectMechanic={handleMechanicSelected}
              onCarSelect={handleCarToggle}
              footerInset={mechanicFooterHeight}
              onSearchFocus={handleMechanicSearchFocus}
            />
          </Animated.View>
        );

      // booking_details and payment stages are handled by FullScreenBookingView
      case "booking_details":
      case "payment":
      case "confirmation":
      default:
        return null;
    }
  };

  // ═══════════════ SEARCH RESULTS RENDERER ═══════════════
  const renderSearchResults = () => (
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
                <Text size="md" weight="semiBold" color={BrandColors.primary}>
                  {suggestion.type === "service" ? suggestion.service.name : suggestion.label}
                </Text>
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
              {suggestion.type === "service" && (
                <Text size="md" weight="bold" color={BrandColors.secondary}>
                  ${suggestion.service.price}
                </Text>
              )}
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
          {topMatches.map((match) => {
            if (match.type === "shop") {
              const shop = match.data;
              return (
                <TouchableOpacity
                  key={`match-shop-${shop.id}`}
                  style={styles.resultCard}
                  onPress={() => handleSearchShopPress(shop.id)}
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
                  onPress={() => handleSearchMechanicPress(mechanic.id)}
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
                      {mechanic.rating && (
                        <View style={styles.ratingBadge}>
                          <Star size={12} color="#F5C254" fill="#F5C254" />
                          <Text size="xs" weight="semiBold" color={BrandColors.primary}>
                            {mechanic.rating.toFixed(1)}
                          </Text>
                        </View>
                      )}
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
              onPress={() => handleSearchShopPress(shop.id)}
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
              <TouchableOpacity onPress={() => handleRemoveRecentShop(shop.id)} style={styles.removeButton} hitSlop={8}>
                <X size={14} color="#9CA3AF" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
          {filteredRecentMechanics.map((mechanic) => (
            <TouchableOpacity
              key={`recent-mech-${mechanic.id}`}
              style={styles.resultCard}
              onPress={() => handleSearchMechanicPress(mechanic.id)}
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
      {searchQuery.length === 0 && !hasRecentlyBooked && (
        <View style={styles.emptyState}>
          <Text size="md" weight="medium" color="#9CA3AF" center>
            Start typing to search for services, shops, or mechanics
          </Text>
        </View>
      )}

      {/* No Results */}
      {searchQuery.length > 0 && !hasSearchResults && (
        <View style={styles.emptyState}>
          <Text size="md" weight="medium" color="#9CA3AF" center>
            No results found for "{searchQuery}"
          </Text>
        </View>
      )}
    </ScrollView>
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={initialIndex}
      animatedIndex={animatedIndex}
      enableDynamicSizing={false}
      enablePanDownToClose={false}
      enableOverDrag={!isSearchMode && !showShopPreview && !showCarPreview}
      enableContentPanningGesture={!isSearchMode && !showShopPreview && !showCarPreview}
      enableHandlePanningGesture={!isSearchMode && !showShopPreview && !showCarPreview}
      backgroundStyle={styles.bottomSheetBackground}
      handleIndicatorStyle={styles.handleIndicator}
      handleStyle={styles.handleContainer}
      footerComponent={isSearchMode ? undefined : renderFooter}
    >
      {/* Header - Only show for service selection stages when NOT in shop/car preview */}
      {isServiceStage && !showShopPreview && !showCarPreview && (
        <View style={styles.header}>
          <View style={styles.headerTop}>
            {/* Title */}
            <Text size="xl" weight="bold" color={BrandColors.primary} style={styles.headerTitle}>
              Select Services
            </Text>

            {/* Right side buttons container */}
            <View style={styles.headerButtons}>
              {/* Car selection button - always visible */}
              <TouchableOpacity
                onPress={handleCarToggle}
                style={styles.carToggleButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Car size={20} color={BrandColors.primary} />
              </TouchableOpacity>

              {/* X button: always visible in search mode, conditional in browse mode */}
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
          </View>

          {/* Search Bar */}
          {isSearchMode ? (
            <Animated.View entering={FadeIn.duration(200)} style={styles.searchInputContainer}>
              <Search size={20} color="#9CA3AF" />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search services, shops, mech..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={handleSearchQueryChange}
                returnKeyType="search"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={handleClearSearch} hitSlop={8}>
                  <X size={18} color="#9CA3AF" />
                </TouchableOpacity>
              )}
            </Animated.View>
          ) : (
            <TouchableOpacity onPress={enterSearchMode} style={styles.searchBarTouchable} activeOpacity={0.7}>
              <View style={styles.searchBar}>
                <Search size={20} color="#9CA3AF" />
                <Text size="md" weight="regular" color="#9CA3AF" style={styles.searchPlaceholder}>
                  Search for services or mechanics...
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Content - Search results, car preview, shop preview, or stage content */}
      <View style={styles.expandedContainer}>
        {isSearchMode ? (
          <Animated.View
            key="search"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.contentWrapper}
          >
            {renderSearchResults()}
          </Animated.View>
        ) : showCarPreview ? (
          <Animated.View
            key="car-preview"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.contentWrapper}
          >
            <CarSelectionContent onClose={handleCarSelectionClose} />
          </Animated.View>
        ) : showShopPreview ? (
          <Animated.View
            key="shop-preview"
            entering={FadeIn.duration(200)}
            exiting={FadeOut.duration(150)}
            style={styles.contentWrapper}
          >
            <ShopPreviewContent
              selectedShopId={selectedShopId}
              onShopChange={handleShopPreviewChange}
              onShopDetails={handleShopPreviewDetails}
              onClose={handleShopPreviewClose}
            />
          </Animated.View>
        ) : (
          renderStageContent()
        )}
      </View>
    </BottomSheet>
  );
}

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
  headerTitle: {
    flex: 1,
  },
  headerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  shopToggleButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  carToggleButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  closeButton: {
    padding: Spacing.xs,
  },
  searchBarTouchable: {
    marginBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  searchPlaceholder: {
    flex: 1,
  },
  // Active search input
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
  expandedContainer: {
    flex: 1,
    minHeight: 0,
  },
  contentWrapper: {
    flex: 1,
    minHeight: 0,
  },
  // Search results styles
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

// Car selection footer: single Confirm button
const carConfirmFooterStyles = StyleSheet.create({
  container: {
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
  },
  confirmButton: {
    backgroundColor: BrandColors.secondary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
});

// Mechanic selection footer styles
const mechanicFooterStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: BrandColors.white,
  },
  container: {
    backgroundColor: BrandColors.white,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    paddingTop: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  bottomBar: {
    height: 20,
    backgroundColor: BrandColors.white,
  },
  noSelectionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F9FAFB",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  serviceLabel: {
    flex: 1,
  },
  promptContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  selectionContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.md,
  },
  detailsContainer: {
    flex: 1,
  },
  bookButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: BrandColors.primary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
  },
});
