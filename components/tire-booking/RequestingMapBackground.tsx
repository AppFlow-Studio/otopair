/**
 * RequestingMapBackground
 *
 * PURPOSE: Decorative full-screen Apple Maps backdrop for the tire-quote
 *          requesting screen. Centers on the user's location and fades in
 *          5 OtoPair pin logos one-by-one in the upper portion of the
 *          screen over ~6 seconds. Non-interactive — taps fall through to
 *          the FloatingSheet above.
 *
 *          IMPLEMENTATION NOTE: Earlier attempts rendered the logos as
 *          react-native-maps `<Marker>` children with custom JSX. That
 *          path was unreliable on Apple Maps (PROVIDER_DEFAULT) — the
 *          Marker snapshot system either ignored the image or rendered it
 *          at the wrong size. Since the map is non-interactive (no scroll,
 *          no zoom), there's no need for lat/lng-anchored pins; we render
 *          the logos as absolutely-positioned `<Image>` views on top of
 *          the MapView and keep the implementation entirely in stock RN.
 *
 * USED IN: app/(tire-booking)/requesting.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useRef, useState } from "react";
import { Animated, Easing, Image, StyleSheet, View } from "react-native";

import * as Location from "expo-location";
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

const PIN_COUNT = 5;
const STAGGER_MS = 1200;
// Drop animation timings — `FADE_MS` is short so pins are visible during
// the drop, `DROP_MS` runs longer so the bounce easing reads as gravity.
const FADE_MS = 200;
const DROP_MS = 650;
const DROP_DISTANCE = 120;
const PIN_SIZE = 76;
// Pins live in the upper portion of the screen so they sit above the
// 52%-tall bottom sheet. Top band spans 8% → 42% of screen height. Bigger
// pins eat more vertical room — TOP_BAND_END subtracts PIN_SIZE downstream.
const TOP_BAND_START = 0.08;
const TOP_BAND_END = 0.42;
// Horizontal padding so pins don't kiss the screen edges.
const SIDE_PADDING = 24;
// Minimum pixel distance between any two pin centers — scales with
// PIN_SIZE so bigger pins still get breathing room.
const MIN_PIN_GAP_PX = PIN_SIZE + 24;

interface PinPosition {
  id: string;
  top: number;
  left: number;
}

/**
 * Convert a pin's pixel position on the screen to a real-world coordinate.
 * The map fills the layer, so screen-center maps to `region.latitude/longitude`
 * and per-pixel deltas come from `region.latitudeDelta / height` etc.
 */
function pixelToCoord(
  pin: PinPosition,
  region: Region,
  width: number,
  height: number,
): { latitude: number; longitude: number } {
  const cx = pin.left + PIN_SIZE / 2;
  const cy = pin.top + PIN_SIZE / 2;
  const latPerPx = region.latitudeDelta / height;
  const lngPerPx = region.longitudeDelta / width;
  // pixelY increasing = south (smaller lat); pixelX increasing = east.
  return {
    latitude: region.latitude + (height / 2 - cy) * latPerPx,
    longitude: region.longitude + (cx - width / 2) * lngPerPx,
  };
}

/**
 * Reverse-geocodes a coordinate via the OS geocoder (no external API call).
 * Land returns at least one result with a street/city/name; bodies of water
 * resolve to an empty array. Errors are treated as "land" so we don't drop
 * pins because of a transient permissions hiccup.
 */
async function isOnLand(coord: {
  latitude: number;
  longitude: number;
}): Promise<boolean> {
  try {
    const results = await Location.reverseGeocodeAsync(coord);
    return results.some((r) => r.street || r.city || r.name || r.region);
  } catch {
    return true;
  }
}

/**
 * Async pin generation with rejection sampling. For each pin we try up to
 * MAX_ATTEMPTS positions; each must (1) clear the spacing constraint and
 * (2) reverse-geocode to land. If every attempt fails (rare), we fall
 * back to the last spacing-clean candidate so we never end up with
 * fewer than PIN_COUNT pins. Caps reverse-geocode calls at
 * PIN_COUNT * MAX_ATTEMPTS = 30 — comfortably below OS rate limits.
 */
