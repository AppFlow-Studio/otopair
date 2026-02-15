/**
 * Vehicle Image URL Builder
 *
 * Constructs IMAGIN.studio CDN URLs for dynamic vehicle images.
 * The API uses machine learning to fuzzy-match make/model names,
 * so exact casing or naming conventions are not required.
 *
 * Images have a 7-day TTL on the CDN. A weekly rotating cache key
 * is appended to ensure images are regenerated before expiry.
 *
 * Docs: https://docs.imagin.studio/guides/getting-images
 */

const IMAGIN_CUSTOMER = "us-appflowstudio";
const IMAGIN_BASE = "https://cdn.imagin.studio/getImage";

/**
 * Build an IMAGIN.studio image URL for a vehicle.
 *
 * @param make   - Vehicle manufacturer (e.g. "Volkswagen", "TOYOTA")
 * @param model  - Model family (e.g. "Tiguan", "Corolla")
 * @param year   - Optional model year (e.g. 2024)
 * @returns      - Full CDN image URL
 */
export function getVehicleImageUrl(
  make: string,
  model: string,
  year?: number
): string {
  // Weekly rotating cache key to refresh CDN images before 7-day TTL expires
  const weekNum = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));

  const params = new URLSearchParams({
    customer: IMAGIN_CUSTOMER,
    make: sanitize(make),
    modelFamily: sanitize(model),
    zoomType: "relative",
    width: "1600",
    angle: "01",
    _v: String(weekNum),
  });

  if (year && year > 1900) {
    params.set("modelYear", String(year));
  }

  return `${IMAGIN_BASE}?${params.toString()}`;
}

/** Lowercase, trim, and replace spaces/special chars with hyphens */
function sanitize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
