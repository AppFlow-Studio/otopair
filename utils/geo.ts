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

/**
 * Format distance for display (auto-selects km/m based on magnitude)
 *
 * @param distanceKm - Distance in kilometers
 * @returns Formatted string like "1.2 km" or "500 m"
 */
export function formatDistanceKm(distanceKm: number): string {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  }
  return `${distanceKm.toFixed(1)} km`;
}

/**
 * Format distance for display in miles
 *
 * @param distanceMiles - Distance in miles
 * @returns Formatted string like "1.2 mi" or "0.5 mi"
 */
export function formatDistanceMiles(distanceMiles: number): string {
  return `${distanceMiles.toFixed(1)} mi`;
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
