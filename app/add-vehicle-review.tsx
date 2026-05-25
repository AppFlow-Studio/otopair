/**
 * AddVehicleReviewScreen
 *
 * PURPOSE: Shows decoded vehicle info and lets the user confirm + add the vehicle.
 *
 * USED IN: Navigated from add-vehicle.tsx or vin-scanner.tsx after VIN decode.
 */

// 1. React & React Native
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Image as ExpoImage } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// 2. Expo & Third-party
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bell, Car, CircleDot, Cog, Fuel, Gauge, History, MapPin, Plus, Wrench } from 'lucide-react-native';
import { useAction, useMutation, useQuery } from 'convex/react';

// 3. App imports
import { Text } from '@/components/shared-ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { scale, verticalScale, moderateScale } from '@/utils/responsive';
import { useVdbColorsForVin } from '@/utils/vehicleImage';
import { ColorSwatchSkeletonRow } from '@/components/shared-ui/ColorSwatchSkeleton';

// ============================================================================
// COMPONENT
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// One swatch in the color picker — owns its own scale animation so the
// parent doesn't need to manage N shared values. Springs to 1.08 on
// select, back to 1.0 on deselect.
function ColorSwatchItem({
  color,
  isSelected,
  onPress,
}: {
  color: { id: string; label: string; hex: string };
  isSelected: boolean;
  onPress: () => void;
}) {
  const scaleSv = useSharedValue(1);
  useEffect(() => {
    scaleSv.value = withSpring(isSelected ? 1.08 : 1, {
      damping: 15,
      stiffness: 180,
    });
  }, [isSelected, scaleSv]);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleSv.value }],
  }));

  const isWhite = color.hex.toUpperCase() === '#FFFFFF';

  return (
    <Pressable onPress={onPress} style={styles.swatchPress} hitSlop={6}>
      <Animated.View
        style={[
          styles.swatchRingWrapper,
          isSelected && styles.swatchRingActive,
          animatedStyle,
        ]}
      >
        <View
          style={[
            styles.swatchCircle,
            { backgroundColor: color.hex },
            isWhite && styles.swatchCircleWhite,
          ]}
        />
      </Animated.View>
      <Text
        size="xs"
        color={isSelected ? '#1F2937' : '#6B7280'}
        center
        numberOfLines={2}
        style={styles.swatchLabel}
      >
        {color.label}
      </Text>
    </Pressable>
  );
}

