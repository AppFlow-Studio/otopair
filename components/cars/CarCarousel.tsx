/**
 * CarCarousel
 *
 * PURPOSE: Displays a horizontal swipeable carousel of vehicle cards with pagination
 *          dots. The next car peeks out slightly, and vehicle details animate/morph
 *          when swiping between cars.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (My Cars screen)
 *
 * PROPS:
 *   - vehicles (Vehicle[]): Array of vehicle objects to display
 *   - onEditMileage ((vehicleId: string) => void): Called when edit mileage is pressed [optional]
 *   - onToggleDefault ((vehicleId: string, isDefault: boolean) => void): Called when default toggle changes [optional]
 *
 * EXAMPLE:
 *   <CarCarousel
 *     vehicles={vehiclesArray}
 *     onEditMileage={(id) => console.log('Edit', id)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  Switch,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { Edit2 } from 'lucide-react-native';
import { Easing } from 'react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { BrandColors, Colors, Spacing } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  mileage: number;
  nextServiceDate?: string;
  isDefault: boolean;
  imageSource?: ImageSourcePropType;
}

interface CarCarouselProps {
  vehicles: Vehicle[];
  onEditMileage?: (vehicleId: string) => void;
  onToggleDefault?: (vehicleId: string, isDefault: boolean) => void;
  onActiveIndexChange?: (index: number) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 32; // Full width minus padding
const CARD_MARGIN = 16; // Horizontal margin on each side

// Default images
const DEFAULT_VEHICLE_IMAGE = require('@/assets/images/lexus.png');
const BLUE_LAMBO_IMAGE = require('@/assets/images/bluelambo.png');

// ============================================================================
// COMPONENT
// ============================================================================

export function CarCarousel({
  vehicles,
  onEditMileage,
  onToggleDefault,
  onActiveIndexChange,
}: CarCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showDetails, setShowDetails] = useState(false);
  const scrollX = useRef(new Animated.Value(0)).current;
  const flatListRef = useRef<FlatList>(null);

  // Animation values for details overlay
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const item1Opacity = useRef(new Animated.Value(0)).current;
  const item2Opacity = useRef(new Animated.Value(0)).current;
  const item3Opacity = useRef(new Animated.Value(0)).current;
  const item1TranslateY = useRef(new Animated.Value(20)).current;
  const item2TranslateY = useRef(new Animated.Value(20)).current;
  const item3TranslateY = useRef(new Animated.Value(20)).current;

  const activeVehicle = vehicles[activeIndex];

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: true }
  );

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newIndex = Math.round(offsetX / SCREEN_WIDTH);
    if (newIndex >= 0 && newIndex < vehicles.length) {
      if (newIndex !== activeIndex) {
        setActiveIndex(newIndex);
        onActiveIndexChange?.(newIndex);
        // Close details when switching cars
        if (showDetails) {
          setShowDetails(false);
          overlayOpacity.setValue(0);
          item1Opacity.setValue(0);
          item2Opacity.setValue(0);
          item3Opacity.setValue(0);
        }
      }
    }
  };

  const handleDetailsPress = () => {
    if (showDetails) {
      // Close animation
      Animated.sequence([
        Animated.stagger(200, [
          Animated.timing(item3Opacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(item2Opacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
          Animated.timing(item1Opacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.bezier(0.25, 0.1, 0.25, 1),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 800,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
      ]).start(() => {
        setShowDetails(false);
      });
    } else {
      setShowDetails(true);
      // Reset values
      overlayOpacity.setValue(0);
      item1Opacity.setValue(0);
      item2Opacity.setValue(0);
      item3Opacity.setValue(0);
      item1TranslateY.setValue(20);
      item2TranslateY.setValue(20);
      item3TranslateY.setValue(20);

      // Open animation
      Animated.sequence([
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        Animated.stagger(300, [
          Animated.parallel([
            Animated.timing(item1Opacity, {
              toValue: 1,
              duration: 500,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
            Animated.timing(item1TranslateY, {
              toValue: 0,
              duration: 500,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(item2Opacity, {
              toValue: 1,
              duration: 500,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
            Animated.timing(item2TranslateY, {
              toValue: 0,
              duration: 500,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(item3Opacity, {
              toValue: 1,
              duration: 500,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
            Animated.timing(item3TranslateY, {
              toValue: 0,
              duration: 500,
              easing: Easing.bezier(0.25, 0.1, 0.25, 1),
              useNativeDriver: true,
            }),
          ]),
        ]),
      ]).start();
    }
  };

  const handleEditMileage = () => {
    onEditMileage?.(activeVehicle.id);
  };

  const handleToggleDefault = (value: boolean) => {
    onToggleDefault?.(activeVehicle.id, value);
  };

  const detailItems = [
    { label: 'Model Year', value: String(activeVehicle?.year || ''), opacity: item1Opacity, translateY: item1TranslateY, editable: false },
    { label: 'Mileage', value: `${(activeVehicle?.mileage || 0).toLocaleString()} mi`, opacity: item2Opacity, translateY: item2TranslateY, editable: true },
    { label: 'Next Service', value: activeVehicle?.nextServiceDate || 'Not Set', opacity: item3Opacity, translateY: item3TranslateY, editable: false },
  ];

  const renderCarCard = ({ item, index }: { item: Vehicle; index: number }) => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];

    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.9, 1, 0.9],
      extrapolate: 'clamp',
    });

    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.7, 1, 0.7],
      extrapolate: 'clamp',
    });

    // Use appropriate image based on index or provided imageSource
    const imageSource = item.imageSource || (index === 1 ? BLUE_LAMBO_IMAGE : DEFAULT_VEHICLE_IMAGE);

    return (
      <Animated.View style={[styles.cardContainer, { transform: [{ scale }], opacity }]}>
        <View style={styles.card}>
          {/* Car Title */}
          <View style={[styles.cardHeader, index === 1 && { marginLeft: -38 }]}>
            <Text weight="bold" size="2xl" color={Colors.light.text}>
              {item.make}
            </Text>
            <Text weight="bold" size="2xl" color={Colors.light.text}>
              {item.model}
            </Text>
            {item.vin && (
              <Text weight="medium" size="sm" color={BrandColors.secondary}>
                {item.vin}
              </Text>
            )}
          </View>

          {/* Car Image */}
          <View style={[styles.imageWrapper, index === 1 && { marginLeft: -40 }]}>
            <Image
              source={imageSource}
              style={styles.image}
              resizeMode="contain"
            />
            {/* Car shadow */}
            <View style={styles.carShadow} />

            {/* Details Overlay - only show on active card */}
            {showDetails && index === activeIndex && (
              <Animated.View style={[styles.detailsOverlay, { opacity: overlayOpacity }]}>
                <BlurView intensity={25} tint="light" style={styles.blurView}>
                  <View style={styles.blurOverlayBackground} />
                  <Pressable style={styles.overlayContent} onPress={handleDetailsPress}>
                    {detailItems.map((detailItem) => (
                      <Animated.View
                        key={detailItem.label}
                        style={[
                          styles.detailItem,
                          {
                            opacity: detailItem.opacity,
                            transform: [{ translateY: detailItem.translateY }],
                          },
                        ]}
                      >
                        <Text size="xs" color="#6B7280" style={styles.detailLabel}>
                          {detailItem.label}
                        </Text>
                        <View style={styles.valueRow}>
                          <Text weight="bold" size="xl" color={Colors.light.text}>
                            {detailItem.value}
                          </Text>
                          {detailItem.editable && (
                            <Pressable
                              onPress={handleEditMileage}
                              style={({ pressed }) => [
                                styles.editButton,
                                pressed && styles.editButtonPressed,
                              ]}
                            >
                              <Edit2 size={16} color={Colors.light.text} />
                            </Pressable>
                          )}
                        </View>
                      </Animated.View>
                    ))}
                  </Pressable>
                </BlurView>
              </Animated.View>
            )}
          </View>
        </View>
      </Animated.View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Carousel */}
      <Animated.FlatList
        ref={flatListRef}
        data={vehicles}
        renderItem={renderCarCard}
        keyExtractor={(item) => item.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        pagingEnabled
        decelerationRate="fast"
        onScroll={handleScroll}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        scrollEventThrottle={16}
      />

      {/* Pagination Dots */}
      <View style={styles.pagination}>
        {vehicles.map((_, index) => {
          const inputRange = [
            (index - 1) * SCREEN_WIDTH,
            index * SCREEN_WIDTH,
            (index + 1) * SCREEN_WIDTH,
          ];

          const dotScale = scrollX.interpolate({
            inputRange,
            outputRange: [1, 1.4, 1],
            extrapolate: 'clamp',
          });

          const dotOpacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.4, 1, 0.4],
            extrapolate: 'clamp',
          });

          return (
            <Animated.View
              key={index}
              style={[
                styles.dot,
                {
                  transform: [{ scale: dotScale }],
                  opacity: dotOpacity,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Car Details Button */}
      <Pressable
        onPress={handleDetailsPress}
        style={({ pressed }) => [
          styles.detailsButton,
          pressed && styles.detailsButtonPressed,
        ]}
      >
        <Text weight="semiBold" size="md" color={BrandColors.white} style={styles.buttonText}>
          {showDetails ? 'Hide Details' : 'Car Details'}
        </Text>
      </Pressable>

      {/* Default Car Toggle */}
      <View style={styles.toggleRow}>
        <Text weight="medium" size="sm" color="#4B5563">
          Set as Default Car
        </Text>
        <Switch
          value={activeVehicle?.isDefault || false}
          onValueChange={handleToggleDefault}
          thumbColor={activeVehicle?.isDefault ? BrandColors.white : '#f4f3f4'}
          trackColor={{ false: '#D1D5DB', true: BrandColors.secondary }}
          style={styles.switch}
        />
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  cardContainer: {
    width: SCREEN_WIDTH,
    paddingLeft: 8,
    paddingRight: 24,
  },
  card: {
    backgroundColor: 'transparent',
  },
  cardHeader: {
    paddingBottom: Spacing.sm,
    gap: 2,
    alignItems: 'flex-start', // Keep title left-aligned
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 16 / 10,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginLeft: -16,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  carShadow: {
    position: 'absolute',
    bottom: 0,
    left: '15%',
    right: '15%',
    height: 30,
    backgroundColor: 'transparent',
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
    transform: [{ scaleX: 1.5 }],
  },
  // Details overlay
  detailsOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 20,
    overflow: 'hidden',
  },
  blurView: {
    flex: 1,
    position: 'relative',
  },
  blurOverlayBackground: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  detailItem: {
    alignItems: 'center',
    gap: 2,
    paddingVertical: Spacing.xs,
  },
  detailLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 11,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  editButton: {
    padding: 4,
  },
  editButtonPressed: {
    opacity: 0.6,
  },
  // Pagination dots
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#C4C4C4', // Very light grey
  },
  // Car Details Button
  detailsButton: {
    backgroundColor: BrandColors.secondary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 12,
    alignSelf: 'stretch',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  detailsButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    textAlign: 'center',
  },
  // Toggle row
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  switch: {
    transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
  },
});

export default CarCarousel;