async function generateValidPins(
  region: Region,
  width: number,
  height: number,
): Promise<PinPosition[]> {
  const MAX_ATTEMPTS = 6;
  const placed: PinPosition[] = [];
  const minTop = Math.round(height * TOP_BAND_START);
  const maxTop = Math.round(height * TOP_BAND_END) - PIN_SIZE;
  const minLeft = SIDE_PADDING;
  const maxLeft = width - SIDE_PADDING - PIN_SIZE;

  for (let i = 0; i < PIN_COUNT; i++) {
    let chosen: PinPosition | null = null;
    let lastSpaced: PinPosition | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const top = minTop + Math.random() * (maxTop - minTop);
      const left = minLeft + Math.random() * (maxLeft - minLeft);
      const c: PinPosition = { id: `pin-${i}`, top, left };
      const tooClose = placed.some((p) => {
        const dx = (p.left + PIN_SIZE / 2) - (c.left + PIN_SIZE / 2);
        const dy = (p.top + PIN_SIZE / 2) - (c.top + PIN_SIZE / 2);
        return Math.sqrt(dx * dx + dy * dy) < MIN_PIN_GAP_PX;
      });
      if (tooClose) continue;
      lastSpaced = c;
      const coord = pixelToCoord(c, region, width, height);
      if (await isOnLand(coord)) {
        chosen = c;
        break;
      }
    }
    const final = chosen ?? lastSpaced;
    if (final) placed.push(final);
  }
  return placed;
}

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

  // Pins generate asynchronously after the region resolves, because each
  // candidate is reverse-geocoded to filter out water tiles. There's a
  // brief window where the map is visible but pins haven't dropped yet —
  // intentional, the map alone reads cleanly while geocoding settles.
  const [pins, setPins] = useState<PinPosition[]>([]);
  useEffect(() => {
    if (!region) return;
    let cancelled = false;
    generateValidPins(region, width, height).then((result) => {
      if (!cancelled) setPins(result);
    });
    return () => {
      cancelled = true;
    };
  }, [region, width, height]);

  return (
    <>
      {/* MAP LAYER — sits at the bottom of the screen's z-stack. */}
      <View style={[styles.mapLayer, { width, height }]} pointerEvents="none">
        {region ? (
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
          />
        ) : (
          <View style={[styles.fallback, StyleSheet.absoluteFill]} />
        )}
      </View>

      {/* PIN OVERLAY — separate sibling so it isn't a child of the same View
          tree as the native MapView UIView. iOS' UIKit composition can let
          a native MapView overdraw RN siblings sharing its parent; lifting
          the pins out (plus explicit `elevation` + high `zIndex`) keeps
          them visible above the map on both platforms. */}
      <View
        style={[styles.pinLayer, { width, height }]}
        pointerEvents="none"
      >
        {pins.map((pin, i) => (
          <FadingLogoPin key={pin.id} pin={pin} delayMs={i * STAGGER_MS} />
        ))}
      </View>
    </>
  );
}

interface PinComponentProps {
  pin: PinPosition;
  delayMs: number;
}

function FadingLogoPin({ pin, delayMs }: PinComponentProps) {
  const opacity = useRef(new Animated.Value(0)).current;
  // Start above the final resting spot so the pin appears to fall in. The
  // `Easing.bounce` curve gives the classic Apple-Maps "drop and settle"
  // feel — a couple of small bounces after impact.
  const translateY = useRef(new Animated.Value(-DROP_DISTANCE)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: FADE_MS,
        delay: delayMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: DROP_MS,
        delay: delayMs,
        easing: Easing.bounce,
        useNativeDriver: true,
      }),
    ]).start();
  }, [delayMs, opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.pinWrap,
        {
          top: pin.top,
          left: pin.left,
          opacity,
          transform: [{ translateY }],
        },
      ]}
    >
      <Image
        source={require("@/assets/images/homelogo.png")}
        style={styles.pinImage}
        resizeMode="contain"
        fadeDuration={0}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  mapLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    overflow: "hidden",
  },
  pinLayer: {
    position: "absolute",
    top: 0,
    left: 0,
    // Force above the native MapView. zIndex helps on iOS; elevation
    // is the Android equivalent. Both are needed for cross-platform.
    zIndex: 10,
    elevation: 10,
  },
  fallback: {
    backgroundColor: "#CFE4F7",
  },
  pinWrap: {
    position: "absolute",
    width: PIN_SIZE,
    height: PIN_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  pinImage: {
    width: PIN_SIZE,
    height: PIN_SIZE,
  },
});
