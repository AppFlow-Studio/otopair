/**
 * Geo Utilities
 *
 * PURPOSE: Geographic calculation utilities (distance, coordinates, etc.)
 *
 * USED IN: Booking flow, shop filtering, location services
 *
 * OWNER: Waleed Mansour
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/** Earth's radius in kilometers */
const EARTH_RADIUS_KM = 6371;

/** Earth's radius in miles */
const EARTH_RADIUS_MILES = 3959;

export type DistanceUnit = "mi" | "km";

export const KM_PER_MILE = 1.609344;
export const MILES_PER_KM = 0.621371192237334;

// ============================================================================
// DISTANCE CALCULATIONS
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in kilometers
 *
 * @example
 * const distance = calculateDistanceKm(40.7128, -74.0060, 34.0522, -118.2437);
 * console.log(distance); // ~3935.75 km (NYC to LA)
 */
export function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate distance between two coordinates in miles
 *
 * @param lat1 - Latitude of first point
 * @param lon1 - Longitude of first point
 * @param lat2 - Latitude of second point
 * @param lon2 - Longitude of second point
 * @returns Distance in miles
 */
export function calculateDistanceMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_MILES * c;
}

export function normalizeDistanceUnit(unit: unknown): DistanceUnit {
  return unit === "km" ? "km" : "mi";
}

export function milesToKm(miles: number): number {
  return miles * KM_PER_MILE;
}

export function kmToMiles(km: number): number {
  return km * MILES_PER_KM;
}

function formatProximityDistanceValue(value: number, unit: DistanceUnit): string {
  const safeValue = Math.max(0, value);
  if (safeValue < 0.1) return `< 0.1 ${unit}`;
  return `${safeValue.toFixed(1)} ${unit}`;
}

export function formatProximityDistanceFromMiles(
  distanceMiles: number | null | undefined,
  unit: DistanceUnit = "mi",
): string {
  if (typeof distanceMiles !== "number" || !Number.isFinite(distanceMiles)) return "";
  const value = unit === "km" ? milesToKm(distanceMiles) : distanceMiles;
  return formatProximityDistanceValue(value, unit);
}

export function formatProximityDistanceFromKm(
  distanceKm: number | null | undefined,
  unit: DistanceUnit = "km",
): string {
  if (typeof distanceKm !== "number" || !Number.isFinite(distanceKm)) return "";
  const value = unit === "mi" ? kmToMiles(distanceKm) : distanceKm;
  return formatProximityDistanceValue(value, unit);
}

/**
 * Format distance for display in kilometers
 *
 * @param distanceKm - Distance in kilometers
 * @returns Formatted string like "1.2 km" or "< 0.1 km"
 */
export function formatDistanceKm(distanceKm: number): string {
  return formatProximityDistanceFromKm(distanceKm, "km");
}

/**
 * Format distance for display in miles
 *
 * @param distanceMiles - Distance in miles
 * @returns Formatted string like "1.2 mi" or "0.5 mi"
 */
export function formatDistanceMiles(distanceMiles: number): string {
  return formatProximityDistanceFromMiles(distanceMiles, "mi");
}

// ============================================================================
// HELPERS
// ============================================================================

/** Convert degrees to radians */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// ============================================================================
// COORDINATE TYPES
// ============================================================================

/** Basic coordinate interface */
export interface Coordinate {
  latitude: number;
  longitude: number;
}

/**
 * Calculate distance between two coordinate objects
 *
 * @param from - Starting coordinate
 * @param to - Ending coordinate
 * @returns Distance in kilometers
 */
export function distanceBetween(from: Coordinate, to: Coordinate): number {
  return calculateDistanceKm(from.latitude, from.longitude, to.latitude, to.longitude);
}
