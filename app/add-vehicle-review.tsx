/**
 * AddVehicleReviewScreen
 *
 * PURPOSE: Shows decoded vehicle info and offers Smartcar connect or direct add.
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
import { ArrowLeft, Car, Link2, Plus } from 'lucide-react-native';
import { useAction, useQuery } from 'convex/react';

// 3. App imports
import { Text } from '@/components/shared-ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { Id } from '@/convex/_generated/dataModel';
import { useSmartcar } from '@/hooks/useSmartCar';
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
  const { connect, isConnecting, error: smartcarError } = useSmartcar();

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

  const handleConnectCar = async () => {
    if (!me?._id) {
      setError('Please sign in to continue');
      return;
    }
    if (!params.vin) {
      setError('Missing VIN data');
      return;
    }

    setError(null);

    try {
      // Pass VIN for deterministic matching — backend will only link
      // the Smartcar vehicle whose VIN matches this one.
      const result = await connect(me._id, params.vin);

      if (result?.success) {
        router.replace('/vehicle-added');
      } else if (result?.error && result.error !== 'Cancelled') {
        setError(result.error || 'Connection failed. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed. Please try again.');
    }
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

  const displayError = error || smartcarError;
  const isLoading = isConfirming || isConnecting;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent />

      {/* Back Button */}
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

      {/* Title */}
      <View style={[styles.titleContainer, { top: insets.top + scale(60) }]}>
        <Text weight="bold" size="2xl" color="#333333" style={styles.title}>
          VEHICLE DETECTED
        </Text>
        <Text size="sm" color="#666666" style={styles.subtitle}>
          We found your vehicle from the VIN
        </Text>
      </View>

      {/* Vehicle Card */}
      <View style={styles.vehicleCard}>
        <View style={styles.vehicleIconContainer}>
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
        {selectedColor ? (
          <Text size="xs" color="#888888" style={styles.colorName}>
            {CAR_COLORS.find((c) => c.id === selectedColor)?.label}
          </Text>
        ) : null}
      </View>

      {/* Smartcar Section */}
      <View style={styles.connectSection}>
        <Text weight="semiBold" size="md" color="#333333" style={styles.connectTitle}>
          Connect your {params.make} app?
        </Text>
        <Text size="sm" color="#888888" style={styles.connectDescription}>
          Get real-time mileage, tire pressure, oil life, and more directly from your car.
        </Text>
      </View>

      {/* Error */}
      {displayError ? (
        <View style={styles.errorContainer}>
          <Text size="sm" color="#FF4444" style={styles.errorText}>
            {displayError}
          </Text>
        </View>
      ) : null}

      {/* Bottom Buttons */}
      <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + scale(20) }]}>
        {/* Connect My Car */}
        <Pressable
          onPress={handleConnectCar}
          disabled={isLoading}
          style={({ pressed }) => [
            styles.connectButton,
            pressed && styles.buttonPressed,
            isLoading && styles.buttonDisabled,
          ]}
        >
          <LinearGradient
            colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.connectButtonGradient}
          >
            {isConnecting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Link2 size={scale(20)} color="#FFFFFF" strokeWidth={2} />
                <Text weight="bold" size="md" color="#FFFFFF">
                  Connect My Car
                </Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* Add Vehicle (skip Smartcar) */}
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
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
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
    marginTop: verticalScale(200),
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
  bottomContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
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
