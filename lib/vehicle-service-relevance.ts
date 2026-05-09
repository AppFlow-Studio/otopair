/**
 * vehicle-service-relevance
 *
 * Inspects a booking's service names to flag whether the work falls into
 * categories that require additional pre-job survey fields (brake measurements,
 * oil viscosity/type, etc.). Used by `validatePrejobReport` in convex/bookings.ts.
 *
 * Mirrors the shape of the otopair-web helper of the same name. If/when the
 * canonical version lands, replace this stub with the shared module.
 */

const BRAKE_KEYWORDS = ["brake", "rotor", "pad"];
const OIL_KEYWORDS = ["oil change", "oil filter", "lube"];

function matchesAny(haystack: string, keywords: string[]): boolean {
  const normalized = haystack.toLowerCase();
  return keywords.some((kw) => normalized.includes(kw));
}

export interface BookingServiceFlags {
  hasBrakeWork: boolean;
  hasOilChange: boolean;
}

export function getBookingServiceFlags(serviceNames: string[]): BookingServiceFlags {
  const joined = serviceNames.join(" | ");
  return {
    hasBrakeWork: matchesAny(joined, BRAKE_KEYWORDS),
    hasOilChange: matchesAny(joined, OIL_KEYWORDS),
  };
}
