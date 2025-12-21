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

import type { Shop } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useShopStore } from "@/stores/useShopStore";
import * as Location from "expo-location";
import { Navigation2 } from "lucide-react-native";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";
import MapView, { PROVIDER_DEFAULT, Region } from "react-native-maps";
import Animated, { SharedValue, useAnimatedStyle, withTiming } from "react-native-reanimated";
import { ShopMarker } from "./ShopMarker";
import { BrandColors } from "@/components/shared-ui";
import { Spacing } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

interface BookingMapProps {
  /** Called when a shop marker is tapped */
  onShopSelect?: (shop: Shop) => void;
  /** Animated index from bottom sheet (0 = collapsed, 1 = expanded) */
  sheetAnimatedIndex?: SharedValue<number>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function BookingMap({ onShopSelect, sheetAnimatedIndex }: BookingMapProps) {
  // ═══════════════ STATE-EFFECT: Refs ═══════════════
  const mapRef = useRef<MapView>(null);

  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const setUserLocation = useBookingStore((state) => state.setUserLocation);
  const mapRegion = useBookingStore((state) => state.mapRegion);
  const setMapRegion = useBookingStore((state) => state.setMapRegion);

  // Shop store subscriptions
  const shopsRecord = useShopStore((state) => state.shops);
  const shopIds = useShopStore((state) => state.shopIds);
  const filters = useShopStore((state) => state.filters);

  // Compute filtered shops based on active filters
  const filteredShops = useMemo(() => {
    // Safety check - ensure we have valid data
    if (!shopIds || !shopsRecord) return [];

    let filtered = shopIds.map((id) => shopsRecord[id]).filter((shop): shop is Shop => shop != null);

    // Filter by availability (show only shops with availability > 0)
    if (filters.availableOnly) {
      filtered = filtered.filter((shop) => shop.availability > 0);
    }

    // Filter by minimum rating
    if (filters.minRating > 0) {
      filtered = filtered.filter((shop) => (shop.rating ?? 0) >= filters.minRating);
    }

    // Filter by service IDs
    if (filters.serviceIds && filters.serviceIds.length > 0) {
      filtered = filtered.filter(
        (shop) => shop.serviceIds && filters.serviceIds.some((serviceId) => shop.serviceIds.includes(serviceId))
      );
    }

    return filtered;
  }, [shopsRecord, shopIds, filters]);

  // Debounce the shops to prevent rapid map updates that crash the app
  const [shops, setShops] = useState<Shop[]>(filteredShops);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const prevFilteredShopsLengthRef = useRef(filteredShops.length);

  useEffect(() => {
    // Clear any pending debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // If showing MORE shops (clearing filters), update immediately
    // If showing FEWER shops (adding filters), debounce to prevent crashes
    const isShowingMore = filteredShops.length > prevFilteredShopsLengthRef.current;
    prevFilteredShopsLengthRef.current = filteredShops.length;

    if (isShowingMore || filteredShops.length === 0) {
      // Immediate update when clearing filters or showing more
      setShops(filteredShops);
    } else {
      // Debounce when filtering down
      debounceRef.current = setTimeout(() => {
        setShops(filteredShops);
      }, 50);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [filteredShops]);

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
      >
        {shops.map((shop) =>
          shop ? <ShopMarker key={`marker-${shop.id}`} shop={shop} onPress={() => handleMarkerPress(shop)} /> : null
        )}
      </MapView>

      {/* Recenter Button - shows when sheet is collapsed */}
      <Animated.View style={[styles.recenterButtonContainer, recenterButtonStyle]}>
        <TouchableOpacity onPress={handleRecenter} activeOpacity={0.6} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
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
