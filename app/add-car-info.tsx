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
import { Car, Bike, Truck, Check, ChevronLeft, ChevronRight, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import LottieView from "lottie-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
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

  const { url: carImageUrl } = useVehicleImage(
    brand,
    effectiveModel,
    yearNum,
    undefined,
    selectedColor,
    effectiveTrim,
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
  const carImageOpacity = useSharedValue(0);
  useEffect(() => {
    carImageOpacity.value = withTiming(carImageUrl ? 1 : 0, { duration: 300 });
  }, [carImageUrl, carImageOpacity]);
  const carImageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: carImageOpacity.value,
  }));

  // Trim picker keeps a separate text-input value because NHTSA doesn't
  // expose trims without VIN context — most cache rows resolve to []. The
  // input lives in the sheet so the user can type the trim themselves.
  const [trimDraft, setTrimDraft] = useState("");

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
    pickerSheetRef.current?.close();
  }, []);

  const handleSelectDrivetrain = useCallback((selectedDrivetrain: string) => {
    setDrivetrain(selectedDrivetrain);
    pickerSheetRef.current?.close();
  }, []);

  const handleConfirmVehicle = async () => {
    if (!userId) {
      router.push("/vehicle-added");
      return;
    }

    let createdOwnershipId: string | null = null;
    try {
      const normalizedVin =
        typeof vin === "string" && vin.trim().length === 17
          ? vin.trim().toUpperCase()
          : `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

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

  // Dynamic snap height — fits the actual content (header + rows +
  // padding) so short lists like Drivetrain don't render as a half-empty
  // sheet. Trim mode reserves extra height for the text-input header.
  // Capped at 70% of screen height for long lists.
  const pickerSnapHeights = useMemo(() => {
    const HEADER = 60;
    const ROW = 56;
    const PADDING = 40;
    const EXTRA = sheetMode === "trim" ? 120 : 0;
    const content =
      HEADER + Math.max(pickerData.length, 1) * ROW + PADDING + EXTRA;
    return [Math.min(content, SCREEN_HEIGHT * 0.7)];
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
        return renderPickerRow(item, item, brand === item, () => handleSelectBrand(item));
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
        return renderPickerRow(item, item, trim === item, () => handleSelectTrim(item));
      case "drivetrain":
        return renderPickerRow(item, item, drivetrain === item, () => handleSelectDrivetrain(item));
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
    options: { isFirst?: boolean; colorDot?: string; disabled?: boolean } = {},
  ) => {
    const tappable = isEditing && !options.disabled;
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
          <Text size="md" weight="medium" color={BrandColors.primary}>
            {label}
          </Text>
          <View style={styles.rowValue}>
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
          <View style={isManualEntry ? styles.heroEmpty : undefined}>
            <Image
              source={require("@/assets/images/covered-car.png")}
              style={isManualEntry ? styles.heroEmptyImage : styles.heroImage}
              resizeMode="contain"
            />
            {isManualEntry && !carImageUrl && (
              <Text size="sm" color="#8E8E93" center style={styles.heroEmptyText}>
                Your car shows up here as you fill in the details
              </Text>
            )}
          </View>

          {carImageUrl && (
            <Animated.Image
              source={{ uri: carImageUrl }}
              style={[styles.heroImageOverlay, carImageAnimatedStyle]}
              resizeMode="contain"
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
          {renderRow("Brand", brand || null, "Select brand", () => openPicker("brand"))}
          {renderRow(
            "Model",
            model || null,
            canPickModel ? "Select model" : "Pick year & brand first",
            () => openPicker("model"),
            { disabled: !canPickModel },
          )}
          {renderRow(
            "Trim",
            trim || null,
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
          disabled={!allFieldsFilled}
          style={({ pressed }) => [
            styles.ctaWrap,
            !allFieldsFilled && styles.ctaDisabled,
            pressed && allFieldsFilled && { opacity: 0.92 },
          ]}
        >
          <LinearGradient
            colors={["#7BB8FF", "#5299FE", "#3B7FEB"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.ctaGradient}
          >
            <Text weight="bold" size="md" color={BrandColors.white}>
              Confirm & Add Vehicle
            </Text>
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
            <Text weight="bold" size="lg" color={BrandColors.primary}>
              {getSheetTitle()}
            </Text>
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
            ) : pickerData.length === 0 ? (
              <View style={styles.emptyState}>
                <Text size="md" color="#8E8E93" center>
                  {sheetMode === "model"
                    ? "No models found — try a different year"
                    : sheetMode === "trim"
                      ? "No saved trims — type your trim above"
                      : "Nothing to pick yet"}
                </Text>
              </View>
            ) : (
              pickerData.map((item: any) => renderPickerItem(item))
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
    minHeight: 200,
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
  rowValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  rowColorDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
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
    // soft-circle close on the right.
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
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
    paddingBottom: 16,
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
