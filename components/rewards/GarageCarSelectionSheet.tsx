/**
 * GarageCarSelectionSheet
 *
 * PURPOSE: My Garage vehicle selector bottom sheet for rewards/membership page.
 *          Vertical list view — lets the user quickly pick a vehicle to switch
 *          from pooled → individual stats, or tap "All Vehicles" to return to pooled.
 *
 * USED IN: app/membership.tsx
 */

import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  ImageSourcePropType,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { X, Search, ArrowLeft } from "lucide-react-native";
import { useQuery, useMutation } from "convex/react";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BrandColors, Text } from "@/components/shared-ui";
import { BorderRadius, Spacing } from "@/constants/theme";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { fetchVehicleImageUrl } from "@/utils/vehicleImage";
import { GarageCarSelectionCard, type VehicleTier } from "./GarageCarSelectionCard";

const SCROLL_THRESHOLD = 4; // 4+ vehicles → scrollable
const SEARCH_THRESHOLD = 5; // 5+ vehicles → show search bar

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.92;

export interface GarageCarSheetRef {
  present: () => void;
  dismiss: () => void;
}

export interface GarageCarSelectionSheetProps {
  innerRef: React.RefObject<GarageCarSheetRef | null>;
  onStatusBadgePress: (tier: VehicleTier) => void;
  onCarSelected?: (vin: string) => void;
  onClose?: () => void;
}

