// 1. React & React Native
import React, { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
// (none)

// 3. Shared UI
import { Text } from '@/components/shared-ui';

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
  const [refreshing, setRefreshing] = useState(false);
  const [activeVehicleIndex, setActiveVehicleIndex] = useState(0);

  // Vehicle state - managed locally for toggle functionality
  const [vehicles, setVehicles] = useState<Vehicle[]>([
    {
      id: 'vehicle-1',
      year: 2019,
      make: 'Lexus',
      model: 'RX 350',
      vin: '1N6AD06W98C406256',
      mileage: 52300,
      nextServiceDate: 'Sep 15, 2024',
      isDefault: true,
      imageSource: require('@/assets/images/lexus.png'),
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
    },
  ]);

  // Get current vehicle and its data
  const activeVehicle = vehicles[activeVehicleIndex];
  const maintenanceItems = maintenanceByVehicle[activeVehicle?.id] || [];
  const serviceRecords = serviceHistoryByVehicle[activeVehicle?.id] || [];

  // Handle default toggle - set one as default, untoggle others
  const handleToggleDefault = (vehicleId: string, isDefault: boolean) => {
    setVehicles((prev) =>
      prev.map((v) => ({
        ...v,
        isDefault: v.id === vehicleId ? isDefault : false,
      }))
    );
  };

  const handleRefresh = () => {
    setRefreshing(true);
    // TODO: Fetch latest maintenance data from API/store
    setTimeout(() => setRefreshing(false), 800);
  };

  return (
    <View style={styles.container}>
      {/* Full Page Scroll - same as home page */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 12 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#5299FE" />
        }
      >
        {/* Header - now inside ScrollView */}
        <View style={styles.header}>
          <Text weight="semiBold" size="xl" color="#141C24">
            My Car
          </Text>
        </View>

        {/* Car Carousel */}
        <CarCarousel
          vehicles={vehicles}
          onActiveIndexChange={setActiveVehicleIndex}
          onEditMileage={(id) => {
            // TODO: Implement mileage edit flow - open modal or inline edit
          }}
          onToggleDefault={handleToggleDefault}
        />

        {/* Maintenance Tracker Section */}
        <MaintenanceTracker
          items={maintenanceItems}
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#dde2ee',
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
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
});
