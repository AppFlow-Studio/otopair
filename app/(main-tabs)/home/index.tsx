
// My console.log and label additions are for testing purposes only. Please remove before merging.

import { OtoPairIcon } from '@/components/icons/oto-pair';
import { Button, Text } from '@/components/shared-ui';
import { MoveRight } from 'lucide-react-native';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useOnboardingStore } from '@/stores/useOnboardingStore';

export default function HomeScreen() {
  console.log('car knowledge level: ', useOnboardingStore.getState().data.carKnowledgeLevel);
  console.log('last oil change: ', useOnboardingStore.getState().data.lastOilChange);
  console.log('brakes replaced: ', useOnboardingStore.getState().data.brakesReplaced);
  console.log('last inspection: ', useOnboardingStore.getState().data.lastInspection);
  console.log('last tire service: ', useOnboardingStore.getState().data.lastTireService);
  console.log('last battery replacement: ', useOnboardingStore.getState().data.lastBatteryReplacement);
  console.log('services 12 months: ', useOnboardingStore.getState().data.services12months);
  console.log('last oil mileage: ', useOnboardingStore.getState().data.lastOilMileage);
  console.log('push notifications granted: ', useOnboardingStore.getState().data.pushNotificationsGranted);
  console.log('location services granted: ', useOnboardingStore.getState().data.locationGranted);
  console.log('push notification status: ', useOnboardingStore.getState().data.pushNotificationStatus);
  console.log('location permission status: ', useOnboardingStore.getState().data.locationPermissionStatus);
  console.log('vehicle vin: ', useOnboardingStore.getState().data.vehicleVin);
  console.log('vehicle mileage: ', useOnboardingStore.getState().data.vehicleMileage);
  const data = useOnboardingStore((state) => state.data);

  const rows: { label: string; value: string }[] = [
    { label: 'Car knowledge level', value: String(data.carKnowledgeLevel ?? '—') },
    { label: 'Last oil change', value: String(data.lastOilChange ?? '—') },
    { label: 'Brakes replaced', value: String(data.brakesReplaced ?? '—') },
    { label: 'Last inspection', value: String(data.lastInspection ?? '—') },
    { label: 'Last tire service', value: String(data.lastTireService ?? '—') },
    { label: 'Last battery replacement', value: String(data.lastBatteryReplacement ?? '—') },
    { label: 'Services 12 months', value: data.services12months ? JSON.stringify(data.services12months) : '—' },
    { label: 'Last oil mileage', value: String(data.lastOilMileage ?? '—') },
    { label: 'Push notifications granted', value: String(data.pushNotificationsGranted) },
    { label: 'Location services granted', value: String(data.locationGranted) },
    { label: 'Push notification status', value: String(data.pushNotificationStatus ?? '—') },
    { label: 'Location permission status', value: String(data.locationPermissionStatus ?? '—') },
    { label: 'Vehicle vin', value: String(data.vehicleVin ?? '—') },
    { label: 'Vehicle mileage', value: String(data.vehicleMileage ?? '—') },
  ];


  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <OtoPairIcon />
        <Text weight="semiBold" size="2xl" style={styles.title}>
          OtoPair
        </Text>
        <Button variant='secondary'>Let’s Check Your Car Now <MoveRight size={16} color="#fff" /> </Button>
        <View style={styles.debugPanel}>
          {rows.map((row) => (
            <Text key={row.label} size="sm" style={styles.debugRow}>
              {row.label}: {row.value}
            </Text>
          ))}
        </View>
      </View>
    </View >
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    gap: 16,
  },
  title: {
    color: '#141C24',
    letterSpacing: 0.5,
  },
  debugPanel: {
    marginTop: 24,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#f4f6f8',
    width: '100%',
    gap: 6,
  },
  debugRow: {
    color: '#141C24',
  },
});
