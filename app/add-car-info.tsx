/**
 * AddVehicleDetailsScreen
 *
 * PURPOSE: Screen for entering / reviewing vehicle details.
 *          - Manual mode (manual=true): user picks every field from scratch.
 *          - Review mode (VIN flow): fields are pre-populated; tap "Edit
 *            Information" to make rows tappable, then tap each row to change.
 *
 * USED IN: Navigated from add-vehicle.tsx after VIN input/scan or via
 *          the "Enter car information manually" button.
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Image,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. Expo & Third-party
import { StatusBar } from "expo-status-bar";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { Car, Bike, Truck, Check, ChevronLeft, ChevronRight, X, Search, RotateCw } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import Svg, { Line, Rect } from "react-native-svg";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

// 3. Convex & hooks
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { buildYearOptions, useMakes, useModels } from "@/hooks/useYmmtCatalog";
import { usePendingNavigationStore } from "@/stores/usePendingNavigationStore";

// 4. Shared UI
import { Text } from "@/components/shared-ui";
import { Input } from "@/components/shared-ui/Input";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import {
  fetchVehicleImageUrl,
  useVdbColorsForVin,
  useVdbVariants,
  useVehicleImage,
} from "@/utils/vehicleImage";
import { ColorSwatchSkeletonList } from "@/components/shared-ui/ColorSwatchSkeleton";

// 5. Constants
import { Spacing, BorderRadius, BrandColors } from "@/constants/theme";
import { getMakeLogo } from "@/constants/carLogos";

// ============================================================================
// CONSTANTS
// ============================================================================

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const getKeyboardOffset = () => 0;

// Generic vehicle colour fallback — only shown when VDB returns no
// recognizable paint variants for this car (rare; usually means the
// VIN/YMMT lookup failed entirely). The dynamic list from
// `useVdbColorsForVin` is preferred so the user only picks paints
// VDB actually has for their vehicle.
type ColorOption = { id: string; label: string; color: string };
const FALLBACK_COLOURS: ColorOption[] = [
  { id: "black", label: "Black", color: "#1a1a1a" },
  { id: "midnight-silver", label: "Midnight Silver", color: "#4A4A4A" },
  { id: "silver", label: "Silver", color: "#C0C0C0" },
  { id: "white", label: "White", color: "#FFFFFF" },
  { id: "gray", label: "Gray", color: "#808080" },
  { id: "red", label: "Red", color: "#DC2626" },
  { id: "blue", label: "Blue", color: "#2563EB" },
  { id: "green", label: "Green", color: "#16A34A" },
  { id: "beige", label: "Beige", color: "#D4B896" },
  { id: "brown", label: "Brown", color: "#8B4513" },
];

// Vehicle types / Body Styles
const BODY_STYLES = [
  { id: "sedan", label: "Sedan", Icon: Car },
  { id: "suv", label: "SUV", Icon: Car },
  { id: "coupe", label: "Coupe", Icon: Car },
  { id: "hatchback", label: "Hatchback", Icon: Car },
  { id: "wagon", label: "Wagon", Icon: Car },
  { id: "convertible", label: "Convertible", Icon: Car },
  { id: "truck", label: "Truck", Icon: Truck },
  { id: "van", label: "Van", Icon: Car },
  { id: "motorcycle", label: "Motorcycle", Icon: Bike },
];

// Year list — newest first, back to 1981. Matches otopair-web's picker.
const YEARS = buildYearOptions();

const DRIVETRAINS = [
  "Front-Wheel Drive (FWD)",
  "Rear-Wheel Drive (RWD)",
  "All-Wheel Drive (AWD)",
  "Four-Wheel Drive (4WD)",
];

type SheetMode = "brand" | "model" | "year" | "color" | "bodyStyle" | "trim" | "drivetrain";

// Tidy verbose VDB variant strings for display: abbreviate the drivetrain and
// drop the redundant "Automatic" so trims read clean in the picker + form
// (e.g. "Base All Wheel Drive Automatic" → "Base AWD"). Display-only — the raw
// trim is still what gets stored and used as the VDB image-lookup key, so this
// never changes selection or lookups.
const prettyTrim = (t: string): string =>
  t
    .replace(/\bAll[-\s]?Wheel[-\s]?Drive\b/gi, "AWD")
    .replace(/\bFour[-\s]?Wheel[-\s]?Drive\b/gi, "4WD")
    .replace(/\bFront[-\s]?Wheel[-\s]?Drive\b/gi, "FWD")
    .replace(/\bRear[-\s]?Wheel[-\s]?Drive\b/gi, "RWD")
    .replace(/\bAutomatic\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

// ── Drivetrain icons ─────────────────────────────────────────────────────────
// Schematic (two axles + a central driveshaft, four wheel pills) with the
// *driven* wheels filled — so FWD / RWD / AWD / 4WD read at a glance. Matches
// the reference icon style.
type DrivetrainVariant = "fwd" | "rwd" | "awd" | "4wd";

// [frontLeft, frontRight, rearLeft, rearRight]
const DRIVEN_WHEELS: Record<DrivetrainVariant, [boolean, boolean, boolean, boolean]> = {
  fwd: [true, true, false, false],
  rwd: [false, false, true, true],
  awd: [true, true, true, true],
  "4wd": [true, true, true, true],
};

const drivetrainVariant = (label: string): DrivetrainVariant => {
  if (/fwd|front/i.test(label)) return "fwd";
  if (/rwd|rear/i.test(label)) return "rwd";
  if (/4wd|four/i.test(label)) return "4wd";
  return "awd";
};

// Full picker labels keyed by variant — must match the DRIVETRAINS list.
const DRIVETRAIN_LABEL: Record<DrivetrainVariant, string> = {
  fwd: "Front-Wheel Drive (FWD)",
  rwd: "Rear-Wheel Drive (RWD)",
  awd: "All-Wheel Drive (AWD)",
  "4wd": "Four-Wheel Drive (4WD)",
};

// Detect a drivetrain the trim string *explicitly* names — VDB variant strings
// encode it (e.g. "…4dr AWD 4MATIC+", "…quattro"). Returns null when the trim
// says nothing about drivetrain, so we never overwrite the field with a guess.
const drivetrainFromTrim = (trim: string): DrivetrainVariant | null => {
  if (/\bFWD\b|front[-\s]?wheel/i.test(trim)) return "fwd";
  if (/\bRWD\b|rear[-\s]?wheel/i.test(trim)) return "rwd";
  if (/\b4WD\b|four[-\s]?wheel/i.test(trim)) return "4wd";
  if (/\bAWD\b|all[-\s]?wheel|4MATIC|quattro|xDrive/i.test(trim)) return "awd";
  return null;
};

// Pulsing skeleton shown over the hero card while the car image is being
// fetched (useVehicleImage.isLoading) — a loading state instead of a static
// placeholder during the lookup.
function HeroImageSkeleton() {
  const pulse = useSharedValue(0.5);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 750, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <Animated.View pointerEvents="none" style={[styles.heroSkeleton, style]}>
      <View style={styles.heroSkeletonBlock} />
    </Animated.View>
  );
}

function DrivetrainIcon({
  variant,
  size = 24,
  color = BrandColors.primary,
}: {
  variant: DrivetrainVariant;
  size?: number;
  color?: string;
}) {
  const [fl, fr, rl, rr] = DRIVEN_WHEELS[variant];
  const frame = "rgba(20,28,36,0.32)";
  const wheel = (x: number, y: number, on: boolean) => (
    <Rect
      x={x}
      y={y}
      width={3.2}
      height={6.4}
      rx={1.6}
      fill={on ? color : "#FFFFFF"}
      stroke={on ? color : frame}
      strokeWidth={1.4}
    />
  );
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {/* front axle, rear axle, driveshaft */}
      <Line x1={5} y1={7} x2={19} y2={7} stroke={frame} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={5} y1={17} x2={19} y2={17} stroke={frame} strokeWidth={1.4} strokeLinecap="round" />
      <Line x1={12} y1={7} x2={12} y2={17} stroke={frame} strokeWidth={1.4} strokeLinecap="round" />
      {/* wheels: FL, FR, RL, RR — filled when driven */}
      {wheel(3.4, 3.8, fl)}
      {wheel(17.4, 3.8, fr)}
      {wheel(3.4, 13.8, rl)}
      {wheel(17.4, 13.8, rr)}
    </Svg>
  );
}

