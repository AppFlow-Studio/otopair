/**
 * BookingMap
 *
 * PURPOSE: Displays an interactive map with shop markers for the booking flow.
 *          Dynamically loads pins based on the current visible map region.
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - onShopSelect ((shop: Shop) => void): Called when a shop marker is tapped [optional]
 *   - sheetAnimatedIndex (SharedValue<number>): Animated index from bottom sheet for recenter button visibility [optional]
 *   - focusedShop (Shop | null): Shop to center the map on [optional]
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
import React, { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import * as Location from "expo-location";
import MapView, { PROVIDER_DEFAULT, Region } from "react-native-maps";
import { SharedValue } from "react-native-reanimated";

// 4. Flow-specific components
import { ShopMarker } from "./ShopMarker";

// 5. Constants, hooks, types, stores
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
}

// ============================================================================
// COMPONENT
// ============================================================================

/** Zoom threshold - below this latitudeDelta = zoomed in (show labels) */
const ZOOM_THRESHOLD = 0.03;

export const BookingMap = forwardRef<MapView, BookingMapProps>(function BookingMap(
  { onShopSelect, sheetAnimatedIndex, focusedShop },
  forwardedRef
) {
  // ═══════════════ STATE-EFFECT: Refs ═══════════════
  const internalMapRef = useRef<MapView>(null);
  
  // Callback ref to set both internal and forwarded refs
  const setMapRef = useCallback((node: MapView | null) => {
    internalMapRef.current = node;
    if (typeof forwardedRef === "function") {
      forwardedRef(node);
    } else if (forwardedRef) {
      forwardedRef.current = node;
    }
  }, [forwardedRef]);

  // Track zoom level for marker display mode
  const [isZoomedIn, setIsZoomedIn] = useState(true);

  // Track current visible region for dynamic pin loading
  const [visibleRegion, setVisibleRegion] = useState<Region | null>(null);

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

  // Get the reference point for distance calculation (center of visible region or user location)
  const referencePoint = useMemo(() => {
    // If we have a visible region, use its center
    if (visibleRegion) {
      return {
        latitude: visibleRegion.latitude,
        longitude: visibleRegion.longitude,
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
  }, [visibleRegion, userLocation]);

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

  // Calculate shops to display based on current visible region (dynamic loading)
  const closestShops = useMemo(() => {
    // If we have a visible region, show shops within the visible bounds
    if (visibleRegion) {
      // Add 30% padding to bounds to include shops slightly outside visible area
      const latPadding = visibleRegion.latitudeDelta * 0.3;
      const lonPadding = visibleRegion.longitudeDelta * 0.3;
      const minLat = visibleRegion.latitude - visibleRegion.latitudeDelta / 2 - latPadding;
      const maxLat = visibleRegion.latitude + visibleRegion.latitudeDelta / 2 + latPadding;
      const minLon = visibleRegion.longitude - visibleRegion.longitudeDelta / 2 - lonPadding;
      const maxLon = visibleRegion.longitude + visibleRegion.longitudeDelta / 2 + lonPadding;

      const shopsInArea = filteredShops.filter(
        (shop) =>
          shop.latitude >= minLat && shop.latitude <= maxLat && shop.longitude >= minLon && shop.longitude <= maxLon
      );

      // If no shops in visible area, fall back to closest shops to the center
      if (shopsInArea.length === 0) {
        return getClosestShops(visibleRegion.latitude, visibleRegion.longitude, MAX_MARKERS);
      }

      // Limit to MAX_MARKERS if too many shops in view
      if (shopsInArea.length > MAX_MARKERS) {
        return getClosestShops(visibleRegion.latitude, visibleRegion.longitude, MAX_MARKERS);
      }

      return shopsInArea;
    }

    // Initial state: show only the closest shops to user location
    return getClosestShops(referencePoint.latitude, referencePoint.longitude, MAX_MARKERS);
  }, [filteredShops, referencePoint, visibleRegion, getClosestShops]);

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
    if (focusedShop && internalMapRef.current) {
      internalMapRef.current.animateToRegion(
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

  // Track when map region changes - dynamically load pins for visible area
  const handleRegionChangeComplete = useCallback((newRegion: Region) => {
    // Update visible region for dynamic pin loading
    setVisibleRegion(newRegion);
    // Update zoom state based on latitudeDelta
    setIsZoomedIn(newRegion.latitudeDelta < ZOOM_THRESHOLD);
  }, []);

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={styles.container}>
      <MapView
        ref={setMapRef}
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
    </View>
  );
});

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
});
