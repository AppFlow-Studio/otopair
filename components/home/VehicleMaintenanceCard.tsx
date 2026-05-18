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
import { useRouter } from 'expo-router';
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
    .failOffsetY([-20, 20])
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
        if (onSwipeEnd) runOnJS(onSwipeEnd)();
      }
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
    return (
    <View style={styles.card}>
      {/* Top Section - Vehicle Info */}
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

      <View
        style={styles.swiperWrapper}
        onTouchStart={() => onSwipeStart?.()}
        onTouchEnd={() => onSwipeEnd?.()}
        onTouchCancel={() => onSwipeEnd?.()}
      >
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
        <View style={[styles.swiperContainer, resolvedCardHeight ? { height: resolvedCardHeight } : undefined]}>
          {/* Back card preview */}
          {canSwipe && (
            <View style={styles.backCard}>
              {renderCardContent(vehicles[backIndex], 1)}
            </View>
          )}

          {/* Front card */}
          {canSwipe ? (
            <GestureDetector gesture={panGesture}>
              <Animated.View style={frontCardStyle}>
                {renderCardContent(frontVehicle)}
              </Animated.View>
            </GestureDetector>
          ) : (
            renderCardContent(frontVehicle)
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