export function GarageCarSelectionSheet({
  innerRef,
  onStatusBadgePress,
  onCarSelected,
  onClose,
}: GarageCarSelectionSheetProps) {
  const router = useRouter();
  const { userId } = useUserFromConvex();
  const { vehicles: rawVehicles } = useVehicleOwnershipFromConvex();
  const vehicleTiers = useQuery(api.rewards.getVehicleTiersByUser, userId ? { userId } : "skip");
  const updateOwnershipPrimary = useMutation(api.vehicles.updateOwnershipPrimary);
  const selectVehicle = useVehicleStore((s) => s.selectVehicle);

  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchVisible, setSearchVisible] = useState(false);
  const [fetchedImageUrls, setFetchedImageUrls] = useState<Record<string, string>>({});
  const searchInputRef = useRef<TextInput>(null);
  const pendingImageVinsRef = useRef(new Set<string>());
  const sheetTranslateY = useRef(new Animated.Value(SHEET_HEIGHT)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const searchTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  /* ── Vehicle data ── */

  useEffect(() => {
    if (!rawVehicles?.length) return;

    let cancelled = false;

    rawVehicles
      .filter((r: any) => r.vehicle != null)
      .forEach((r: any) => {
        const v = r.vehicle;
        const meta = (v?.metadata as { make?: string; model?: string }) ?? {};
        const make = meta.make ?? r.ownership?.nickname?.split(" ")[1] ?? "";
        const model = meta.model ?? r.ownership?.nickname?.split(" ").slice(2).join(" ") ?? "";
        const year = v?.year ?? new Date().getFullYear();
        const vin = r.vin;

        // Treat a stale white-bg cached URL as missing so we re-fetch
        // and pick up the new transparent-bg image.
        const cachedTransparent =
          typeof v?.image_url === "string" && v.image_url.includes("/transparent/");
        if (!vin || cachedTransparent || fetchedImageUrls[vin] || !make || !model) return;
        if (pendingImageVinsRef.current.has(vin)) return;

        pendingImageVinsRef.current.add(vin);
        fetchVehicleImageUrl(make, model, year, vin)
          .then((url) => {
            if (cancelled || !url) return;
            setFetchedImageUrls((prev) => (prev[vin] ? prev : { ...prev, [vin]: url }));
          })
          .finally(() => {
            pendingImageVinsRef.current.delete(vin);
          });
      });

    return () => {
      cancelled = true;
    };
  }, [rawVehicles, fetchedImageUrls]);

  const vehiclesList = useMemo(() => {
    if (!rawVehicles?.length) return [];
    return rawVehicles
      .filter((r: any) => r.vehicle != null)
      .map((r: any) => {
        const v = r.vehicle;
        const o = r.ownership;
        const meta = (v?.metadata as { make?: string; model?: string; trim?: string }) ?? {};
        const make = meta.make ?? o?.nickname?.split(" ")[1] ?? "Vehicle";
        const model = meta.model ?? o?.nickname?.split(" ").slice(2).join(" ") ?? r.vin.slice(-6);
        const year = v?.year ?? new Date().getFullYear();
        const fetchedImageUrl = fetchedImageUrls[r.vin];
        const cachedIsTransparent =
          typeof v?.image_url === "string" && v.image_url.includes("/transparent/");
        const resolvedUrl = cachedIsTransparent ? v.image_url : fetchedImageUrl;
        const imageSource: ImageSourcePropType | undefined = resolvedUrl
          ? { uri: resolvedUrl }
          : undefined;

        return {
          id: r.vin,
          vin: r.vin,
          year,
          make,
          model,
          mileage: o?.mileage,
          imageSource,
          isDefault: o?.is_primary ?? false,
        };
      });
  }, [rawVehicles, fetchedImageUrls]);

  const tierByVin = useMemo(() => {
    const map: Record<string, VehicleTier> = {};
    (vehicleTiers ?? []).forEach((t) => {
      map[t.vin] = t.tier;
    });
    return map;
  }, [vehicleTiers]);

  const isScrollable = vehiclesList.length >= SCROLL_THRESHOLD;
  const showSearch = vehiclesList.length >= SEARCH_THRESHOLD;

  const filteredVehicles = useMemo(() => {
    if (!searchQuery.trim()) return vehiclesList;
    const q = searchQuery.toLowerCase().trim();
    return vehiclesList.filter((v) => {
      const mileageStr = v.mileage ? v.mileage.toLocaleString() : "";
      const searchable = `${v.make} ${v.model} ${v.year} ${v.vin} ${mileageStr}`.toLowerCase();
      return searchable.includes(q);
    });
  }, [vehiclesList, searchQuery]);

  /* ── Shared animation helpers — all useNativeDriver: true for 60fps ── */

  const animateSheetIn = useCallback(() => {
    sheetTranslateY.setValue(SHEET_HEIGHT);
    backdropOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 40,
        friction: 12,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();
  }, [sheetTranslateY, backdropOpacity]);

  /** @param fast — use quick 200ms timing instead of spring (for chaining into another modal) */
  const animateSheetOut = useCallback(
    (onComplete?: () => void, fast?: boolean) => {
      const sheetAnim = fast
        ? Animated.timing(sheetTranslateY, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(sheetTranslateY, {
            toValue: SHEET_HEIGHT,
            tension: 65,
            friction: 14,
            useNativeDriver: true,
          });
      Animated.parallel([
        sheetAnim,
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: fast ? 200 : 300,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setVisible(false);
        onComplete?.();
      });
    },
    [sheetTranslateY, backdropOpacity]
  );

  const animateSearchOut = useCallback(
    (onComplete?: () => void) => {
      Keyboard.dismiss();
      Animated.timing(searchTranslateY, {
        toValue: SCREEN_HEIGHT,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        setSearchVisible(false);
        setSearchQuery("");
        onComplete?.();
      });
    },
    [searchTranslateY]
  );

  /** Dismiss search + sheet simultaneously (used for actions from search view) */
  const dismissAll = useCallback(
    (onComplete?: () => void, fast?: boolean) => {
      Keyboard.dismiss();
      const sheetAnim = fast
        ? Animated.timing(sheetTranslateY, {
            toValue: SHEET_HEIGHT,
            duration: 200,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          })
        : Animated.spring(sheetTranslateY, {
            toValue: SHEET_HEIGHT,
            tension: 65,
            friction: 14,
            useNativeDriver: true,
          });
      Animated.parallel([
        Animated.timing(searchTranslateY, {
          toValue: SCREEN_HEIGHT,
          duration: fast ? 200 : 240,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        sheetAnim,
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: fast ? 200 : 300,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) return;
        setSearchVisible(false);
        setSearchQuery("");
        setVisible(false);
        onComplete?.();
      });
    },
    [searchTranslateY, sheetTranslateY, backdropOpacity]
  );

  /* ── Present / Dismiss ── */

  const present = useCallback(() => {
    setVisible(true);
    setSearchQuery("");
    setSearchVisible(false);
    animateSheetIn();
  }, [animateSheetIn]);

  const dismiss = useCallback(() => {
    animateSheetOut(onClose);
  }, [animateSheetOut, onClose]);

  useImperativeHandle(innerRef, () => ({ present, dismiss }), [present, dismiss]);

  /* ── Handlers ── */

  const handleSelectVehicle = useCallback(
    (vin: string) => {
      if (!userId) return;
      selectVehicle(vin);
      updateOwnershipPrimary({
        vin,
        userId: userId as Id<"users">,
        is_primary: true,
      }).catch(() => {});
      // Native driver = JS re-renders can't jank the animation, so fire immediately
      onCarSelected?.(vin);
      animateSheetOut(onClose);
    },
    [userId, selectVehicle, updateOwnershipPrimary, animateSheetOut, onCarSelected, onClose]
  );

  const handleTierPress = useCallback(
    (vin: string) => {
      const tier = tierByVin[vin] ?? "driver";
      animateSheetOut(() => onStatusBadgePress(tier), true);
    },
    [tierByVin, animateSheetOut, onStatusBadgePress]
  );

  const handleAddVehicle = useCallback(() => {
    dismiss();
    router.replace("/(main-tabs)/cars");
  }, [dismiss, router]);

  const enterSearchMode = useCallback(() => {
    setSearchVisible(true);
    searchTranslateY.setValue(SCREEN_HEIGHT);
    setTimeout(() => searchInputRef.current?.focus(), 50);
    Animated.spring(searchTranslateY, {
      toValue: 0,
      tension: 50,
      friction: 12,
      useNativeDriver: true,
    }).start();
  }, [searchTranslateY]);

  const exitSearchMode = useCallback(() => {
    animateSearchOut();
  }, [animateSearchOut]);

  const handleSelectFromSearch = useCallback(
    (vin: string) => {
      if (!userId) return;
      selectVehicle(vin);
      updateOwnershipPrimary({
        vin,
        userId: userId as Id<"users">,
        is_primary: true,
      }).catch(() => {});
      // Fire immediately — page updates behind the closing sheet
      onCarSelected?.(vin);
      // Search + sheet slide out simultaneously
      dismissAll(onClose);
    },
    [userId, selectVehicle, updateOwnershipPrimary, dismissAll, onCarSelected, onClose]
  );

  const handleTierPressFromSearch = useCallback(
    (vin: string) => {
      const tier = tierByVin[vin] ?? "driver";
      // Search + sheet slide out simultaneously, then open tier modal
      dismissAll(() => onStatusBadgePress(tier), true);
    },
    [tierByVin, dismissAll, onStatusBadgePress]
  );

  return (
      <Modal visible={visible} transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
        <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        </Animated.View>

        <Animated.View style={[styles.bottomSheet, { transform: [{ translateY: sheetTranslateY }] }]}>
          <View style={styles.dragHandleContainer}>
            <View style={styles.dragHandle} />
          </View>

          <View style={styles.sheetContent}>
            <Pressable
              onPress={dismiss}
              style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.7 }]}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={20} color="#1F2937" />
            </Pressable>

            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Text size="2xl" weight="bold" color="#1F2937">
                  My Garage
                </Text>
              </View>
              {showSearch ? (
                <Pressable style={styles.searchBarFake} onPress={enterSearchMode}>
                  <Search size={16} color="#9CA3AF" />
                  <Text size="sm" color="#9CA3AF" style={{ flex: 1 }}>
                    Search by make, model, year, VIN...
                  </Text>
                </Pressable>
              ) : (
                <Text size="sm" color="#9CA3AF" style={styles.subtitle}>
                  {vehiclesList.length} vehicle{vehiclesList.length !== 1 ? "s" : ""}
                </Text>
              )}
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.listContent}
              style={isScrollable ? styles.list : undefined}
              scrollEnabled={isScrollable}
              keyboardShouldPersistTaps="handled"
            >
              {vehiclesList.map((vehicle) => (
                <GarageCarSelectionCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  tier={tierByVin[vehicle.id] ?? "driver"}
                  onSelect={() => handleSelectVehicle(vehicle.id)}
                  onStatusPress={() => handleTierPress(vehicle.id)}
                />
              ))}
            </ScrollView>

            <Pressable
              style={({ pressed }) => [styles.addLink, pressed && styles.addLinkPressed]}
              onPress={handleAddVehicle}
              hitSlop={{ top: 6, bottom: 6 }}
            >
              <Text size="md" weight="medium" color={BrandColors.secondary}>
                + Add a vehicle
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        {/* ── Full-screen search overlay (animated slide-up) ── */}
        {searchVisible && (
          <Animated.View
            style={[
              styles.searchOverlay,
              { paddingTop: insets.top, transform: [{ translateY: searchTranslateY }] },
            ]}
          >
            <View style={styles.searchHeader}>
              <Pressable
                onPress={exitSearchMode}
                style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.6 }]}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <ArrowLeft size={22} color="#1F2937" />
              </Pressable>
              <View style={styles.searchBarLive}>
                <Search size={16} color="#9CA3AF" />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  placeholder="Search by make, model, year, VIN..."
                  placeholderTextColor="#9CA3AF"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                    <X size={14} color="#9CA3AF" />
                  </Pressable>
                )}
              </View>
            </View>

            <View style={styles.searchResultsInfo}>
              <Text size="sm" color="#9CA3AF">
                {searchQuery.trim()
                  ? `${filteredVehicles.length} result${filteredVehicles.length !== 1 ? "s" : ""}`
                  : `${vehiclesList.length} vehicle${vehiclesList.length !== 1 ? "s" : ""}`}
              </Text>
            </View>

            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.searchListContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              bottomOffset={20}
            >
              {filteredVehicles.map((vehicle) => (
                <GarageCarSelectionCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  tier={tierByVin[vehicle.id] ?? "driver"}
                  onSelect={() => handleSelectFromSearch(vehicle.id)}
                  onStatusPress={() => handleTierPressFromSearch(vehicle.id)}
                />
              ))}
              {filteredVehicles.length === 0 && searchQuery.trim() !== "" && (
                <View style={styles.emptySearch}>
                  <Text size="md" color="#9CA3AF">{`No vehicles match "${searchQuery}"`}</Text>
                </View>
              )}
            </KeyboardAwareScrollView>
          </Animated.View>
        )}
      </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  bottomSheet: {
    position: "absolute",
    bottom: SCREEN_HEIGHT * 0.015,
    left: SCREEN_WIDTH * 0.025,
    right: SCREEN_WIDTH * 0.025,
    width: SCREEN_WIDTH * 0.95,
    maxHeight: SHEET_HEIGHT,
    backgroundColor: "#F2F3F5",
    borderRadius: 40,
    paddingBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 2,
  },
  sheetContent: {
    paddingHorizontal: 24,
  },
  closeButton: {
    position: "absolute",
    top: 0,
    right: 24,
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E8EAED",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  header: {
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  titleRow: {
    paddingRight: 40,
  },
  subtitle: {
    marginTop: 2,
  },
  searchBarFake: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
    zIndex: 20,
  },
  list: {
    maxHeight: SCREEN_HEIGHT * 0.45,
  },
  listContent: {
    paddingBottom: 0,
  },
  addLink: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
    marginTop: -4,
    marginBottom: 0,
  },
  addLinkPressed: {
    opacity: 0.6,
  },
  /* ── Full-screen search ── */
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F2F3F5",
    zIndex: 100,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.full,
    backgroundColor: "#E8EAED",
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarLive: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Urbanist-Regular",
    color: "#1F2937",
    padding: 0,
  },
  searchResultsInfo: {
    paddingHorizontal: 24,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  searchListContent: {
    paddingHorizontal: 24,
    paddingTop: Spacing.sm,
    paddingBottom: 40,
  },
  emptySearch: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
  },
});
