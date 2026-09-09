/**
 * Persistent booking-flow map.
 *
 * One MapView for the whole `(booking-flow)` stack, mounted once in
 * the layout behind the `<Stack>`. Screens used to each mount their
 * own MapView, so every navigation remounted the map — tiles
 * reloaded and the provider re-initialised, which read as a choppy
 * flash between screens. Hoisting a single instance above the
 * navigator means the map never unmounts during in-flow navigation;
 * the screens are transparent and just slide their sheets over a
 * stable map.
 *
 * Screens drive the shared map through context rather than props:
 *  - `setInteractive(false)` + `setMarkers([])` — the locked backdrop
 *    used by Screen 1 (select-services) and Screen 2 (category).
 *  - `setInteractive(true)` + `setMarkers([...])` + `mapRef` — Screen
 *    3 (choose-mechanic), which pans/zooms the camera imperatively.
 *
 * The map is uncontrolled (initialRegion only) and every camera move
 * goes through `mapRef.animateToRegion`, so the locked and interactive
 * screens never fight a controlled `region` prop on the same instance.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import MapView, {
  Circle,
  Marker,
  PROVIDER_DEFAULT,
  type Region,
} from "react-native-maps";
import { Text } from "@/components/shared-ui";
import { BrandColors, SemanticColors } from "@/constants/theme";
import { useStagedLocation } from "@/hooks/useStagedLocation";
import { useBookingStore } from "@/stores/useBookingStore";
import {
  RatingMarkerPill,
  RATING_MARKER_REPAINT_MS,
} from "@/components/booking-flow/RatingMarkerPill";
import { MapSkeleton } from "@/components/booking-flow/MapSkeleton";
import type { UserLocation } from "@/stores/types/store.types";

/** Hard stop on the skeleton. `onMapLoaded` is not guaranteed to fire —
 *  a misconfigured Google Maps key, for one, leaves it silent — and a
 *  surface that shimmers forever reads worse than a static one. Past
 *  this we drop the skeleton and show whatever the map managed. */
const MAP_READY_TIMEOUT_MS = 6000;

export interface BookingFlowMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
}

/** ChatGPT-style shop pin: rendered as a Marker whose child is a
 *  `<RatingMarkerPill>`. Kept as a separate setter from `setMarkers`
 *  so the bare-title-only contract stays compatible for any future
 *  caller that just wants a default pin.
 *
 *  `isSelected` drives the black-vs-white pill background. `onPress`
 *  fires when the user taps the marker — choose-mechanic uses it to
 *  swap the active shop + scroll the carousel below to that page. */
export interface BookingFlowShopPin {
  shopId: string;
  latitude: number;
  longitude: number;
  shopName: string;
  rating: number | null;
  isSelected: boolean;
  onPress?: () => void;
}

interface BookingFlowMapContextValue {
  /** Imperative handle — choose-mechanic animates the camera through it. */
  mapRef: React.RefObject<MapView | null>;
  /** Resolved user (or fallback) region — the default camera target. */
  region: Region | null;
  /** User coordinates when permission is granted; null otherwise. */
  userLocation: UserLocation | null;
  /** Toggle pan/zoom/rotate gestures (off = locked backdrop). */
  setInteractive: (interactive: boolean) => void;
  /** Replace the rendered markers (default pins, title-only). */
  setMarkers: (markers: BookingFlowMarker[]) => void;
  /** Replace the rendered shop pins (ChatGPT-style rating pills with
   *  shop names and tap handlers). Iterated separately from `markers`
   *  in the render block so a caller can use either or both. */
  setShopPins: (pins: BookingFlowShopPin[]) => void;
}

const BookingFlowMapContext =
  createContext<BookingFlowMapContextValue | null>(null);

export function useBookingFlowMap(): BookingFlowMapContextValue {
  const ctx = useContext(BookingFlowMapContext);
  if (!ctx) {
    throw new Error(
      "useBookingFlowMap must be used within a BookingFlowMapProvider",
    );
  }
  return ctx;
}

