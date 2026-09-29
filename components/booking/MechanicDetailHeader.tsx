/**
 * MechanicDetailHeader
 *
 * PURPOSE: Hero map for the shop detail page. Renders a real Apple
 *          Maps view (PROVIDER_DEFAULT on iOS) centred on this shop,
 *          with the branded Otopair pin for this shop AND every other
 *          bookable shop nearby — the same ShopPinMarker the booking
 *          flow uses, so a pin means the same thing everywhere.
 *
 *          Pan and zoom are ENABLED (Ahmad, 2026-09-23). They used to
 *          be off so the page scroll wasn't fighting the map, and the
 *          result read as a screenshot: a fixed frame, one flat dot,
 *          no other shops. The trade-off is real and deliberate — a
 *          vertical drag STARTED on the map now pans the map instead
 *          of scrolling the page. The map is 240pt of a scrolling
 *          page, so there is always content below to scroll from.
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

import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { ArrowLeft } from "lucide-react-native";
import MapView, { PROVIDER_DEFAULT, type Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandColors, Spacing } from "@/components/shared-ui";
import { BorderRadius, Shadows } from "@/constants/theme";
import type { Shop } from "@/stores/types/store.types";
import { ShopPinMarker } from "@/components/booking-flow/ShopPinMarker";
import { useShopsFromConvex } from "@/hooks/useShopsFromConvex";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

interface MechanicDetailHeaderProps {
  shop: Shop;
  onBack: () => void;
}

/** Header content height (excluding safe area). The floating
 *  ShopHeroCard overlaps the bottom of this by ~24px. */
const HEADER_CONTENT_HEIGHT = 240;

/** Map region delta — tight enough to see streets + the shop pin. */
const MAP_DELTA = 0.004;

/** How far out to pin other shops, in degrees (~0.09 deg lat is ~6 mi).
 *  Generous enough that zooming out finds neighbours, tight enough that a
 *  nationwide shop list doesn't all land in one header. */
const NEARBY_DEGREES = 0.09;

/** Hard cap on nearby pins. Each one is a rendered view on the map; a
 *  dense city block should not cost 200 of them. */
const MAX_NEARBY_PINS = 25;

export function MechanicDetailHeader({ shop, onBack }: MechanicDetailHeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const mapRef = useRef<MapView | null>(null);
  const { shops: allShops } = useShopsFromConvex();

  const hasCoords =
    typeof shop.latitude === "number" &&
    typeof shop.longitude === "number" &&
    !Number.isNaN(shop.latitude) &&
    !Number.isNaN(shop.longitude) &&
    // Reject (0, 0) — null island in the Atlantic, almost always a missing-data sentinel.
    !(shop.latitude === 0 && shop.longitude === 0);

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

  /** Other bookable shops worth pinning: real coords, not this one, and
   *  close enough that they'd actually appear in this frame at any sane
   *  zoom. Unbounded pins would turn a 240pt header into a pin cloud. */
  const nearbyShops = useMemo(() => {
    if (!hasCoords) return [];
    const lat = shop.latitude as number;
    const lng = shop.longitude as number;
    return allShops
      .filter((s) => s.id !== shop.id)
      .filter(
        (s) =>
          typeof s.latitude === "number" &&
          typeof s.longitude === "number" &&
          !(s.latitude === 0 && s.longitude === 0),
      )
      .filter(
        (s) =>
          Math.abs(s.latitude - lat) < NEARBY_DEGREES &&
          Math.abs(s.longitude - lng) < NEARBY_DEGREES,
      )
      .slice(0, MAX_NEARBY_PINS);
  }, [allShops, hasCoords, shop.id, shop.latitude, shop.longitude]);

  /** Tapping this shop's own pin after panning away brings you back —
   *  cheaper than hunting for it, and the only "reset" affordance the
   *  header has room for. */
  const recenter = useCallback(() => {
    mapRef.current?.animateToRegion(mapRegion, 350);
  }, [mapRegion]);

  const goToShop = useCallback(
    (shopId: string) => {
      router.push({ pathname: "/booking/shop/[id]", params: { id: shopId } });
    },
    [router],
  );

  // Recentre when the shop changes. With `initialRegion` the map keeps
  // whatever the user panned to, which is right for a gesture and wrong
  // when the underlying shop is swapped out from under it.
  useEffect(() => {
    if (!hasCoords) return;
    mapRef.current?.animateToRegion(mapRegion, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shop.id]);

  return (
    <View style={[styles.container, { height: HEADER_CONTENT_HEIGHT + insets.top }]}>
      {hasCoords ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          // initialRegion, NOT region. A controlled `region` re-applies on
          // every render, so each pan snapped straight back to the shop and
          // the map behaved exactly like a picture of itself. Recentring on
          // a shop change is handled by the effect above instead.
          initialRegion={mapRegion}
          scrollEnabled
          zoomEnabled
          pitchEnabled={false}
          rotateEnabled={false}
          showsUserLocation
          showsMyLocationButton={false}
          toolbarEnabled={false}
          showsCompass={false}
          // `showsPointsOfInterests` — the plural IS the library's spelling.
          // It has read `showsPointsOfInterest` since this file was written, so
          // the prop silently did nothing and the POI labels you can see came
          // from the default. Fixed while making this a real map.
          showsPointsOfInterests
          legalLabelInsets={{ top: -1000, left: -1000, right: -1000, bottom: -1000 }}
        >
          {/* This shop, always rendered and always selected. Kept separate
              from the nearby list so it still pins when the shops query is
              loading, empty, or missing this shop. */}
          <ShopPinMarker
            latitude={shop.latitude as number}
            longitude={shop.longitude as number}
            rating={shop.rating ?? null}
            shopName={shop.name}
            isSelected
            onPress={recenter}
          />
          {nearbyShops.map((s) => (
            <ShopPinMarker
              key={s.id}
              latitude={s.latitude}
              longitude={s.longitude}
              rating={s.rating}
              shopName={s.name}
              isSelected={false}
              onPress={() => goToShop(s.id)}
            />
          ))}
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
