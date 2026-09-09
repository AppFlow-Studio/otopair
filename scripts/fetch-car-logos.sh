#!/usr/bin/env bash
#
# fetch-car-logos.sh — (re)build the bundled car-make logo assets + map.
#
# Captures brand logos from the open car-logos-dataset
# (github.com/filippofilip95/car-logos-dataset), downscales them, drops them
# in assets/images/car-logos/, and regenerates constants/carLogos.ts (the
# static require() map the app reads). Run from the repo root:
#
#     bash scripts/fetch-car-logos.sh
#
# When the YMMT catalog gains new makes, add their slugs to SLUGS below and
# re-run. A slug is the lowercased make name with non-alphanumerics collapsed
# to hyphens ("Alfa Romeo" -> "alfa-romeo"). Brands the dataset lacks are
# skipped and fall back to a first-letter monogram in the brand picker.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGO_DIR="$ROOT/assets/images/car-logos"
MAP_FILE="$ROOT/constants/carLogos.ts"
BASE="https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/optimized"
MAX_PX=128

# Union of the catalog makes + common US-market / luxury brands likely to
# surface as the catalog lazy-caches more from NHTSA.
SLUGS=$(cat <<'EOF'
acura alfa-romeo aston-martin audi bentley bmw buick bugatti cadillac chevrolet
chrysler citroen dodge ferrari fiat ford genesis gmc honda hummer hyundai infiniti
jaguar jeep kia lamborghini land-rover lexus lincoln lotus lucid maserati maybach
mazda mclaren mercedes-benz mercury mini mitsubishi nissan opel peugeot polestar
pontiac porsche ram rivian rolls-royce saab saturn scion smart subaru suzuki tesla
toyota volkswagen volvo mack koenigsegg pagani abarth alpina isuzu renault seat skoda
EOF
)

mkdir -p "$LOGO_DIR"
cd "$LOGO_DIR"

echo "==> Downloading logos -> $LOGO_DIR"
printf '%s\n' $SLUGS | while read -r s; do
  [ -z "$s" ] && continue
  if curl -fsSL "$BASE/$s.png" -o "$s.png"; then
    echo "  ok   $s"
  else
    rm -f "$s.png"
    echo "  miss $s (dataset has no logo — monogram fallback)"
  fi
done

echo "==> Downscaling to ${MAX_PX}px max (preserves aspect + alpha)"
sips -Z "$MAX_PX" *.png >/dev/null 2>&1 || true

echo "==> Regenerating $MAP_FILE"
{
cat <<'HEADER'
/**
 * carLogos — bundled car-make logo assets keyed by make slug.
 *
 * Offline / permanent replacement for a runtime CDN fetch. Logos are captured
 * from the open car-logos-dataset (github.com/filippofilip95/car-logos-dataset),
 * downscaled, and committed under assets/images/car-logos/. Any make not
 * present here falls back to a first-letter monogram in the brand picker
 * (see BrandLogoTile in app/add-car-info.tsx).
 *
 * GENERATED FILE — do not edit by hand. Re-run: bash scripts/fetch-car-logos.sh
 */
import type { ImageSourcePropType } from "react-native";

// slug = lowercased make name with non-alphanumerics collapsed to hyphens
// ("Alfa Romeo" → "alfa-romeo", "Mercedes-Benz" → "mercedes-benz").
export const makeLogoSlug = (make: string): string =>
  make
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const CAR_LOGOS: Record<string, ImageSourcePropType> = {
HEADER
for f in $(ls -1 *.png | sort); do
  slug="${f%.png}"
  echo "  \"$slug\": require(\"@/assets/images/car-logos/$slug.png\"),"
done
cat <<'FOOTER'
};

/** Returns the bundled logo asset for a make, or null if none is bundled. */
export const getMakeLogo = (make: string): ImageSourcePropType | null =>
  CAR_LOGOS[makeLogoSlug(make)] ?? null;
FOOTER
} > "$MAP_FILE"

echo "==> Done. $(ls -1 *.png | wc -l | tr -d ' ') logos, $(du -sh . | cut -f1) total."
