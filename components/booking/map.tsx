/**
 * BookingMap
 *
 * PURPOSE: Displays an interactive map with shop markers for the booking flow
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - onShopSelect ((shop: Shop) => void): Called when a shop marker is tapped [optional]
 *   - sheetAnimatedIndex (SharedValue<number>): Animated index from bottom sheet for recenter button visibility [optional]
 *
 * EXAMPLE:
 *   <BookingMap
 *     onShopSelect={(shop) => console.log("Selected:", shop.name)}
 *     sheetAnimatedIndex={animatedIndex}
 *   />
 *
 * OWNER: Waleed Mansour, Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Expo & Third-party
import * as Location from "expo-location";
import { Navigation2 } from "lucide-react-native";
import MapView, { PROVIDER_DEFAULT, Region } from "react-native-maps";
import Animated, { SharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors } from "@/components/shared-ui";

// 4. Flow-specific components
import { ShopMarker } from "./ShopMarker";

// 5. Constants, hooks, types, stores
import { Spacing } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";
import { calculateDistanceKm } from "@/utils/geo";
import { filterShops } from "@/utils/shopFilters";

// ============================================================================
// TYPES
// ============================================================================

/** Maximum number of markers to display on the map */
const MAX_MARKERS = 10;

interface BookingMapProps {
  /** Called when a shop marker is tapped */
  onShopSelect?: (shop: Shop) => void;
  /** Animated index from bottom sheet (0 = collapsed, 1 = expanded) */
  sheetAnimatedIndex?: SharedValue<number>;
  /** Shop to center the map on (animates to this location when changed) */
  focusedShop?: Shop | null;
  /** Called when the map region changes significantly (for "Search this area" button) */
  onRegionChange?: (region: Region) => void;
  /** The region that was searched - shops will be filtered to this area */
  searchedRegion?: Region | null;
}

// ============================================================================
// COMPONENT
// ============================================================================

/** Zoom threshold - below this latitudeDelta = zoomed in (show labels) */
const ZOOM_THRESHOLD = 0.03;

