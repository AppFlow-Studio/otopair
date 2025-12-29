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
import { useRouter } from 'expo-router';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

interface NavigationETABarProps {
  etaMinutes: number;
  destinationLatitude?: number;
  destinationLongitude?: number;
  destinationName?: string;
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
  etaMinutes,
  destinationLatitude = DEFAULT_LOCATION.latitude,
  destinationLongitude = DEFAULT_LOCATION.longitude,
  destinationName = 'Premium Auto Care',
}: NavigationETABarProps) {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

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

  // Use user location if available, otherwise use default
  const currentLatitude = userLocation?.latitude ?? DEFAULT_LOCATION.latitude;
  const currentLongitude = userLocation?.longitude ?? DEFAULT_LOCATION.longitude;
  
  const handleNavigate = () => {
    router.push('/home/map');
  };

  return (
    <View style={styles.container}>
      {/* Full Map Background - centered on user location, shifted right so pin shows on left */}
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
            <Text weight="bold" size="md" color="#141C24">{etaMinutes} min</Text>
          </View>

          <Pressable
            onPress={handleNavigate}
            style={({ pressed }) => [
              styles.navigateButton,
              pressed && styles.navigateButtonPressed,
            ]}
          >
            <Text weight="semiBold" size="sm" color="#FFFFFF">
              Navigate-{etaMinutes} Min
            </Text>
          </Pressable>
        </BlurView>
      </View>
    </View>
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
});

export default NavigationETABar;
