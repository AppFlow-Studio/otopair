/**
 * ReviewVehicleDetailsScreen
 *
 * PURPOSE: Screen for reviewing vehicle details extracted from VIN
 *
 * USED IN: Navigated from add-vehicle.tsx after VIN input or scan
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useMemo, useRef, useState, useCallback, useEffect } from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  TextInput,
  Image,
  InputAccessoryView,
  Keyboard,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 2. Expo & Third-party
import { StatusBar } from "expo-status-bar";
import { useRouter, useLocalSearchParams } from "expo-router";
import { ArrowLeft, ChevronDown, ChevronLeft, Car, Bike, Truck, Check, X } from "lucide-react-native";
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetFlatList } from "@gorhom/bottom-sheet";
import LottieView from "lottie-react-native";

// 3. Convex & hooks
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";

// 4. Shared UI
import { Text } from "@/components/shared-ui";
import { useVehicleImage } from "@/utils/vehicleImage";
import { scale, verticalScale, moderateScale } from '@/utils/responsive';

// 5. Constants
import { Spacing, BorderRadius, FontFamily } from "@/constants/theme";

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Calculate keyboard offset based on screen height
const getKeyboardOffset = () => {
  if (Platform.OS !== "ios") return 0;
  // iPhone 14 Pro Max (~932 points) needs more offset
  // iPhone 17 Pro (~852 points) needs minimal offset
  if (SCREEN_HEIGHT >= 920) return 50;
  return 0;
};

// Accent color for selections
const ACCENT_COLOR = "#5299FE";

// Vehicle colours
const COLOURS = [
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

// Years (last 30 years)
const YEARS = Array.from({ length: 30 }, (_, i) => (2025 - i).toString());

// Popular brands
const BRANDS = [
  "Acura",
  "Alfa Romeo",
  "Aston Martin",
  "Audi",
  "Bentley",
  "BMW",
  "Buick",
  "Cadillac",
  "Chevrolet",
  "Chrysler",
  "Dodge",
  "Ferrari",
  "Fiat",
  "Ford",
  "Genesis",
  "GMC",
  "Honda",
  "Hyundai",
  "Infiniti",
  "Jaguar",
  "Jeep",
  "Kia",
  "Lamborghini",
  "Land Rover",
  "Lexus",
  "Lincoln",
  "Maserati",
  "Mazda",
  "McLaren",
  "Mercedes-Benz",
  "Mini",
  "Mitsubishi",
  "Nissan",
  "Porsche",
  "Ram",
  "Rolls-Royce",
  "Subaru",
  "Tesla",
  "Toyota",
  "Volkswagen",
  "Volvo",
];

// Models per brand (simplified - in real app would come from API)
const BRAND_MODELS: Record<string, string[]> = {
  Lexus: ["ES", "GS", "GX", "IS", "LC", "LS", "LX", "NX", "RC", "RX", "UX", "RX350", "RX450h", "ES350", "NX300"],
  Toyota: [
    "4Runner",
    "Avalon",
    "Camry",
    "Corolla",
    "GR86",
    "Highlander",
    "Land Cruiser",
    "Prius",
    "RAV4",
    "Sequoia",
    "Supra",
    "Tacoma",
    "Tundra",
    "Venza",
  ],
  Honda: ["Accord", "Civic", "CR-V", "HR-V", "Insight", "Odyssey", "Passport", "Pilot", "Ridgeline"],
  BMW: [
    "2 Series",
    "3 Series",
    "4 Series",
    "5 Series",
    "7 Series",
    "8 Series",
    "i4",
    "i7",
    "iX",
    "M3",
    "M4",
    "M5",
    "X1",
    "X3",
    "X5",
    "X7",
    "Z4",
  ],
  "Mercedes-Benz": [
    "A-Class",
    "C-Class",
    "CLA",
    "CLS",
    "E-Class",
    "EQE",
    "EQS",
    "G-Class",
    "GLA",
    "GLB",
    "GLC",
    "GLE",
    "GLS",
    "S-Class",
    "SL",
  ],
  Audi: ["A3", "A4", "A5", "A6", "A7", "A8", "e-tron", "Q3", "Q4", "Q5", "Q7", "Q8", "R8", "RS6", "S4", "S5", "TT"],
  Tesla: ["Model 3", "Model S", "Model X", "Model Y", "Cybertruck"],
  Ford: ["Bronco", "Edge", "Escape", "Expedition", "Explorer", "F-150", "Maverick", "Mustang", "Ranger"],
  Chevrolet: [
    "Blazer",
    "Bolt",
    "Camaro",
    "Colorado",
    "Corvette",
    "Equinox",
    "Malibu",
    "Silverado",
    "Suburban",
    "Tahoe",
    "Trailblazer",
    "Traverse",
  ],
};

// Drivetrains
const DRIVETRAINS = [
  "Front-Wheel Drive (FWD)",
  "Rear-Wheel Drive (RWD)",
  "All-Wheel Drive (AWD)",
  "Four-Wheel Drive (4WD)",
];

// Trims (common across brands)
const TRIMS = [
  "Base",
  "Sport",
  "Premium",
  "Luxury",
  "Limited",
  "Platinum",
  "F Sport",
  "S",
  "SE",
  "SEL",
  "XLE",
  "XSE",
  "Touring",
  "GT",
  "RS",
  "AMG",
  "M Sport",
];

type SheetMode = "brand" | "model" | "year" | "color" | "bodyStyle" | "trim" | "drivetrain";

// ============================================================================
// COMPONENT
// ============================================================================

export default function ReviewVehicleDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { vin, manual } = useLocalSearchParams<{ vin: string; manual: string }>();
  const { userId } = useUserFromConvex();
  const addOwner = useMutation(api.vehicles.addOwner);
  const upsertVehicle = useMutation(api.vehicles.upsertVehicle);
  // Check if this is manual entry mode (no VIN provided)
  const isManualEntry = manual === "true";

  // State - Hardcoded Lexus RX350 details for VIN mode, blank for manual mode
  const [year, setYear] = useState(isManualEntry ? "" : "2023");
  const [brand, setBrand] = useState(isManualEntry ? "" : "Lexus");
  const [model, setModel] = useState(isManualEntry ? "" : "RX350");
  const [trim, setTrim] = useState(isManualEntry ? "" : "F Sport");
  const [drivetrain, setDrivetrain] = useState(isManualEntry ? "" : "All-Wheel Drive (AWD)");
  const [bodyStyle, setBodyStyle] = useState(isManualEntry ? "" : "suv");
  const [selectedColor, setSelectedColor] = useState(isManualEntry ? "" : "midnight-silver");
  const [mileage, setMileage] = useState("");
  const [isEditing, setIsEditing] = useState(isManualEntry);
  const [sheetMode, setSheetMode] = useState<SheetMode>("brand");
  const [isLoadingComplete, setIsLoadingComplete] = useState(false);
  const [showCarImageAfterAnimation, setShowCarImageAfterAnimation] = useState(false);
  const hasAnimationPlayedRef = useRef(false);

  const carImageUrl = useVehicleImage(brand, model, year ? parseInt(year, 10) : undefined, undefined, selectedColor);

  // Refs
  const pickerSheetRef = useRef<BottomSheetModal>(null);

  // Snap points for picker sheet - taller for longer lists
  const snapPoints = useMemo(() => ["92%"], []);

  // Check if all required fields are filled (for manual entry)
  const allFieldsFilled = useMemo(() => {
    return !!(brand && model && year && selectedColor && bodyStyle && trim && drivetrain);
  }, [brand, model, year, selectedColor, bodyStyle, trim, drivetrain]);

  // Get color object by id
  const getColorById = (id: string) => COLOURS.find((c) => c.id === id) || null;

  // Get body style object by id
  const getBodyStyleById = (id: string) => BODY_STYLES.find((b) => b.id === id) || null;

  // Get models for selected brand
  const availableModels = useMemo(() => {
    if (!brand) return [];
    return BRAND_MODELS[brand] || [];
  }, [brand]);

  // Trigger loading animation when all fields are filled (manual entry only, plays once)
  useEffect(() => {
    if (isManualEntry && allFieldsFilled && !hasAnimationPlayedRef.current) {
      hasAnimationPlayedRef.current = true;
      setIsLoadingComplete(true);
      const timer = setTimeout(() => {
        setIsLoadingComplete(false);
        setShowCarImageAfterAnimation(true); // Show car image after animation ends
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [isManualEntry, allFieldsFilled]);

  // Handlers
  const handleBack = () => {
    router.back();
  };

  const openPicker = useCallback((mode: SheetMode) => {
    setSheetMode(mode);
    pickerSheetRef.current?.present();
  }, []);

  const handleSelectBrand = useCallback((selectedBrand: string) => {
    setBrand(selectedBrand);
    setModel(""); // Reset model when brand changes
    pickerSheetRef.current?.dismiss();
  }, []);

  const handleSelectModel = useCallback((selectedModel: string) => {
    setModel(selectedModel);
    pickerSheetRef.current?.dismiss();
  }, []);

  const handleSelectYear = useCallback((selectedYear: string) => {
    setYear(selectedYear);
    pickerSheetRef.current?.dismiss();
  }, []);

  const handleSelectColor = useCallback((colorId: string) => {
    setSelectedColor(colorId);
    pickerSheetRef.current?.dismiss();
  }, []);

  const handleSelectBodyStyle = useCallback((styleId: string) => {
    setBodyStyle(styleId);
    pickerSheetRef.current?.dismiss();
  }, []);

  const handleSelectTrim = useCallback((selectedTrim: string) => {
    setTrim(selectedTrim);
    pickerSheetRef.current?.dismiss();
  }, []);

  const handleSelectDrivetrain = useCallback((selectedDrivetrain: string) => {
    setDrivetrain(selectedDrivetrain);
    pickerSheetRef.current?.dismiss();
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

      // Ensure vehicle exists (upsertVehicle creates if missing; addOwner also ensures it)
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
        is_primary: true,
        nickname: brand && model && year ? `${year} ${brand} ${model}` : undefined,
        mileage: mileage ? Number(mileage) : undefined,
      });
      createdOwnershipId = String(ownershipId);

    } catch (e) {
      console.warn("Convex add vehicle failed", e);
    }
    router.push({
      pathname: "/vehicle-added",
      params: {
        flow: "manual",
        vehicleOwnerId: createdOwnershipId ?? "",
      },
    });
  };

  const handleToggleEdit = () => {
    setIsEditing(!isEditing);
  };

  const renderBackdrop = useCallback(
    (props: any) => <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.5} />,
    [],
  );

  const currentColor = getColorById(selectedColor);
  const currentBodyStyle = getBodyStyleById(bodyStyle);

  // Get sheet title based on mode
  const getSheetTitle = () => {
    switch (sheetMode) {
      case "brand":
        return "Select Brand";
      case "model":
        return "Select Model";
      case "year":
        return "Select Year";
      case "color":
        return "Select Color";
      case "bodyStyle":
        return "Select Body Style";
      case "trim":
        return "Select Trim";
      case "drivetrain":
        return "Select Drivetrain";
      default:
        return "Select";
    }
  };

  // Memoized picker data for stable reference
  const pickerData = useMemo(() => {
    switch (sheetMode) {
      case "brand":
        return BRANDS;
      case "model":
        return availableModels;
      case "year":
        return YEARS;
      case "color":
        return COLOURS;
      case "bodyStyle":
        return BODY_STYLES;
      case "trim":
        return TRIMS;
      case "drivetrain":
        return DRIVETRAINS;
      default:
        return [];
    }
  }, [sheetMode, availableModels]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: any) => {
    if (typeof item === "string") return item;
    return item.id || item.label;
  }, []);

  // Render item for FlatList
  const renderPickerItem = useCallback(
    ({ item }: { item: any }) => {
      switch (sheetMode) {
        case "brand":
          return (
            <Pressable
              onPress={() => handleSelectBrand(item)}
              style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
            >
              <Text size="md" color="#000000">
                {item}
              </Text>
              {brand === item && <Check size={scale(20)} color={ACCENT_COLOR} strokeWidth={3} />}
            </Pressable>
          );

        case "model":
          return (
            <Pressable
              onPress={() => handleSelectModel(item)}
              style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
            >
              <Text size="md" color="#000000">
                {item}
              </Text>
              {model === item && <Check size={scale(20)} color={ACCENT_COLOR} strokeWidth={3} />}
            </Pressable>
          );

        case "year":
          return (
            <Pressable
              onPress={() => handleSelectYear(item)}
              style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
            >
              <Text size="md" color="#000000">
                {item}
              </Text>
              {year === item && <Check size={scale(20)} color={ACCENT_COLOR} strokeWidth={3} />}
            </Pressable>
          );

        case "color":
          return (
            <Pressable
              onPress={() => handleSelectColor(item.id)}
              style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
            >
              <View style={styles.pickerItemLeft}>
                <View
                  style={[
                    styles.pickerColorDot,
                    { backgroundColor: item.color },
                    item.id === "white" && styles.pickerColorDotBorder,
                  ]}
                />
                <Text size="md" color="#000000">
                  {item.label}
                </Text>
              </View>
              {selectedColor === item.id && <Check size={scale(20)} color={ACCENT_COLOR} strokeWidth={3} />}
            </Pressable>
          );

        case "bodyStyle":
          const IconComponent = item.Icon;
          return (
            <Pressable
              onPress={() => handleSelectBodyStyle(item.id)}
              style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
            >
              <View style={styles.pickerItemLeft}>
                <View style={styles.pickerIconContainer}>
                  <IconComponent size={scale(20)} color="#666666" />
                </View>
                <Text size="md" color="#000000">
                  {item.label}
                </Text>
              </View>
              {bodyStyle === item.id && <Check size={scale(20)} color={ACCENT_COLOR} strokeWidth={3} />}
            </Pressable>
          );

        case "trim":
          return (
            <Pressable
              onPress={() => handleSelectTrim(item)}
              style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
            >
              <Text size="md" color="#000000">
                {item}
              </Text>
              {trim === item && <Check size={scale(20)} color={ACCENT_COLOR} strokeWidth={3} />}
            </Pressable>
          );

        case "drivetrain":
          return (
            <Pressable
              onPress={() => handleSelectDrivetrain(item)}
              style={({ pressed }) => [styles.pickerItem, pressed && styles.pickerItemPressed]}
            >
              <Text size="md" color="#000000">
                {item}
              </Text>
              {drivetrain === item && <Check size={scale(20)} color={ACCENT_COLOR} strokeWidth={3} />}
            </Pressable>
          );

        default:
          return null;
      }
    },
    [
      sheetMode,
      brand,
      model,
      year,
      selectedColor,
      bodyStyle,
      trim,
      drivetrain,
      handleSelectBrand,
      handleSelectModel,
      handleSelectYear,
      handleSelectColor,
      handleSelectBodyStyle,
      handleSelectTrim,
      handleSelectDrivetrain,
    ],
  );

  // Empty state component for model picker
  const ListEmptyComponent = useCallback(() => {
    if (sheetMode === "model" && availableModels.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Text size="md" color="#999999">
            Please select a brand first
          </Text>
        </View>
      );
    }
    return null;
  }, [sheetMode, availableModels.length]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={getKeyboardOffset()}
    >
      <StatusBar style="dark" />

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 120, paddingTop: insets.top + 8 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
            hitSlop={12}
          >
            <ArrowLeft size={scale(24)} color="#000000" strokeWidth={2} />
          </Pressable>
          <Text weight="bold" size="xl" color="#000000" style={styles.headerTitle}>
            {isManualEntry ? "Add Vehicle Details" : "Review Vehicle Details"}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Car Image Section */}
        <View style={styles.imageSection}>
          <View style={styles.imageContainer}>
            {/* Show car image for VIN mode OR after animation completes in manual mode */}
            {(!isManualEntry || showCarImageAfterAnimation) && (
              <Image
                source={
                  carImageUrl
                    ? { uri: carImageUrl }
                    : require("@/assets/images/lexus.png")
                }
                style={styles.carImage}
                resizeMode="contain"
              />
            )}
            {!isManualEntry && (
              <View style={styles.extractedBadge}>
                <Text weight="semiBold" size="xs" color="#666666" style={styles.extractedBadgeText}>
                  EXTRACTED FROM VIN
                </Text>
              </View>
            )}
            {/* Loading Animation for manual entry */}
            {isManualEntry && isLoadingComplete && (
              <LottieView
                source={require("@/assets/animations/loading-dots-blue.json")}
                autoPlay
                loop
                style={styles.lottieAnimation}
              />
            )}
          </View>
        </View>

        {/* Vehicle Details Card */}
        <View style={styles.detailsCard}>
          {/* 2x2 Grid */}
          <View style={styles.gridContainer}>
            {/* Brand & Model */}
            <Pressable
              style={[styles.gridItem, styles.gridItemLeft]}
              onPress={isEditing ? () => openPicker("brand") : undefined}
            >
              <Text weight="semiBold" size="xs" color={ACCENT_COLOR} style={styles.gridLabel}>
                BRAND & MODEL
              </Text>
              <View style={styles.selectableField}>
                <Text weight="bold" size="lg" color={brand || model ? "#000000" : "#CCCCCC"}>
                  {brand && model ? `${brand} ${model}` : brand || "Select brand"}
                </Text>
                {isEditing && <ChevronDown size={scale(16)} color="#999999" style={styles.chevron} />}
              </View>
            </Pressable>

            {/* Year */}
            <Pressable
              style={[styles.gridItem, styles.gridItemRight]}
              onPress={isEditing ? () => openPicker("year") : undefined}
            >
              <Text weight="semiBold" size="xs" color={ACCENT_COLOR} style={styles.gridLabel}>
                YEAR
              </Text>
              <View style={styles.selectableField}>
                <Text weight="bold" size="lg" color={year ? "#000000" : "#CCCCCC"}>
                  {year || "Select year"}
                </Text>
                {isEditing && <ChevronDown size={scale(16)} color="#999999" style={styles.chevron} />}
              </View>
            </Pressable>

            {/* Color */}
            <Pressable
              style={[styles.gridItem, styles.gridItemLeft, styles.gridItemBottom]}
              onPress={isEditing ? () => openPicker("color") : undefined}
            >
              <Text weight="semiBold" size="xs" color={ACCENT_COLOR} style={styles.gridLabel}>
                COLOR
              </Text>
              <View style={styles.colorDisplay}>
                {currentColor ? (
                  <>
                    <View style={[styles.colorDot, { backgroundColor: currentColor.color }]} />
                    <Text weight="bold" size="lg" color="#000000">
                      {currentColor.label}
                    </Text>
                  </>
                ) : (
                  <Text weight="bold" size="lg" color="#CCCCCC">
                    Select color
                  </Text>
                )}
                {isEditing && <ChevronDown size={scale(16)} color="#999999" style={styles.chevron} />}
              </View>
            </Pressable>

            {/* Body Style */}
            <Pressable
              style={[styles.gridItem, styles.gridItemRight, styles.gridItemBottom]}
              onPress={isEditing ? () => openPicker("bodyStyle") : undefined}
            >
              <Text weight="semiBold" size="xs" color={ACCENT_COLOR} style={styles.gridLabel}>
                BODY STYLE
              </Text>
              <View style={styles.selectableField}>
                <Text weight="bold" size="lg" color={currentBodyStyle ? "#000000" : "#CCCCCC"}>
                  {currentBodyStyle ? currentBodyStyle.label : "Select style"}
                </Text>
                {isEditing && <ChevronDown size={scale(16)} color="#999999" style={styles.chevron} />}
              </View>
            </Pressable>
          </View>
        </View>

        {/* Mileage Input */}
        <View style={styles.mileageSection}>
          <Text size="md" color="#666666" style={styles.mileageLabel}>
            Mileage
          </Text>
          <View style={styles.mileageInputContainer}>
            <TextInput
              style={styles.mileageInput}
              placeholder="e.g. 12,500"
              placeholderTextColor="#CCCCCC"
              value={mileage}
              onChangeText={setMileage}
              keyboardType="number-pad"
              inputAccessoryViewID="mileageInputAccessory"
            />
            <Text size="md" color="#999999" style={styles.mileageSuffix}>
              mi
            </Text>
          </View>
          <Text size="xs" color="#999999" style={styles.mileageHelper}>
            (estimate is okay)
          </Text>
        </View>

        {/* Keyboard Accessory for Mileage Input (iOS only) */}
        {Platform.OS === "ios" && (
          <InputAccessoryView nativeID="mileageInputAccessory">
            <View style={styles.keyboardAccessory}>
              <View style={styles.keyboardAccessorySpacer} />
              <Pressable
                onPress={() => Keyboard.dismiss()}
                style={({ pressed }) => [styles.keyboardDoneButton, pressed && styles.buttonPressed]}
              >
                <Text weight="semiBold" size="md" color={ACCENT_COLOR}>
                  Done
                </Text>
              </Pressable>
            </View>
          </InputAccessoryView>
        )}

        {/* Vehicle Details Section */}
        <View style={styles.detailsSection}>
          <Text weight="semiBold" size="xs" color="#999999" style={styles.sectionLabel}>
            VEHICLE DETAILS
          </Text>

          {/* Model (separate selection if brand is selected) */}
          {brand && (
            <>
              <Pressable style={styles.detailRow} onPress={isEditing ? () => openPicker("model") : undefined}>
                <Text size="md" color="#666666">
                  Model
                </Text>
                <View style={styles.detailValue}>
                  <Text weight="semiBold" size="md" color={model ? "#000000" : "#CCCCCC"}>
                    {model || "Select model"}
                  </Text>
                  {isEditing && <ChevronDown size={scale(16)} color="#999999" />}
                </View>
              </Pressable>
              <View style={styles.divider} />
            </>
          )}

          {/* Trim */}
          <Pressable style={styles.detailRow} onPress={isEditing ? () => openPicker("trim") : undefined}>
            <Text size="md" color="#666666">
              Trim
            </Text>
            <View style={styles.detailValue}>
              <Text weight="semiBold" size="md" color={trim ? "#000000" : "#CCCCCC"}>
                {trim || "Select trim"}
              </Text>
              {isEditing && <ChevronDown size={scale(16)} color="#999999" />}
            </View>
          </Pressable>
          <View style={styles.divider} />

          {/* Drivetrain */}
          <Pressable style={styles.detailRow} onPress={isEditing ? () => openPicker("drivetrain") : undefined}>
            <Text size="md" color="#666666">
              Drivetrain
            </Text>
            <View style={styles.detailValue}>
              <Text weight="semiBold" size="md" color={drivetrain ? "#000000" : "#CCCCCC"}>
                {drivetrain || "Select drivetrain"}
              </Text>
              {isEditing && <ChevronDown size={scale(16)} color="#999999" />}
            </View>
          </Pressable>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={handleConfirmVehicle}
          style={({ pressed }) => [styles.confirmButton, pressed && styles.confirmButtonPressed]}
        >
          <Text weight="bold" size="md" color="#FFFFFF" style={styles.confirmButtonText}>
            Confirm & Add Vehicle
          </Text>
        </Pressable>

        <Pressable
          onPress={handleToggleEdit}
          style={({ pressed }) => [styles.editButton, pressed && styles.editButtonPressed]}
        >
          <Text
            weight="semiBold"
            size="md"
            color={isEditing ? ACCENT_COLOR : "#000000"}
            style={[styles.editButtonText, isEditing && styles.editButtonTextActive]}
          >
            {isEditing ? "Done Editing" : "Edit Information"}
          </Text>
        </Pressable>
      </View>

      {/* Picker Bottom Sheet */}
      <BottomSheetModal
        ref={pickerSheetRef}
        snapPoints={snapPoints}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
        enableDynamicSizing={false}
        enableContentPanningGesture={false}
      >
        <View style={styles.sheetWrapper}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderSpacer} />
            <Text weight="semiBold" size="lg" color="#000000" style={styles.sheetTitle}>
              {getSheetTitle()}
            </Text>
            <Pressable
              onPress={() => pickerSheetRef.current?.dismiss()}
              style={({ pressed }) => [styles.sheetCloseButton, pressed && styles.buttonPressed]}
            >
              <X size={scale(24)} color="#000000" />
            </Pressable>
          </View>

          <BottomSheetFlatList
            key={sheetMode}
            data={pickerData}
            keyExtractor={keyExtractor}
            renderItem={renderPickerItem}
            ListEmptyComponent={ListEmptyComponent}
            contentContainerStyle={styles.sheetContent}
            showsVerticalScrollIndicator={true}
            style={styles.flatListContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            nestedScrollEnabled
            removeClippedSubviews={false}
            scrollEventThrottle={16}
          />
        </View>
      </BottomSheetModal>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  backButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: "center",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
  headerTitle: {
    flex: 1,
    textAlign: "left",
    marginLeft: Spacing.xs,
  },
  headerSpacer: {
    width: scale(40),
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {},
  // Image Section
  imageSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  imageContainer: {
    backgroundColor: "#F5F5F5",
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    minHeight: scale(180) + Spacing.lg * 2, // Same height as when image is present
  },
  carImage: {
    width: SCREEN_WIDTH - scale(64),
    height: scale(180),
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(245, 245, 245, 0.9)",
    borderRadius: BorderRadius.xl,
    justifyContent: "center",
    alignItems: "center",
  },
  lottieAnimation: {
    width: scale(200),
    height: scale(100),
  },
  extractedBadge: {
    position: "absolute",
    bottom: scale(12),
    right: scale(12),
    backgroundColor: "#FFFFFF",
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
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
  // Details Card
  detailsCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.xl,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    width: "50%",
    padding: Spacing.lg,
  },
  gridItemLeft: {
    borderRightWidth: 1,
    borderRightColor: "#F0F0F0",
  },
  gridItemRight: {},
  gridItemBottom: {
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  gridLabel: {
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  selectableField: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  colorDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  colorDot: {
    width: scale(20),
    height: scale(20),
    borderRadius: scale(10),
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  chevron: {
    marginLeft: scale(4),
  },
  // Details Section
  detailsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    marginBottom: Spacing.md,
    letterSpacing: 1,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  detailValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: "#F0F0F0",
  },
  // Mileage Section
  mileageSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  mileageLabel: {
    marginBottom: Spacing.sm,
  },
  mileageInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F5F5",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
  },
  mileageInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: moderateScale(16),
    color: "#000000",
    paddingVertical: Spacing.md,
  },
  mileageSuffix: {
    marginLeft: Spacing.sm,
  },
  mileageHelper: {
    marginTop: Spacing.xs,
  },
  // Keyboard Accessory
  keyboardAccessory: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    backgroundColor: "#F0F0F0",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#D0D0D0",
  },
  keyboardAccessorySpacer: {
    flex: 1,
  },
  keyboardDoneButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    backgroundColor: "#FFFFFF",
  },
  confirmButton: {
    backgroundColor: ACCENT_COLOR,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.lg,
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  confirmButtonPressed: {
    opacity: 0.9,
  },
  confirmButtonText: {
    letterSpacing: 0.5,
  },
  editButton: {
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  editButtonPressed: {
    opacity: 0.7,
  },
  editButtonText: {
    textDecorationLine: "underline",
  },
  editButtonTextActive: {
    textDecorationLine: "none",
  },
  // Bottom Sheet Styles
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
  },
  sheetWrapper: {
    flex: 1,
  },
  sheetHandle: {
    backgroundColor: "#E0E0E0",
    width: scale(40),
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sheetHeaderSpacer: {
    width: scale(40),
  },
  sheetTitle: {
    textAlign: "center",
    flex: 1,
  },
  sheetCloseButton: {
    width: scale(40),
    height: scale(40),
    justifyContent: "center",
    alignItems: "center",
  },
  sheetContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: scale(150),
  },
  flatListContainer: {
    flex: 1,
  },
  pickerItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  pickerItemPressed: {
    backgroundColor: "#F5F5F5",
  },
  pickerItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  pickerColorDot: {
    width: scale(24),
    height: scale(24),
    borderRadius: scale(12),
  },
  pickerColorDotBorder: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  pickerIconContainer: {
    width: scale(32),
    height: scale(32),
    borderRadius: BorderRadius.md,
    backgroundColor: "#F5F5F5",
    justifyContent: "center",
    alignItems: "center",
  },
  emptyState: {
    paddingVertical: Spacing.xl,
    alignItems: "center",
  },
});
