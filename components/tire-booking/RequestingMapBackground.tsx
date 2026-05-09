/**
 * RequestingMapBackground
 *
 * PURPOSE: Decorative full-screen Apple Maps backdrop for the tire-quote
 *          requesting screen. Centers on the user's location.
 *          Non-interactive — taps fall through to the FloatingSheet above.
 *
 *          NOTE: The 5 staggered OtoPair logo pins are temporarily
 *          commented out below — image-marker rendering on Apple Maps
 *          (PROVIDER_DEFAULT) was unreliable. To re-enable, restore the
 *          marked blocks. The pin generator + AnimatedLogoMarker are
 *          preserved so we can pick this back up.
 *
 * USED IN: app/(tire-booking)/requesting.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import * as Location from "expo-location";
// import { Image } from "react-native";
// import { Marker } from "react-native-maps";
import MapView, { PROVIDER_DEFAULT, type Region } from "react-native-maps";

interface Props {
  width: number;
  height: number;
}

// SF fallback — same coordinates the home MapScreen uses when location is
// unavailable so the screen still has *somewhere* to point.
const FALLBACK_REGION: Region = {
  latitude: 37.7749,
  longitude: -122.4194,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

/* ---------------------------------------------------------------------------
 * Pin logic — temporarily disabled. Re-enable when we sort out the
 * react-native-maps Marker rendering on Apple Maps.
 *
 * interface Pin {
 *   id: string;
 *   latitude: number;
 *   longitude: number;
 * }
 *
 * const PIN_COUNT = 5;
 * const STAGGER_MS = 1200;
 * const MIN_PIN_GAP = 0.006;
 *
 * function generatePins(region: Region): Pin[] {
 *   const placed: Pin[] = [];
 *   for (let i = 0; i < PIN_COUNT; i++) {
 *     let candidate: Pin | null = null;
 *     for (let attempt = 0; attempt < 30; attempt++) {
 *       const c: Pin = {
 *         id: `pin-${i}`,
 *         latitude: region.latitude + 0.004 + Math.random() * 0.012,
 *         longitude: region.longitude + (Math.random() - 0.5) * 0.024,
 *       };
 *       const tooClose = placed.some(
 *         (p) =>
 *           Math.abs(p.latitude - c.latitude) < MIN_PIN_GAP &&
 *           Math.abs(p.longitude - c.longitude) < MIN_PIN_GAP,
 *       );
 *       if (!tooClose) { candidate = c; break; }
 *       candidate = c;
 *     }
 *     if (candidate) placed.push(candidate);
 *   }
 *   return placed;
 * }
 * ------------------------------------------------------------------------- */

export function RequestingMapBackground({ width, height }: Props) {
  const [region, setRegion] = useState<Region | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setRegion(FALLBACK_REGION);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        });
      } catch {
        if (!cancelled) setRegion(FALLBACK_REGION);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // const pins = useMemo(() => (region ? generatePins(region) : []), [region]);

  if (!region) {
    return <View style={[styles.fallback, { width, height }]} />;
  }

  return (
    <MapView
      style={StyleSheet.absoluteFill}
      provider={PROVIDER_DEFAULT}
      region={region}
      showsUserLocation
      scrollEnabled={false}
      zoomEnabled={false}
      pitchEnabled={false}
      rotateEnabled={false}
      pointerEvents="none"
    >
      {/* {pins.map((pin, i) => (
        <AnimatedLogoMarker key={pin.id} pin={pin} delayMs={i * STAGGER_MS} />
      ))} */}
    </MapView>
  );
}

/* ---------------------------------------------------------------------------
 * AnimatedLogoMarker — disabled along with the pin logic above.
 *
 * interface MarkerProps {
 *   pin: Pin;
 *   delayMs: number;
 * }
 *
 * function AnimatedLogoMarker({ pin, delayMs }: MarkerProps) {
 *   const [visible, setVisible] = useState(false);
 *   const [imageLoaded, setImageLoaded] = useState(false);
 *   const [tracking, setTracking] = useState(true);
 *
 *   useEffect(() => {
 *     const t = setTimeout(() => setVisible(true), delayMs);
 *     return () => clearTimeout(t);
 *   }, [delayMs]);
 *
 *   useEffect(() => {
 *     if (!imageLoaded) return;
 *     const t = setTimeout(() => setTracking(false), 200);
 *     return () => clearTimeout(t);
 *   }, [imageLoaded]);
 *
 *   if (!visible) return null;
 *
 *   return (
 *     <Marker
 *       coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
 *       anchor={{ x: 0.5, y: 0.5 }}
 *       tracksViewChanges={tracking}
 *     >
 *       <View style={styles.pinWrap}>
 *         <Image
 *           source={require("@/assets/images/splash-icon.png")}
 *           style={styles.pinImage}
 *           resizeMode="contain"
 *           onLoad={() => setImageLoaded(true)}
 *           fadeDuration={0}
 *         />
 *       </View>
 *     </Marker>
 *   );
 * }
 * ------------------------------------------------------------------------- */

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: "#CFE4F7",
  },
  // pinWrap: {
  //   width: 56,
  //   height: 56,
  //   alignItems: "center",
  //   justifyContent: "center",
  // },
  // pinImage: {
  //   width: 52,
  //   height: 52,
  // },
});
