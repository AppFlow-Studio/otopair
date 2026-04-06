/**
 * AIGreeting
 *
 * PURPOSE: Displays ChatGPT-style greeting with vehicle selection and suggestion chips
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown when no messages exist)
 *
 * PROPS:
 *   - userName (string): User's name to display in greeting (default: "User")
 *   - suggestions (Suggestion[]): Array of suggestion objects to display
 *   - onSuggestionPress ((text: string) => void): Callback when a suggestion is pressed
 *   - vehicles (VehicleCard[]): Array of user's vehicles to display for selection
 *   - selectedVehicleVin (string | null): Currently selected vehicle VIN
 *   - onVehicleSelect ((vin: string) => void): Callback when a vehicle is selected
 *   - onVehicleConfirm ((vin: string) => void): Callback when user confirms vehicle with "Choose"
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState, useCallback } from 'react';
import { View, StyleSheet, Pressable, Dimensions } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  FadeIn,
  FadeOut,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Car } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

interface Suggestion {
  id: string;
  text: string;
  subtitle?: string;
  value?: string;
}

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
  suggestions: Suggestion[];
  onSuggestionPress: (text: string) => void;
  vehicles?: VehicleCard[];
  selectedVehicleVin?: string | null;
  onVehicleSelect?: (vin: string) => void;
  onVehicleConfirm?: (vin: string) => void;
}

// ============================================================================
// CHATGPT-STYLE HORIZONTAL SUGGESTIONS
// ============================================================================

const HORIZONTAL_SUGGESTIONS: Suggestion[] = [
  { id: 'brake', text: 'Fix', subtitle: 'brake noise' },
  { id: 'engine', text: 'Check', subtitle: 'engine light' },
  { id: 'oil', text: 'Schedule', subtitle: 'a service' },
  { id: 'vague', text: 'Not sure', subtitle: "what's wrong" },
];

const MOCK_VEHICLES: VehicleCard[] = [
  { vin: 'mock_1', year: 2025, make: 'Lexus', model: 'ES', imageUrl: null, localImage: require('@/assets/images/lexus.png') },
  { vin: 'mock_2', year: 2022, make: 'Honda', model: 'Civic', imageUrl: null },
  { vin: 'mock_3', year: 2024, make: 'BMW', model: '330i', imageUrl: null },
  { vin: 'mock_4', year: 2021, make: 'Ford', model: 'Mustang', imageUrl: null },
  { vin: 'mock_5', year: 2023, make: 'Tesla', model: 'Model 3', imageUrl: null },
  { vin: 'mock_6', year: 2022, make: 'Audi', model: 'A4', imageUrl: null },
  { vin: 'mock_7', year: 2024, make: 'Mercedes', model: 'C300', imageUrl: null },
];

// ============================================================================
// VEHICLE CARD COMPONENT
// ============================================================================

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = SCREEN_WIDTH * 0.7;
const CARD_GAP = Spacing.md;
const SNAP_INTERVAL = CARD_WIDTH + CARD_GAP;

function VehicleCardItem({
  vehicle,
  onPress,
  confirmed,
  index,
  scrollX,
}: {
  vehicle: VehicleCard;
  onPress: () => void;
  confirmed: boolean;
  index: number;
  scrollX: { value: number };
}) {
  const pressScale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SNAP_INTERVAL,
      index * SNAP_INTERVAL,
      (index + 1) * SNAP_INTERVAL,
    ];
    const cardScale = interpolate(
      scrollX.value,
      inputRange,
      [0.75, 1.12, 0.75],
      Extrapolation.CLAMP,
    );
    return {
      transform: [{ scale: cardScale * pressScale.value }],
    };
  });

  const handlePressIn = () => {
    pressScale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View
      entering={FadeInRight.delay(600 + index * 200).duration(500).springify().damping(16).stiffness(80)}
    >
      <Animated.View style={animatedStyle}>
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
              transition={200}
            />
          ) : vehicle.imageUrl ? (
            <Image
              source={{ uri: vehicle.imageUrl }}
              style={styles.vehicleImage}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <View style={styles.vehicleImagePlaceholder}>
              <Car size={40} color="#9CA3AF" />
            </View>
          )}
          <Text style={styles.vehicleYear} numberOfLines={1}>
            {vehicle.year} {vehicle.make}
          </Text>
          <Text
            style={styles.vehicleModel}
            weight="bold"
            numberOfLines={1}
          >
            {vehicle.model}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================================
// SUGGESTION CHIP COMPONENT
// ============================================================================

function SuggestionChip({
  suggestion,
  onPress,
  index,
}: {
  suggestion: Suggestion;
  onPress: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={({ pressed }) => [
          styles.suggestionChip,
          pressed && styles.suggestionChipPressed,
        ]}
      >
        <Text style={styles.suggestionTitle} weight="semiBold">
          {suggestion.text}
        </Text>
        {suggestion.subtitle && (
          <Text style={styles.suggestionSubtitle}>
            {suggestion.subtitle}
          </Text>
        )}
      </Pressable>
    </Animated.View>
  );
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
}: AIGreetingProps) {
  const displaySuggestions = suggestions.length > 0 ? suggestions : HORIZONTAL_SUGGESTIONS;
  const allVehicles = React.useMemo(() => [...vehicles, ...MOCK_VEHICLES], [vehicles]);
  const hasVehicles = allVehicles.length > 0;
  const [confirmed, setConfirmed] = useState(false);
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  return (
    <View style={styles.container}>
      {/* Greeting + Vehicle Selection — centered */}
      <View style={styles.greetingContainer}>
        {!confirmed && (
          <Animated.View
            entering={FadeIn.delay(100).duration(500)}
            exiting={FadeOut.duration(300)}
          >
            <Text style={styles.greeting} weight="semiBold">
              Hello, {userName}
            </Text>
          </Animated.View>
        )}

        {/* Subtitle — only before confirmation */}
        {!confirmed && (
          <Animated.View
            key="default-subtitle"
            entering={FadeIn.delay(300).duration(500)}
            exiting={FadeOut.duration(300)}
          >
            <Text style={styles.subtitle}>
              {hasVehicles
                ? 'Which car can I help with today?'
                : 'What can I help you with today?'}
            </Text>
          </Animated.View>
        )}

      </View>

      {/* Vehicle Cards — outside greetingContainer so scroll isn't clipped */}
      {hasVehicles && !confirmed && (
        <Animated.View
          exiting={FadeOut.duration(300)}
          style={styles.vehiclesSection}
        >
          <Animated.ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{ overflow: 'visible' }}
            contentContainerStyle={styles.vehiclesScroll}
            snapToInterval={SNAP_INTERVAL}
            decelerationRate="fast"
            onScroll={onScroll}
            scrollEventThrottle={16}
          >
            {allVehicles.map((vehicle, index) => (
              <VehicleCardItem
                key={vehicle.vin}
                vehicle={vehicle}
                onPress={() => {
                  onVehicleSelect?.(vehicle.vin);
                  setConfirmed(true);
                  onVehicleConfirm?.(vehicle.vin);
                }}
                confirmed={false}
                index={index}
                scrollX={scrollX}
              />
            ))}
          </Animated.ScrollView>
        </Animated.View>
      )}

      {/* Suggestions removed — they now appear in the chat view after AI responds */}
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
    fontSize: 38,
    lineHeight: 48,
    color: '#000000',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: '#000000',
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontFamily: FontFamily.regular,
  },
  // Vehicle cards
  vehiclesSection: {
    marginTop: Spacing['5xl'],
    marginBottom: Spacing.xl,
    overflow: 'visible',
  },
  vehiclesScroll: {
    paddingHorizontal: Spacing.lg,
    gap: CARD_GAP,
    overflow: 'visible',
    paddingVertical: Spacing.lg,
  },
  vehicleCard: {
    width: CARD_WIDTH,
    alignItems: 'center',
  },
  vehicleImage: {
    width: '100%',
    height: 120,
    marginBottom: Spacing.md,
  },
  vehicleImagePlaceholder: {
    width: '100%',
    height: 120,
    marginBottom: Spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    borderRadius: BorderRadius.lg,
  },
  vehicleYear: {
    fontSize: 14,
    color: '#6B7280',
    fontFamily: FontFamily.regular,
    textAlign: 'center',
    marginBottom: 2,
  },
  vehicleModel: {
    fontSize: 22,
    color: '#000000',
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  // Suggestions
  suggestionsContainer: {
    paddingBottom: Spacing.xs,
  },
  suggestionsScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  suggestionChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderWidth: 0,
    minWidth: 120,
  },
  suggestionChipPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  suggestionTitle: {
    color: '#000000',
    fontSize: 15,
    fontFamily: FontFamily.semiBold,
    lineHeight: 20,
  },
  suggestionSubtitle: {
    color: '#000000',
    fontSize: 14,
    fontFamily: FontFamily.regular,
    lineHeight: 18,
  },
});
