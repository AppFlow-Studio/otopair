/**
 * BookingMap
 *
 * PURPOSE: Displays an interactive map with mechanic shop markers for the booking flow
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - onShopSelect ((shop: Shop) => void): Called when a shop marker is tapped [optional]
 *   - selectedShopId (string): ID of currently selected shop for highlighting [optional]
 *
 * EXAMPLE:
 *   <BookingMap
 *     onShopSelect={(shop) => console.log("Selected:", shop.name)}
 *     selectedShopId="shop_1"
 *   />
 *
 * OWNER: Waleed Mansour, Ahmad Hamoudeh
 */

import { BrandColors } from "@/components/shared-ui";
import type { Shop } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import * as Location from "expo-location";
import React, { useCallback, useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";

// ============================================================================
// TYPES
// ============================================================================

interface BookingMapProps {
  /** Called when a shop marker is tapped */
  onShopSelect?: (shop: Shop) => void;
  /** ID of currently selected shop for highlighting */
  selectedShopId?: string;
}

// ============================================================================
// SAMPLE DATA (TODO: Replace with API data)
// ============================================================================

export const SAMPLE_SHOPS: Shop[] = [
  {
    id: "shop_1",
    name: "Premium Auto Care",
    rating: 4.8,
    address: "1445 Richmond Ave",
    distance: "1.1 Mi",
    isOpen: true,
    isVerified: true,
    coordinate: { latitude: 37.7749, longitude: -122.4194 },
  },
  {
    id: "shop_2",
    name: "Happy Medium Auto",
    rating: 4.6,
    address: "2100 Market St",
    distance: "1.8 Mi",
    isOpen: true,
    isVerified: true,
    coordinate: { latitude: 37.7849, longitude: -122.4094 },
  },
  {
    id: "shop_3",
    name: "Quick Fix Garage",
    rating: 4.5,
    address: "890 Valencia St",
    distance: "2.2 Mi",
    isOpen: false,
    isVerified: false,
    coordinate: { latitude: 37.7649, longitude: -122.4294 },
  },
  {
    id: "shop_4",
    name: "City Auto Service",
    rating: 4.9,
    address: "555 Mission St",
    distance: "0.8 Mi",
    isOpen: true,
    isVerified: true,
    coordinate: { latitude: 37.7799, longitude: -122.4144 },
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function BookingMap({ onShopSelect, selectedShopId }: BookingMapProps) {
  // ═══════════════ STATE-EFFECT: Store Subscriptions ═══════════════
  const userLocation = useBookingStore((state) => state.userLocation);
  const setUserLocation = useBookingStore((state) => state.setUserLocation);
  const mapRegion = useBookingStore((state) => state.mapRegion);
  const setMapRegion = useBookingStore((state) => state.setMapRegion);

  // Select raw state values - don't call getter methods inside selectors (causes infinite loop)
  const shopsRecord = useMechanicStore((state) => state.shops);
  const shopIds = useMechanicStore((state) => state.shopIds);

  // Compute derived values using useMemo
  const shops = useMemo(() => {
    return shopIds.map((id) => shopsRecord[id]).filter(Boolean);
  }, [shopsRecord, shopIds]);

  // ═══════════════ STATE-EFFECT: Computed Values ═══════════════
  const region: Region = mapRegion || {
    latitude: userLocation?.latitude || 37.7749,
    longitude: userLocation?.longitude || -122.4194,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
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
          <Marker
            key={shop.id}
            coordinate={shop.coordinate}
            title={shop.name}
            description={`★ ${shop.rating}`}
            onPress={() => handleMarkerPress(shop)}
            pinColor={shop.id === selectedShopId ? BrandColors.secondary : BrandColors.primary}
          />
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
