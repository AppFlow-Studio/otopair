/**
 * home
 *
 * PURPOSE: Main landing screen for authenticated users, displaying setup progress and quick actions.
 *
 * USED IN: app/(main-tabs)/_layout.tsx
 *
 * PROPS: None
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

// TODO: console.log and label additions are for testing purposes only and can be removed if necessary.

import { OtoPairIcon } from '@/components/icons/oto-pair';
import { Button, Text, BrandColors, FontFamily, FontSize, Spacing } from '@/components/shared-ui';
import { MoveRight, CheckCircle2, UserPlus, User, Car, CreditCard, ChevronRight } from 'lucide-react-native';
import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Modal, Pressable, Animated, useWindowDimensions, TouchableOpacity } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';

import { useOnboardingStore } from '@/stores/useOnboardingStore';

export default function HomeScreen() {
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
  console.log('vehicle make: ', useOnboardingStore.getState().data.vehicleMake);
  console.log('vehicle model: ', useOnboardingStore.getState().data.vehicleModel);
  console.log('vehicle year: ', useOnboardingStore.getState().data.vehicleYear);
  console.log('phone number: ', useOnboardingStore.getState().data.phoneNumber);
  console.log('first name: ', useOnboardingStore.getState().data.firstName);
  console.log('last name: ', useOnboardingStore.getState().data.lastName);
  console.log('alias: ', useOnboardingStore.getState().data.alias);
  console.log('username: ', useOnboardingStore.getState().data.phoneNumber);
  console.log('car knowledge level: ', useOnboardingStore.getState().data.carKnowledgeLevel);
  console.log('user intentions: ', useOnboardingStore.getState().data.userIntentions);
  console.log('stress note: ', useOnboardingStore.getState().data.carStressNote);
  console.log('car usage: ', useOnboardingStore.getState().data.carUsage);
  console.log('service priorities: ', useOnboardingStore.getState().data.servicePriorities);
  console.log('decision helper: ', useOnboardingStore.getState().data.decisionHelper);
  console.log('maintenance tracking: ', useOnboardingStore.getState().data.maintenanceTracking);
  console.log('monthly mileage: ', useOnboardingStore.getState().data.monthlyMileage);
  console.log('shop type: ', useOnboardingStore.getState().data.shopType);
  console.log('why new option: ', useOnboardingStore.getState().data.whyNewOption);
  console.log('terminology comfort: ', useOnboardingStore.getState().data.carTerminologyComfort);

  console.log('is tell us about yourself complete: ', useOnboardingStore.getState().data.isTellUsAboutYourselfComplete);
  const { data } = useOnboardingStore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 800;
  const progressCircleScale = isSmallScreen ? 1.15 : 1.28;
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const currentSlidePosition = useRef(height);

  // Track the actual position of slideAnim
  useEffect(() => {
    const listenerId = slideAnim.addListener(({ value }) => {
      currentSlidePosition.current = value;
    });
    return () => {
      slideAnim.removeListener(listenerId);
    };
  }, [slideAnim]);

  // Snap points
  const COLLAPSED_POSITION = height * 0.15;
  const DISMISSED_POSITION = height;

  // Bottom sheet animation
  useEffect(() => {
    if (showBottomSheet) {
      slideAnim.setValue(height);
      panY.setValue(0);
      requestAnimationFrame(() => {
        Animated.spring(slideAnim, {
          toValue: COLLAPSED_POSITION,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      });
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showBottomSheet, slideAnim, height, COLLAPSED_POSITION]);

  // Only track downward gestures for dismissal
  const handleGestureEvent = (event: any) => {
    const { translationY } = event.nativeEvent;
    panY.setValue(Math.max(0, translationY));
  };

  const handleGestureStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;
      const clampedTranslation = Math.max(0, translationY);
      const currentVisualPosition = currentSlidePosition.current + clampedTranslation;

      if (
        velocityY > 500 ||
        (clampedTranslation > 100 && currentVisualPosition > COLLAPSED_POSITION + 50)
      ) {
        slideAnim.setValue(currentVisualPosition);
        panY.setValue(0);
        handleCloseSheet();
      } else {
        slideAnim.setValue(currentVisualPosition);
        panY.setValue(0);
        Animated.spring(slideAnim, {
          toValue: COLLAPSED_POSITION,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      }
    }
  };

  const translateY = Animated.add(slideAnim, panY);

  const handleCloseSheet = () => {
    setShowBottomSheet(false);
  };

  // Determine completion status
  const hasPhoneNumber = !!data.phoneNumber?.trim();
  const hasNames = !!data.firstName?.trim() && !!data.lastName?.trim();
  const isCreateAccountComplete = hasPhoneNumber && hasNames;
  const isTellUsAboutYourselfComplete = data.isTellUsAboutYourselfComplete;
  const isAddYourCarComplete = data.vehicleMake !== null && data.vehicleModel !== null && data.vehicleYear !== null;
  const isPaymentMethodComplete = false; // TODO: Add payment method tracking

  const setupItems = [
    {
      id: 'create_account',
      title: 'Create account',
      subtitle: 'Get access to all of our products',
      isComplete: isCreateAccountComplete,
      icon: UserPlus,
      onPress: undefined, // No action; already completed at this point
    },
    {
      id: 'tell_us_about_yourself',
      title: 'Tell us about yourself',
      subtitle: 'Help us personalize your experience',
      isComplete: isTellUsAboutYourselfComplete,
      icon: User,
      onPress: () => {
        handleCloseSheet();
        router.push('/(tell-us-about)/flow');
      },
    },
    {
      id: 'add_your_car',
      title: 'Add your car',
      subtitle: 'Track maintenance and get recommendations',
      isComplete: isAddYourCarComplete,
      icon: Car,
      onPress: () => {
        handleCloseSheet();
        // TODO: Navigate to add car screen
      },
    },
    {
      id: 'payment_method',
      title: 'Set up payment method',
      subtitle: 'Pay for services and subscriptions',
      isComplete: isPaymentMethodComplete,
      icon: CreditCard,
      onPress: () => {
        handleCloseSheet();
        router.push('/payment-methods');
      },
    },
  ];

  const completedCount = setupItems.filter(item => item.isComplete).length;

  const rows: { label: string; value: string }[] = [
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
    { label: 'Vehicle make', value: String(data.vehicleMake ?? '—') },
    { label: 'Vehicle model', value: String(data.vehicleModel ?? '—') },
    { label: 'Vehicle year', value: String(data.vehicleYear ?? '—') },
    { label: 'Phone number', value: String(data.phoneNumber ?? '—') },
    { label: 'First name', value: String(data.firstName ?? '—') },
    { label: 'Last name', value: String(data.lastName ?? '—') },
    { label: 'Alias', value: String(data.alias ?? '—') },
    { label: 'Username', value: String(data.username) },
    { label: 'Car knowledge level', value: String(data.carKnowledgeLevel ?? '—') },
    { label: 'User intentions', value: data.userIntentions ? JSON.stringify(data.userIntentions) : '—' },
    { label: 'Car stress note', value: String(data.carStressNote ?? '—') },
    { label: 'Car usage', value: String(data.carUsage ?? '—') },
    { label: 'Monthly mileage', value: String(data.monthlyMileage ?? '—') },
    { label: 'Service priorities', value: data.servicePriorities ? JSON.stringify(data.servicePriorities) : '—' },
    { label: 'Decision helper', value: String(data.decisionHelper ?? '—') },
    { label: 'Maintenance tracking', value: String(data.maintenanceTracking ?? '—') },
    { label: 'Shop type', value: String(data.shopType ?? '—') },
    { label: 'Why new option', value: data.whyNewOption ? JSON.stringify(data.whyNewOption) : '—' },
    { label: 'Repair quote needs', value: data.repairQuoteNeeds ? JSON.stringify(data.repairQuoteNeeds) : '—' },
    { label: 'Is tell us about yourself complete', value: String(data.isTellUsAboutYourselfComplete) },
  ];


  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <OtoPairIcon />
        <Text weight="semiBold" size="2xl" style={styles.title}>
          OtoPair
        </Text>
        <Button
          variant='secondary'
          onPress={() => router.push('/payment-methods')}
        >
          Enter card info <MoveRight size={16} color="#fff" />
        </Button>
        <Button
          variant='secondary'
          onPress={() => setShowBottomSheet(true)}
        >
          Finish setting up <MoveRight size={16} color="#fff" />
        </Button>
        <View style={styles.debugPanel}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 60 }]}
            showsVerticalScrollIndicator={true}
          >
            {rows.map((row) => (
              <Text key={row.label} size="sm" style={styles.debugRow}>
                {row.label}: {row.value}
              </Text>
            ))}
          </ScrollView>
        </View>
      </View>

      {/* Setup Bottom Sheet */}
      <Modal
        visible={showBottomSheet}
        transparent
        animationType="none"
        onRequestClose={handleCloseSheet}
      >
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.bottomSheetBackdrop}>
            {/* Backdrop press target */}
            <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseSheet} />

            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  transform: [{ translateY: translateY }],
                  height: height,
                  paddingTop: insets.top,
                  paddingBottom: insets.bottom + (isSmallScreen ? Spacing['3xl'] : Spacing['2xl']),
                },
              ]}
            >
              {/* Draggable handle area */}
              <PanGestureHandler
                onGestureEvent={handleGestureEvent}
                onHandlerStateChange={handleGestureStateChange}
                activeOffsetY={[-9999, 10]}
              >
                <Animated.View>
                  <View style={styles.handleContainer}>
                    <View style={styles.bottomSheetHandle} />
                  </View>
                </Animated.View>
              </PanGestureHandler>

              <View style={[
                styles.bottomSheetContent,
                isSmallScreen && { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
                { paddingBottom: isSmallScreen ? Spacing.lg : Spacing['2xl'] }
              ]}>
                {/* Progress Indicator */}
                <View style={styles.progressRow}>
                  <View style={[
                    styles.progressContainer,
                    isSmallScreen && { marginBottom: Spacing.md }
                  ]}>
                    <View style={[
                      styles.progressCircleContainer,
                      isSmallScreen && { width: 50, height: 50 },
                      { transform: [{ scale: progressCircleScale }] }
                    ]}>
                      <Svg
                        width={isSmallScreen ? 50 : 60}
                        height={isSmallScreen ? 50 : 60}
                        style={styles.progressSvg}
                      >
                        {/* Background circle */}
                        <Circle
                          cx={isSmallScreen ? 25 : 30}
                          cy={isSmallScreen ? 25 : 30}
                          r={isSmallScreen ? 22 : 26}
                          stroke="#374151"
                          strokeWidth={isSmallScreen ? 3 : 4}
                          fill="transparent"
                        />
                        {/* Progress arc */}
                        {completedCount > 0 && (() => {
                          const size = isSmallScreen ? 50 : 60;
                          const center = size / 2;
                          const radius = isSmallScreen ? 22 : 26;
                          const progress = completedCount / setupItems.length;
                          const circumference = 2 * Math.PI * radius;
                          const strokeDasharray = circumference;
                          const strokeDashoffset = circumference * (1 - progress);

                          return (
                            <Circle
                              cx={center}
                              cy={center}
                              r={radius}
                              stroke={BrandColors.secondary}
                              strokeWidth={isSmallScreen ? 3 : 4}
                              fill="transparent"
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              strokeLinecap="round"
                              transform={`rotate(-90 ${center} ${center})`}
                            />
                          );
                        })()}
                      </Svg>
                      <View style={styles.progressTextContainer}>
                        <Text style={[
                          styles.progressText,
                          isSmallScreen && { fontSize: FontSize.md }
                        ]}>
                          {completedCount}/{setupItems.length}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {/* Title and Subtitle */}
                <Text style={[
                  styles.bottomSheetTitle,
                  isSmallScreen && { fontSize: FontSize['2xl'], paddingBottom: Spacing.xs }
                ]}>
                  Finish setting up
                </Text>
                <Text style={[
                  styles.bottomSheetSubtitle,
                  isSmallScreen && { fontSize: FontSize.sm, lineHeight: 18, marginBottom: Spacing.md }
                ]}>
                  Complete your profile to unlock all features and get the most out of Otopair.
                </Text>

                {/* Checklist */}
                <View style={[
                  styles.checklistContainer,
                  isSmallScreen && { gap: Spacing.sm }
                ]}>
                  {setupItems.map((item) => {
                    const Icon = item.icon;
                    const isDisabled = !item.onPress;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[
                          styles.checklistItem,
                          isSmallScreen && { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md }
                        ]}
                        onPress={item.onPress}
                        activeOpacity={isDisabled ? 1 : 0.7}
                        disabled={isDisabled}
                      >
                        <View style={styles.checklistItemLeft}>
                          {item.isComplete ? (
                            <CheckCircle2
                              size={isSmallScreen ? 20 : 24}
                              color={BrandColors.secondary}
                              fill={BrandColors.secondary}
                            />
                          ) : (
                            <Icon size={isSmallScreen ? 20 : 24} color={BrandColors.white} />
                          )}
                          <View style={styles.checklistItemText}>
                            <Text style={[
                              styles.checklistItemTitle,
                              isSmallScreen && { fontSize: FontSize.md }
                            ]}>
                              {item.title}
                            </Text>
                            <Text style={[
                              styles.checklistItemSubtitle,
                              isSmallScreen && { fontSize: FontSize.xs }
                            ]}>
                              {item.subtitle}
                            </Text>
                          </View>
                        </View>
                        {!item.isComplete && !isDisabled && (
                          <ChevronRight size={isSmallScreen ? 16 : 20} color={BrandColors.white} opacity={0.5} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </Animated.View>
          </View>
        </GestureHandlerRootView>
      </Modal>
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
    height: 400,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    gap: 6,
    paddingBottom: 6,
  },
  debugRow: {
    color: '#141C24',
  },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handleContainer: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#6B7280',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  bottomSheetContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.lg,
  },
  progressContainer: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  progressCircleContainer: {
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  progressSvg: {
    position: 'absolute',
  },
  progressTextContainer: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.bold,
    color: BrandColors.white,
  },
  bottomSheetTitle: {
    fontSize: FontSize['3xl'],
    fontFamily: FontFamily.bold,
    color: BrandColors.white,
    paddingBottom: Spacing.sm,
    textAlign: 'center',
  },
  bottomSheetSubtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.7,
    marginBottom: Spacing['2xl'],
    textAlign: 'center',
    lineHeight: 22,
  },
  checklistContainer: {
    gap: Spacing.md,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  checklistItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: Spacing.md,
  },
  checklistItemText: {
    flex: 1,
  },
  checklistItemTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.white,
    marginBottom: Spacing.xs / 2,
  },
  checklistItemSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.6,
  },
  progressRow: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    minHeight: 60,
  },
});
