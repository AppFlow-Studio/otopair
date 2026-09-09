import { useEffect, useState } from "react";
import * as Location from "expo-location";

import type { UserLocation } from "@/stores/types/store.types";

export type LocationStage =
  | "loading"
  | "cached"
  | "estimate"
  | "precise"
  | "unavailable";

interface StagedLocationState {
  location: UserLocation | null;
  stage: LocationStage;
  isResolving: boolean;
}

function toUserLocation(
  loc: Location.LocationObject,
  source: NonNullable<UserLocation["source"]>,
): UserLocation {
  return {
    label: source === "cached" ? "Updating location..." : "Current Location",
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
    city: "",
    state: "",
    accuracyMeters: loc.coords.accuracy,
    source,
  };
}

function sameFix(a: UserLocation, b: UserLocation): boolean {
  return (
    a.source === b.source &&
    a.latitude === b.latitude &&
    a.longitude === b.longitude
  );
}

async function getAddressLabel(location: UserLocation): Promise<Partial<UserLocation> | null> {
  try {
    const [address] = await Location.reverseGeocodeAsync({
      latitude: location.latitude,
      longitude: location.longitude,
    });
    if (!address) return null;
    const city = address.city || address.subregion || "";
    const state = address.region || "";
    const label = [city || "Current Location", state].filter(Boolean).join(", ");
    return { label, city, state };
  } catch {
    return null;
  }
}

export function useStagedLocation(): StagedLocationState {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [stage, setStage] = useState<LocationStage>("loading");
  const [isResolving, setIsResolving] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let foundLocation = false;

    const publish = (loc: Location.LocationObject, source: NonNullable<UserLocation["source"]>) => {
      foundLocation = true;
      const next = toUserLocation(loc, source);
      setLocation(next);
      setStage(source);

      void getAddressLabel(next).then((label) => {
        if (cancelled || !label) return;
        setLocation((current) => (
          current && sameFix(current, next) ? { ...current, ...label } : current
        ));
      });
    };

    (async () => {
      setIsResolving(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setLocation(null);
          setStage("unavailable");
          return;
        }

        const cached = await Location.getLastKnownPositionAsync({
          maxAge: 30 * 60 * 1000,
          requiredAccuracy: 5000,
        });
        if (cancelled) return;
        if (cached) publish(cached, "cached");

        const estimate = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        publish(estimate, "estimate");

        const precise = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        if (cancelled) return;
        publish(precise, "precise");
      } catch {
        if (!cancelled && !foundLocation) setStage("unavailable");
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { location, stage, isResolving };
}
