/**
 * The Home header's location line on Android, formatted to match iOS.
 *
 * The two platforms reverse-geocode through different providers (Apple /
 * Google) and fill expo-location's fields differently. For a US address iOS
 * gives the city and the two-letter state — "New York, NY". Android's Google
 * geocoder often leaves `city` empty inside the NYC boroughs (the borough is
 * in `district`) and spells the state out, so the same kind of spot read
 * "Richmond County, New York". This brings US labels to "City, ST"; everywhere
 * else keeps the provider's own region text. iOS keeps its own formatting in
 * hooks/useStagedLocation.ts.
 */

export interface GeocodedAddress {
  city?: string | null;
  district?: string | null;
  subregion?: string | null;
  region?: string | null;
  isoCountryCode?: string | null;
}

const US_STATES: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA",
  Colorado: "CO", Connecticut: "CT", Delaware: "DE", "District of Columbia": "DC",
  Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA",
  Maine: "ME", Maryland: "MD", Massachusetts: "MA", Michigan: "MI", Minnesota: "MN",
  Mississippi: "MS", Missouri: "MO", Montana: "MT", Nebraska: "NE", Nevada: "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK",
  Oregon: "OR", Pennsylvania: "PA", "Puerto Rico": "PR", "Rhode Island": "RI",
  "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX",
  Utah: "UT", Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV",
  Wisconsin: "WI", Wyoming: "WY",
};

export function formatLocationLabel(address: GeocodedAddress): {
  label: string;
  city: string;
  state: string;
} {
  const city = address.city || address.district || address.subregion || "";
  const region = address.region || "";
  const state =
    address.isoCountryCode === "US" ? US_STATES[region] ?? region : region;
  const label = [city || "Current Location", state].filter(Boolean).join(", ");
  return { label, city, state };
}
