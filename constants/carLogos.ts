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
  "abarth": require("@/assets/images/car-logos/abarth.png"),
  "acura": require("@/assets/images/car-logos/acura.png"),
  "alfa-romeo": require("@/assets/images/car-logos/alfa-romeo.png"),
  "alpina": require("@/assets/images/car-logos/alpina.png"),
  "aston-martin": require("@/assets/images/car-logos/aston-martin.png"),
  "audi": require("@/assets/images/car-logos/audi.png"),
  "bentley": require("@/assets/images/car-logos/bentley.png"),
  "bmw": require("@/assets/images/car-logos/bmw.png"),
  "bugatti": require("@/assets/images/car-logos/bugatti.png"),
  "buick": require("@/assets/images/car-logos/buick.png"),
  "cadillac": require("@/assets/images/car-logos/cadillac.png"),
  "chevrolet": require("@/assets/images/car-logos/chevrolet.png"),
  "chrysler": require("@/assets/images/car-logos/chrysler.png"),
  "citroen": require("@/assets/images/car-logos/citroen.png"),
  "dodge": require("@/assets/images/car-logos/dodge.png"),
  "ferrari": require("@/assets/images/car-logos/ferrari.png"),
  "fiat": require("@/assets/images/car-logos/fiat.png"),
  "ford": require("@/assets/images/car-logos/ford.png"),
  "genesis": require("@/assets/images/car-logos/genesis.png"),
  "gmc": require("@/assets/images/car-logos/gmc.png"),
  "honda": require("@/assets/images/car-logos/honda.png"),
  "hummer": require("@/assets/images/car-logos/hummer.png"),
  "hyundai": require("@/assets/images/car-logos/hyundai.png"),
  "infiniti": require("@/assets/images/car-logos/infiniti.png"),
  "isuzu": require("@/assets/images/car-logos/isuzu.png"),
  "jaguar": require("@/assets/images/car-logos/jaguar.png"),
  "jeep": require("@/assets/images/car-logos/jeep.png"),
  "kia": require("@/assets/images/car-logos/kia.png"),
  "koenigsegg": require("@/assets/images/car-logos/koenigsegg.png"),
  "lamborghini": require("@/assets/images/car-logos/lamborghini.png"),
  "land-rover": require("@/assets/images/car-logos/land-rover.png"),
  "lexus": require("@/assets/images/car-logos/lexus.png"),
  "lincoln": require("@/assets/images/car-logos/lincoln.png"),
  "lotus": require("@/assets/images/car-logos/lotus.png"),
  "lucid": require("@/assets/images/car-logos/lucid.png"),
  "mack": require("@/assets/images/car-logos/mack.png"),
  "maserati": require("@/assets/images/car-logos/maserati.png"),
  "maybach": require("@/assets/images/car-logos/maybach.png"),
  "mazda": require("@/assets/images/car-logos/mazda.png"),
  "mclaren": require("@/assets/images/car-logos/mclaren.png"),
  "mercedes-benz": require("@/assets/images/car-logos/mercedes-benz.png"),
  "mercury": require("@/assets/images/car-logos/mercury.png"),
  "mini": require("@/assets/images/car-logos/mini.png"),
  "mitsubishi": require("@/assets/images/car-logos/mitsubishi.png"),
  "nissan": require("@/assets/images/car-logos/nissan.png"),
  "opel": require("@/assets/images/car-logos/opel.png"),
  "pagani": require("@/assets/images/car-logos/pagani.png"),
  "peugeot": require("@/assets/images/car-logos/peugeot.png"),
  "polestar": require("@/assets/images/car-logos/polestar.png"),
  "pontiac": require("@/assets/images/car-logos/pontiac.png"),
  "porsche": require("@/assets/images/car-logos/porsche.png"),
  "ram": require("@/assets/images/car-logos/ram.png"),
  "renault": require("@/assets/images/car-logos/renault.png"),
  "rivian": require("@/assets/images/car-logos/rivian.png"),
  "rolls-royce": require("@/assets/images/car-logos/rolls-royce.png"),
  "saab": require("@/assets/images/car-logos/saab.png"),
  "saturn": require("@/assets/images/car-logos/saturn.png"),
  "scion": require("@/assets/images/car-logos/scion.png"),
  "seat": require("@/assets/images/car-logos/seat.png"),
  "skoda": require("@/assets/images/car-logos/skoda.png"),
  "smart": require("@/assets/images/car-logos/smart.png"),
  "subaru": require("@/assets/images/car-logos/subaru.png"),
  "suzuki": require("@/assets/images/car-logos/suzuki.png"),
  "tesla": require("@/assets/images/car-logos/tesla.png"),
  "toyota": require("@/assets/images/car-logos/toyota.png"),
  "volkswagen": require("@/assets/images/car-logos/volkswagen.png"),
  "volvo": require("@/assets/images/car-logos/volvo.png"),
};

/** Returns the bundled logo asset for a make, or null if none is bundled. */
export const getMakeLogo = (make: string): ImageSourcePropType | null =>
  CAR_LOGOS[makeLogoSlug(make)] ?? null;
