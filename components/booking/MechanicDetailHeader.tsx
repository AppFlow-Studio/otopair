/**
 * MechanicDetailHeader
 *
 * PURPOSE: Header component for mechanic detail page with map background,
 *          shop location pin, shop name, and specialties display.
 *
 * USED IN: app/(booking)/mechanic/[id].tsx
 *
 * PROPS:
 *   - mechanic (Mechanic): The mechanic data to display
 *   - shop (Shop): The shop data containing location coordinates
 *   - onBack (() => void): Called when back button is pressed
 *
 * EXAMPLE:
 *   <MechanicDetailHeader
 *     mechanic={mechanicData}
 *     shop={shopData}
 *     onBack={() => router.back()}
 *   />
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useMemo } from "react";
import { Image, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { ArrowLeft, ArrowRight } from "lucide-react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Region } from "react-native-maps";
import { Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types
import { BorderRadius, Shadows } from "@/constants/theme";
import type { Mechanic, Shop } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

// ============================================================================
// TYPES
// ============================================================================

interface MechanicDetailHeaderProps {
  /** The mechanic data to display */
  mechanic: Mechanic;
  /** The shop data containing location coordinates */
  shop: Shop;
  /** Called when back button is pressed */
  onBack: () => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Height of the header section (excluding safe area) */
const HEADER_CONTENT_HEIGHT = 280;

/** Map region delta for focusing on shop location */
const MAP_DELTA = 0.005;

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicDetailHeader({ mechanic, shop, onBack }: MechanicDetailHeaderProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

  // ═══════════════ STORES ═══════════════
  const availableServices = useBookingStore((state) => state.availableServices);

  const hasValidCoordinates = Number.isFinite(shop.latitude) && Number.isFinite(shop.longitude);

  // ═══════════════ COMPUTED VALUES ═══════════════
  // Map region centered on shop location
  const mapRegion: Region | null = useMemo(() => {
    if (!hasValidCoordinates) {
      return null;
    }

    return {
      latitude: shop.latitude,
      longitude: shop.longitude,
      latitudeDelta: MAP_DELTA,
      longitudeDelta: MAP_DELTA,
    };
  }, [hasValidCoordinates, shop.latitude, shop.longitude]);

  // Map specialty IDs to service names
  const specialtyNames = useMemo(() => {
    if (!mechanic.specialties || mechanic.specialties.length === 0) {
      return [];
    }

    // Create a map of service ID to service name
    const serviceMap = new Map<string, string>();
    availableServices.forEach((service) => {
      serviceMap.set(service.id, service.name);
    });

    // Map specialty IDs to names, filtering out any that don't exist
    return mechanic.specialties
      .map((specialtyId) => serviceMap.get(specialtyId))
      .filter((name): name is string => !!name);
  }, [mechanic.specialties, availableServices]);

  // Calculate total header height including safe area
  const totalHeaderHeight = HEADER_CONTENT_HEIGHT;

  // ═══════════════ RENDER ═══════════════
  return (
    <View style={[styles.container, { height: totalHeaderHeight + insets.top }]}>
      {/* Map Background - Non-interactive */}
      <View style={styles.mapContainer}>
        {mapRegion ? (
          <MapView
            style={styles.map}
            provider={PROVIDER_DEFAULT}
            region={mapRegion}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            zoomTapEnabled={false}
            showsUserLocation={false}
            showsMyLocationButton={false}
            toolbarEnabled={false}
          >
            <Marker coordinate={{ latitude: shop.latitude, longitude: shop.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
              <Image
                source={require("@/assets/images/otopair-ai-logo.png")}
                style={styles.markerImage}
                resizeMode="contain"
              />
            </Marker>
          </MapView>
        ) : (
          <View style={styles.mapFallback} />
        )}

        {/* White Overlay */}
        <View style={styles.whiteOverlay} />
      </View>

      {/* Back Button - Absolute positioned with safe area */}
      <View style={[styles.backButtonContainer, { top: insets.top + Spacing.md, left: Spacing.lg }]}>
        <Pressable onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <View style={styles.backButton}>
            <ArrowLeft size={24} color={BrandColors.primary} />
          </View>
        </Pressable>
      </View>

      {/* Content Overlay - Shop Name and Info */}
      <View style={[styles.contentOverlay, { bottom: Spacing.xs }]}>
        <View style={styles.infoContainer}>
          <Text size="3xl" weight="bold" color={BrandColors.primary} style={styles.shopName}>
            {mechanic.title ?? mechanic.shopName}
          </Text>

          {/* Specialties */}
          {/* {specialtyNames.length > 0 && (
                        <View style={styles.specialtiesContainer}>
                            {specialtyNames.map((specialty, index) => (
                                <View key={index} style={styles.specialtyTag}>
                                    <Text size="sm" weight="medium" color={BrandColors.primary}>
                                        {specialty}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    )} */}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    position: "relative",
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
  },
  map: {
    flex: 1,
  },
  mapFallback: {
    flex: 1,
    backgroundColor: "#E5EEF7",
  },
  whiteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: BrandColors.white,
    opacity: 0.5,
  },
  backButtonContainer: {
    position: "absolute",
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.white,
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
  contentOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
    justifyContent: "flex-end",
  },
  infoContainer: {
    paddingBottom: Spacing.xs,
  },
  shopName: {
    marginBottom: Spacing.xs,
    lineHeight: 40,
  },
  specialtiesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  specialtyTag: {
    backgroundColor: BrandColors.white,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: BrandColors.secondary + "30",
  },
  markerImage: {
    width: 64,
    height: 64,
  },
});
