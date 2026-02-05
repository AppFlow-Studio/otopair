// 1. React & React Native
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// 4. Flow-specific components
import CarCarousel, { Vehicle } from '@/components/cars/CarCarousel';
import LoyaltyPoints from '@/components/cars/LoyaltyPoints';
import MaintenanceTracker, { MaintenanceItem } from '@/components/cars/MaintenanceTracker';
import ServiceHistory, { ServiceRecord } from '@/components/cars/ServiceHistory';

// ============================================================================
// VEHICLE-SPECIFIC DATA
// ============================================================================

// Maintenance data per vehicle
const maintenanceByVehicle: Record<string, MaintenanceItem[]> = {
  'vehicle-1': [
    { id: 'oil-change', serviceName: 'Oil Change', description: 'Last oil change', detail: 'Mar 2025', status: 'due_soon' },
    { id: 'inspection', serviceName: 'NY State Inspection', description: 'Inspection valid until', detail: 'Aug 2025', status: 'on_time' },
    { id: 'brakes', serviceName: 'Brakes', description: 'Last brake service', detail: 'Dec 2024', status: 'overdue' },
    { id: 'tires', serviceName: 'Tires', description: 'Last tire service', detail: 'Unknown', status: 'unknown' },
    { id: 'battery', serviceName: 'Battery', description: 'Last battery replacement', detail: 'Apr 2025', status: 'on_time' },
  ],
  'vehicle-2': [
    { id: 'oil-change', serviceName: 'Oil Change', description: 'Last oil change', detail: 'Oct 2024', status: 'on_time' },
    { id: 'inspection', serviceName: 'NY State Inspection', description: 'Inspection valid until', detail: 'Dec 2025', status: 'on_time' },
    { id: 'brakes', serviceName: 'Brakes', description: 'Last brake service', detail: 'Sep 2024', status: 'on_time' },
    { id: 'transmission', serviceName: 'Transmission', description: 'Last service', detail: 'Aug 2024', status: 'due_soon' },
    { id: 'coolant', serviceName: 'Coolant Flush', description: 'Last coolant flush', detail: 'Unknown', status: 'unknown' },
  ],
};

// Service history per vehicle
const serviceHistoryByVehicle: Record<string, ServiceRecord[]> = {
  'vehicle-1': [
    { id: 'service-1', date: 'Sep 3, 2025', facilityName: "Joe's Auto Shop", services: ['Brake Service', 'Oil Change', 'Filter Change'], totalCost: 240 },
    { id: 'service-2', date: 'Aug 15, 2025', facilityName: 'Midtown Mechanic', services: ['Oil Change'], totalCost: 95 },
    { id: 'service-3', date: 'Jul 1, 2025', facilityName: 'Quick Fix Motors', services: ['NY Inspection'], totalCost: 37 },
  ],
  'vehicle-2': [
    { id: 'service-4', date: 'Oct 10, 2024', facilityName: 'Lamborghini Manhattan', services: ['Annual Service', 'Oil Change', 'Brake Inspection'], totalCost: 1850 },
    { id: 'service-5', date: 'Sep 5, 2024', facilityName: 'Lamborghini Manhattan', services: ['Ceramic Coating', 'Detail'], totalCost: 2200 },
  ],
};

