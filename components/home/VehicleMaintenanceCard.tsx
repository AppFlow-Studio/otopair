/**
 * VehicleMaintenanceCard
 *
 * PURPOSE: Displays vehicle maintenance information with swipable cards showing maintenance items, vehicle details, and mileage tracking
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - vehicle (Vehicle): The vehicle object to display maintenance for
 *   - maintenanceItems (MaintenanceItem[]): Array of maintenance items to display
 *   - onUpdateMileage ((vehicleId: string, mileage: number) => void): Called when mileage is updated [optional]
 *   - onMaintenanceAction ((itemId: string) => void): Called when a maintenance action is triggered [optional]
 *
 * EXAMPLE:
 *   <VehicleMaintenanceCard
 *     vehicle={userVehicle}
 *     maintenanceItems={maintenanceList}
 *     onUpdateMileage={(id, miles) => updateMileage(id, miles)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  ImageSourcePropType,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useVehicleStore } from '@/stores/useVehicleStore';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// 3. Shared UI
import { Text } from '@/components/shared-ui';
import { fetchVehicleImageUrl } from '@/utils/vehicleImage';

// ============================================================================
// TYPES
// ============================================================================

interface MaintenanceItem {
  id: string;
  serviceName: string;
  dueText: string;
  isOverdue: boolean;
}

interface Vehicle {
  id: string;
  name: string;
  vin: string;
  imageUrl: string;
  localImage?: any;
  maintenanceItems: MaintenanceItem[];
  _fetchParams?: { make: string; model: string; year?: number };
}

interface VehicleMaintenanceCardProps {
  vehicles?: Vehicle[];
  onBookNow?: (vehicleId: string, serviceId: string) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

const SAMPLE_VEHICLES: Vehicle[] = [
  {
    id: '1',
    name: 'Lamborghini\nAventador S',
    vin: '1N6AD06W98C406256',
    imageUrl: '',
    maintenanceItems: [
      { id: '1', serviceName: 'Oil Change', dueText: 'Due in 500 miles', isOverdue: false },
      { id: '2', serviceName: 'State Inspection', dueText: 'Due in 2 weeks', isOverdue: false },
      { id: '3', serviceName: 'Tire Rotation', dueText: 'Overdue by 200 miles', isOverdue: true },
    ],
    _fetchParams: { make: 'Lamborghini', model: 'Aventador', year: 2023 },
  },
  {
    id: '2',
    name: 'Tesla\nModel S',
    vin: '5YJSA1E26HF000316',
    imageUrl: '',
    maintenanceItems: [
      { id: '1', serviceName: 'Tire Rotation', dueText: 'Due in 1000 miles', isOverdue: false },
      { id: '2', serviceName: 'Brake Inspection', dueText: 'Due in 3 weeks', isOverdue: false },
      { id: '3', serviceName: 'Battery Check', dueText: 'Due in 6 months', isOverdue: false },
    ],
    _fetchParams: { make: 'Tesla', model: 'Model S', year: 2023 },
  },
  {
    id: '3',
    name: 'Lexus\nRX 350',
    vin: '2T2BK1BA4HC123456',
    imageUrl: '',
    maintenanceItems: [
      { id: '1', serviceName: 'Oil Change', dueText: 'Due in 800 miles', isOverdue: false },
      { id: '2', serviceName: 'Air Filter', dueText: 'Due in 1 month', isOverdue: false },
      { id: '3', serviceName: 'Coolant Flush', dueText: 'Overdue by 500 miles', isOverdue: true },
    ],
    _fetchParams: { make: 'Lexus', model: 'RX 350', year: 2023 },
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH / 4;
const THIRD_CARD_SLIVER_HEIGHT = 52;
const FALLBACK_VEHICLE_IMAGE = require('@/assets/images/covered-car.png');

// ============================================================================
// COMPONENT
// ============================================================================

export function VehicleMaintenanceCard({
  vehicles = SAMPLE_VEHICLES,
  onBookNow,
  onSwipeStart,
  onSwipeEnd,
}: VehicleMaintenanceCardProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [backIndex, setBackIndex] = useState(vehicles.length > 1 ? 1 : 0);
  const [promotingIndex, setPromotingIndex] = useState<number | null>(null);
  const [thirdToSecondIndex, setThirdToSecondIndex] = useState<number | null>(null);
  const [incomingThirdIndex, setIncomingThirdIndex] = useState<number | null>(null);
  const [fetchedImageUrls, setFetchedImageUrls] = useState<Record<string, string>>({});
  const [imageLoadErrors, setImageLoadErrors] = useState<Record<string, string | true>>({});
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  // Animated values for the front card
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  const promotionProgress = useSharedValue(0);
  const stackShiftProgress = useSharedValue(1);

  useEffect(() => {
    vehicles.forEach((v) => {
      if (v.imageUrl || fetchedImageUrls[v.id] || !v._fetchParams) return;
      const { make, model, year } = v._fetchParams;
      fetchVehicleImageUrl(make, model, year, v.vin).then((url) => {
        if (url) setFetchedImageUrls((prev) => ({ ...prev, [v.id]: url }));
      });
    });
  }, [vehicles]);

  const handleBookNow = (vehicleId: string, serviceId: string) => {
    if (onBookNow) {
      onBookNow(vehicleId, serviceId);
    } else {
      router.push('/booking/map?openServices=true');
    }
  };

  const finishPromotion = (nextIndex: number) => {
    setCurrentIndex(nextIndex);
    setBackIndex((nextIndex + 1) % vehicles.length);
    // Keep the promoted card mounted briefly while React commits the new
    // first-card content underneath it. Otherwise the second card can flash
    // through for a frame on slower native commits.
    setTimeout(() => {
      cardOpacity.value = 1;
      setTimeout(() => {
        setPromotingIndex(null);
        setThirdToSecondIndex(null);
        setIncomingThirdIndex(null);
      }, 80);
    }, 32);
  };

  const promoteNextCard = () => {
    const nextIndex = (currentIndex + 1) % vehicles.length;
    const nextSecondIndex = (currentIndex + 2) % vehicles.length;
    const nextThirdIndex = (currentIndex + 3) % vehicles.length;
    promotionProgress.value = 0;
    stackShiftProgress.value = 0;
    setPromotingIndex(nextIndex);
    if (vehicles.length > 2) {
      setThirdToSecondIndex(nextSecondIndex);
      setIncomingThirdIndex(nextThirdIndex);
    }
    promotionProgress.value = withTiming(1, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    }, (finished) => {
      if (finished) {
        runOnJS(finishPromotion)(nextIndex);
      }
    });
    stackShiftProgress.value = withTiming(1, {
      duration: 260,
      easing: Easing.out(Easing.cubic),
    });
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      if (onSwipeStart) runOnJS(onSwipeStart)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      rotation.value = (event.translationX / SCREEN_WIDTH) * 10;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        const targetX = direction === 'right' ? SCREEN_WIDTH * 1.5 : -SCREEN_WIDTH * 1.5;
        translateX.value = withTiming(targetX, {
          duration: 300,
          easing: Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) {
            // Card is off-screen, so promote the next card into the front slot.
            cardOpacity.value = 0;
            translateX.value = 0;
            rotation.value = 0;
            runOnJS(promoteNextCard)();
          }
        });
        rotation.value = withTiming(direction === 'right' ? 15 : -15, { duration: 300 });
      } else {
        translateX.value = withSpring(0, { damping: 15, stiffness: 150 });
        rotation.value = withSpring(0, { damping: 15, stiffness: 150 });
      }
    })
    // Re-enable the parent ScrollView whenever the gesture ends —
    // INCLUDING after a completed swipe. The threshold branch above used
    // to skip onSwipeEnd, leaving `isCardSwiping` stuck true on Home →
    // permanently dead vertical scroll. onFinalize fires for every end
    // (swipe, snap-back, or cancel), so scroll always recovers.
    .onFinalize(() => {
      if (onSwipeEnd) runOnJS(onSwipeEnd)();
    });

  const frontCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateX: translateX.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const promotingCardStyle = useAnimatedStyle(() => {
    const progress = promotionProgress.value;
    return {
      top: -8 + 8 * progress,
      left: 12 - 12 * progress,
      right: 12 - 12 * progress,
      transform: [{ scale: 0.98 + 0.02 * progress }],
    };
  });

  const thirdToSecondCardStyle = useAnimatedStyle(() => {
    const progress = stackShiftProgress.value;
    const revealProgress = Math.max(0, Math.min(1, (progress - 0.18) / 0.82));
    return {
      top: -16 + 8 * progress,
      left: 24 - 12 * progress,
      right: 24 - 12 * progress,
      opacity: revealProgress,
      transform: [{ scale: 0.96 + 0.02 * progress }],
    };
  });

  const incomingThirdCardStyle = useAnimatedStyle(() => {
    const progress = stackShiftProgress.value;
    return {
      top: -20 + 4 * progress,
      left: 30 - 6 * progress,
      right: 30 - 6 * progress,
      opacity: 0.65 * progress,
      height: THIRD_CARD_SLIVER_HEIGHT,
      transform: [{ scale: 0.94 + 0.02 * progress }],
    };
  });

  const resolveVehicleImageSource = (vehicle: Vehicle): ImageSourcePropType => {
    if (vehicle.localImage) return vehicle.localImage;

    const resolvedImageUrl = fetchedImageUrls[vehicle.id] || vehicle.imageUrl;
    if (!resolvedImageUrl || imageLoadErrors[vehicle.id] === resolvedImageUrl) {
      return FALLBACK_VEHICLE_IMAGE;
    }

    return { uri: resolvedImageUrl };
  };

  const handleVehicleImageError = (vehicle: Vehicle) => {
    const resolvedImageUrl = fetchedImageUrls[vehicle.id] || vehicle.imageUrl;
    setImageLoadErrors((prev) => {
      if (!resolvedImageUrl || prev[vehicle.id] === resolvedImageUrl) {
        return prev;
      }
      return { ...prev, [vehicle.id]: resolvedImageUrl };
    });
  };

  const renderCardContent = (vehicle: Vehicle, maxItems?: number, isPreview = false) => {
    const items = maxItems ? vehicle.maintenanceItems.slice(0, maxItems) : vehicle.maintenanceItems;
    return (
    <View style={styles.card}>
      {/* Top Section - Vehicle Info (tap handled by the card's Tap gesture) */}
      <View style={styles.topSection}>
        <LinearGradient
          colors={['#FFFFFF', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topSectionInner}>
          <View style={styles.vehicleInfoSection}>
            <View style={styles.vehicleTextInfo}>
              <Text
                weight="bold"
                size="xl"
                color="#1F2937"
                lineHeight={1.25}
                numberOfLines={2}
                adjustsFontSizeToFit
                minimumFontScale={0.82}
                ellipsizeMode="clip"
                style={styles.vehicleName}
              >
                {vehicle.name}
              </Text>
              <Text
                size="sm"
                color="#9CA3AF"
                lineHeight={1.25}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.68}
                ellipsizeMode="clip"
                style={styles.vin}
              >
                {vehicle.vin}
              </Text>
            </View>
            <Image
              source={resolveVehicleImageSource(vehicle)}
              style={styles.vehicleImage}
              resizeMode="contain"
              onError={() => handleVehicleImageError(vehicle)}
            />
          </View>
        </View>
      </View>

      {/* Bottom Section - Maintenance List */}
      <View style={styles.bottomSection}>
        <View style={styles.maintenanceList}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.maintenanceItem,
                index === items.length - 1 && styles.maintenanceItemLast,
              ]}
            >
              <View style={styles.maintenanceInfo}>
                <Text weight="semiBold" size="md" color="#1F2937">
                  {item.serviceName}
                </Text>
                <Text
                  size="sm"
                  color={item.isOverdue ? '#EF4444' : '#6B7280'}
                >
                  {item.dueText}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  if (item.id === 'healthy') {
                    router.push('/(main-tabs)/cars');
                  } else {
                    handleBookNow(vehicle.id, item.id);
                  }
                }}
                style={({ pressed }) => [
                  styles.bookButton,
                  pressed && styles.bookButtonPressed,
                ]}
              >
                <Text weight="medium" size="sm" color="#5299FE">
                  {item.id === 'healthy' ? 'View' : 'Book Now'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </View>
    </View>
    );
  };

  const frontVehicle = vehicles[currentIndex];
  const canSwipe = vehicles.length > 1;
  const hasThirdCard = vehicles.length > 2;
  const thirdIndex = (currentIndex + 2) % vehicles.length;
  // Tap the active card → open it on the Cars tab. Implemented as an RNGH
  // Tap (not an RN Pressable) so it can be made EXCLUSIVE with the swipe
  // pan — a horizontal swipe activates the pan, which suppresses the tap,
  // so swiping no longer registers as a press.
  const handleCardPress = () => {
    const vin = vehicles[currentIndex]?.vin;
    // Drive the shared vehicle store; the Cars carousel listens to this
    // (Effect A) and rotates to the matching car, which in turn syncs the
    // page background + maintenance tracker via its onActiveIndexChange.
    if (vin) useVehicleStore.getState().selectVehicle(vin);
    router.push('/(main-tabs)/cars');
  };
  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    // Fail the tap as soon as the finger travels >8px so a vertical drag
    // isn't held by the tap recognizer — that hand-off lets the parent
    // ScrollView take the gesture and scroll (kills the dead zone).
    .maxDistance(8)
    .onEnd((_e, success) => {
      if (success) runOnJS(handleCardPress)();
    });
  // Race (not Exclusive): whichever of pan/tap recognizes first wins, and
  // a vertical drag recognizes NEITHER (pan needs horizontal, tap fails on
  // move) so the touch falls through to the ScrollView.
  const composedGesture = Gesture.Race(panGesture, tapGesture);
  const resolvedCardHeight = (() => {
    const heights = Object.values(measuredHeights);
    if (heights.length === 0) return undefined;
    return Math.max(...heights);
  })();

  const handleMeasureCard = (vehicleId: string, height: number) => {
    setMeasuredHeights((prev) => {
      if (prev[vehicleId] === height) {
        return prev;
      }
      return { ...prev, [vehicleId]: height };
    });
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#000000" style={styles.sectionHeader}>
        Vehicle Maintenance
      </Text>

      {/* No onTouchStart/onTouchEnd here: those fired on EVERY touch-down
          (including a vertical scroll), flipping isCardSwiping → the home
          ScrollView's scrollEnabled went false before the gesture system
          could decide, killing vertical scroll on the card. isCardSwiping
          is driven solely by the pan gesture now (onStart / onFinalize),
          so it only disables scroll during a real horizontal swipe. */}
      <View style={styles.swiperWrapper}>
        {/* Pre-measure every card so the section keeps a stable height. */}
        <View style={styles.measurementLayer} pointerEvents="none">
          {vehicles.map((vehicle) => (
            <View
              key={`measure-${vehicle.id}`}
              style={styles.measurementCard}
              onLayout={(e) => handleMeasureCard(vehicle.id, e.nativeEvent.layout.height)}
            >
              {renderCardContent(vehicle)}
            </View>
          ))}
        </View>

        {/* Card area */}
        <View style={[styles.swiperContainer, resolvedCardHeight ? { height: resolvedCardHeight } : undefined]}>
          {canSwipe && hasThirdCard && promotingIndex === null && (
            <View style={[styles.thirdCard, styles.thirdCardSliver]}>
              {renderCardContent(vehicles[thirdIndex], 1, true)}
            </View>
          )}

          {canSwipe && incomingThirdIndex !== null && (
            <Animated.View style={[styles.thirdCard, styles.thirdCardSliver, incomingThirdCardStyle]}>
              {renderCardContent(vehicles[incomingThirdIndex], 1, true)}
            </Animated.View>
          )}

          {canSwipe && thirdToSecondIndex !== null && (
            <Animated.View style={[styles.thirdCard, styles.secondCardLayer, thirdToSecondCardStyle]}>
              {renderCardContent(vehicles[thirdToSecondIndex], 1, true)}
            </Animated.View>
          )}

          {/* Second card preview */}
          {canSwipe && promotingIndex === null && (
            <View style={styles.backCard}>
              {renderCardContent(vehicles[backIndex], 1, true)}
            </View>
          )}

          {canSwipe && promotingIndex !== null && (
            <Animated.View style={[styles.backCard, styles.promotingCard, promotingCardStyle]}>
              {renderCardContent(vehicles[promotingIndex])}
            </Animated.View>
          )}

          {/* Front card */}
          {canSwipe ? (
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={frontCardStyle}>
                {renderCardContent(frontVehicle)}
              </Animated.View>
            </GestureDetector>
          ) : (
            <GestureDetector gesture={tapGesture}>
              {renderCardContent(frontVehicle)}
            </GestureDetector>
          )}
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionHeader: {
    marginBottom: 28,
    fontStyle: 'italic',
  },
  swiperWrapper: {
    position: 'relative',
    paddingTop: 10,
  },
  measurementLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },
  measurementCard: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  swiperContainer: {
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
  },
  thirdCard: {
    position: 'absolute',
    top: -16,
    left: 24,
    right: 24,
    zIndex: 0,
    opacity: 0.65,
    transform: [{ scale: 0.96 }],
  },
  thirdCardSliver: {
    height: THIRD_CARD_SLIVER_HEIGHT,
    overflow: 'hidden',
    borderRadius: 12,
  },
  backCard: {
    position: 'absolute',
    top: -8,
    left: 12,
    right: 12,
    zIndex: 1,
    transform: [{ scale: 0.98 }],
  },
  secondCardLayer: {
    zIndex: 1,
  },
  promotingCard: {
    zIndex: 2,
  },
  frontCard: {
    position: 'relative',
    zIndex: 3,
    elevation: 8,
  },
  card: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  cardPreview: {
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  topSection: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8ECF2',
    position: 'relative',
    marginBottom: -12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
    zIndex: 2,
  },
  topSectionPreview: {
    borderWidth: 0,
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  topSectionInner: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 16,
  },
  bottomSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 10,
    paddingBottom: 2,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 1,
  },
  vehicleInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleTextInfo: {
    flex: 1,
  },
  vehicleName: {
    marginBottom: 4,
    minHeight: 50,
  },
  vin: {
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  vehicleImage: {
    width: 140,
    height: 80,
  },
  maintenanceList: {
    gap: 0,
  },
  maintenanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  maintenanceItemLast: {
    borderBottomWidth: 0,
  },
  maintenanceInfo: {
    flex: 1,
    gap: 2,
  },
  bookButton: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5299FE',
    backgroundColor: '#FFFFFF',
    minWidth: 100,
    alignItems: 'center',
  },
  bookButtonPressed: {
    backgroundColor: '#EBF4FF',
  },
});

export default VehicleMaintenanceCard;
