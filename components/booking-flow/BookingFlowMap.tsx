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
  useRef,
  useState,
} from "react";
import { StyleSheet, View } from "react-native";
import * as Location from "expo-location";
import MapView, {
  Marker,
  PROVIDER_DEFAULT,
  type Region,
} from "react-native-maps";

const FALLBACK_REGION: Region = {
  latitude: 41.1959,
  longitude: -73.4365,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

export interface BookingFlowMarker {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
}

interface BookingFlowMapContextValue {
  /** Imperative handle — choose-mechanic animates the camera through it. */
  mapRef: React.RefObject<MapView | null>;
  /** Resolved user (or fallback) region — the default camera target. */
  region: Region | null;
  /** User coordinates when permission is granted; null otherwise. */
  userLocation: { latitude: number; longitude: number } | null;
  /** Toggle pan/zoom/rotate gestures (off = locked backdrop). */
  setInteractive: (interactive: boolean) => void;
  /** Replace the rendered markers. */
  setMarkers: (markers: BookingFlowMarker[]) => void;
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
  const [region, setRegion] = useState<Region | null>(null);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [interactive, setInteractive] = useState(false);
  const [markers, setMarkers] = useState<BookingFlowMarker[]>([]);

  // Resolve location once for the whole flow (each screen used to do
  // this independently). Falls back to a NY-metro region.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setRegion(FALLBACK_REGION);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        const coords = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(coords);
        setRegion({ ...coords, latitudeDelta: 0.05, longitudeDelta: 0.05 });
      } catch {
        if (!cancelled) setRegion(FALLBACK_REGION);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setInteractiveCb = useCallback(
    (next: boolean) => setInteractive(next),
    [],
  );
  const setMarkersCb = useCallback(
    (next: BookingFlowMarker[]) => setMarkers(next),
    [],
  );

  return (
    <BookingFlowMapContext.Provider
      value={{
        mapRef,
        region,
        userLocation,
        setInteractive: setInteractiveCb,
        setMarkers: setMarkersCb,
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
              showsUserLocation
              scrollEnabled
              zoomEnabled
              pitchEnabled={false}
              rotateEnabled
            >
              {markers.map((m) => (
                <Marker
                  key={m.id}
                  coordinate={{ latitude: m.latitude, longitude: m.longitude }}
                  title={m.title}
                />
              ))}
            </MapView>
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.fallback]} />
          )}
        </View>

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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#C8D7DE",
  },
  fallback: {
    backgroundColor: "#C8D7DE",
  },
});