export default function CarsHomeScreen() {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const [refreshing, setRefreshing] = useState(false);
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);

  // Vehicle state - managed locally for toggle functionality
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 'vehicle-1',
      year: 2022,
      make: 'Lexus',
      model: 'RX 350',
      vin: '1N6AD06W98C406256',
      mileage: 20843,
      nextServiceDate: 'Sep 15, 2024',
      isDefault: true,
      imageSource: require('@/assets/images/lexus.png'),
      logoSource: require('@/assets/images/LexusLogo.png'),
      condition: 82,
      nextUnlock: 'Next unlock: Free Oil Change (320 miles)',
      gradientColors: ['#9a9cc0', '#e7e3fd', '#e0dcf4', '#f1ecfe'], // Purple gradient with cutoff
    },
    {
      id: 'vehicle-2',
      year: 2023,
      make: 'Lamborghini',
      model: 'Aventador S',
      vin: 'ZHWUC1ZF8KLA06789',
      mileage: 8200,
      nextServiceDate: 'Oct 20, 2024',
      isDefault: false,
      imageSource: require('@/assets/images/bluelambo.png'),
      logoSource: require('@/assets/images/LamboLogo.png'),
      condition: 94,
      nextUnlock: 'Next unlock: Premium Detail (1,800 miles)',
      gradientColors: ['#5090d8', '#c0daf8', '#b8d4f8', '#d8ecff'], // Blue gradient with horizontal overlay
    },
  ]);

  // Memoize current vehicle and its data to prevent unnecessary re-renders
  const activeVehicle = useMemo(() => vehicles[activeVehicleIndex], [vehicles, activeVehicleIndex]);
  const maintenanceItems = useMemo(() => maintenanceByVehicle[activeVehicle?.id] || [], [activeVehicle?.id]);
  const serviceRecords = useMemo(() => serviceHistoryByVehicle[activeVehicle?.id] || [], [activeVehicle?.id]);
  
  // Pre-render all gradients - just animate opacity, NO re-renders
  // Lexus is index 0, Lambo is index 1
  const lamboOpacity = useRef(new Animated.Value(0)).current;
  
  useEffect(() => {
    // Animate opacity based on which car is active - no state updates, no re-renders
    Animated.timing(lamboOpacity, {
      toValue: activeVehicleIndex === 1 ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [activeVehicleIndex]);

  // Handle default toggle - set one as default, untoggle others
  const handleToggleDefault = useCallback((vehicleId: string, isDefault: boolean) => {
    setVehicles((prev) =>
      prev.map((v) => ({
        ...v,
        isDefault: v.id === vehicleId ? isDefault : false,
      }))
    );
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    // TODO: Fetch latest maintenance data from API/store
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  return (
    <View style={styles.container}>

      {/* Full Page Scroll */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#FFFFFF" />
        }
      >
        {/* Scrolling Gradient - PRE-RENDERED for both cars, only opacity animates */}
        <View style={styles.scrollingGradientContainer} pointerEvents="none">
          {/* LEXUS gradient - always rendered, fades out when Lambo selected */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.subtract(1, lamboOpacity) }]}>
            <LinearGradient
              colors={['#9a9cc0', '#e7e3fd', '#e0dcf4', '#f1ecfe']}
              locations={[0, 0.33, 0.33, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0.35)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.1)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
          
          {/* LAMBO gradient - always rendered, fades in when Lambo selected */}
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: lamboOpacity }]}>
            <LinearGradient
              colors={['#5090d8', '#c0daf8', '#b8d4f8', '#d8ecff']}
              locations={[0, 0.33, 0.335, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.12)', 'rgba(255, 255, 255, 0.3)']}
              locations={[0, 0.5, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(180, 210, 255, 0.15)', 'rgba(255, 255, 255, 0)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.5, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            TOP SECTION: Vehicle Carousel
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.topSection}>
        <CarCarousel
          vehicles={vehicles}
          onActiveIndexChange={setActiveVehicleIndex}
          onEditMileage={(id) => {
            // TODO: Implement mileage edit flow - open modal or inline edit
          }}
          onToggleDefault={handleToggleDefault}
          isFocused={isFocused}
        />
        </View>

        {/* ═══════════════════════════════════════════════════════════════════
            BOTTOM SECTION: Maintenance, Service History, Loyalty
        ═══════════════════════════════════════════════════════════════════ */}
        <View style={styles.bottomSection}>
        {/* Maintenance Tracker Section */}
        <MaintenanceTracker
          items={maintenanceItems}
          vehicleCondition={activeVehicle?.condition}
          onBookNow={(id) => {
            // TODO: Navigate to booking flow with selected service
            console.log('Book Now for service', id);
          }}
          onAddInfo={(id) => {
            // TODO: Navigate to maintenance history form
            console.log('Add Info for service', id);
          }}
        />

        {/* Service History Section */}
        <ServiceHistory
          records={serviceRecords}
          onAddNotes={(id) => {
            // TODO: Open notes modal/screen for this service record
            console.log('Add Notes for record', id);
          }}
          onDownloadReceipt={(id) => {
            // TODO: Download PDF receipt for this service record
            console.log('Download Receipt for record', id);
          }}
        />

        {/* Loyalty Points Section */}
        <LoyaltyPoints
          totalPoints={1240}
          currentTier="Gold Member"
          currentPoints={240}
          pointsToNextTier={260}
          nextTier="Platinum"
          maxPoints={500}
          onViewFullPage={() => {
            // TODO: Navigate to full loyalty page
            console.log('View Full Loyalty Page');
          }}
        />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f1ecfe', // Fallback
  },
  scrollingGradientContainer: {
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.5, // Extend above to cover when scrolling down
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 2.5, // Much taller to cover entire scroll content
    zIndex: 0,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 0,
    paddingBottom: 120,
  },
  // ═══════════════ SECTION CONTAINERS ═══════════════
  topSection: {
    zIndex: 1,
  },
  bottomSection: {
    zIndex: 1,
  },
});
