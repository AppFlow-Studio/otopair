/**
 * AIGreeting
 *
 * PURPOSE: Luxury showroom greeting with vehicle carousel, parallax, text crossfade, and pagination
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown when no messages exist)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';
import * as Haptics from 'expo-haptics';

// 2. Expo & Third-party
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withSequence,
  withDelay,
  interpolate,
  Extrapolation,
  type SharedValue,
} from 'react-native-reanimated';
import Carousel from 'react-native-reanimated-carousel';
import { Image } from 'expo-image';
import { Car } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface VehicleCard {
  vin: string;
  year: number;
  make: string;
  model: string;
  imageUrl?: string | null;
  localImage?: any;
}

interface AIGreetingProps {
  userName?: string;
  suggestions: { id: string; text: string; subtitle?: string; value?: string }[];
  onSuggestionPress: (text: string) => void;
  vehicles?: VehicleCard[];
  selectedVehicleVin?: string | null;
  onVehicleSelect?: (vin: string) => void;
  onVehicleConfirm?: (vin: string, vehicle: VehicleCard) => void;
  keyboardVisible?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SCREEN_WIDTH = Dimensions.get('window').width;

const MOCK_VEHICLES: VehicleCard[] = [
  { vin: 'mock_1', year: 2025, make: 'Lexus', model: 'ES', imageUrl: null, localImage: require('@/assets/images/lexus.png') },
  { vin: 'mock_2', year: 2021, make: 'Ford', model: 'Explorer', imageUrl: null, localImage: require('@/assets/images/explorer.png') },
];

// ============================================================================
// VEHICLE CARD (image + shadow only — text is rendered separately for crossfade)
// ============================================================================

function VehicleCardItem({
  vehicle,
  onPress,
  confirmed,
  pulseScale,
}: {
  vehicle: VehicleCard;
  onPress: () => void;
  confirmed: boolean;
  pulseScale: SharedValue<number>;
}) {
  const pressScale = useSharedValue(1);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value * pulseScale.value }],
  }));

  const handlePressIn = () => {
    pressScale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        onPress={confirmed ? undefined : onPress}
        onPressIn={confirmed ? undefined : handlePressIn}
        onPressOut={confirmed ? undefined : handlePressOut}
        style={styles.vehicleCard}
      >
        {vehicle.localImage ? (
          <Image
            source={vehicle.localImage}
            style={styles.vehicleImage}
            contentFit="contain"
            transition={0}
            placeholder={null}
            cachePolicy="memory-disk"
            recyclingKey={vehicle.vin}
          />
        ) : vehicle.imageUrl ? (
          <Image
            source={{ uri: vehicle.imageUrl }}
            style={styles.vehicleImage}
            contentFit="contain"
            transition={0}
            placeholder={null}
            cachePolicy="memory-disk"
            recyclingKey={vehicle.vin}
          />
        ) : (
          <View style={styles.vehicleImagePlaceholder}>
            <Car size={64} color="#9CA3AF" />
          </View>
        )}
        {/* Grounding shadow */}
        <View style={styles.groundShadow} />
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// PAGINATION DOT
// ============================================================================

