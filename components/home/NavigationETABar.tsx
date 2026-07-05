/**
 * NavigationETABar
 *
 * PURPOSE: Displays a glassy blur overlay with map preview, ETA information, and navigation button for active service appointments
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - etaMinutes (number): Estimated time of arrival in minutes
 *   - destinationLatitude (number): Destination latitude coordinate [optional]
 *   - destinationLongitude (number): Destination longitude coordinate [optional]
 *   - destinationName (string): Name of the destination location [optional]
 *
 * EXAMPLE:
 *   <NavigationETABar
 *     etaMinutes={15}
 *     destinationLatitude={37.7749}
 *     destinationLongitude={-122.4194}
 *     destinationName="Premium Auto Care"
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Utils
import { calculateDistanceKm } from '@/utils/geo';
import { openMapsForAddress, openMapsForCoordinates } from '@/utils/linking';

// ============================================================================
// TYPES
// ============================================================================

interface NavigationETABarProps {
  /**
   * Pre-computed ETA in minutes. When omitted, the component computes
   * a rough estimate from straight-line distance × a road factor at
   * an average urban driving speed. The real navigation app shows the
   * authoritative time once the user taps Navigate.
   */
  etaMinutes?: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
  destinationName?: string;
  /**
   * Postal address fallback for the destination. Used when lat/lng
   * are missing or invalid (e.g., the shop record hasn't been
   * geocoded yet) — the maps app will geocode the string itself.
   */
  destinationAddress?: string;
}

function hasValidCoords(lat: number | undefined, lng: number | undefined): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  // Treat 0,0 as missing — it's the default fallback callers use when
  // the shop hasn't been geocoded, and it's in the middle of the ocean.
  if (lat === 0 && lng === 0) return false;
  return true;
}

// Default location (San Francisco) - used as fallback
const DEFAULT_LOCATION = {
  latitude: 37.7749,
  longitude: -122.4194,
};

// Rough drive-time estimate: scale straight-line distance to account
// for roads (~1.3×) at a typical urban average speed (~40 km/h).
// Good enough for a glanceable home-screen pill; the user's map app
// shows the precise routed time on Navigate.
const ROAD_DISTANCE_FACTOR = 1.3;
const AVG_DRIVING_KMH = 40;

function estimateDriveMinutes(distanceKm: number): number {
  const hours = (distanceKm * ROAD_DISTANCE_FACTOR) / AVG_DRIVING_KMH;
  return Math.max(1, Math.round(hours * 60));
}

// ============================================================================
// COMPONENT
// ============================================================================

