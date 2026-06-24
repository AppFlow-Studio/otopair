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
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
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
import { BrandColors, FontFamily } from '@/constants/theme';

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

// ============================================================================
// PAGINATION DOT — mirrors components/ai-chat/AIGreeting.tsx so the Home
// card stack reads as swipeable with the same visual language as Oto AI.
// ============================================================================

function PaginationDot({ index, activeIndex }: { index: number; activeIndex: number }) {
  const isActive = index === activeIndex;
  const dotWidth = useSharedValue(isActive ? 18 : 6);

  useEffect(() => {
    dotWidth.value = withSpring(isActive ? 18 : 6, { damping: 15, stiffness: 200 });
  }, [isActive, dotWidth]);

  const dotStyle = useAnimatedStyle(() => ({
    width: dotWidth.value,
    backgroundColor: isActive ? BrandColors.secondary : 'rgba(0,0,0,0.12)',
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

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
  const [fetchedImageUrls, setFetchedImageUrls] = useState<Record<string, string>>({});
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  // Animated values for the front card
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  // Inner-press flag — set to 1 while the touch lives inside an
  // interactive child Pressable (e.g. the Book Now button), so the
  // parent's Gesture.Tap onEnd skips its "open the Cars tab" route.
  // Without this the parent's tap and the button's onPress both
  // resolve on the same touch and race; the parent's navigation was
  // winning on quick taps, sending the user to /cars instead of the
  // booking flow.
  const innerPressedSV = useSharedValue(0);

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
      router.push('/(booking-flow)/select-services');
    }
  };

  const advanceIndex = () => {
    setCurrentIndex((prev) => (prev + 1) % vehicles.length);
    onSwipeEnd?.();
  };

  // After React commits the new front card content, make it visible
  // then update the back card (safely hidden behind the front)
  useEffect(() => {
    if (cardOpacity.value === 0) {
      cardOpacity.value = 1;
      // Back card updates after front is visible and covering it
      requestAnimationFrame(() => {
        setBackIndex((currentIndex + 1) % vehicles.length);
      });
    }
  }, [currentIndex]);

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
            // Card is off-screen — hide it, reset position, then let JS advance index
            cardOpacity.value = 0;
            translateX.value = 0;
            rotation.value = 0;
            runOnJS(advanceIndex)();
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

  const renderCardContent = (vehicle: Vehicle, maxItems?: number) => {
    const items = maxItems ? vehicle.maintenanceItems.slice(0, maxItems) : vehicle.maintenanceItems;
    const isPreview = maxItems != null;
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
              source={vehicle.localImage || { uri: fetchedImageUrls[vehicle.id] || vehicle.imageUrl }}
              style={styles.vehicleImage}
              resizeMode="contain"
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
                onPressIn={() => {
                  // Tell the parent Gesture.Tap to skip this touch.
                  innerPressedSV.value = 1;
                }}
                onPressOut={() => {
                  // Hold the flag a beat after release so the parent's
                  // tap onEnd (which fires on touch release) still sees
                  // it before we clear.
                  setTimeout(() => {
                    innerPressedSV.value = 0;
                  }, 250);
                }}
                onPress={() => {
                  if (item.id === 'healthy') {
                    if (vehicle.vin) useVehicleStore.getState().selectVehicle(vehicle.vin);
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
      'worklet';
      // Skip the parent "open Cars" route when the touch landed on an
      // inner Pressable (e.g. Book Now). The button's own onPress will
      // handle the navigation; without this guard, the parent fired
      // simultaneously and clobbered the destination.
      if (success && innerPressedSV.value === 0) {
        runOnJS(handleCardPress)();
      }
    });
  // Race (not Exclusive): whichever of pan/tap recognizes first wins, and
  // a vertical drag recognizes NEITHER (pan needs horizontal, tap fails on
  // move) so the touch falls through to the ScrollView.
  const composedGesture = Gesture.Race(panGesture, tapGesture);
  // Size the swiper container to the ACTIVE vehicle's measured card height
  // (not Math.max across all vehicles). Otherwise a short "All systems healthy"
  // card sits inside a container sized for the tallest possible card and the
  // More Services section below gets pushed down with dead air. The back-card
  // preview is `position: absolute` so it doesn't affect this measurement.
  // Falls back to max when the active vehicle's height hasn't been measured yet
  // so we never collapse the slot.
  const resolvedCardHeight = (() => {
    const heights = Object.values(measuredHeights);
    if (heights.length === 0) return undefined;
    const activeHeight = frontVehicle ? measuredHeights[frontVehicle.id] : undefined;
    return activeHeight ?? Math.max(...heights);
  })();

  // Smooth post-swipe reflow: the swipe gesture itself only transforms the
  // front card (no layout change). When the swipe settles and the active
  // card changes, we animate the container height so the downstream
  // sections slide smoothly instead of snapping.
  const animatedCardHeight = useSharedValue<number>(resolvedCardHeight ?? 0);
  useEffect(() => {
    if (resolvedCardHeight == null) return;
    animatedCardHeight.value = withTiming(resolvedCardHeight, { duration: 280 });
  }, [resolvedCardHeight, animatedCardHeight]);
  const containerHeightStyle = useAnimatedStyle(() => ({
    height: animatedCardHeight.value,
  }));

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

        {/* Stacked card behind */}
        {canSwipe && (
          <View style={styles.stackedCard}>
            <BlurView
              intensity={40}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(245, 247, 250, 0.92)', 'rgba(241, 244, 249, 0.88)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.stackedCardHighlight} />
          </View>
        )}

        {/* Card area */}
        <Animated.View style={[styles.swiperContainer, resolvedCardHeight != null && containerHeightStyle]}>
          {/* Back card preview */}
          {canSwipe && (
            <View style={styles.backCard}>
              {renderCardContent(vehicles[backIndex], 1)}
            </View>
          )}

          {/* Front card */}
          {canSwipe ? (
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.frontCard, frontCardStyle]}>
                {renderCardContent(frontVehicle)}
              </Animated.View>
            </GestureDetector>
          ) : (
            <GestureDetector gesture={tapGesture}>
              <View style={styles.frontCard}>
                {renderCardContent(frontVehicle)}
              </View>
            </GestureDetector>
          )}
        </Animated.View>

        {/* Swipe indicator — only when there's more than one vehicle. */}
        {vehicles.length > 1 && (
          <View style={styles.dotsRow}>
            {vehicles.map((_, i) => (
              <PaginationDot key={i} index={i} activeIndex={currentIndex} />
            ))}
          </View>
        )}
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
  stackedCard: {
    position: 'absolute',
    top: -4,
    left: 17,
    right: 17,
    height: 50,
    borderRadius: 12,
    zIndex: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(220, 225, 235, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stackedCardHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  swiperContainer: {
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
  },
  backCard: {
    position: 'absolute',
    top: -8,
    left: 12,
    right: 12,
    zIndex: 0,
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
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
    width: 160,
    height: 90,
    // Pull the hero image flush to the card's right edge by canceling
    // `topSectionInner`'s 20px right padding. The text column keeps its
    // padding via `topSectionInner` itself, so only the image bleeds out.
    marginRight: -20,
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

  // Swipe indicator (mirrors AIGreeting's dots strip).
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
});

export default VehicleMaintenanceCard;