export function BookingMap({
  onShopSelect,
  sheetAnimatedIndex,
  focusedShop,
  onRegionChange,
  searchedRegion,
}: BookingMapProps) {
  // ═══════════════ STATE-EFFECT: Refs ═══════════════
  const mapRef = useRef<MapView>(null);

  // Track zoom level for marker display mode
  const [isZoomedIn, setIsZoomedIn] = useState(true);

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const setUserLocation = useBookingStore((state) => state.setUserLocation);
  const mapRegion = useBookingStore((state) => state.mapRegion);
  const setMapRegion = useBookingStore((state) => state.setMapRegion);

  // Shop store subscriptions
  const shopsRecord = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const filters = useShopStore((state) => state.filters);

  // Compute filtered shops using the extracted utility
  const filteredShops = useMemo(() => filterShops({ shopsRecord, shopIds, filters }), [shopsRecord, shopIds, filters]);

  // Get the reference point for distance calculation
  const referencePoint = useMemo(() => {
    // If we have a searched region, use its center
    if (searchedRegion) {
      return {
        latitude: searchedRegion.latitude,
        longitude: searchedRegion.longitude,
      };
    }
    // Otherwise use user location
    if (userLocation) {
      return {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      };
    }
    // Fallback to NYC Midtown
    return { latitude: 40.758, longitude: -73.9855 };
  }, [searchedRegion, userLocation]);

  // Helper function to get closest N shops to a point
  const getClosestShops = useCallback(
    (lat: number, lon: number, limit?: number) => {
      const withDistance = filteredShops.map((shop) => ({
        ...shop,
        calculatedDistance: calculateDistanceKm(lat, lon, shop.latitude, shop.longitude),
      }));
      withDistance.sort((a, b) => a.calculatedDistance - b.calculatedDistance);
      const sliced = limit ? withDistance.slice(0, limit) : withDistance;
      return sliced.map(({ calculatedDistance, ...shop }) => shop);
    },
    [filteredShops]
  );

  // Calculate distance and sort shops, filter by region bounds if searched
  const closestShops = useMemo(() => {
    // If we have a searched region, show ALL shops within the visible bounds (no limit)
    if (searchedRegion) {
      // Add 30% padding to bounds to include shops slightly outside visible area
      const latPadding = searchedRegion.latitudeDelta * 0.3;
      const lonPadding = searchedRegion.longitudeDelta * 0.3;
      const minLat = searchedRegion.latitude - searchedRegion.latitudeDelta / 2 - latPadding;
      const maxLat = searchedRegion.latitude + searchedRegion.latitudeDelta / 2 + latPadding;
      const minLon = searchedRegion.longitude - searchedRegion.longitudeDelta / 2 - lonPadding;
      const maxLon = searchedRegion.longitude + searchedRegion.longitudeDelta / 2 + lonPadding;

      const shopsInArea = filteredShops.filter(
        (shop) =>
          shop.latitude >= minLat && shop.latitude <= maxLat && shop.longitude >= minLon && shop.longitude <= maxLon
      );

      // If no shops in area, fall back to closest 10 to the search center
      if (shopsInArea.length === 0) {
        return getClosestShops(searchedRegion.latitude, searchedRegion.longitude, MAX_MARKERS);
      }

      return shopsInArea;
    }

    // Initial state: show only the 10 closest to user location
    return getClosestShops(referencePoint.latitude, referencePoint.longitude, MAX_MARKERS);
  }, [filteredShops, referencePoint, searchedRegion, getClosestShops]);

  // Debounce the shops to prevent rapid map updates that crash the app
  const [shops, setShops] = useState<Shop[]>(closestShops);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevShopsLengthRef = useRef(closestShops.length);

  useEffect(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // If showing MORE shops (clearing filters), update immediately
    // If showing FEWER shops (adding filters), debounce to prevent crashes
    const isShowingMore = closestShops.length > prevShopsLengthRef.current;
    prevShopsLengthRef.current = closestShops.length;

    if (isShowingMore || closestShops.length === 0) {
      // Immediate update when clearing filters or showing more
      setShops(closestShops);
    } else {
      // Debounce when filtering down
      debounceRef.current = setTimeout(() => {
        setShops(closestShops);
      }, 50);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [closestShops]);

  // ═══════════════ STATE-EFFECT: Computed Values ═══════════════
  // Default to NYC (Midtown Manhattan) if no user location
  const region: Region = mapRegion || {
    latitude: userLocation?.latitude || 40.758,
    longitude: userLocation?.longitude || -73.9855,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  };

  // ═══════════════ STATE-EFFECT: Effects ═══════════════
  // [STATE-EFFECT] Request location permission and get current location on mount
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.log("Location permission denied");
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      };
      setMapRegion(newRegion);

      // Reverse geocode to get location name
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (address) {
          setUserLocation({
            label: `${address.city || address.subregion || "Unknown"}, ${address.region || ""}`,
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            city: address.city || "",
            state: address.region || "",
          });
        }
      } catch (error) {
        console.log("Reverse geocoding error:", error);
      }
    })();
  }, [setMapRegion, setUserLocation]);

  // [STATE-EFFECT] Center map on focused shop when it changes
  useEffect(() => {
    if (focusedShop && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: focusedShop.latitude,
          longitude: focusedShop.longitude,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        400
      );
    }
  }, [focusedShop]);

  // ═══════════════ STATE-EFFECT: Handlers ═══════════════
  const handleMarkerPress = useCallback(
    (shop: Shop) => {
      onShopSelect?.(shop);
    },
    [onShopSelect]
  );

  const handleRecenter = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        300
      );
    }
  }, [userLocation]);

  // Track when map region changes (for "Search this area" button)
  const handleRegionChangeComplete = useCallback(
    (newRegion: Region) => {
      onRegionChange?.(newRegion);
      // Update zoom state based on latitudeDelta
      setIsZoomedIn(newRegion.latitudeDelta < ZOOM_THRESHOLD);
    },
    [onRegionChange]
  );

  // ═══════════════ STATE-EFFECT: Animated Styles ═══════════════
  // Show recenter button when sheet is collapsed (index < 0.5)
  const recenterButtonStyle = useAnimatedStyle(() => {
    const isVisible = sheetAnimatedIndex ? sheetAnimatedIndex.value < 0.3 : true;
    return {
      opacity: withTiming(isVisible ? 1 : 0, { duration: 200 }),
      transform: [{ scale: withTiming(isVisible ? 1 : 0.8, { duration: 200 }) }],
      pointerEvents: isVisible ? "auto" : "none",
    };
  });

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {shops.map((shop) =>
          shop ? (
            <ShopMarker
              key={`marker-${shop.id}`}
              shop={shop}
              onPress={() => handleMarkerPress(shop)}
              showLabel={isZoomedIn}
            />
          ) : null
        )}
      </MapView>

      {/* Recenter Button - shows when sheet is collapsed */}
      <Animated.View style={[styles.recenterButtonContainer, recenterButtonStyle]}>
        <TouchableOpacity
          onPress={handleRecenter}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Navigation2 size={24} color={BrandColors.secondary} fill={BrandColors.secondary} />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  recenterButtonContainer: {
    position: "absolute",
    top: 160,
    right: Spacing.lg,
  },
});