export function BookingFlowMapProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const mapRef = useRef<MapView | null>(null);
  const { location: resolvedLocation, stage, isResolving } = useStagedLocation();
  const region = useMemo<Region | null>(
    () =>
      resolvedLocation
        ? {
            latitude: resolvedLocation.latitude,
            longitude: resolvedLocation.longitude,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }
        : null,
    [resolvedLocation],
  );
  const setBookingUserLocation = useBookingStore((s) => s.setUserLocation);
  const clearBookingUserLocation = useBookingStore((s) => s.clearUserLocation);
  const setLocationLoading = useBookingStore((s) => s.setLocationLoading);
  const [interactive, setInteractive] = useState(false);
  const [markers, setMarkers] = useState<BookingFlowMarker[]>([]);
  const [shopPins, setShopPins] = useState<BookingFlowShopPin[]>([]);
  // Skeleton covers two distinct waits: `region === null` (permission
  // check + location fix still in flight) and the gap between MapView
  // mounting and the provider painting its first tiles. Dismissal is
  // keyed to `onMapLoaded` (tiles rendered), NOT `onMapReady` — ready
  // fires when the map object initialises, seconds before anything is
  // drawn, which left the user staring at Google's blank beige canvas.
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setLocationLoading(isResolving);
  }, [isResolving, setLocationLoading]);

  useEffect(() => {
    if (resolvedLocation) {
      setBookingUserLocation(resolvedLocation);
    } else if (!isResolving) {
      clearBookingUserLocation();
    }
  }, [clearBookingUserLocation, isResolving, resolvedLocation, setBookingUserLocation]);

  useEffect(() => {
    if (region) mapRef.current?.animateToRegion(region, 450);
  }, [region]);

  // Start the fallback timer only once the MapView is actually mounted
  // (`region` resolved) — otherwise a slow permission prompt burns the
  // window before the map ever gets a chance to report in.
  useEffect(() => {
    if (!region || mapReady) return;
    const t = setTimeout(() => setMapReady(true), MAP_READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [region, mapReady]);

  const setInteractiveCb = useCallback(
    (next: boolean) => setInteractive(next),
    [],
  );
  const setMarkersCb = useCallback(
    (next: BookingFlowMarker[]) => setMarkers(next),
    [],
  );
  const setShopPinsCb = useCallback(
    (next: BookingFlowShopPin[]) => setShopPins(next),
    [],
  );

  return (
    <BookingFlowMapContext.Provider
      value={{
        mapRef,
        region,
        userLocation: resolvedLocation,
        setInteractive: setInteractiveCb,
        setMarkers: setMarkersCb,
        setShopPins: setShopPinsCb,
      }}
    >
      <View style={styles.root} pointerEvents="box-none">
        {/* Persistent map behind every screen. Gesture props on the
            MapView are ALWAYS on — react-native-maps has been spotty
            about re-applying scrollEnabled/zoomEnabled mid-mount, so
            we let the MapView always think it's interactive and gate
            real touches at the wrapper's pointerEvents instead. When
            `interactive` is false the wrapper blocks all touches, so
            the MapView never sees a gesture; when true, touches
            arrive on an already-configured MapView. */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={interactive ? "auto" : "none"}
        >
          {region ? (
            <MapView
              ref={mapRef}
              style={StyleSheet.absoluteFill}
              provider={PROVIDER_DEFAULT}
              initialRegion={region}
              onMapLoaded={() => setMapReady(true)}
              showsUserLocation
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled
            >
              {resolvedLocation?.accuracyMeters && resolvedLocation.source !== "precise" ? (
                <Circle
                  center={{
                    latitude: resolvedLocation.latitude,
                    longitude: resolvedLocation.longitude,
                  }}
                  radius={Math.max(resolvedLocation.accuracyMeters, 250)}
                  fillColor="rgba(82, 153, 254, 0.16)"
                  strokeColor="rgba(82, 153, 254, 0.35)"
                  strokeWidth={1}
                />
              ) : null}
              {markers.map((m) => (
                <Marker
                  key={m.id}
                  coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                  title={m.title}
                />
              ))}
              {shopPins.map((p) => (
                <BookingFlowShopPinMarker
                  key={p.shopId}
                  pin={p}
                />
              ))}
            </MapView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.fallback]}>
              <Text size="sm" weight="semiBold" color={SemanticColors.textMuted}>
                {stage === "unavailable"
                  ? "Enable location to see nearby shops"
                  : "Finding your location..."}
              </Text>
            </View>
          )}
        </View>

        {/* Above the map, below the screens. `pointerEvents="none"`
            inside `MapSkeleton` keeps it out of the touch path, so a
            late `onMapReady` can't strand gestures behind it.

            Gated on HAVING a region, not just on readiness. With no region
            the branch above already renders the staged-location fallback
            ("Enable location…" / "Finding your location…"), and `region &&
            mapReady` can never become true without one — so the old
            condition left the skeleton shimmering permanently on top of
            that message. Skeleton is for "map is coming"; the fallback is
            for "there is no map to come". */}
        {!region || mapReady ? null : <MapSkeleton />}

        {/* Children (the booking-flow Stack) wrapped in a controlled
            pointerEvents layer. When the map is interactive, this
            wrapper is `box-none` so empty screen areas pass touches
            straight through to the map sibling underneath — fixes
            the case where a screen's own `box-none` root wasn't
            enough to defeat the react-navigation Card from
            consuming touches. When the map is locked, this wrapper
            is `auto` so screens behave like a normal opaque layer. */}
        <View
          style={StyleSheet.absoluteFill}
          pointerEvents={interactive ? "box-none" : "auto"}
        >
          {children}
        </View>
      </View>
    </BookingFlowMapContext.Provider>
  );
}

/** Wraps a `RatingMarkerPill` inside a `<Marker>` with the
 *  tracksViewChanges trick: native side has to repaint when the
 *  selected state flips, but leaving the prop on full-time thrashes
 *  the frame budget. We flip to `true` for ~200ms on isSelected
 *  change, then back to `false`. Same shape `ShopMarker` uses. */
function BookingFlowShopPinMarker({ pin }: { pin: BookingFlowShopPin }) {
  const [track, setTrack] = useState(true);
  // First mount tracks once so the initial layout lands, then we
  // turn it off until the next isSelected flip.
  useEffect(() => {
    const t = setTimeout(() => setTrack(false), RATING_MARKER_REPAINT_MS);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    setTrack(true);
    const t = setTimeout(() => setTrack(false), RATING_MARKER_REPAINT_MS);
    return () => clearTimeout(t);
  }, [pin.isSelected]);

  return (
    <Marker
      coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
      onPress={pin.onPress}
      anchor={{ x: 0.5, y: 0.5 }}
      tracksViewChanges={track}
    >
      <RatingMarkerPill
        rating={pin.rating}
        shopName={pin.shopName}
        isSelected={pin.isSelected}
      />
    </Marker>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  fallback: {
    alignItems: "center",
    backgroundColor: "#C8D7DE",
    justifyContent: "center",
  },
});
