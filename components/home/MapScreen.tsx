/**
 * MapScreen
 *
 * PURPOSE: Displays a full-screen map with nearby mechanic locations, a header overlay with location info,
 *          and a floating mechanic summary card; used for browsing shops from the Home flow.
 *
 * USED IN: app/(main-tabs)/home/map.tsx
 *
 * PROPS:
 *   - None (screen-level component; uses internal hooks and navigation)
 *
 * EXAMPLE:
 *   <MapScreen />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT, Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { ArrowLeft, BriefcaseBusiness, List } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// SAMPLE DATA & CONSTANTS
// ============================================================================

// Sample mechanic locations (San Francisco area)
const SAMPLE_MECHANICS = [
  {
    id: '1',
    name: 'Premium Auto Care',
    rating: 4.8,
    coordinate: { latitude: 37.7749, longitude: -122.4194 },
  },
  {
    id: '2',
    name: 'Happy Medium Auto',
    rating: 4.8,
    coordinate: { latitude: 37.7849, longitude: -122.4094 },
  },
  {
    id: '3',
    name: 'Quick Fix Garage',
    rating: 4.8,
    coordinate: { latitude: 37.7649, longitude: -122.4294 },
  },
  {
    id: '4',
    name: 'City Auto Service',
    rating: 4.8,
    coordinate: { latitude: 37.7799, longitude: -122.4144 },
  },
];

// Default region (San Francisco) - used as fallback
const DEFAULT_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function MapScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [locationName, setLocationName] = useState('San Francisco, CA');

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
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      });

      // Get location name (reverse geocoding)
      try {
        const [address] = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
        if (address) {
          setLocationName(
            `${address.city || address.subregion || 'Unknown'}, ${address.region || ''}`,
          );
        }
      } catch (error) {
        console.log('Reverse geocoding error:', error);
      }
    })();
  }, []);

  const handleBackToList = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      {/* Map */}
      <MapView
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        region={region}
        showsUserLocation
        showsMyLocationButton
      >
        {SAMPLE_MECHANICS.map((mechanic) => (
          <Marker
            key={mechanic.id}
            coordinate={mechanic.coordinate}
            title={mechanic.name}
            description={`⭐ ${mechanic.rating}`}
          />
        ))}
      </MapView>

      {/* Header Overlay */}
      <View style={[styles.headerOverlay, { paddingTop: insets.top }]}>
        <Pressable
          onPress={handleBackToList}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
        >
          <ArrowLeft size={24} color="#141C24" />
        </Pressable>

        <View style={styles.locationInfo}>
          <Text size="xs" color="#6B7280">
            Your Location
          </Text>
          <Text weight="semiBold" size="sm" color="#141C24">
            {locationName}
          </Text>
        </View>

        <Pressable
          onPress={handleBackToList}
          style={({ pressed }) => [styles.listButton, pressed && styles.buttonPressed]}
        >
          <List size={20} color="#5299FE" />
        </Pressable>
      </View>

      {/* Floating Mechanic Card */}
      <View style={styles.mechanicCardContainer}>
        <BlurView intensity={80} tint="light" style={styles.mechanicCard}>
          <View style={styles.cardContent}>
            <View style={styles.cardIcon}>
              <BriefcaseBusiness size={24} color="#5299FE" />
            </View>
            <View style={styles.cardInfo}>
              <View style={styles.cardHeader}>
                <Text weight="semiBold" size="md" color="#141C24">
                  Premium Auto Care
                </Text>
                <View style={styles.ratingBadge}>
                  <Text size="xs" color="#5299FE">
                    ★
                  </Text>
                  <Text weight="semiBold" size="xs" color="#141C24">
                    4.8
                  </Text>
                </View>
              </View>
              <View style={styles.cardDetails}>
                <Text size="xs" color="#6B7280">
                  1445 Richmond Ave
                </Text>
                <Text size="xs" color="#6B7280">
                  {'  •  '}
                </Text>
                <Text size="xs" color="#6B7280">
                  1.1 Mi
                </Text>
                <Text size="xs" color="#6B7280">
                  {'  •  '}
                </Text>
                <Text size="xs" color="#22C55E" weight="medium">
                  Open
                </Text>
                <View style={styles.verifiedBadge}>
                  <Text size="xs" color="#22C55E">
                    ✓ Verified
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </BlurView>
      </View>

      {/* Bottom Swipe Section - Solid White */}
      <View style={[styles.swipeSection, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.swipeHandle} />
        <Text size="lg" weight="semiBold" color="#000000" style={styles.swipeText}>
          Swipe up for service list
        </Text>
      </View>
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
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  locationInfo: {
    alignItems: 'center',
  },
  listButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  mechanicCardContainer: {
    position: 'absolute',
    bottom: 120,
    left: 16,
    right: 16,
  },
  mechanicCard: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(243, 244, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  swipeSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  swipeHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    marginBottom: 4,
  },
  swipeText: {
    marginBottom: 2,
    marginTop: 8,
  },
});


