/**
 * MechanicDetailHeader
 *
 * PURPOSE: Hero map for the shop detail page. Renders a real Apple
 *          Maps view (PROVIDER_DEFAULT on iOS) tightly zoomed on the
 *          shop's coordinates with a branded pin. Map gestures are
 *          disabled so the page scroll isn't fighting the map.
 *
 *          Shop name + stats + actions live in the floating
 *          ShopHeroCard below this — keep this component purely the
 *          map + a floating back button.
 *
 * USED IN: app/booking/mechanic/[id]/index.tsx, app/booking/shop/[id]/index.tsx
 *
 * PROPS:
 *   - shop: Shop containing latitude/longitude
 *   - onBack: Called when back button is pressed
 *
 * OWNER: Ahmad (rewritten from Temurbek's original — overlay removed)
 */

import React, { useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ArrowLeft } from "lucide-react-native";
import MapView, { Marker, PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandColors, Spacing } from "@/components/shared-ui";
import { BorderRadius, Shadows } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";

interface MechanicDetailHeaderProps {
  shop: Shop;
  onBack: () => void;
}

/** Header content height (excluding safe area). The floating
 *  ShopHeroCard overlaps the bottom of this by ~24px. */
const HEADER_CONTENT_HEIGHT = 240;

/** Map region delta — tight enough to see streets + the shop pin. */
const MAP_DELTA = 0.004;

export function MechanicDetailHeader({ shop, onBack }: MechanicDetailHeaderProps) {
  const insets = useSafeAreaInsets();

  const hasCoords =
    typeof shop.latitude === "number" &&
    typeof shop.longitude === "number" &&
    !Number.isNaN(shop.latitude) &&
    !Number.isNaN(shop.longitude);

  if (!hasCoords) {
    console.warn(
      "[MechanicDetailHeader] shop is missing lat/lng — rendering a neutral hero instead of the map",
      { shopId: shop.id, shopName: shop.name },
    );
  }

  const mapRegion: Region = useMemo(
    () => ({
      latitude: shop.latitude ?? 0,
      longitude: shop.longitude ?? 0,
      latitudeDelta: MAP_DELTA,
      longitudeDelta: MAP_DELTA,
    }),
    [shop.latitude, shop.longitude],
  );

  return (
    <View style={[styles.container, { height: HEADER_CONTENT_HEIGHT + insets.top }]}>
      {hasCoords ? (
        <MapView
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          region={mapRegion}
          scrollEnabled={false}
          zoomEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          zoomTapEnabled={false}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          showsCompass={false}
          showsPointsOfInterest
          legalLabelInsets={{ top: -1000, left: -1000, right: -1000, bottom: -1000 }}
        >
          <Marker
            coordinate={{
              latitude: shop.latitude as number,
              longitude: shop.longitude as number,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.shopDotRing}>
              <View style={styles.shopDotInner} />
            </View>
          </Marker>
        </MapView>
      ) : (
        // Fallback if a shop is missing coordinates — neutral pale-blue
        // wash so the layout still works.
        <View style={[StyleSheet.absoluteFill, styles.mapFallback]} />
      )}

      {/* Floating back button */}
      <Pressable
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        style={[
          styles.backButtonContainer,
          { top: insets.top + Spacing.md, left: Spacing.lg },
        ]}
      >
        <View style={styles.backButton}>
          <ArrowLeft size={22} color={BrandColors.primary} />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    backgroundColor: "#EEF4FB",
    overflow: "hidden",
  },
  mapFallback: {
    backgroundColor: "#DBEAFE",
  },
  // Shop's location marker — small two-layer blue dot styled to read
  // like the iOS native location indicator, but in OtoPair brand blue
  // so it's visually distinct from the user's own blue location halo
  // (now also visible via showsUserLocation).
  shopDotRing: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.sm,
  },
  shopDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: BrandColors.secondary,
  },
  backButtonContainer: {
    position: "absolute",
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },
});
