/**
 * formatMake — normalize a raw make string to its canonical casing.
 *
 * Upstream sources (NHTSA vPIC, Vehicle Databases, some seed data) hand us
 * makes in SHOUTING_CAPS ("VOLKSWAGEN", "FORD"). A naive
 * `charAt(0).toUpperCase() + slice(1).toLowerCase()` breaks acronyms (BMW→Bmw,
 * GMC→Gmc) and multi-word brands (Mercedes-Benz→Mercedes-benz, Land Rover→Land rover).
 *
 * Look up the canonical casing in a dictionary of the makes the app supports;
 * fall back to title-case-per-word for anything unknown.
 */

const CANONICAL: Record<string, string> = {
  acura: "Acura",
  "alfa romeo": "Alfa Romeo",
  "aston martin": "Aston Martin",
  audi: "Audi",
  bentley: "Bentley",
  bmw: "BMW",
  buick: "Buick",
  cadillac: "Cadillac",
  chevrolet: "Chevrolet",
  chrysler: "Chrysler",
  dodge: "Dodge",
  ferrari: "Ferrari",
  fiat: "Fiat",
  ford: "Ford",
  genesis: "Genesis",
  gmc: "GMC",
  honda: "Honda",
  hyundai: "Hyundai",
  infiniti: "Infiniti",
  jaguar: "Jaguar",
  jeep: "Jeep",
  kia: "Kia",
  lamborghini: "Lamborghini",
  "land rover": "Land Rover",
  lexus: "Lexus",
  lincoln: "Lincoln",
  maserati: "Maserati",
  mazda: "Mazda",
  mclaren: "McLaren",
  "mercedes-benz": "Mercedes-Benz",
  mercedes: "Mercedes-Benz",
  mini: "Mini",
  mitsubishi: "Mitsubishi",
  nissan: "Nissan",
  porsche: "Porsche",
  ram: "Ram",
  "rolls-royce": "Rolls-Royce",
  subaru: "Subaru",
  tesla: "Tesla",
  toyota: "Toyota",
  volkswagen: "Volkswagen",
  vw: "Volkswagen",
  volvo: "Volvo",
};

export function formatMake(raw: string | null | undefined): string {
  if (!raw) return "";
  const key = raw.trim().toLowerCase();
  if (CANONICAL[key]) return CANONICAL[key];
  return key
    .split(/\s+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
