/**
 * VehicleCard
 *
 * PURPOSE: Displays a user's vehicle with a large image and a "Car Details" button.
 *          When tapped, a glassy overlay smoothly appears over the car showing
 *          Model Year, Mileage, and Next Service Date with staggered fade-in animations.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (My Cars screen)
 *
 * PROPS:
 *   - id (string): Unique identifier for the vehicle
 *   - year (number): Vehicle year (e.g., 2019)
 *   - make (string): Vehicle make (e.g., "Lexus")
 *   - model (string): Vehicle model (e.g., "RX 350")
 *   - vin (string): Vehicle identification number [optional]
 *   - mileage (number): Current mileage value to display
 *   - nextServiceDate (string): Next service date (e.g., "Sep 15, 2024") [optional]
 *   - isDefault (boolean): Whether this vehicle is currently the default car
 *   - imageSource (ImageSourcePropType): Optional image source for the vehicle [optional]
 *   - onToggleDefault ((vehicleId: string, isDefault: boolean) => void): Called when default toggle changes [optional]
 *
 * EXAMPLE:
 *   <VehicleCard
 *     id="vehicle-1"
 *     year={2019}
 *     make="Lexus"
 *     model="RX 350"
 *     vin="1N6AD06W98C406256"
 *     mileage={52300}
 *     nextServiceDate="Sep 15, 2024"
 *     isDefault={true}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  Switch,
  View
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { Edit2 } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BorderRadius, BrandColors, Colors, Spacing } from '@/constants/theme';
import { scale, moderateScale } from '@/utils/responsive';

// ============================================================================
// TYPES
// ============================================================================

interface VehicleCardProps {
  id: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  mileage: number;
  nextServiceDate?: string;
  isDefault: boolean;
  imageSource?: ImageSourcePropType;
  onEditMileage?: (vehicleId: string) => void;
  onToggleDefault?: (vehicleId: string, isDefault: boolean) => void;
}

// Fallback image used only when no dynamic imageSource is available
const FALLBACK_VEHICLE_IMAGE = require('@/assets/images/covered-car.png');

// ============================================================================
// COMPONENT
// ============================================================================

export function VehicleCard({
  id,
  year,
  make,
  model,
  vin,
  mileage,
  nextServiceDate,
  isDefault,
  imageSource,
  onEditMileage,
  onToggleDefault,
}: VehicleCardProps) {
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [hasImageError, setHasImageError] = useState(false);
  const [isDefaultState, setIsDefaultState] = useState(isDefault);
  const [showDetails, setShowDetails] = useState(false);

  // Animation values
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const item1Opacity = useRef(new Animated.Value(0)).current;
  const item2Opacity = useRef(new Animated.Value(0)).current;
  const item3Opacity = useRef(new Animated.Value(0)).current;
  const item1TranslateY = useRef(new Animated.Value(20)).current;
  const item2TranslateY = useRef(new Animated.Value(20)).current;
  const item3TranslateY = useRef(new Animated.Value(20)).current;

  const title = `${make}\n${model}`;

  const handleToggleDefault = (value: boolean) => {
    setIsDefaultState(value);
    onToggleDefault?.(id, value);
  };

  const handleDetailsPress = () => {
    if (showDetails) {
      // Close animation - smooth and slow
      Animated.sequence([
        // Items fade out one by one (reverse order)
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
        // Then overlay fades out
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

      // Open animation - overlay first, then items staggered
      Animated.sequence([
        // Overlay fades in
        Animated.timing(overlayOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
          useNativeDriver: true,
        }),
        // Items fade in one by one
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

  const resolvedImageSource = hasImageError
    ? FALLBACK_VEHICLE_IMAGE
    : imageSource || FALLBACK_VEHICLE_IMAGE;

  const handleEditMileage = () => {
    onEditMileage?.(id);
  };

  const detailItems = [
    { label: 'Model Year', value: String(year), opacity: item1Opacity, translateY: item1TranslateY, editable: false },
    { label: 'Mileage', value: `${mileage.toLocaleString()} mi`, opacity: item2Opacity, translateY: item2TranslateY, editable: true },
    { label: 'Next Service', value: nextServiceDate || 'Not Set', opacity: item3Opacity, translateY: item3TranslateY, editable: false },
  ];

  return (
    <View style={styles.card}>
      {/* Header: Title + VIN */}
      <View style={styles.header}>
        <View style={styles.titleSection}>
          <Text weight="bold" size="3xl" color={Colors.light.text} style={styles.title}>
            {title}
          </Text>
          {vin && (
            <Text weight="medium" size="sm" color={BrandColors.secondary}>
              {vin}
            </Text>
          )}
        </View>
      </View>

      {/* Main content: Car image with overlay */}
      <View style={styles.contentContainer}>
        {/* Vehicle Image */}
        <View style={styles.imageWrapper}>
          {isImageLoading && (
            <View style={styles.imageSkeleton}>
              <ActivityIndicator color={BrandColors.secondary} />
            </View>
          )}
          <Image
            source={resolvedImageSource}
            style={styles.image}
            resizeMode="contain"
            onLoadStart={() => setIsImageLoading(true)}
            onLoadEnd={() => setIsImageLoading(false)}
            onError={() => {
              setHasImageError(true);
              setIsImageLoading(false);
            }}
          />
          {/* Car shadow underneath */}
          <View style={styles.carShadow} />

          {/* Glassy Details Overlay */}
          {showDetails && (
            <Animated.View style={[styles.detailsOverlay, { opacity: overlayOpacity }]}>
              <BlurView intensity={25} tint="light" style={styles.blurView}>
                <Pressable style={styles.overlayContent} onPress={handleDetailsPress}>
                    {detailItems.map((item, index) => (
                      <Animated.View
                        key={item.label}
                        style={[
                          styles.detailItem,
                          {
                            opacity: item.opacity,
                            transform: [{ translateY: item.translateY }],
                          },
                        ]}
                      >
                        <Text size="sm" color={Colors.light.text} style={styles.detailLabel}>
                          {item.label}
                        </Text>
                        <View style={styles.valueRow}>
                          <Text weight="bold" size="2xl" color={Colors.light.text}>
                            {item.value}
                          </Text>
                          {item.editable && (
                            <Pressable 
                              onPress={handleEditMileage}
                              style={({ pressed }) => [
                                styles.editButton,
                                pressed && styles.editButtonPressed
                              ]}
                            >
                              <Edit2 size={18} color={Colors.light.text} />
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
            value={isDefaultState}
            onValueChange={handleToggleDefault}
            thumbColor={isDefaultState ? BrandColors.white : '#f4f3f4'}
            trackColor={{ false: '#D1D5DB', true: BrandColors.secondary }}
            style={styles.switch}
          />
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: BorderRadius['2xl'],
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  titleSection: {
    gap: scale(4),
  },
  title: {
    lineHeight: moderateScale(36),
  },
  contentContainer: {
    width: '100%',
  },
  imageWrapper: {
    width: '100%',
    aspectRatio: 16 / 10,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    position: 'relative',
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
    height: scale(30),
    backgroundColor: 'transparent',
    borderRadius: 100,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 15 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 20,
    transform: [{ scaleX: 1.5 }],
  },
  imageSkeleton: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  // Details overlay
  detailsOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(20),
    overflow: 'hidden',
  },
  blurView: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
  },
  overlayContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  detailItem: {
    alignItems: 'center',
    gap: scale(4),
  },
  detailLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  editButton: {
    padding: scale(4),
  },
  editButtonPressed: {
    opacity: 0.6,
  },
  // Car Details Button
  detailsButton: {
    backgroundColor: BrandColors.secondary,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: moderateScale(12),
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

export default VehicleCard;
