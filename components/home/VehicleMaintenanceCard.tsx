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
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import Swiper from 'react-native-deck-swiper';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

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

// Local image imports
const LAMBO_IMAGE = require('@/assets/images/bluelambo.png');
const TESLA_IMAGE = require('@/assets/images/redTesla.png');
const LEXUS_IMAGE = require('@/assets/images/lexus.png');

const SAMPLE_VEHICLES: Vehicle[] = [
  {
    id: '1',
    name: 'Lamborghini\nAventador S',
    vin: '1N6AD06W98C406256',
    imageUrl: '',
    localImage: LAMBO_IMAGE,
    maintenanceItems: [
      { id: '1', serviceName: 'Oil Change', dueText: 'Due in 500 miles', isOverdue: false },
      { id: '2', serviceName: 'State Inspection', dueText: 'Due in 2 weeks', isOverdue: false },
      { id: '3', serviceName: 'Tire Rotation', dueText: 'Overdue by 200 miles', isOverdue: true },
    ],
  },
  {
    id: '2',
    name: 'Tesla\nModel S',
    vin: '5YJSA1E26HF000316',
    imageUrl: '',
    localImage: TESLA_IMAGE,
    maintenanceItems: [
      { id: '1', serviceName: 'Tire Rotation', dueText: 'Due in 1000 miles', isOverdue: false },
      { id: '2', serviceName: 'Brake Inspection', dueText: 'Due in 3 weeks', isOverdue: false },
      { id: '3', serviceName: 'Battery Check', dueText: 'Due in 6 months', isOverdue: false },
    ],
  },
  {
    id: '3',
    name: 'Lexus\nRX 350',
    vin: '2T2BK1BA4HC123456',
    imageUrl: '',
    localImage: LEXUS_IMAGE,
    maintenanceItems: [
      { id: '1', serviceName: 'Oil Change', dueText: 'Due in 800 miles', isOverdue: false },
      { id: '2', serviceName: 'Air Filter', dueText: 'Due in 1 month', isOverdue: false },
      { id: '3', serviceName: 'Coolant Flush', dueText: 'Overdue by 500 miles', isOverdue: true },
    ],
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ============================================================================
// COMPONENT
// ============================================================================

export function VehicleMaintenanceCard({
  vehicles = SAMPLE_VEHICLES,
  onBookNow,
  onSwipeStart,
  onSwipeEnd,
}: VehicleMaintenanceCardProps) {
  const swiperRef = useRef<Swiper<Vehicle>>(null);
  const [cardIndex, setCardIndex] = useState(0);

  const handleBookNow = (vehicleId: string, serviceId: string) => {
    if (onBookNow) {
      onBookNow(vehicleId, serviceId);
    }
    console.log(`Booking ${serviceId} for vehicle ${vehicleId}`);
  };

  const renderCard = (vehicle: Vehicle) => {
    if (!vehicle) return null;
    
    return (
      <View style={styles.card}>
        {/* Top Section - Vehicle Info with subtle gradient */}
        <View style={styles.topSection}>
          {/* Base gradient layer - solid */}
          <LinearGradient
            colors={['#FFFFFF', '#F8F9FB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.topSectionInner}>
            <View style={styles.vehicleInfoSection}>
              <View style={styles.vehicleTextInfo}>
                <Text weight="bold" size="xl" color="#1F2937" style={styles.vehicleName}>
                  {vehicle.name}
                </Text>
                <Text size="sm" color="#9CA3AF" style={styles.vin}>
                  {vehicle.vin}
                </Text>
              </View>
              <Image
                source={vehicle.localImage || { uri: vehicle.imageUrl }}
                style={styles.vehicleImage}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* Bottom Section - Maintenance List */}
        <View style={styles.bottomSection}>
          <View style={styles.maintenanceList}>
            {vehicle.maintenanceItems.map((item, index) => (
              <View 
                key={item.id} 
                style={[
                  styles.maintenanceItem,
                  index === vehicle.maintenanceItems.length - 1 && styles.maintenanceItemLast,
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
                  onPress={() => handleBookNow(vehicle.id, item.id)}
                  style={({ pressed }) => [
                    styles.bookButton,
                    pressed && styles.bookButtonPressed,
                  ]}
                >
                  <Text weight="medium" size="sm" color="#5299FE">
                    Book Now
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#6B7280" style={styles.sectionHeader}>
        Vehicle Maintenance
      </Text>

      {/* Deck Swiper with stacked card effect */}
      <View 
        style={styles.swiperWrapper}
        onTouchStart={() => onSwipeStart?.()}
        onTouchEnd={() => onSwipeEnd?.()}
        onTouchCancel={() => onSwipeEnd?.()}
      >
        {/* Second stacked card (furthest back) - more faded/blurred */}
        {vehicles.length > 2 && (
          <View style={styles.stackedCardSecond}>
            <BlurView
              intensity={20}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(235, 238, 243, 0.9)', 'rgba(229, 232, 240, 0.85)']}
              style={StyleSheet.absoluteFill}
            />
          </View>
        )}
        
        {/* First stacked card (middle) - slightly faded */}
        {vehicles.length > 1 && (
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
            {/* Subtle top highlight */}
            <View style={styles.stackedCardHighlight} />
          </View>
        )}
        
        {/* Actual Swiper */}
        <View style={styles.swiperContainer}>
          <Swiper
            ref={swiperRef}
            cards={vehicles}
            renderCard={renderCard}
            onSwiped={(index) => {
              setCardIndex(index + 1);
              onSwipeEnd?.();
            }}
            onSwipedAll={() => setCardIndex(0)}
            onSwipedAborted={() => onSwipeEnd?.()}
            onTapCard={() => {}}
            cardIndex={cardIndex}
            backgroundColor="transparent"
            stackSize={3}
            stackScale={0}
            stackSeparation={0}
            animateCardOpacity
            infinite
            keyExtractor={(card: Vehicle) => card.id}
            verticalSwipe={false}
            horizontalThreshold={SCREEN_WIDTH / 6}
            inputRotationRange={[-SCREEN_WIDTH / 2, 0, SCREEN_WIDTH / 2]}
            outputRotationRange={['-5deg', '0deg', '5deg']}
            swipeAnimationDuration={500}
            cardVerticalMargin={0}
            cardHorizontalMargin={0}
            containerStyle={styles.swiperInner}
            cardStyle={styles.swiperCard}
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
  stackedCardSecond: {
    position: 'absolute',
    top: -16,
    left: 35,
    right: 35,
    height: 50,
    borderRadius: 12,
    zIndex: -1,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(200, 205, 215, 0.5)',
    opacity: 0.7,
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
    height: 340,
    zIndex: 1,
  },
  swiperInner: {
    flex: 1,
  },
  swiperCard: {
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 320,
  },
  card: {
    borderRadius: 12,
    minHeight: 320,
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
    backgroundColor: '#f2f3f8',
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
  },
  vin: {
    letterSpacing: 0.5,
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