// Leading slot for a brand row: the make's bundled logo on a white tile
// (see constants/carLogos.ts), with a first-letter monogram fallback for any
// make we don't have a logo asset for. Fully offline — no network fetch.
function BrandLogoTile({ name }: { name: string }) {
  const logo = getMakeLogo(name);
  return (
    <View style={styles.pickerLogoTile}>
      {logo ? (
        <Image source={logo} style={styles.pickerLogoImage} resizeMode="contain" />
      ) : (
        <Text weight="bold" size="sm" color="#4B5563">
          {name.trim().charAt(0).toUpperCase() || "?"}
        </Text>
      )}
    </View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function AddVehicleDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vin, manual } = useLocalSearchParams<{ vin: string; manual: string }>();
  const { userId } = useUserFromConvex();
  const addOwner = useMutation(api.vehicles.addOwner);
  const upsertVehicle = useMutation(api.vehicles.upsertVehicle);
  const saveVehicleImageUrl = useMutation(api.vehicles.saveVehicleImageUrl);
  // Queues the "Connecting to your <car>" toast for the user's NEXT
  // home visit. Mirrors the VIN flow in add-vehicle-review.tsx so the
  // manual-entry path gets the same enrichment-in-progress signal
  // instead of silently dropping the user onto /vehicle-added.
  const setPendingEnrichmentToast = usePendingNavigationStore(
    (s) => s.setPendingEnrichmentToast,
  );
  const isManualEntry = manual === "true";

  // State — hardcoded Lexus RX350 details for VIN mode, blank for manual mode.
  const [year, setYear] = useState(isManualEntry ? "" : "2023");
  const [brand, setBrand] = useState(isManualEntry ? "" : "Lexus");
  const [model, setModel] = useState(isManualEntry ? "" : "RX350");
  const [trim, setTrim] = useState(isManualEntry ? "" : "F Sport");
  const [drivetrain, setDrivetrain] = useState(isManualEntry ? "" : "All-Wheel Drive (AWD)");
  const [bodyStyle, setBodyStyle] = useState(isManualEntry ? "" : "suv");
  // Color id is no longer pre-seeded — the dynamic VDB list resolves
  // post-mount and the old "midnight-silver" default rarely matches
  // a real VDB marketing paint name. User picks from the actual
  // paint variants their car comes in.
  const [selectedColor, setSelectedColor] = useState("");
  const [mileage, setMileage] = useState("");
  const [isEditing, setIsEditing] = useState(isManualEntry);
  const [sheetMode, setSheetMode] = useState<SheetMode>("brand");
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const hasAnimationPlayedRef = useRef(false);

  // Submission guard — the "Confirm & Add Vehicle" button is idempotency's
  // last line of defense. `submittingRef` blocks re-entrancy synchronously
  // (state updates are async, so a fast double-tap can slip past `disabled`
  // alone). `isSubmitting` just drives the button's disabled/spinner UI.
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  // One stable VIN per screen visit for the manual path. Previously a fresh
  // `MANUAL-<time>-<rand>` was minted on EVERY press, so each tap created a
  // distinct vehicle + ownership (this is how 44 dupes happened). Minting it
  // once means repeated submits upsert the SAME vehicle and addOwner dedupes
  // on (vin, user) → at most one car per visit.
  const manualVinRef = useRef<string | null>(null);
  const resolveVin = useCallback((): string => {
    if (typeof vin === "string" && vin.trim().length === 17) {
      return vin.trim().toUpperCase();
    }
    if (!manualVinRef.current) {
      manualVinRef.current = `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }
    return manualVinRef.current;
  }, [vin]);

  // Refs
  const pickerSheetRef = useRef<FloatingSheetRef>(null);

  // ── YMMT catalog — makes/models backed by `convex/ymmtCatalog.ts`
  // (shared with otopair-web), trims backed by VDB's ymm-specs
  // options endpoint. We pulled trims off NHTSA because NHTSA returns
  // empty for most modern vehicles and its strings are marketing
  // names VDB's image endpoint rejects. VDB's canonical trim strings
  // double as valid image-lookup keys.
  const makes = useMakes();
  const { models: ymmtModels, loading: modelsLoading } = useModels(brand, year);
  const yearNum = year ? parseInt(year, 10) : undefined;
  const { variants: vdbVariants, isLoading: trimsLoading } = useVdbVariants(yearNum, brand, model);
  // Backward-compat: existing picker UI and sheet logic expects an array
  // of trim strings. Variants carry the model too — we look that up below.
  const vdbTrims = useMemo(() => vdbVariants.map((v) => v.trim), [vdbVariants]);

  // Use the user's explicit picker selection when they've made one,
  // otherwise fall back to the first VDB trim so the image still
  // resolves on year+brand+model alone.
  const effectiveTrim = trim || vdbTrims[0] || undefined;
  // Critical for makes that split engine variants into separate top-level
  // models (Mercedes GLE → GLE 350 / 450 / 580). The variant tells us the
  // CATALOG model to use for image/colors lookup, even when the user
  // picked a family-level model name like "GLE-Class".
  const effectiveModel =
    vdbVariants.find((v) => v.trim === effectiveTrim)?.model ?? model;

  // Bumped by the failure-state "Retry" button to force a fresh image fetch
  // with the same inputs.
  const [imageReloadKey, setImageReloadKey] = useState(0);
  const { url: carImageUrl, isLoading: isImageLoading } = useVehicleImage(
    brand,
    effectiveModel,
    yearNum,
    undefined,
    selectedColor,
    effectiveTrim,
    400,
    imageReloadKey,
  );

  // VDB's paint variants for this exact vehicle. Replaces the static
  // FALLBACK_COLOURS palette whenever VDB has data for the car —
  // user sees only paint options that actually exist on the model.
  // `colorsLoading` drives the skeleton in the picker sheet so the
  // generic fallback never flashes during the in-flight window.
  const {
    colors: vdbColors,
    isLoading: colorsLoading,
    hasVdbData: hasVdbColors,
  } = useVdbColorsForVin({
    vin,
    year: yearNum,
    make: brand,
    model: effectiveModel,
    trim: effectiveTrim,
  });
  const activeColors: ColorOption[] = useMemo(
    () =>
      hasVdbColors
        ? vdbColors.map((c) => ({ id: c.id, label: c.label, color: c.hex }))
        : FALLBACK_COLOURS,
    [hasVdbColors, vdbColors],
  );

  // If the currently-selected id isn't in the new palette (e.g. VDB
  // data just resolved and replaced the fallback list), clear it so
  // the user re-picks from real options. No-op when the id is valid.
  useEffect(() => {
    if (!selectedColor) return;
    if (activeColors.some((c) => c.id === selectedColor)) return;
    setSelectedColor("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeColors]);

  // Crossfade the VDB image over the covered-car placeholder as it
  // arrives. Driven by URL presence — when carImageUrl flips null→string
  // we fade in over 300ms; when it flips back to null (user clears a
  // field) we fade out symmetrically.
  // Reveal the resolved image only once it has actually DECODED (the <Image>
  // onLoad below), not merely when the URL is set — otherwise it fades in over
  // a still-blank image and pops when the bytes land. `imageReady` gates both
  // the crossfade and the skeleton. It stays true across url swaps (color/trim
  // refetch) so the current image is held and swapped in place rather than
  // blinking back to the skeleton; it only resets when the url clears.
  const [imageReady, setImageReady] = useState(false);
  // A new car identity (year/make/model) is a *different* vehicle — drop the
  // previous image so the skeleton covers the gap instead of lingering on the
  // old car. Color/trim tweaks don't touch these, so imageReady is held and
  // the current image is swapped in place (no skeleton flash) for same-car
  // variant changes.
  useEffect(() => {
    setImageReady(false);
  }, [year, brand, model]);
  useEffect(() => {
    if (!carImageUrl) setImageReady(false);
  }, [carImageUrl]);

  // Keep the skeleton up *continuously* through the whole model→variants→image
  // cascade. Picking a model kicks off the VDB trim lookup (trimsLoading) and
  // the image can refetch a few times as the trim list resolves; latching on
  // (isImageLoading || trimsLoading) with a short tail bridges every gap so the
  // covered-car placeholder never flashes between fetches.
  // We had enough to look up an image, so an empty result means "no image
  // found" (→ failure copy) rather than "not enough info yet" (→ fill-in hint).
  const canLookupImage =
    (typeof vin === "string" && vin.trim().length === 17) ||
    !!(brand && model && year);
  const imageBusy = isImageLoading || trimsLoading;
  // Start latched when we can already look up an image (e.g. VIN-review mount)
  // so the skeleton shows immediately instead of a one-frame "no image" flash.
  const [loadingLatch, setLoadingLatch] = useState(canLookupImage);
  useEffect(() => {
    if (imageBusy) {
      setLoadingLatch(true);
      return;
    }
    const t = setTimeout(() => setLoadingLatch(false), 350);
    return () => clearTimeout(t);
  }, [imageBusy]);

  const carImageOpacity = useSharedValue(0);
  useEffect(() => {
    carImageOpacity.value = withTiming(imageReady ? 1 : 0, { duration: 300 });
  }, [imageReady, carImageOpacity]);
  const carImageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: carImageOpacity.value,
  }));

  // Trim picker keeps a separate text-input value because NHTSA doesn't
  // expose trims without VIN context — most cache rows resolve to []. The
  // input lives in the sheet so the user can type the trim themselves.
  const [trimDraft, setTrimDraft] = useState("");

  // Header search box — filters the active picker list by label. Reset on
  // every openPicker() so each sheet starts unfiltered. Trim mode reuses
  // `trimDraft` as its query instead (it already owns the header input).
  const [searchQuery, setSearchQuery] = useState("");

  // Check if all required fields are filled (for manual entry)
  const allFieldsFilled = useMemo(() => {
    return !!(brand && model && year && selectedColor && trim && drivetrain);
  }, [brand, model, year, selectedColor, trim, drivetrain]);

  const getColorById = (id: string) => activeColors.find((c) => c.id === id) || null;
  const getBodyStyleById = (id: string) => BODY_STYLES.find((b) => b.id === id) || null;

  const canPickModel = !!(year && brand);
  const canPickTrim = !!model;

  // Trigger loading animation when all fields are filled (manual entry only, plays once)
  useEffect(() => {
    if (isManualEntry && allFieldsFilled && !hasAnimationPlayedRef.current) {
      hasAnimationPlayedRef.current = true;
      setIsLoadingComplete(true);
      const timer = setTimeout(() => {
        setIsLoadingComplete(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isManualEntry, allFieldsFilled]);

  // Handlers
  const handleBack = () => router.back();

  const openPicker = useCallback((mode: SheetMode) => {
    // Seed the trim draft with the current selection so the user can edit it.
    if (mode === "trim") setTrimDraft(trim);
    setSearchQuery(""); // start each sheet with the full, unfiltered list
    setSheetMode(mode);
    pickerSheetRef.current?.open();
  }, [trim]);

  // Cascade resets — picking a new Year or Brand invalidates Model + Trim;
  // picking a new Model invalidates Trim. Keeps the form consistent with
  // what the YMMT catalog will actually have data for.
  const handleSelectBrand = useCallback((selectedBrand: string) => {
    setBrand(selectedBrand);
    setModel("");
    setTrim("");
    pickerSheetRef.current?.close();
  }, []);

  const handleSelectModel = useCallback((selectedModel: string) => {
    setModel(selectedModel);
    setTrim("");
    pickerSheetRef.current?.close();
  }, []);

  const handleSelectYear = useCallback((selectedYear: string) => {
    setYear(selectedYear);
    setModel("");
    setTrim("");
    pickerSheetRef.current?.close();
  }, []);

  const handleSelectColor = useCallback((colorId: string) => {
    setSelectedColor(colorId);
    pickerSheetRef.current?.close();
  }, []);

  const handleSelectBodyStyle = useCallback((styleId: string) => {
    setBodyStyle(styleId);
    pickerSheetRef.current?.close();
  }, []);

  const handleSelectTrim = useCallback((selectedTrim: string) => {
    setTrim(selectedTrim);
    // Auto-fill drivetrain when the trim string explicitly names one
    // (VDB variants encode it, e.g. "…4dr AWD 4MATIC+"). Leaves the field
    // untouched when the trim says nothing about drivetrain.
    const dt = drivetrainFromTrim(selectedTrim);
    if (dt) setDrivetrain(DRIVETRAIN_LABEL[dt]);
    pickerSheetRef.current?.close();
  }, []);

  const handleSelectDrivetrain = useCallback((selectedDrivetrain: string) => {
    setDrivetrain(selectedDrivetrain);
    pickerSheetRef.current?.close();
  }, []);

  const handleRetryImage = useCallback(() => {
    // Flip to the skeleton immediately, then force a fresh fetch.
    setLoadingLatch(true);
    setImageReloadKey((k) => k + 1);
  }, []);

  const handleConfirmVehicle = async () => {
    // Re-entrancy guard: ignore every tap after the first until this
    // submission settles (or the screen navigates away).
    if (submittingRef.current) return;
    if (!allFieldsFilled && isManualEntry) return; // belt-and-suspenders
    submittingRef.current = true;
    setIsSubmitting(true);

    if (!userId) {
      router.push("/vehicle-added");
      submittingRef.current = false;
      setIsSubmitting(false);
      return;
    }

    let createdOwnershipId: string | null = null;
    try {
      // Stable per-visit VIN — see manualVinRef above. Repeated submits now
      // resolve to the same VIN, so upsertVehicle + addOwner are idempotent.
      const normalizedVin = resolveVin();

      await upsertVehicle({
        vin: normalizedVin,
        year: year ? parseFloat(year) : undefined,
        metadata: {
          make: brand || "",
          model: model || "",
          body_style: bodyStyle || "",
          color: selectedColor || "",
        },
      });

      const ownershipId = await addOwner({
        vin: normalizedVin,
        userId,
        nickname: brand && model && year ? `${year} ${brand} ${model}` : undefined,
        mileage: mileage ? Number(mileage) : undefined,
      });
      createdOwnershipId = String(ownershipId);

      // Persist the rendered image URL so the cars page can short-circuit
      // its own fetch.
      //
      // Preferred path: when the user picked from the VDB-driven palette,
      // each picker option already carries the exact image URL it was
      // parsed from. Save THAT directly — bypasses the
      // `findColorImage()` keyword round-trip, which has been observed
      // to mis-match for some marketing paint names (e.g. picking a gray
      // VW Tiguan paint and getting back the neutral white EVOX render).
      //
      // Fallback: legacy ymmt-only fetch when the picker had no VDB data
      // (manual entry with no VIN, or VDB had no record for this car).
      const pickedVdbColor = vdbColors.find((c) => c.id === selectedColor);
      if (pickedVdbColor) {
        saveVehicleImageUrl({
          vin: normalizedVin,
          image_url: pickedVdbColor.imageUrl,
        });
      } else if (brand && model) {
        const yearNum = year ? parseFloat(year) : undefined;
        const vinForLookup =
          normalizedVin.length === 17 ? normalizedVin : undefined;
        fetchVehicleImageUrl(
          brand,
          model,
          yearNum,
          vinForLookup,
          selectedColor || undefined,
          trim || undefined,
        )
          .then((url) => {
            if (url) saveVehicleImageUrl({ vin: normalizedVin, image_url: url });
          })
          .catch(() => {
            // Non-fatal: cars page useEffect retries on first focus.
          });
      }
    } catch (e) {
      console.warn("Convex add vehicle failed", e);
    } finally {
      // Re-enable the button. Safe on the happy path too: we navigate away
      // next, and if the user returns a re-submit is idempotent (same VIN
      // → addOwner dedupes on (vin, user)).
      submittingRef.current = false;
      setIsSubmitting(false);
    }

    // Queue the enrichment toast for the next time the user lands on
    // home — mirrors the VIN flow's behavior in add-vehicle-review.tsx
    // so the manual path doesn't drop the user onto /vehicle-added
    // with no signal that their car is being set up behind the scenes.
    // Label uses the user-visible "<year> <brand> <model>" so the
    // toast calls out their specific car.
    const carLabel = [year.trim(), brand.trim(), model.trim()]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (carLabel) {
      setPendingEnrichmentToast(carLabel);
    }

    router.push({
      pathname: "/vehicle-added",
      params: {
        flow: "manual",
        vehicleOwnerId: createdOwnershipId ?? "",
      },
    });
  };

  const handleToggleEdit = () => setIsEditing(!isEditing);

  const currentColor = getColorById(selectedColor);
  const currentBodyStyle = getBodyStyleById(bodyStyle);

  // Get sheet title based on mode
  const getSheetTitle = () => {
    switch (sheetMode) {
      case "brand": return "Select Brand";
      case "model": return "Select Model";
      case "year": return "Select Year";
      case "color": return "Select Color";
      case "bodyStyle": return "Select Body Style";
      case "trim": return "Select Trim";
      case "drivetrain": return "Select Drivetrain";
      default: return "Select";
    }
  };

  // Memoized picker data — brand/model/trim come from the YMMT catalog,
  // the rest are static lists. Brand/model/trim arrays are turned into
  // plain string[] so the picker render code stays uniform.
  const pickerData = useMemo<any[]>(() => {
    switch (sheetMode) {
      case "brand": return [...new Set((makes ?? []).map((m) => m.name))];
      case "model": return [...new Set((ymmtModels ?? []).map((m) => m.name))];
      case "year": return YEARS;
      case "color": return activeColors;
      case "bodyStyle": return BODY_STYLES;
      case "trim": return vdbTrims;
      case "drivetrain": return DRIVETRAINS;
      default: return [];
    }
  }, [sheetMode, makes, ymmtModels, vdbTrims]);

  // Search-filtered view of the active list. Case-insensitive substring
  // match on each row's label (string rows match themselves; color /
  // bodyStyle rows match their `.label`). Trim mode filters by `trimDraft`
  // since that input lives in the header for trim; all other modes use the
  // header search box. The unfiltered `pickerData` still drives the snap
  // height so the sheet doesn't resize on every keystroke.
  const filteredPickerData = useMemo(() => {
    const q = (sheetMode === "trim" ? trimDraft : searchQuery).trim().toLowerCase();
    if (!q) return pickerData;
    return pickerData.filter((item: any) => {
      const label = typeof item === "string" ? item : item?.label ?? "";
      return String(label).toLowerCase().includes(q);
    });
  }, [pickerData, sheetMode, searchQuery, trimDraft]);

  // Dynamic snap height — fits the actual content (header + rows +
  // padding) so short lists like Drivetrain don't render as a half-empty
  // sheet. Trim mode reserves extra height for the text-input header.
  // Capped at 70% of screen height for long lists.
  const pickerSnapHeights = useMemo(() => {
    const HANDLE = 24; // grabber region above the header
    const HEADER = 62; // title + inline search row
    // Rows with a 40px icon tile (brand logo, body-style icon, drivetrain
    // schematic) stand taller than plain text rows — size for that so short
    // lists like Drivetrain fit all options without scrolling.
    const hasIconTiles =
      sheetMode === "brand" || sheetMode === "bodyStyle" || sheetMode === "drivetrain";
    const ROW = hasIconTiles ? 78 : 62; // row height incl. the 8px inter-row gap
    // sheetContent top(4) + bottom(28) + slack so the last full-width row
    // clears the sheet's 46px rounded bottom corner instead of touching it.
    const LIST_VPAD = 36;
    const EXTRA = sheetMode === "trim" ? 120 : 0; // trim's free-text input row
    const rows = Math.max(pickerData.length, 1);
    const content = HANDLE + HEADER + LIST_VPAD + rows * ROW + EXTRA;
    // Short lists still open with presence (never a cramped sliver); long
    // lists cap out and scroll internally.
    const MIN = 300 + EXTRA;
    return [Math.max(Math.min(content, SCREEN_HEIGHT * 0.72), MIN)];
  }, [pickerData, sheetMode]);

  const isPickerLoading =
    (sheetMode === "model" && modelsLoading) ||
    (sheetMode === "trim" && trimsLoading);

  const handleConfirmTrimDraft = useCallback(() => {
    const v = trimDraft.trim();
    if (!v) return;
    setTrim(v);
    pickerSheetRef.current?.close();
  }, [trimDraft]);

  // Render picker item (used by ScrollView map below)
  // Common row wrapper — Otopair card treatment (icon slot on the
  // left, label, black check pill on the right when selected).
  // Renamed from renderRow to avoid collision with an existing
  // renderRow helper further down for the vehicle-form rows.
  const renderPickerRow = (
    key: string,
    label: string,
    isSelected: boolean,
    onPress: () => void,
    leadingSlot?: React.ReactNode,
  ) => (
    <Pressable
      key={key}
      onPress={onPress}
      style={({ pressed }) => [
        styles.pickerItem,
        isSelected && styles.pickerItemSelected,
        pressed && !isSelected && styles.pickerItemPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
    >
      <View style={styles.pickerItemLeft}>
        {leadingSlot}
        <Text
          size="md"
          weight="semiBold"
          color={BrandColors.primary}
          numberOfLines={1}
          style={styles.pickerItemLabel}
        >
          {label}
        </Text>
      </View>
      {isSelected ? (
        <View style={styles.pickerCheckPill}>
          <Check size={16} color="#FFFFFF" strokeWidth={2.5} />
        </View>
      ) : null}
    </Pressable>
  );

  const renderPickerItem = (item: any) => {
    switch (sheetMode) {
      case "brand":
        return renderPickerRow(
          item,
          item,
          brand === item,
          () => handleSelectBrand(item),
          <BrandLogoTile name={item} />,
        );
      case "model":
        return renderPickerRow(item, item, model === item, () => handleSelectModel(item));
      case "year":
        return renderPickerRow(item, item, year === item, () => handleSelectYear(item));
      case "color":
        return renderPickerRow(
          item.id,
          item.label,
          selectedColor === item.id,
          () => handleSelectColor(item.id),
          <View
            style={[
              styles.pickerColorDot,
              { backgroundColor: item.color },
              item.id === "white" && styles.pickerColorDotBorder,
            ]}
          />,
        );
      case "bodyStyle": {
        const IconComponent = item.Icon;
        return renderPickerRow(
          item.id,
          item.label,
          bodyStyle === item.id,
          () => handleSelectBodyStyle(item.id),
          <View style={styles.pickerIconContainer}>
            <IconComponent size={20} color="#4B5563" />
          </View>,
        );
      }
      case "trim":
        return renderPickerRow(item, prettyTrim(item), trim === item, () => handleSelectTrim(item));
      case "drivetrain":
        return renderPickerRow(
          item,
          item,
          drivetrain === item,
          () => handleSelectDrivetrain(item),
          <View style={styles.pickerIconContainer}>
            <DrivetrainIcon variant={drivetrainVariant(item)} size={24} />
          </View>,
        );
      default:
        return null;
    }
  };

  // ── Selector list row ──────────────────────────────────────────────────────
  const renderRow = (
    label: string,
    value: string | null,
    placeholder: string,
    onPress: () => void,
    options: {
      isFirst?: boolean;
      colorDot?: string;
      disabled?: boolean;
      logoMake?: string;
      drivetrainValue?: string;
    } = {},
  ) => {
    const tappable = isEditing && !options.disabled;
    // Bundled make logo for the Brand row (null when the make has no asset).
    const brandLogo = options.logoMake ? getMakeLogo(options.logoMake) : null;
    return (
      <React.Fragment key={label}>
        {!options.isFirst && <View style={styles.rowDivider} />}
        <Pressable
          onPress={tappable ? onPress : undefined}
          style={({ pressed }) => [
            styles.row,
            pressed && tappable && styles.rowPressed,
            options.disabled && styles.rowDisabled,
          ]}
          disabled={!tappable}
        >
          <Text
            size="md"
            weight="medium"
            color={BrandColors.primary}
            numberOfLines={1}
            style={styles.rowLabel}
          >
            {label}
          </Text>
          <View style={styles.rowValue}>
            {brandLogo ? (
              <Image source={brandLogo} style={styles.rowBrandLogo} resizeMode="cover" />
            ) : null}
            {options.drivetrainValue ? (
              <DrivetrainIcon variant={drivetrainVariant(options.drivetrainValue)} size={20} />
            ) : null}
            {options.colorDot ? (
              <View
                style={[
                  styles.rowColorDot,
                  { backgroundColor: options.colorDot },
                  options.colorDot.toLowerCase() === "#ffffff" && styles.rowColorDotBorder,
                ]}
              />
            ) : null}
            <Text
              size="md"
              weight="semiBold"
              color={value ? BrandColors.primary : "rgba(20,28,36,0.4)"}
              numberOfLines={1}
              style={styles.rowValueText}
            >
              {value ?? placeholder}
            </Text>
            {isEditing && <ChevronRight size={18} color="rgba(20,28,36,0.4)" />}
          </View>
        </Pressable>
      </React.Fragment>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "android" ? "height" : undefined}
      keyboardVerticalOffset={getKeyboardOffset()}
    >
      <StatusBar style="dark" />
      <LinearGradient
        colors={["#FFFFFF", "#FFFFFF", "#D6EAF8"]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + Spacing.sm,
            paddingBottom: insets.bottom + Spacing.lg + 26,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
        keyboardDismissMode="interactive"
      >
        {/* Header — inline so the page reads as one continuous scroll */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.headerButton, pressed && styles.buttonPressed]}
            hitSlop={12}
          >
            <ChevronLeft size={26} color={BrandColors.primary} strokeWidth={2.25} />
          </Pressable>
          <Text weight="bold" size="xl" color={BrandColors.primary} style={styles.headerTitle}>
            {isManualEntry ? "Add Vehicle Details" : "Review Vehicle Details"}
          </Text>
          <View style={styles.headerButton} />
        </View>
        {/* Hero image card —
            Base layer is always the covered-car placeholder. The VDB
            image fades in over it as soon as the hook resolves, driven
            by `useVehicleImage`'s 400ms-debounced fetch and the
            300ms crossfade on `carImageOpacity`. The Lottie still
            plays once when manual-mode fields fill, but it now sits on
            top of the swap instead of gating it. */}
        <View style={styles.heroCard}>
          {/* Empty-state placeholder — ONLY when there's nothing to show and
              we're not loading. Hidden during load so the skeleton isn't
              stacked on top of the covered-car art. */}
          {!imageReady && !loadingLatch && !carImageUrl && (
            <View style={styles.heroEmpty}>
              <Image
                source={require("@/assets/images/covered-car.png")}
                style={styles.heroEmptyImage}
                resizeMode="contain"
              />
              <Text size="sm" color="#8E8E93" center style={styles.heroEmptyText}>
                {canLookupImage
                  ? "Couldn't get an image of your car"
                  : "Your car shows up here as you fill in the details"}
              </Text>
              {canLookupImage && (
                <>
                  <Text size="xs" color="#9CA3AF" center style={styles.heroContinueHint}>
                    You can still continue without an image
                  </Text>
                  <Pressable
                    onPress={handleRetryImage}
                    style={({ pressed }) => [styles.heroRetryBtn, pressed && { opacity: 0.7 }]}
                    hitSlop={8}
                  >
                    <RotateCw size={14} color={BrandColors.secondary} strokeWidth={2.25} />
                    <Text weight="semiBold" size="sm" color={BrandColors.secondary}>
                      Retry
                    </Text>
                  </Pressable>
                </>
              )}
            </View>
          )}

          {/* Loading skeleton — stays up continuously through the whole
              model→variants→image cascade (latched), and covers the card so the
              placeholder never peeks through. Once an image has decoded, same-car
              refetches (color/trim) hold it and swap in place — no re-flash. */}
          {!imageReady && (loadingLatch || !!carImageUrl) && <HeroImageSkeleton />}

          {carImageUrl && (
            <Animated.Image
              source={{ uri: carImageUrl }}
              style={[styles.heroImageOverlay, carImageAnimatedStyle]}
              resizeMode="contain"
              onLoad={() => setImageReady(true)}
              onError={() => setImageReady(true)}
            />
          )}

          {isManualEntry && isLoadingComplete && (
            <LottieView
              source={require("@/assets/animations/loading-dots-blue.json")}
              autoPlay
              loop
              style={[styles.heroLottie, styles.heroLottieOverlay]}
            />
          )}

          {!isManualEntry && (
            <View style={styles.extractedBadge}>
              <Text weight="semiBold" size="xs" color="#6B7280" style={styles.extractedBadgeText}>
                EXTRACTED FROM VIN
              </Text>
            </View>
          )}
        </View>

        {/* Selector list — single card, internal dividers.
            Order matches the YMMT cascade: Year → Brand → Model → Trim.
            Color + Drivetrain follow afterwards. Model/Trim rows show a
            hint placeholder until their upstream fields are set. */}
        <View style={styles.listCard}>
          {renderRow(
            "Year",
            year || null,
            "Select year",
            () => openPicker("year"),
            { isFirst: true },
          )}
          {renderRow("Brand", brand || null, "Select brand", () => openPicker("brand"), {
            logoMake: brand,
          })}
          {renderRow(
            "Model",
            model || null,
            canPickModel ? "Select model" : "Pick year & brand first",
            () => openPicker("model"),
            { disabled: !canPickModel },
          )}
          {renderRow(
            "Trim",
            trim ? prettyTrim(trim) : null,
            canPickTrim ? "Select trim" : "Pick model first",
            () => openPicker("trim"),
            { disabled: !canPickTrim },
          )}
          {renderRow(
            "Color",
            currentColor ? currentColor.label : null,
            "Select color",
            () => openPicker("color"),
            { colorDot: currentColor?.color },
          )}
          {renderRow(
            "Drivetrain",
            drivetrain || null,
            "Select drivetrain",
            () => openPicker("drivetrain"),
            { drivetrainValue: drivetrain },
          )}
        </View>

        {/* Mileage card */}
        <View style={styles.mileageCard}>
          <Input
            label="Mileage"
            placeholder="e.g. 12,500"
            keyboardType="number-pad"
            value={mileage}
            onChangeText={setMileage}
            size="md"
            rightElement={<Text size="md" color="#8E8E93">mi</Text>}
            helperText="Estimate is fine"
          />
        </View>

        {/* Inline CTA — part of the scroll surface so the page reads as
            one continuous motion (no sticky footer, no cut-off line). */}
        <Pressable
          onPress={handleConfirmVehicle}
          disabled={!allFieldsFilled || isSubmitting}
          style={({ pressed }) => [
            styles.ctaWrap,
            (!allFieldsFilled || isSubmitting) && styles.ctaDisabled,
            pressed && allFieldsFilled && !isSubmitting && { opacity: 0.92 },
          ]}
        >
          <LinearGradient
            colors={["#7BB8FF", "#5299FE", "#3B7FEB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            {isSubmitting ? (
              <ActivityIndicator color={BrandColors.white} />
            ) : (
              <Text weight="bold" size="md" color={BrandColors.white}>
                Confirm & Add Vehicle
              </Text>
            )}
          </LinearGradient>
        </Pressable>

        {!isManualEntry && (
          <Pressable
            onPress={handleToggleEdit}
            style={({ pressed }) => [styles.editLink, pressed && styles.buttonPressed]}
          >
            <Text
              weight="semiBold"
              size="sm"
              color={isEditing ? BrandColors.secondary : "#6B7280"}
            >
              {isEditing ? "Done Editing" : "Edit Information"}
            </Text>
          </Pressable>
        )}
      </ScrollView>

      {/* Picker FloatingSheet (with blur backdrop) */}
      <FloatingSheet
        ref={pickerSheetRef}
        snapHeights={pickerSnapHeights}
        showBackdrop
      >
        <View style={styles.sheetWrapper}>
          <View style={styles.sheetHeader}>
            <Text
              weight="bold"
              size="lg"
              color={BrandColors.primary}
              numberOfLines={1}
              style={styles.sheetTitle}
            >
              {getSheetTitle()}
            </Text>

            {/* Inline search — filters the list as you type. Hidden in trim
                mode, which owns a dedicated free-text input row below. */}
            {sheetMode !== "trim" && (
              <View style={styles.headerSearch}>
                <Search size={16} color="rgba(20,28,36,0.4)" strokeWidth={2.2} />
                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Search"
                  placeholderTextColor="rgba(20,28,36,0.4)"
                  style={styles.headerSearchInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="search"
                  keyboardType={sheetMode === "year" ? "number-pad" : "default"}
                  clearButtonMode="while-editing"
                />
              </View>
            )}

            <Pressable
              onPress={() => pickerSheetRef.current?.close()}
              style={styles.sheetCloseBtn}
              hitSlop={8}
              accessibilityLabel="Close"
            >
              <X size={16} color={BrandColors.primary} strokeWidth={2.4} />
            </Pressable>
          </View>

          {/* Trim mode: free-text input on top — NHTSA returns no trims
              for most (model, year) pairs, so the cached list is usually
              empty. The input lets the user type "F Sport", "XLE", etc.
              Any cached trims show as tappable suggestions below. */}
          {sheetMode === "trim" && (
            <View style={styles.trimInputRow}>
              <TextInput
                value={trimDraft}
                onChangeText={setTrimDraft}
                placeholder="Type a trim — e.g. F Sport, XLE, Limited"
                placeholderTextColor="rgba(20,28,36,0.4)"
                style={styles.trimInput}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={handleConfirmTrimDraft}
              />
              <Pressable
                onPress={handleConfirmTrimDraft}
                disabled={!trimDraft.trim()}
                style={({ pressed }) => [
                  styles.trimSubmit,
                  !trimDraft.trim() && styles.trimSubmitDisabled,
                  pressed && trimDraft.trim() && { opacity: 0.85 },
                ]}
              >
                <Text weight="semiBold" size="sm" color={BrandColors.white}>
                  Use
                </Text>
              </Pressable>
            </View>
          )}

          <ScrollView
            key={sheetMode}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {sheetMode === "color" && colorsLoading ? (
              <ColorSwatchSkeletonList rows={5} />
            ) : isPickerLoading ? (
              <View style={styles.emptyState}>
                <ActivityIndicator color={BrandColors.secondary} />
                <Text size="sm" color="#8E8E93" style={{ marginTop: Spacing.sm }}>
                  Loading…
                </Text>
              </View>
            ) : filteredPickerData.length === 0 ? (
              <View style={styles.emptyState}>
                <Text size="md" color="#8E8E93" center>
                  {(sheetMode === "trim" ? trimDraft.trim() : searchQuery.trim())
                    ? "No matches"
                    : sheetMode === "model"
                      ? "No models found — try a different year"
                      : sheetMode === "trim"
                        ? "No saved trims — type your trim above"
                        : "Nothing to pick yet"}
                </Text>
              </View>
            ) : (
              filteredPickerData.map((item: any) => renderPickerItem(item))
            )}
          </ScrollView>
        </View>
      </FloatingSheet>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#EAF2FA",
  },
  // Header (inline in ScrollView — scrolls with the page)
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: -Spacing.sm,
    marginBottom: Spacing.md,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  // Hero card
  heroCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "rgba(20,28,36,0.06)",
    padding: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    // Stable height across placeholder / skeleton / image states — the
    // covered-car art no longer sets the card height (it's hidden during
    // load), so pin it here to avoid a layout jump as the states swap.
    minHeight: 230,
    marginBottom: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  heroImage: {
    width: "100%",
    height: 180,
  },
  heroImageOverlay: {
    position: "absolute",
    top: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
  },
  heroSkeleton: {
    position: "absolute",
    top: Spacing.lg,
    left: Spacing.lg,
    right: Spacing.lg,
    bottom: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  heroSkeletonBlock: {
    width: "100%",
    height: "100%",
    borderRadius: BorderRadius.lg,
    backgroundColor: "#E5E7EB",
  },
  heroLottie: {
    width: 200,
    height: 100,
  },
  heroLottieOverlay: {
    position: "absolute",
  },
  heroEmpty: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  heroEmptyImage: {
    width: 220,
    height: 140,
    marginBottom: Spacing.md,
  },
  heroEmptyText: {
    maxWidth: 240,
    lineHeight: 18,
  },
  heroContinueHint: {
    maxWidth: 240,
    marginTop: 2,
    lineHeight: 16,
  },
  heroRetryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: "rgba(82,153,254,0.4)",
    backgroundColor: "rgba(82,153,254,0.08)",
  },
  extractedBadge: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: BrandColors.white,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  extractedBadgeText: {
    letterSpacing: 0.5,
  },
  // Selector list card
  listCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "rgba(20,28,36,0.06)",
    marginBottom: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowPressed: {
    backgroundColor: "rgba(82,153,254,0.04)",
  },
  rowDisabled: {
    opacity: 0.55,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(20,28,36,0.08)",
    marginHorizontal: Spacing.lg,
  },
  rowLabel: {
    // Label keeps its natural width; the value column shrinks instead.
    flexShrink: 0,
    marginRight: Spacing.md,
  },
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    // Take the remaining width and allow the value text to shrink so a
    // long trim ("Base E 400 4dr All-wheel Drive 4MATIC Sedan Automatic")
    // ellipsizes on one line instead of wrapping under the label.
    flex: 1,
    minWidth: 0,
    justifyContent: "flex-end",
  },
  rowValueText: {
    flexShrink: 1,
    textAlign: "right",
  },
  rowColorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  rowBrandLogo: {
    width: 28,
    height: 28,
  },
  rowColorDotBorder: {
    borderWidth: 1,
    borderColor: "rgba(20,28,36,0.15)",
  },
  // Mileage card
  mileageCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: "rgba(20,28,36,0.06)",
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  ctaWrap: {
    borderRadius: 28,
    overflow: "hidden",
  },
  ctaDisabled: {
    opacity: 0.55,
  },
  ctaGradient: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  editLink: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  // Picker FloatingSheet body
  sheetWrapper: {
    flex: 1,
  },
  sheetHeader: {
    // Roomier header — matches the sheet header pattern used on
    // Screen 2 category rows and the cart sheet. Title on the left,
    // inline search in the middle, soft-circle close on the right.
    // space-between keeps the close X pinned right even in trim mode,
    // which has no search field to fill the row.
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  sheetTitle: {
    // Natural width but allowed to shrink so the search pill keeps room
    // on narrow screens / longer titles ("Select Drivetrain").
    flexShrink: 1,
  },
  headerSearch: {
    // Soft pill that flexes to fill the space between title and close.
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 96,
    paddingHorizontal: 10,
    height: 36,
    backgroundColor: "rgba(20,28,36,0.05)",
    borderRadius: BorderRadius.full,
  },
  headerSearchInput: {
    flex: 1,
    paddingVertical: 0,
    fontSize: 15,
    color: BrandColors.primary,
  },
  sheetCloseBtn: {
    // Soft-tinted circle for the close X — mirrors the close chip
    // pattern on Cart sheet + Service Info sheet.
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetContent: {
    paddingHorizontal: 20,
    paddingTop: 4,
    // Extra bottom room so the last row clears the sheet's 46px rounded
    // bottom corner (matched by LIST_VPAD in pickerSnapHeights).
    paddingBottom: 28,
    gap: 8,
  },
  pickerItem: {
    // Otopair row card treatment — matches ServiceMultiSelectRow's
    // unselected state on Screen 2. Icon/color dot on the left,
    // label in the middle, check pill on the right when active.
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  pickerItemPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.04)",
  },
  pickerItemSelected: {
    // Same blue-tinted "selected" treatment as the Screen 2 rows.
    backgroundColor: "rgba(82, 153, 254, 0.14)",
    borderColor: "rgba(82, 153, 254, 0.45)",
  },
  pickerItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  pickerItemLabel: {
    flex: 1,
    minWidth: 0,
  },
  pickerColorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  pickerColorDotBorder: {
    borderWidth: 1,
    borderColor: "rgba(20,28,36,0.15)",
  },
  pickerIconContainer: {
    // Same 40×40 icon tile as ServiceMultiSelectRow.
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerLogoTile: {
    // White tile so full-colour brand marks read cleanly; doubles as the
    // monogram chip when the CDN has no logo for a make.
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  pickerLogoImage: {
    width: 35,
    height: 35,
  },
  pickerCheckPill: {
    // Same black check pill as ServiceMultiSelectRow's stateCheck.
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
  trimInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  trimInput: {
    flex: 1,
    backgroundColor: "rgba(20,28,36,0.04)",
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === "ios" ? 12 : 8,
    fontSize: 16,
    color: BrandColors.primary,
  },
  trimSubmit: {
    backgroundColor: BrandColors.secondary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  trimSubmitDisabled: {
    opacity: 0.4,
  },
});
