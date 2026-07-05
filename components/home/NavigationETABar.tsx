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
import { ArrowRight, MapPin } from 'lucide-react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Utils
import { openMapsForAddress, openMapsForCoordinates } from '@/utils/linking';

// ============================================================================
// TYPES
// ============================================================================

interface NavigationETABarProps {
  /**
   * Historically a caller-supplied ETA in minutes. The card no
   * longer surfaces a numeric ETA — Apple Maps shows the routed
   * time on tap — so this prop is accepted but ignored. Kept in
   * the interface for backward compat with existing call sites.
   */
  etaMinutes?: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
  destinationName?: string;
  /**
   * Postal address fallback for the destination. Used by the tap
   * handler when lat/lng are missing or invalid (0, 0) — the maps
   * app will geocode the string itself.
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

// ============================================================================
// COMPONENT
// ============================================================================

export function NavigationETABar({
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

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Location permission denied');
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    })();
  }, []);

  // Use user location if available, otherwise use default
  const currentLatitude = userLocation?.latitude ?? DEFAULT_LOCATION.latitude;
  const currentLongitude = userLocation?.longitude ?? DEFAULT_LOCATION.longitude;

  const canNavigate = coordsValid || !!destinationAddress?.trim();

  // Subtle "alive" pulse on the Go Now button. Scales 1.0 → 1.05 →
  // 1.0 in a slow 1.2s ease-in-out loop so the CTA gently breathes
  // — enough to catch the eye without being annoying. Runs only
  // when the button is actually navigable; disabled state stays
  // static.
  const pulseScale = useSharedValue(1);
  useEffect(() => {
    if (!canNavigate) {
      pulseScale.value = 1;
      return;
    }
    pulseScale.value = withRepeat(
      withTiming(1.05, {
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true, // reverse
    );
  }, [canNavigate, pulseScale]);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  // Nudge the arrow to the right in sync with the pulse for a
  // "let's go" feel. Slightly smaller amplitude so it reads as a
  // subtle push rather than a fidget.
  const arrowShift = useSharedValue(0);
  useEffect(() => {
    if (!canNavigate) {
      arrowShift.value = 0;
      return;
    }
    arrowShift.value = withRepeat(
      withTiming(3, {
        duration: 1200,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [canNavigate, arrowShift]);
  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: arrowShift.value }],
  }));

  const handleNavigate = () => {
    // Prefer coordinates when present; fall back to the address string
    // so the maps app can resolve it itself. Without either, do
    // nothing — opening 0,0 strands the user in the middle of the
    // ocean.
    if (coordsValid) {
      void openMapsForCoordinates(
        destinationLatitude as number,
        destinationLongitude as number,
        destinationName,
      );
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
      {/* Map background — centered on the SHOP'S coordinates (not
          the user's) so the preview reads as "here's where you're
          going." Falls back to the user's location only when the
          shop record has no valid coords yet. Region longitude
          shifted so the destination pin sits left-of-center,
          leaving room on the right for the Navigate CTA overlay.
          scrollEnabled/zoomEnabled/etc all false — the MapView is
          decorative, taps bubble up to the outer Pressable. */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={{
          latitude: coordsValid
            ? (destinationLatitude as number)
            : currentLatitude,
          longitude:
            (coordsValid
              ? (destinationLongitude as number)
              : currentLongitude) + 0.008,
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
        {/* Destination pin — shows where the SHOP is on the map,
            not where the user is. Uses the brand-blue treatment
            we already had for the previous user-location pin. */}
        {coordsValid ? (
          <Marker
            coordinate={{
              latitude: destinationLatitude as number,
              longitude: destinationLongitude as number,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.locationPinContainer}>
              <View style={styles.locationPinOuter} />
              <View style={styles.locationPinInner} />
            </View>
          </Marker>
        ) : null}
      </MapView>

      {/* Destination chip — anchors the map to a specific shop so
          it's obvious the card is "your active booking's shop,"
          not a generic map. Sits at the top-left with a glassy
          backing so the map still reads through. */}
      <BlurView
        intensity={90}
        tint="light"
        style={styles.destChip}
      >
        <MapPin size={12} color="#1F2937" strokeWidth={2.4} />
        <Text
          size="xs"
          weight="bold"
          color="#141C24"
          numberOfLines={1}
          style={styles.destChipText}
        >
          {destinationName}
        </Text>
      </BlurView>

      {/* Overlay — Navigate CTA only. The numeric ETA (both the
          "ETA: N min" text and the "-N Min" suffix on the button)
          used to live here but was a Haversine × road-factor
          heuristic, not a routed drive time, so it could be
          materially off from what Apple Maps actually shows.
          Rather than lie or apologize with a tilde, drop the
          number entirely — the button just says "Navigate" and
          Apple Maps shows the real ETA on tap. */}
      <View style={styles.overlay}>
        <Animated.View style={pulseStyle}>
          <Pressable
            onPress={handleNavigate}
            disabled={!canNavigate}
            style={({ pressed }) => [
              styles.navigateButton,
              pressed && styles.navigateButtonPressed,
              !canNavigate && styles.navigateButtonDisabled,
            ]}
          >
            <Text weight="bold" size="md" color="#FFFFFF">
              Go Now
            </Text>
            <Animated.View style={[styles.arrowSlot, arrowStyle]}>
              <ArrowRight size={16} color="#FFFFFF" strokeWidth={2.5} />
            </Animated.View>
          </Pressable>
        </Animated.View>
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
  destChip: {
    // Top-left liquid-glass pill — Apple iOS 26 style. Heavy
    // BlurView (already applied) + very translucent white fill +
    // a subtle bright border give it that "frosted lens sitting
    // over the map" feel, not the flat white chip it was before.
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.32)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.7)',
    overflow: 'hidden',
    maxWidth: '55%',
  },
  destChipText: {
    flexShrink: 1,
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
  navigateButton: {
    // Row so the "Go Now" label sits alongside the animated arrow.
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#5299FE',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    // Soft brand-blue glow so the button feels lit-up rather than
    // flat — reinforces the "alive" pulse.
    shadowColor: '#5299FE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 6,
  },
  arrowSlot: {
    // Wrapper so the arrow can translate independently of the
    // label. No sizing — the icon inside supplies its own bounds.
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigateButtonPressed: {
    opacity: 0.8,
  },
  navigateButtonDisabled: {
    opacity: 0.4,
  },
});

export default NavigationETABar;
