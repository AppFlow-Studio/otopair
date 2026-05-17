/**
 * AddVehicleReviewScreen
 *
 * PURPOSE: Shows decoded vehicle info and lets the user confirm + add the vehicle.
 *
 * USED IN: Navigated from add-vehicle.tsx or vin-scanner.tsx after VIN decode.
 */

// 1. React & React Native
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

// 2. Expo & Third-party
import { StatusBar } from 'expo-status-bar';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bell, Car, History, MapPin, Plus, Wrench } from 'lucide-react-native';
import { useAction, useQuery } from 'convex/react';

// 3. App imports
import { Text } from '@/components/shared-ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { scale, verticalScale, moderateScale } from '@/utils/responsive';

// ============================================================================
// COMPONENT
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

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
  }>();

  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState('');

  const confirmVehicle = useAction(api.vehicle_pipeline.confirmVehicleForUser);

  const CAR_COLORS = [
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
          <View style={[styles.vehicleIconContainer, { backgroundColor: carCircleBg }]}>
            <Car size={scale(32)} color="#5299FE" strokeWidth={1.5} />
          </View>
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

        {/* Color Picker */}
        <View style={styles.colorSection}>
          <Text weight="semiBold" size="sm" color="#333333" style={styles.colorLabel}>
            What color is your {params.make}?
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.colorRow}
          >
            {CAR_COLORS.map((c) => (
              <Pressable
                key={c.id}
                onPress={() => setSelectedColor(c.id)}
                style={[
                  styles.colorSwatch,
                  { backgroundColor: c.hex },
                  c.id === 'white' && styles.colorSwatchWhite,
                  selectedColor === c.id && styles.colorSwatchSelected,
                ]}
              />
            ))}
          </ScrollView>
          {/* Always rendered with a non-breaking-space fallback so the
              layout below doesn't shift when a color is picked. */}
          <Text size="xs" color="#888888" style={styles.colorName}>
            {selectedSwatch?.label ?? ' '}
          </Text>
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
  colorSection: {
    marginTop: scale(20),
    marginHorizontal: Spacing.lg,
    alignItems: 'center',
  },
  colorLabel: {
    marginBottom: scale(12),
  },
  colorRow: {
    gap: scale(10),
    paddingHorizontal: scale(4),
  },
  colorSwatch: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
  },
  colorSwatchWhite: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: '#5299FE',
  },
  colorName: {
    marginTop: scale(8),
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
