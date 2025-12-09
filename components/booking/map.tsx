/**
 * BookingMap
 *
 * PURPOSE: Displays an interactive map with mechanic shop markers for the booking flow
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - onShopSelect ((shop: Shop) => void): Called when a shop marker is tapped [optional]
 *
 * EXAMPLE:
 *   <BookingMap
 *     onShopSelect={(shop) => console.log("Selected:", shop.name)}
 *   />
 *
 * OWNER: Waleed Mansour, Ahmad Hamoudeh
 */

import type { Shop } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { PROVIDER_DEFAULT, Region } from "react-native-maps";
import { ShopMarker } from "./ShopMarker";

// ============================================================================
// TYPES
// ============================================================================

interface BookingMapProps {
  /** Called when a shop marker is tapped */
  onShopSelect?: (shop: Shop) => void;
}

// ============================================================================
// NOTE: Shop data is now managed in useMechanicStore (50 NYC shops)
// ============================================================================

// ============================================================================
// COMPONENT
// ============================================================================

export function BookingMap({ onShopSelect }: BookingMapProps) {
  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const setUserLocation = useBookingStore((state) => state.setUserLocation);
  const mapRegion = useBookingStore((state) => state.mapRegion);
  const setMapRegion = useBookingStore((state) => state.setMapRegion);

  // Select raw state values - don't call getter methods inside selectors (causes infinite loop)
  const shopsRecord = useMechanicStore((state) => state.shops);
  const shopIds = useMechanicStore((state) => state.shopIds);
  const selectedFilter = useMechanicStore((state) => state.selectedFilter);
  const selectedServiceCategory = useMechanicStore((state) => state.selectedServiceCategory);

  // Compute filtered shops based on active filters
  const shops = useMemo(() => {
    let filtered = shopIds.map((id) => shopsRecord[id]).filter(Boolean);

    // Filter by service category (if selected)
    if (selectedServiceCategory) {
      filtered = filtered.filter((shop) => shop.serviceCategories?.includes(selectedServiceCategory));
    }

    // Filter by filter option
    if (selectedFilter === "available_now") {
      // Only show shops with availability > 0 (not closed)
      filtered = filtered.filter((shop) => shop.availability > 0);
    } else if (selectedFilter === "top_rated") {
      // Sort by rating (highest first), then by verified status
      filtered = [...filtered].sort((a, b) => {
        if (b.rating !== a.rating) {
          return b.rating - a.rating;
        }
        return a.isVerified === b.isVerified ? 0 : a.isVerified ? -1 : 1;
      });
    } else if (selectedFilter === "specialists") {
      // Filter by verified shops (as a proxy for specialists)
      filtered = filtered.filter((shop) => shop.isVerified);
    }

    return filtered;
  }, [shopsRecord, shopIds, selectedFilter, selectedServiceCategory]);

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

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={region}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {shops.map((shop) => (
          <ShopMarker key={shop.id} shop={shop} onPress={() => handleMarkerPress(shop)} />
        ))}
      </MapView>
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
});