export function NavigationETABar({
  etaMinutes,
  destinationLatitude,
  destinationLongitude,
  destinationName = 'Premium Auto Care',
  destinationAddress,
}: NavigationETABarProps) {
  const coordsValid = hasValidCoords(destinationLatitude, destinationLongitude);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // When the shop record lacks coords but has a postal address, geocode
  // the address once so the ETA can still compute. The maps app handles
  // the address itself on Navigate; this lookup is purely for the ETA
  // estimate.
  const [geocodedDest, setGeocodedDest] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  // Map preview centers on the user's location; the destination only
  // affects ETA + the Navigate target. Prefer explicit coords; otherwise
  // use the geocoded address result if we have one.
  const destLat = coordsValid
    ? (destinationLatitude as number)
    : geocodedDest?.latitude ?? null;
  const destLng = coordsValid
    ? (destinationLongitude as number)
    : geocodedDest?.longitude ?? null;

  useEffect(() => {
    (async () => {
      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  useEffect(() => {
    // Skip when we already have real coords, or when there's no
    // address to resolve. Re-run if the address changes (e.g., the
    // upcoming booking switches to a different shop).
    if (coordsValid) {
      setGeocodedDest(null);
      return;
    }
    const address = destinationAddress?.trim();
    if (!address) {
      setGeocodedDest(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const results = await Location.geocodeAsync(address);
        if (cancelled) return;
        const first = results[0];
        if (first) {
          setGeocodedDest({ latitude: first.latitude, longitude: first.longitude });
        }
      } catch {
        // Geocoding can fail offline / rate-limited — leave ETA as "—".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [coordsValid, destinationAddress]);

  // Use user location if available, otherwise use default
  const currentLatitude = userLocation?.latitude ?? DEFAULT_LOCATION.latitude;
  const currentLongitude = userLocation?.longitude ?? DEFAULT_LOCATION.longitude;

  // Prefer a caller-supplied ETA; otherwise estimate from haversine
  // distance once we have a real user fix AND a real destination.
  // While either is missing we render a dash rather than a
  // misleading number.
  const computedEtaMinutes =
    userLocation && destLat !== null && destLng !== null
      ? estimateDriveMinutes(
          calculateDistanceKm(
            userLocation.latitude,
            userLocation.longitude,
            destLat,
            destLng,
          ),
        )
      : null;
  const displayEta = etaMinutes ?? computedEtaMinutes;
  const etaLabel = displayEta !== null ? `${displayEta} min` : '—';
  const buttonLabel =
    displayEta !== null ? `Navigate-${displayEta} Min` : 'Navigate';

  const canNavigate = coordsValid || !!destinationAddress?.trim();

  const handleNavigate = () => {
    // Prefer coordinates when present (no geocoding needed); fall back
    // to the address string so the maps app can resolve it itself.
    // Without either, do nothing — opening 0,0 strands the user in
    // the middle of the ocean.
    if (destLat !== null && destLng !== null) {
      void openMapsForCoordinates(destLat, destLng, destinationName);
      return;
    }
    if (destinationAddress?.trim()) {
      void openMapsForAddress(destinationAddress.trim());
    }
  };

  return (
    // Whole card is tappable — anywhere on the map preview opens
    // Apple Maps to the shop's destination, same as the Navigate
    // pill inside. The inner Pressable stays as a separate affordance
    // for the button-style visual but both routes hit handleNavigate.
    <Pressable
      style={({ pressed }) => [
        styles.container,
        pressed && canNavigate ? styles.containerPressed : null,
      ]}
      onPress={handleNavigate}
      disabled={!canNavigate}
      accessibilityRole="button"
      accessibilityLabel={`Navigate to ${destinationName}`}
    >
      {/* Full Map Background - centered on user location, shifted right so pin shows on left.
          scrollEnabled/zoomEnabled/etc all false — the MapView is decorative,
          taps bubble up to the outer Pressable. */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={{
          latitude: currentLatitude,
          longitude: currentLongitude + 0.035,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsUserLocation={false}
        pointerEvents="none"
      >
        {/* Current Location Pin - shows user's actual location */}
        <Marker
          coordinate={{
            latitude: currentLatitude,
            longitude: currentLongitude - 0.002,
          }}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.locationPinContainer}>
            <View style={styles.locationPinOuter} />
            <View style={styles.locationPinInner} />
          </View>
        </Marker>
      </MapView>

      {/* Overlay - ETA Pill with Glass Effect */}
      <View style={styles.overlay}>
        <BlurView
          intensity={80}
          tint="light"
          style={styles.etaPill}
        >
          <View style={styles.etaContainer}>
            <Text size="sm" color="#6B7280">ETA: </Text>
            <Text weight="bold" size="md" color="#141C24">{etaLabel}</Text>
          </View>

          <Pressable
            onPress={handleNavigate}
            disabled={!canNavigate}
            style={({ pressed }) => [
              styles.navigateButton,
              pressed && styles.navigateButtonPressed,
              !canNavigate && styles.navigateButtonDisabled,
            ]}
          >
            <Text weight="semiBold" size="sm" color="#FFFFFF">
              {buttonLabel}
            </Text>
          </Pressable>
        </BlurView>
      </View>
    </Pressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  containerPressed: {
    opacity: 0.85,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  locationPinContainer: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationPinOuter: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(82, 153, 254, 0.25)',
  },
  locationPinInner: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#5299FE',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'flex-end',
    paddingRight: 12,
    paddingLeft: 80,
  },
  etaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    paddingLeft: 16,
    paddingRight: 4,
    paddingVertical: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  etaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  navigateButton: {
    backgroundColor: '#1F2937',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 4,
  },
  navigateButtonPressed: {
    opacity: 0.8,
  },
  navigateButtonDisabled: {
    opacity: 0.4,
  },
});

export default NavigationETABar;
