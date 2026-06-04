/**
 * AddVehicleScreen
 *
 * PURPOSE: Screen for adding a vehicle with background image
 *
 * USED IN: Navigated from AddFirstVehicleCard component
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useState } from 'react';
import { ActivityIndicator, Dimensions, Pressable, StyleSheet, View, TextInput, Keyboard } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ArrowLeft, QrCode, Edit3 } from 'lucide-react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
} from 'react-native-reanimated';
import { KeyboardStickyView, useReanimatedKeyboardAnimation } from 'react-native-keyboard-controller';
import { useAction } from 'convex/react';

// 3. App imports
import { Text } from '@/components/shared-ui';
import { Spacing } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { scale, moderateScale } from '@/utils/responsive';

// ============================================================================
// COMPONENT
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate keyboard offset multiplier based on screen height
// iPhone 14 Pro Max (~932 points) works well with 0.65
// iPhone 17 Pro (smaller screen ~852 points) needs more movement to avoid blocking VIN badge
const getKeyboardOffsetMultiplier = () => {
  if (SCREEN_HEIGHT >= 900) return 0.65; // iPhone 14 Pro Max
  return 0.75; // iPhone 17 Pro - move car content up more
};

export default function AddVehicleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [vinNumber, setVinNumber] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);
  const { progress: keyboardProgress } = useReanimatedKeyboardAnimation();

  const decodeVin = useAction(api.vehicle_pipeline.decodeVin);

  const handleBack = () => {
    router.back();
  };

  const handleVinSubmit = async () => {
    const vin = vinNumber.trim().toUpperCase();
    if (vin.length !== 17) {
      setDecodeError('VIN must be exactly 17 characters');
      return;
    }

    setIsDecoding(true);
    setDecodeError(null);
    Keyboard.dismiss();

    try {
      const result = await decodeVin({ vin });

      if (result.success) {
        router.push({
          pathname: '/add-vehicle-review',
          params: {
            vin: result.vin,
            make: result.make,
            model: result.model,
            year: String(result.year),
            trim: result.trim,
            trimId: result.trimId,
            engineId: result.engineId,
            engineCode: result.engineCode,
            displacement: result.displacement,
            cylinders: String(result.cylinders),
            fuelType: result.fuelType,
            nhtsaModel: result.nhtsaModel ?? "",
            nhtsaSeries: result.nhtsaSeries ?? "",
            nhtsaTrim: result.nhtsaTrim ?? "",
            vdbDecodedModel: result.vdbDecodedModel ?? "",
            vdbDecodedStyle: result.vdbDecodedStyle ?? "",
            vdbDecodedTrimAndStyle: result.vdbDecodedTrimAndStyle ?? "",
            // Specs-card fields. Router params are strings, so we
            // serialize numbers/nulls into empty string when absent
            // and the review screen parses them back.
            horsepower: result.horsepower != null ? String(result.horsepower) : "",
            engineDisplacementLiters: result.engineDisplacementLiters != null ? String(result.engineDisplacementLiters) : "",
            cylindersConfiguration: result.cylindersConfiguration ?? "",
            mpgCity: result.mpgCity != null ? String(result.mpgCity) : "",
            mpgHighway: result.mpgHighway != null ? String(result.mpgHighway) : "",
            mpgCombined: result.mpgCombined != null ? String(result.mpgCombined) : "",
            frontTireSize: result.frontTireSize ?? "",
            rearTireSize: result.rearTireSize ?? "",
            frontTirePressure: result.frontTirePressure != null ? String(result.frontTirePressure) : "",
            rearTirePressure: result.rearTirePressure != null ? String(result.rearTirePressure) : "",
            transType: result.transType ?? "",
            transSpeeds: result.transSpeeds != null ? String(result.transSpeeds) : "",
            drivetrain: result.drivetrain ?? "",
            bodyClass: result.bodyClass ?? "",
          },
        });
      } else {
        setDecodeError(result.error || 'Could not decode VIN');
      }
    } catch (err) {
      setDecodeError(err instanceof Error ? err.message : 'Failed to decode VIN');
    } finally {
      setIsDecoding(false);
    }
  };

  const handleScanVin = () => {
    router.push('/vin-scanner');
  };

  const handleManualEntry = () => {
    router.push({
      pathname: '/add-car-info',
      params: { manual: 'true' },
    });
  };

  const keyboardOffsetMultiplier = getKeyboardOffsetMultiplier();

  // Pre-compute scaled values here on the JS thread — scale() is not a worklet
  // function and cannot be called inside useAnimatedStyle callbacks.
  const doorTranslateX = scale(15);
  const windshieldTranslateX = scale(-10);
  const bottomPadding = scale(20);
  const bottomPaddingWithInset = insets.bottom + scale(20);

  const artworkTranslateY = useDerivedValue(() =>
    interpolate(
      keyboardProgress.value,
      [0, 1],
      [0, -400 * keyboardOffsetMultiplier],
      Extrapolation.CLAMP
    )
  );

  const movingArtworkStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: artworkTranslateY.value }],
  }));

  const doorConnectorStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: '1deg' },
      { translateX: doorTranslateX },
      { translateY: artworkTranslateY.value },
    ],
  }));

  const windshieldConnectorStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: '1deg' },
      { translateX: windshieldTranslateX },
      { translateY: artworkTranslateY.value },
    ],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(keyboardProgress.value, [0, 0.15, 0.25], [1, 0.2, 0], Extrapolation.CLAMP),
    transform: [
      {
        translateY: interpolate(keyboardProgress.value, [0, 1], [0, -24], Extrapolation.CLAMP),
      },
    ],
  }));

  const bottomButtonsStyle = useAnimatedStyle(() => ({
    paddingBottom: interpolate(
      keyboardProgress.value,
      [0, 1],
      [bottomPaddingWithInset, bottomPadding],
      Extrapolation.CLAMP
    ),
  }));

  // Positioning for dots and lines (relative to screen)
  const windshieldDotLeft = SCREEN_WIDTH * 0.32;
  const doorDotLeft = SCREEN_WIDTH * 0.59;
  const windshieldDotTop = SCREEN_HEIGHT * 0.51;
  const doorDotTop = SCREEN_HEIGHT * 0.525;
  const vinBadgeTop = SCREEN_HEIGHT * 0.60;
  const imageTop = SCREEN_HEIGHT * 0.08;

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent />
      
      {/* Full Screen Car Image */}
      <Animated.Image
        source={require('@/assets/images/add-your-vehicle-v2.jpg')}
        style={[styles.fullScreenImage, { top: imageTop }, movingArtworkStyle]}
        resizeMode="cover"
      />

      {/* Back Button */}
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [
          styles.backButton,
          { top: insets.top + scale(12) },
          pressed && styles.backButtonPressed,
        ]}
        hitSlop={scale(12)}
      >
        <ArrowLeft size={scale(24)} color="#000000" strokeWidth={2} />
      </Pressable>

      {/* Title - Overlaid on image (hidden when keyboard is up) */}
      <Animated.View style={[styles.titleContainer, { top: insets.top + scale(40) }, titleAnimatedStyle]}>
        <Text weight="bold" size="2xl" color="#333333" style={styles.title}>
          ADD YOUR VEHICLE
        </Text>
        <Text size="sm" color="#666666" style={styles.description}>
          Scan or enter your VIN to add your vehicle. You can find your 17-digit Vehicle Identification Number (VIN) on your driver side door panel or on the windshield.
        </Text>
      </Animated.View>

      {/* Red Dot - Door Panel */}
      <Animated.View style={[styles.redDot, { top: doorDotTop, left: doorDotLeft }, movingArtworkStyle]}>
        <View style={styles.redDotInner} />
      </Animated.View>

      {/* Red Dot - Windshield */}
      <Animated.View style={[styles.redDot, { top: windshieldDotTop, left: windshieldDotLeft }, movingArtworkStyle]}>
        <View style={styles.redDotInner} />
      </Animated.View>

      {/* Line from Door Dot to VIN Badge */}
      <Animated.View style={[
        styles.connectorLine,
        {
          top: doorDotTop + scale(12),
          left: doorDotLeft - scale(6),
          height: vinBadgeTop - doorDotTop - scale(10),
        },
        doorConnectorStyle,
      ]} />

      {/* Line from Windshield Dot to VIN Badge */}
      <Animated.View style={[
        styles.connectorLine,
        {
          top: windshieldDotTop + scale(12),
          left: windshieldDotLeft + scale(18.5),
          height: vinBadgeTop - windshieldDotTop - scale(5),
        },
        windshieldConnectorStyle,
      ]} />

      {/* VIN Badge */}
      <Animated.View style={[styles.vinBadge, { top: vinBadgeTop }, movingArtworkStyle]}>
        <Text weight="semiBold" size="sm" color="#FFFFFF" style={styles.vinBadgeText}>
          1FDXV92H6KCB23213
        </Text>
      </Animated.View>

      {/* Bottom Buttons */}
      <KeyboardStickyView style={styles.bottomButtonsWrapper}>
        <Animated.View style={[styles.bottomButtonsContainer, bottomButtonsStyle]}>
          {/* Error Message */}
          {decodeError ? (
            <View style={styles.errorBanner}>
              <Text size="sm" color="#FF4444" style={styles.errorText}>
                {decodeError}
              </Text>
            </View>
          ) : null}

          {/* VIN Input Field */}
          <TextInput
            style={styles.vinInput}
            placeholder="Enter VIN"
            placeholderTextColor="#999999"
            value={vinNumber}
            onChangeText={(text) => {
              setVinNumber(text);
              if (decodeError) setDecodeError(null);
            }}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={17}
            returnKeyType="done"
            onSubmitEditing={handleVinSubmit}
            editable={!isDecoding}
          />

          {/* Decode / Scan VIN Button */}
          {vinNumber.trim().length > 0 ? (
            <Pressable
              onPress={handleVinSubmit}
              disabled={isDecoding}
              style={({ pressed }) => [
                styles.scanVinButton,
                pressed && styles.scanVinButtonPressed,
                isDecoding && styles.buttonDisabled,
              ]}
            >
              <LinearGradient
                colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.scanVinButtonGradient}
              >
                {isDecoding ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text weight="bold" size="md" color="#FFFFFF">
                    Decode VIN
                  </Text>
                )}
              </LinearGradient>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleScanVin}
              style={({ pressed }) => [
                styles.scanVinButton,
                pressed && styles.scanVinButtonPressed,
              ]}
            >
              <LinearGradient
                colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.scanVinButtonGradient}
              >
                <QrCode size={scale(20)} color="#FFFFFF" strokeWidth={2} />
                <Text weight="bold" size="md" color="#FFFFFF">
                  Scan VIN
                </Text>
              </LinearGradient>
            </Pressable>
          )}

          {/* Manual Entry Link */}
          <Pressable
            onPress={handleManualEntry}
            style={({ pressed }) => [
              styles.manualEntryButton,
              pressed && styles.manualEntryButtonPressed,
            ]}
          >
            <Edit3 size={scale(16)} color="#5299FE" strokeWidth={2} />
            <Text weight="semiBold" size="sm" color="#5299FE" style={styles.manualEntryText}>
              Enter car information manually
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardStickyView>
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
  fullScreenImage: {
    position: 'absolute',
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 1,
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
    marginBottom: Spacing.sm,
    letterSpacing: scale(1),
  },
  description: {
    textAlign: 'center',
    lineHeight: moderateScale(20),
  },
  redDot: {
    position: 'absolute',
    width: scale(20),
    height: scale(20),
    borderRadius: moderateScale(10),
    backgroundColor: 'rgba(255, 82, 82, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  redDotInner: {
    width: scale(12),
    height: scale(12),
    borderRadius: moderateScale(6),
    backgroundColor: '#FF5252',
  },
  connectorLine: {
    position: 'absolute',
    width: 1.5,
    backgroundColor: '#888888',
    zIndex: 10,
  },
  vinBadge: {
    position: 'absolute',
    alignSelf: 'center',
    left: SCREEN_WIDTH * 0.5 - scale(90),
    backgroundColor: '#1a1a1a',
    paddingHorizontal: scale(16),
    paddingVertical: scale(8),
    borderRadius: moderateScale(6),
    zIndex: 15,
  },
  vinBadgeText: {
    letterSpacing: scale(1),
  },
  bottomButtonsWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 20,
  },
  bottomButtonsContainer: {
    paddingHorizontal: Spacing.lg,
    gap: scale(12),
  },
  vinInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(30),
    paddingVertical: scale(16),
    paddingHorizontal: scale(20),
    fontSize: moderateScale(16),
    fontWeight: '500',
    color: '#333333',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scanVinButton: {
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    shadowColor: 'rgba(82,153,254,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  scanVinButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  scanVinButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(16),
    paddingHorizontal: scale(32),
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(12),
    gap: scale(8),
  },
  manualEntryButtonPressed: {
    opacity: 0.7,
  },
  manualEntryText: {
    textDecorationLine: 'underline',
  },
  errorBanner: {
    backgroundColor: '#FFF0F0',
    borderRadius: moderateScale(12),
    paddingVertical: scale(10),
    paddingHorizontal: scale(16),
  },
  errorText: {
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