export default function AddVehicleReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    vin: string;
    make: string;
    model: string;
    year: string;
    trim: string;
    trimId: string;
    engineId: string;
    engineCode: string;
    displacement: string;
    cylinders: string;
    fuelType: string;
    /** NHTSA's raw Model field — often the specific designation
     *  (e.g. "530i") that VDB's catalog uses, even when our merged
     *  `model` has been overwritten to a family name. Highest-
     *  priority discovery candidate. */
    nhtsaModel?: string;
    /** NHTSA's raw Series field (e.g. "5-Series"). */
    nhtsaSeries?: string;
    /** NHTSA's raw Trim field. */
    nhtsaTrim?: string;
    /** VDB advanced-vin-decode fields — used to build the
     *  YMMT combo matrix for `vehicle-images` direct probes when
     *  the VIN URL has no record. */
    vdbDecodedModel?: string;
    vdbDecodedStyle?: string;
    vdbDecodedTrimAndStyle?: string;
    // Specs-card fields. All serialized as strings; empty = unknown.
    horsepower?: string;
    engineDisplacementLiters?: string;
    cylindersConfiguration?: string;
    mpgCity?: string;
    mpgHighway?: string;
    mpgCombined?: string;
    frontTireSize?: string;
    rearTireSize?: string;
    frontTirePressure?: string;
    rearTirePressure?: string;
    transType?: string;
    transSpeeds?: string;
    drivetrain?: string;
  }>();

  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');

  const confirmVehicle = useAction(api.vehicle_pipeline.confirmVehicleForUser);
  const saveVehicleImageUrl = useMutation(api.vehicles.saveVehicleImageUrl);

  // VDB's paint variants for this VIN. Falls back to a generic
  // palette only if VDB has no record / no recognizable paint names —
  // otherwise the user picks from colors VDB actually has for the car.
  type ColorOption = { id: string; label: string; hex: string };
  const FALLBACK_COLORS: ColorOption[] = [
    { id: 'black', label: 'Black', hex: '#1a1a1a' },
    { id: 'midnight-silver', label: 'Midnight Silver', hex: '#4A4A4A' },
    { id: 'silver', label: 'Silver', hex: '#C0C0C0' },
    { id: 'white', label: 'White', hex: '#FFFFFF' },
    { id: 'gray', label: 'Gray', hex: '#808080' },
    { id: 'red', label: 'Red', hex: '#DC2626' },
    { id: 'blue', label: 'Blue', hex: '#2563EB' },
    { id: 'green', label: 'Green', hex: '#16A34A' },
    { id: 'beige', label: 'Beige', hex: '#D4B896' },
    { id: 'brown', label: 'Brown', hex: '#8B4513' },
  ];
  const yearNum = params.year ? parseInt(params.year, 10) : undefined;
  const { colors: vdbColors, isLoading: vdbLoading, hasVdbData } = useVdbColorsForVin({
    vin: params.vin,
    year: yearNum,
    make: params.make,
    model: params.model,
    trim: params.trim,
    // NHTSA's raw model/series/trim from the decode — drives VDB
    // model discovery when the catalog uses a different model string
    // than our merged result (e.g. merged "5 Series" vs NHTSA's
    // "530i" which matches VDB's "530" catalog after token-strip).
    nhtsaModel: params.nhtsaModel,
    nhtsaSeries: params.nhtsaSeries,
    nhtsaTrim: params.nhtsaTrim,
    // VDB advanced-vin-decode fields — used to build a (model, trim)
    // combo matrix when the VIN URL has no record but the catalog
    // does. For BMW: VDB decode returns model="530i", catalog
    // expects model="530" + trim="i-xDrive Sedan ...".
    vdbDecodedModel: params.vdbDecodedModel,
    vdbDecodedStyle: params.vdbDecodedStyle,
    vdbDecodedTrimAndStyle: params.vdbDecodedTrimAndStyle,
  });
  // FALLBACK_COLORS is reached ONLY after the network finishes with no
  // usable VDB record. While `vdbLoading` is true, the JSX renders a
  // skeleton instead — the generic palette never flashes in front of
  // the user during the in-flight window.
  const CAR_COLORS: ColorOption[] = hasVdbData
    ? vdbColors.map((c) => ({ id: c.id, label: c.label, hex: c.hex }))
    : FALLBACK_COLORS;

  // Drives the live car-image preview in the vehicle card. Priority:
  //  1. Picked color's image (instant swap on tap)
  //  2. Black variant if VDB has one (`#1A1A1A` = FAMILY_HEX.black)
  //  3. First VDB variant
  //  4. null → fall back to the lucide Car icon (loading / vdb-empty)
  const previewImageUrl: string | null =
    (selectedColor &&
      vdbColors.find((c) => c.id === selectedColor)?.imageUrl) ||
    vdbColors.find((c) => c.hex.toUpperCase() === '#1A1A1A')?.imageUrl ||
    vdbColors[0]?.imageUrl ||
    null;

  const me = useQuery(api.users.getMe);

  const handleBack = () => {
    router.back();
  };

  const handleAddVehicle = async () => {
    if (!params.vin || !params.trimId || !params.engineId) {
      setError('Missing vehicle data');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      const result = await confirmVehicle({
        vin: params.vin,
        trimId: params.trimId as Id<'trims'>,
        engineId: params.engineId as Id<'engines'>,
        year: parseFloat(params.year || '0'),
        make: params.make || '',
        model: params.model || '',
        trim: params.trim || 'Base',
        engineCode: params.engineCode || '',
        displacement: params.displacement || '',
        cylinders: parseFloat(params.cylinders || '0'),
        fuelType: params.fuelType || 'Gasoline',
        color: selectedColor || undefined,
      });

      if (result.success) {
        // When the user picked from the VDB palette, persist the exact
        // image URL straight from the picker option. This bypasses the
        // cars-page `findColorImage()` keyword round-trip (which has
        // been observed to mis-match for some marketing paint names,
        // e.g. a gray VW Tiguan pick rendering as a neutral white EVOX).
        // Fire-and-forget — the cars page falls back to its own fetch
        // if this hasn't landed by the time the user gets there.
        const pickedVdbColor = vdbColors.find((c) => c.id === selectedColor);
        if (pickedVdbColor && params.vin) {
          saveVehicleImageUrl({
            vin: params.vin,
            image_url: pickedVdbColor.imageUrl,
          }).catch(() => {
            // Non-fatal: cars page useEffect will retry.
          });
        }
        router.replace({
          pathname: '/vehicle-added',
          params: {
            flow: 'manual',
            vehicleOwnerId: String(result.vehicleOwnerId),
          },
        });
      } else {
        setError(result.error || 'Failed to add vehicle');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add vehicle');
    } finally {
      setIsConfirming(false);
    }
  };

  const displayError = error;
  const isLoading = isConfirming;

  // Soft-tint the vehicle-icon circle to match the picked paint
  // color so the color picker feels connected to the card. White
  // (and the no-selection case) falls back to the default light
  // blue — appending alpha to #FFFFFF would be invisible.
  const selectedSwatch = CAR_COLORS.find((c) => c.id === selectedColor);
  const carCircleBg =
    selectedSwatch && selectedColor !== 'white'
      ? `${selectedSwatch.hex}33` // ~20% alpha
      : '#EEF4FF';

  // Feature preview shown below the color picker so the page has
  // substance instead of empty space after Smartcar's "Connect your
  // car" section was removed.
  const FEATURES = [
    { icon: Wrench, label: 'Track maintenance & service intervals' },
    { icon: History, label: 'Log every service in one place' },
    { icon: Bell, label: 'Get reminders before things go wrong' },
    { icon: MapPin, label: 'Book trusted local mechanics' },
  ] as const;

  // Specs card data. Build display strings from router params; empty
  // string from the parent means "unknown" → render as em-dash.
  const DASH = '—';
  const parseOptionalNum = (s: string | undefined): number | null => {
    if (!s) return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };

  const hp = parseOptionalNum(params.horsepower);
  const litersFromSpecs = parseOptionalNum(params.engineDisplacementLiters);
  // Fall back to the existing `displacement` param (1.x form, also
  // liters) when the new specs-specific field is blank — keeps older
  // decode paths working.
  const liters = litersFromSpecs ?? parseOptionalNum(params.displacement);
  const cylConfig = params.cylindersConfiguration || '';
  const transType = params.transType || '';
  const transSpeeds = parseOptionalNum(params.transSpeeds);
  const drivetrain = (params.drivetrain && params.drivetrain !== 'unknown')
    ? params.drivetrain
    : '';
  const mpgCity = parseOptionalNum(params.mpgCity);
  const mpgHighway = parseOptionalNum(params.mpgHighway);
  const mpgCombined = parseOptionalNum(params.mpgCombined);
  const frontTireSize = params.frontTireSize || '';
  const rearTireSize = params.rearTireSize || '';
  const frontPsi = parseOptionalNum(params.frontTirePressure);
  const rearPsi = parseOptionalNum(params.rearTirePressure);

  // Engine tile: "2.0L I-4" primary, "272 hp" secondary.
  const engineLine1 =
    liters || cylConfig
      ? `${liters ? `${liters}L` : ''}${liters && cylConfig ? ' ' : ''}${cylConfig}`.trim()
      : DASH;
  const engineLine2 = hp ? `${hp} hp` : DASH;

  // Transmission tile: "Automatic 8sp" primary, "AWD" secondary.
  const transLine1 =
    transType || transSpeeds
      ? `${transType}${transType && transSpeeds ? ' ' : ''}${transSpeeds ? `${transSpeeds}sp` : ''}`.trim()
      : DASH;
  const transLine2 = drivetrain || DASH;

  // MPG tile: "City 22 / Hwy 31" primary, "Combined 25" secondary.
  const mpgLine1 =
    mpgCity || mpgHighway
      ? `${mpgCity ?? DASH} / ${mpgHighway ?? DASH}`
      : DASH;
  const mpgLine2 = mpgCombined ? `Combined ${mpgCombined}` : DASH;

  // Tires tile: front tire size primary, "F33 R33 psi" secondary.
  // If front/rear match, show one. Otherwise show separately.
  const tireSizeLine =
    frontTireSize && rearTireSize && frontTireSize !== rearTireSize
      ? `${frontTireSize} / ${rearTireSize}`
      : (frontTireSize || rearTireSize || DASH);
  const tirePsiLine =
    frontPsi || rearPsi
      ? `F ${frontPsi ?? DASH} · R ${rearPsi ?? DASH} psi`
      : DASH;

  const specsTiles = [
    { icon: Gauge, label: 'Engine', line1: engineLine1, line2: engineLine2 },
    { icon: Cog, label: 'Transmission', line1: transLine1, line2: transLine2 },
    { icon: Fuel, label: 'MPG', line1: mpgLine1, line2: mpgLine2 },
    { icon: CircleDot, label: 'Tires', line1: tireSizeLine, line2: tirePsiLine },
  ];

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent />

      {/* Back Button — stays an overlay so the scroll view extends edge to edge */}
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [
          styles.backButton,
          { top: insets.top + scale(12) },
          pressed && styles.backButtonPressed,
        ]}
        hitSlop={12}
      >
        <ArrowLeft size={scale(24)} color="#000000" strokeWidth={2} />
      </Pressable>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + scale(36), paddingBottom: insets.bottom + scale(20) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Title */}
        <View style={styles.titleContainer}>
          <Text weight="bold" size="2xl" color="#333333" style={styles.title}>
            VEHICLE DETECTED
          </Text>
          <Text size="sm" color="#666666" style={styles.subtitle}>
            We found your vehicle from the VIN
          </Text>
        </View>

        {/* Vehicle Card */}
        <View style={styles.vehicleCard}>
          {/* Live VDB car-image preview — swaps in real time as the user
              taps a swatch below. Defaults to the black variant before
              any pick, falls back to the lucide Car icon while VDB is
              loading or returned nothing usable. */}
          {previewImageUrl ? (
            <ExpoImage
              source={{ uri: previewImageUrl }}
              style={styles.vehiclePreviewImage}
              contentFit="contain"
              transition={180}
              cachePolicy="memory-disk"
            />
          ) : (
            <View style={[styles.vehicleIconContainer, { backgroundColor: carCircleBg }]}>
              <Car size={scale(32)} color="#5299FE" strokeWidth={1.5} />
            </View>
          )}
          <Text weight="bold" size="xl" color="#333333" style={styles.vehicleYear}>
            {params.year}
          </Text>
          <Text weight="semiBold" size="lg" color="#333333" style={styles.vehicleName}>
            {params.make} {params.model}
          </Text>
          <Text size="sm" color="#888888" style={styles.vehicleTrim}>
            {params.trim || 'Base'} {params.displacement ? `${params.displacement}L` : ''} {params.fuelType}
          </Text>
          <View style={styles.vinBadge}>
            <Text weight="medium" size="xs" color="#FFFFFF" style={styles.vinText}>
              {params.vin}
            </Text>
          </View>
        </View>

        {/* Color Picker — wrapped in a white card matching `vehicleCard`'s
            shadow so the section reads as a peer of the vehicle summary
            above. Bigger swatches with marketing-name labels; selected
            swatch springs and gets a blue ring. */}
        <View style={styles.colorCard}>
          <View style={styles.colorHeaderRow}>
            <Text weight="semiBold" size="md" color="#1F2937">
              Choose your {params.make}'s color
            </Text>
            <Text size="xs" color="#9CA3AF" numberOfLines={1} style={styles.colorHeaderRight}>
              {selectedSwatch
                ? selectedSwatch.label
                : `${CAR_COLORS.length} colors`}
            </Text>
          </View>
          {vdbLoading ? (
            <ColorSwatchSkeletonRow count={6} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.colorRow}
            >
              {CAR_COLORS.map((c) => (
                <ColorSwatchItem
                  key={c.id}
                  color={c}
                  isSelected={selectedColor === c.id}
                  onPress={() => setSelectedColor(c.id)}
                />
              ))}
            </ScrollView>
          )}
        </View>

        {/* Specs card — 2×2 grid of stat tiles, sourced from VDB's
            advanced-vin-decode response. Missing fields render as
            em-dash so the layout stays stable for sparse decodes. */}
        <View style={styles.specsCard}>
          <Text weight="semiBold" size="md" color="#1F2937" style={styles.specsHeader}>
            Specs
          </Text>
          <View style={styles.specsGrid}>
            {specsTiles.map(({ icon: Icon, label, line1, line2 }) => (
              <View key={label} style={styles.specsTile}>
                <View style={styles.specsTileHeader}>
                  <Icon size={scale(16)} color="#5299FE" strokeWidth={2} />
                  <Text size="xs" color="#6B7280" weight="medium">
                    {label}
                  </Text>
                </View>
                <Text
                  size="md"
                  weight="semiBold"
                  color="#111827"
                  numberOfLines={1}
                  style={styles.specsTileLine1}
                >
                  {line1}
                </Text>
                <Text
                  size="xs"
                  color="#6B7280"
                  numberOfLines={1}
                >
                  {line2}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Feature preview */}
        <View style={styles.featureList}>
          {FEATURES.map(({ icon: Icon, label }) => (
            <View key={label} style={styles.featureRow}>
              <View style={styles.featureIcon}>
                <Icon size={scale(18)} color="#5299FE" strokeWidth={2} />
              </View>
              <Text size="sm" color="#3D4654" style={styles.featureLabel}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Error */}
        {displayError ? (
          <View style={styles.errorContainer}>
            <Text size="sm" color="#FF4444" style={styles.errorText}>
              {displayError}
            </Text>
          </View>
        ) : null}

        {/* Add Vehicle — flows below feature list, pushed to bottom by flexGrow */}
        <View style={styles.bottomContainer}>
          <Pressable
            onPress={handleAddVehicle}
            disabled={isLoading}
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.buttonPressed,
              isLoading && styles.buttonDisabled,
            ]}
          >
            {isConfirming ? (
              <ActivityIndicator size="small" color="#5299FE" />
            ) : (
              <>
                <Plus size={scale(20)} color="#5299FE" strokeWidth={2} />
                <Text weight="bold" size="md" color="#5299FE">
                  Add Vehicle
                </Text>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  scrollContent: {
    flexGrow: 1,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.md,
    zIndex: 20,
    width: SCREEN_WIDTH * 0.1,
    height: SCREEN_WIDTH * 0.1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  titleContainer: {
    paddingHorizontal: Spacing.lg,
    marginBottom: scale(20),
  },
  title: {
    textAlign: 'center',
    marginBottom: scale(4),
    letterSpacing: 1,
  },
  subtitle: {
    textAlign: 'center',
  },
  vehicleCard: {
    marginHorizontal: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    paddingVertical: scale(28),
    paddingHorizontal: scale(24),
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  vehicleIconContainer: {
    width: scale(64),
    height: scale(64),
    borderRadius: scale(32),
    backgroundColor: '#EEF4FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: scale(16),
  },
  vehiclePreviewImage: {
    // Wider landscape area replaces the round icon when a VDB image
    // is available. contentFit="contain" preserves aspect ratio so
    // letterboxing is invisible against the white card.
    width: scale(220),
    height: scale(130),
    marginBottom: scale(8),
  },
  vehicleYear: {
    marginBottom: scale(2),
  },
  vehicleName: {
    marginBottom: scale(4),
  },
  vehicleTrim: {
    marginBottom: scale(16),
  },
  vinBadge: {
    backgroundColor: '#1a1a1a',
    paddingHorizontal: scale(16),
    paddingVertical: scale(6),
    borderRadius: moderateScale(6),
  },
  vinText: {
    letterSpacing: 1,
  },
  colorCard: {
    marginTop: scale(20),
    marginHorizontal: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(18),
    paddingVertical: scale(16),
    paddingLeft: scale(16),
    paddingRight: scale(8),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  colorHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(14),
    paddingRight: scale(8),
    gap: scale(8),
  },
  colorHeaderRight: {
    maxWidth: scale(140),
    textAlign: 'right',
  },
  colorRow: {
    gap: scale(14),
    paddingVertical: scale(4),
    paddingRight: scale(8),
  },
  swatchPress: {
    width: scale(64),
    alignItems: 'center',
  },
  // Always-present wrapper reserves space for the ring so the layout
  // doesn't shift when a swatch is selected. Border color is
  // transparent by default, switches to brand blue when active.
  swatchRingWrapper: {
    width: scale(60),
    height: scale(60),
    borderRadius: scale(30),
    borderWidth: 2,
    borderColor: 'transparent',
    padding: scale(4),
    alignItems: 'center',
    justifyContent: 'center',
  },
  swatchRingActive: {
    borderColor: '#5299FE',
  },
  swatchCircle: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
  },
  // White swatches need a faint border so they don't disappear into
  // the white card background.
  swatchCircleWhite: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#D1D5DB',
  },
  swatchLabel: {
    marginTop: scale(6),
    fontSize: scale(11),
    lineHeight: scale(14),
  },
  // Specs card — same white-card + shadow treatment as `colorCard`
  // and `vehicleCard` so the three read as a vertical stack.
  specsCard: {
    marginTop: scale(20),
    marginHorizontal: Spacing.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(18),
    paddingVertical: scale(16),
    paddingHorizontal: scale(16),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  specsHeader: {
    marginBottom: scale(14),
  },
  // 2×2 grid via flex-wrap. Each tile claims ~48% width so they sit
  // side-by-side with a small gap. On phones < 380pt wide the wrap
  // naturally falls back to single-column when content needs more
  // room — no separate breakpoint logic required.
  specsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: scale(10),
  },
  specsTile: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    paddingVertical: scale(10),
    paddingHorizontal: scale(12),
    gap: scale(2),
  },
  specsTileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    marginBottom: scale(4),
  },
  specsTileLine1: {
    marginTop: scale(2),
  },
  connectSection: {
    marginTop: scale(28),
    marginHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  connectTitle: {
    marginBottom: scale(8),
    textAlign: 'center',
  },
  connectDescription: {
    textAlign: 'center',
    lineHeight: moderateScale(20),
  },
  errorContainer: {
    marginTop: scale(16),
    marginHorizontal: Spacing.lg,
    backgroundColor: '#FFF0F0',
    borderRadius: moderateScale(12),
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
  },
  errorText: {
    textAlign: 'center',
  },
  featureList: {
    marginTop: scale(24),
    marginHorizontal: Spacing.lg,
    gap: scale(14),
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
  },
  featureIcon: {
    width: scale(32),
    height: scale(32),
    borderRadius: scale(16),
    backgroundColor: '#EEF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    flex: 1,
  },
  bottomContainer: {
    marginTop: 'auto',
    paddingTop: scale(24),
    paddingHorizontal: Spacing.lg,
    gap: scale(12),
  },
  connectButton: {
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    shadowColor: 'rgba(82,153,254,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  connectButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(16),
    paddingHorizontal: scale(32),
  },
  addButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(24),
    paddingVertical: scale(16),
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: scale(8),
    borderWidth: 1.5,
    borderColor: '#5299FE',
  },
  buttonText: {
    letterSpacing: 0.5,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