function PaginationDot({ index, activeIndex }: { index: number; activeIndex: number }) {
  const isActive = index === activeIndex;
  const dotWidth = useSharedValue(isActive ? 18 : 6);

  useEffect(() => {
    dotWidth.value = withSpring(isActive ? 18 : 6, { damping: 15, stiffness: 200 });
  }, [isActive]);

  const dotStyle = useAnimatedStyle(() => ({
    width: dotWidth.value,
    backgroundColor: isActive ? BrandColors.primary : 'rgba(0,0,0,0.12)',
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIGreeting({
  userName = 'User',
  suggestions,
  onSuggestionPress,
  vehicles = [],
  selectedVehicleVin = null,
  onVehicleSelect,
  onVehicleConfirm,
  keyboardVisible = false,
}: AIGreetingProps) {
  const allVehicles = React.useMemo(() => [...vehicles, ...MOCK_VEHICLES], [vehicles]);
  const hasVehicles = allVehicles.length > 0;
  const isSingleCar = allVehicles.length === 1;
  const [tappedVin, setTappedVin] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Pulse scale for tap-to-confirm animation
  const pulseScale = useSharedValue(1);

  // Text crossfade — fades out/in when swiping between cars
  const textOpacity = useSharedValue(1);
  const [displayIndex, setDisplayIndex] = useState(0);

  useEffect(() => {
    if (activeIndex === displayIndex) return;
    // Fade out, swap text, fade in
    textOpacity.value = withSequence(
      withTiming(0, { duration: 150 }),
      withDelay(50, withTiming(1, { duration: 150 })),
    );
    // Update displayed text mid-fade
    const timer = setTimeout(() => setDisplayIndex(activeIndex), 170);
    return () => clearTimeout(timer);
  }, [activeIndex]);

  const textFadeStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  // Greeting + dots fade/translate for tap-to-confirm
  const greetingOpacity = useSharedValue(1);
  const greetingTranslateY = useSharedValue(0);
  const dotsOpacity = useSharedValue(1);

  const greetingAnimStyle = useAnimatedStyle(() => ({
    opacity: greetingOpacity.value,
    transform: [{ translateY: greetingTranslateY.value }],
  }));

  const dotsAnimStyle = useAnimatedStyle(() => ({
    opacity: dotsOpacity.value,
  }));

  const displayedVehicle = allVehicles[displayIndex] || allVehicles[0];

  const handleCarTap = (vehicle: VehicleCard) => {
    if (tappedVin) return;

    // 1. Haptic
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    // 2. Car pulse
    pulseScale.value = withSequence(
      withSpring(1.03, { damping: 8 }),
      withSpring(1, { damping: 12 }),
    );

    // 3. Greeting fade out + translate up
    greetingOpacity.value = withTiming(0, { duration: 200 });
    greetingTranslateY.value = withTiming(-10, { duration: 200 });

    // 4. Dots fade out
    dotsOpacity.value = withTiming(0, { duration: 150 });

    // 5. Set state and call callbacks
    setTappedVin(vehicle.vin);
    onVehicleSelect?.(vehicle.vin);
    onVehicleConfirm?.(vehicle.vin, vehicle);
  };

  return (
    <View style={styles.container}>
      {/* Greeting text */}
      <View style={styles.greetingContainer}>
        <Animated.View style={greetingAnimStyle}>
          <Animated.View entering={FadeIn.delay(100).duration(500)}>
            <Text style={styles.greeting} weight="semiBold">
              Hello, {userName}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeIn.delay(300).duration(500)}>
            <Text style={styles.subtitle}>
              {hasVehicles
                ? (tappedVin ? 'Getting things ready...' : 'Which car can I help with today?')
                : 'What can I help you with today?'}
            </Text>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Vehicle Carousel or Single Car */}
      {hasVehicles && (
        <View style={styles.vehiclesSection}>
          {isSingleCar ? (
            // Single car — no carousel, centered
            <View style={styles.singleCarContainer}>
              <VehicleCardItem
                vehicle={allVehicles[0]}
                onPress={() => handleCarTap(allVehicles[0])}
                confirmed={!!tappedVin}
                pulseScale={pulseScale}
              />
            </View>
          ) : (
            // Multi-car carousel with parallax
            <Carousel
              width={SCREEN_WIDTH}
              height={180}
              data={allVehicles}
              loop={false}
              snapEnabled={true}
              pagingEnabled={true}
              autoPlay={false}
              style={{ overflow: 'visible' }}
              onSnapToItem={(index) => setActiveIndex(index)}
              customAnimation={(value: number) => {
                'worklet';
                const s = interpolate(
                  value,
                  [-1, -0.5, 0, 0.5, 1],
                  [0.82, 0.88, 1, 0.88, 0.82],
                  Extrapolation.CLAMP,
                );
                const o = interpolate(
                  value,
                  [-1, -0.5, 0, 0.5, 1],
                  [0.4, 0.6, 1, 0.6, 0.4],
                  Extrapolation.CLAMP,
                );
                const parallax = interpolate(value, [-1, 0, 1], [-15, 0, 15], Extrapolation.CLAMP);
                const tx = value * SCREEN_WIDTH + parallax;
                return {
                  transform: [{ translateX: tx }, { scale: s }],
                  opacity: o,
                };
              }}
              renderItem={({ item: vehicle }) => (
                <VehicleCardItem
                  vehicle={vehicle}
                  onPress={() => handleCarTap(vehicle)}
                  confirmed={!!tappedVin}
                  pulseScale={pulseScale}
                />
              )}
            />
          )}

          {/* Year/Make + Model text — crossfades independently */}
          <Animated.View style={[styles.vehicleTextContainer, textFadeStyle]}>
            <Text style={styles.vehicleYear} numberOfLines={1}>
              {displayedVehicle.year} {displayedVehicle.make}
            </Text>
            <Text style={styles.vehicleModel} weight="bold" numberOfLines={1}>
              {displayedVehicle.model}
            </Text>
          </Animated.View>

          {/* Pagination dots */}
          {!isSingleCar && (
            <Animated.View style={[styles.dotsRow, dotsAnimStyle]}>
              {allVehicles.map((_, i) => (
                <PaginationDot key={i} index={i} activeIndex={activeIndex} />
              ))}
            </Animated.View>
          )}

          {/* Swipe hint — only when there's more than one vehicle to swipe
              between, so first-time users know the carousel is swipeable. */}
          {!isSingleCar && (
            <Text style={styles.swipeHint}>Swipe to switch vehicles</Text>
          )}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: 130,
  },
  greetingContainer: {
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    overflow: 'visible',
  },
  greeting: {
    fontSize: 24,
    lineHeight: 32,
    color: '#000000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(0,0,0,0.45)',
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontFamily: FontFamily.regular,
  },
  // Vehicle section
  vehiclesSection: {
    marginTop: Spacing['5xl'],
    overflow: 'visible',
  },
  singleCarContainer: {
    alignItems: 'center',
  },
  vehicleCard: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    paddingHorizontal: SCREEN_WIDTH * 0.15,
  },
  vehicleImage: {
    width: 180,
    height: 120,
  },
  vehicleImagePlaceholder: {
    width: 180,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: BorderRadius.lg,
  },
  groundShadow: {
    width: 108,
    height: 12,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.05)',
    transform: [{ scaleY: 0.15 }],
    alignSelf: 'center',
    marginTop: -4,
  },
  // Vehicle text — rendered outside carousel for crossfade
  vehicleTextContainer: {
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  vehicleYear: {
    fontSize: 13,
    color: 'rgba(0,0,0,0.4)',
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: 0.5,
  },
  vehicleModel: {
    fontSize: 20,
    color: '#000000',
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  // Pagination
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 16,
  },
  swipeHint: {
    marginTop: 8,
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
    fontFamily: FontFamily.medium,
  },
  dot: {
    height: 6,
    borderRadius: 3,
  },
});
