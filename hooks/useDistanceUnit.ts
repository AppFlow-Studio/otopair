import { useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { normalizeDistanceUnit, type DistanceUnit } from "@/utils/geo";

export function useDistanceUnit(): DistanceUnit {
  const preferences = useQuery(api.preferences.getMyPreferences);
  const storeUnits = useOnboardingStore((state) => state.data.units);

  return normalizeDistanceUnit(preferences?.units ?? storeUnits);
}
