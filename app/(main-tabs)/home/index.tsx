
// My console.log and label additions are for testing purposes only. Please remove before merging.

import { OtoPairIcon } from '@/components/icons/oto-pair';
import { Button, Text, BrandColors, FontFamily, FontSize, Spacing } from '@/components/shared-ui';
import { OnboardingBackButton } from '@/components/onboarding/OnboardingBackButton';
import { MoveRight, CheckCircle2, UserPlus, User, Car, CreditCard, ChevronRight } from 'lucide-react-native';
import React, { useState, useRef, useEffect } from 'react';
import { ScrollView, StyleSheet, View, Modal, Pressable, Animated, useWindowDimensions, TouchableOpacity, TextInput } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  GestureHandlerRootView,
  PanGestureHandler,
  State,
} from 'react-native-gesture-handler';

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
  console.log('vehicle make: ', useOnboardingStore.getState().data.vehicleMake);
  console.log('vehicle model: ', useOnboardingStore.getState().data.vehicleModel);
  console.log('vehicle year: ', useOnboardingStore.getState().data.vehicleYear);
  console.log('phone number: ', useOnboardingStore.getState().data.phoneNumber);
  console.log('first name: ', useOnboardingStore.getState().data.firstName);
  console.log('last name: ', useOnboardingStore.getState().data.lastName);
  console.log('alias: ', useOnboardingStore.getState().data.alias);
  console.log('user intentions: ', useOnboardingStore.getState().data.userIntentions);
  const { data, updateData } = useOnboardingStore();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const isSmallScreen = height < 800;
  // Keep the answers box comfortably above the bottom edge on all devices.
  const optionsScrollMaxHeight = Math.round(height * (isSmallScreen ? 0.22 : 0.28));
  // Make the progress circle visually bigger without affecting layout (transform doesn't participate in layout)
  // Make it obviously larger; still doesn't affect layout because it's a transform.
  const progressCircleScale = isSmallScreen ? 1.15 : 1.28;
  const [questionStep, setQuestionStep] = useState<
    'none' | 'experience' | 'carUsage' | 'servicePriorities' | 'decisionHelper' | 'stressNote'
  >('none');
  const [stressNote, setStressNote] = useState('');
  const [servicePrioritySelection, setServicePrioritySelection] = useState<string[]>(
    data.servicePriorities ?? []
  );
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
  // "Create account" is complete when phone + first/last name are populated (ignore empty strings)
  const hasPhoneNumber = !!data.phoneNumber?.trim();
  const hasNames = !!data.firstName?.trim() && !!data.lastName?.trim();
  const isCreateAccountComplete = hasPhoneNumber && hasNames;
  const isTellUsAboutYourselfComplete = data.isTellUsAboutYourselfComplete;
  const isAddYourCarComplete = data.vehicleMake !== null && data.vehicleModel !== null && data.vehicleYear !== null;
  const isPaymentMethodComplete = false; // TODO: Add payment method tracking

  const experienceOptions = [
    { id: 1, label: '🚗 Level 1: I just drive it' },
    { id: 2, label: '🔧 Level 2: I know the basics' },
    { id: 3, label: "🏎️ Level 3: I'm pretty hands-on" },
    { id: 4, label: '🔬 Level 4: I know my stuff' },
  ] as const;

  const handleSelectExperience = (level: 1 | 2 | 3 | 4) => {
    updateData({ carKnowledgeLevel: level });
    // Only Level 1 gets an immediate follow-up question for now
    if (level === 1) {
      setQuestionStep('carUsage');
    } else {
      setQuestionStep('servicePriorities');
    }
  };

  const carUsageOptions = [
    '🎉 Rarely (special occasions)',
    '🛒 Weekend errands only',
    '🚙 Daily commute to work/school',
    '🗺️ Frequent long trips',
    '🚕 Uber/Lyft/delivery driving',
  ] as const;

  const handleSelectCarUsage = (value: (typeof carUsageOptions)[number]) => {
    updateData({ carUsage: value });
    setQuestionStep('servicePriorities');
  };

  const servicePriorityOptions = [
    { id: '💰 Getting the best price', label: '💰 Getting the best price' },
    { id: '⏰ Quick turnaround time', label: '⏰ Quick turnaround time' },
    { id: '🏆 High-quality service', label: '🏆 High-quality service' },
    { id: '📍 Convenience/location', label: '📍 Convenience/location' },
    { id: '🧾 Transparent pricing/no surprises', label: '🧾 Transparent pricing/no surprises' },
    { id: '⭐ Trusted reviews/reputation', label: '⭐ Trusted reviews/reputation' },
  ] as const;

  useEffect(() => {
    if (questionStep === 'servicePriorities') {
      setServicePrioritySelection(data.servicePriorities ?? []);
    }
  }, [questionStep, data.servicePriorities]);

  const handleToggleServicePriority = (id: string) => {
    setServicePrioritySelection((prev) => {
      const isSelected = prev.includes(id);
      if (isSelected) {
        const next = prev.filter((x) => x !== id);
        updateData({ servicePriorities: next.length ? next : null });
        return next;
      }
      if (prev.length >= 3) return prev;
      const next = [...prev, id];
      if (next.length === 3) {
        updateData({ servicePriorities: next });
        setQuestionStep('decisionHelper');
      } else {
        updateData({ servicePriorities: next });
      }
      return next;
    });
  };

  const decisionHelperOptions = [
    '🧠 I handle it myself',
    '👨‍👩‍👧‍👦 Family member/friend who knows cars',
    '🗣️ I ask the mechanic to explain everything',
    "🤝 I just trust the mechanic's recommendation",
  ] as const;

  const handleSelectDecisionHelper = (value: (typeof decisionHelperOptions)[number]) => {
    updateData({ decisionHelper: value });
    setQuestionStep('stressNote');
  };

  const handleFinishQuestionnaire = () => {
    // Snap back to the collapsed position and return to checklist
    updateData({ isTellUsAboutYourselfComplete: true, carStressNote: stressNote });
    slideAnim.setValue(COLLAPSED_POSITION);
    panY.setValue(0);
    setQuestionStep('none');
  };

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
      onPress: isTellUsAboutYourselfComplete
        ? undefined
        : () => {
            setQuestionStep('experience');
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
    { label: 'Car knowledge level', value: String(data.carKnowledgeLevel ?? '—') },
    { label: 'User intentions', value: data.userIntentions ? JSON.stringify(data.userIntentions) : '—' },
    { label: 'Car stress note', value: String(data.carStressNote ?? '—') },
    { label: 'Car usage', value: String(data.carUsage ?? '—') },
    { label: 'Service priorities', value: data.servicePriorities ? JSON.stringify(data.servicePriorities) : '—' },
    { label: 'Decision helper', value: String(data.decisionHelper ?? '—') },
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
            {/* Backdrop press target (separate from sheet so drags inside content don't close it) */}
            <Pressable style={StyleSheet.absoluteFill} onPress={handleCloseSheet} />

            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  transform: [{ translateY: translateY }],
                  height: height,
                  paddingTop: insets.top,
                  // Extra breathing room so content never feels clipped by the system gesture bar
                  paddingBottom: insets.bottom + (isSmallScreen ? Spacing['3xl'] : Spacing['2xl']),
                },
              ]}
            >
              {/* Only the handle area is draggable (keeps the content scrollable) */}
              <PanGestureHandler
                onGestureEvent={handleGestureEvent}
                onHandlerStateChange={handleGestureStateChange}
                // Only activate for a real downward drag (prevents accidental dismiss while scrolling)
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
                      {questionStep !== 'none' && (
                        <View style={styles.progressBackButton}>
                          <OnboardingBackButton
                            onBack={() => {
                              if (questionStep === 'decisionHelper') {
                                setQuestionStep('servicePriorities');
                                return;
                              }
                              if (questionStep === 'servicePriorities') {
                                setQuestionStep(data.carKnowledgeLevel === 1 ? 'carUsage' : 'experience');
                                return;
                              }
                              if (questionStep === 'carUsage') {
                                setQuestionStep('experience');
                                return;
                              }
                              setQuestionStep('none');
                            }}
                            alwaysShow
                          />
                        </View>
                      )}
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
                      Complete your profile to unlock all features and get the most out of Otopair
                    </Text>

                    {/* Checklist or Experience Questionnaire */}
                    {questionStep === 'none' ? (
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
                    ) : questionStep === 'experience' ? (
                      <View style={styles.questionCard}>
                        <Text style={styles.questionTitle}>How would you explain your experience with cars in general?</Text>
                        <ScrollView
                          style={[styles.questionOptionsScroll, { maxHeight: optionsScrollMaxHeight }]}
                          contentContainerStyle={[styles.questionOptions, { paddingBottom: Spacing.lg }]}
                          showsVerticalScrollIndicator={false}
                          bounces={false}
                        >
                          {experienceOptions.map((option) => {
                            const isSelected = data.carKnowledgeLevel === option.id;
                            return (
                              <TouchableOpacity
                                key={option.id}
                                style={[
                                  styles.questionOption,
                                  isSelected && styles.questionOptionSelected,
                                  isSmallScreen && styles.questionOptionCompact
                                ]}
                                onPress={() => handleSelectExperience(option.id)}
                                activeOpacity={0.8}
                              >
                                <Text style={[
                                  styles.questionOptionText,
                                  isSelected && styles.questionOptionTextSelected,
                                  isSmallScreen && { fontSize: FontSize.sm }
                                ]}>
                                  {option.label}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : questionStep === 'carUsage' ? (
                      <View style={styles.questionCard}>
                        <Text style={styles.questionTitle}>How do you typically use your car?</Text>
                        <ScrollView
                          style={[styles.questionOptionsScroll, { maxHeight: optionsScrollMaxHeight }]}
                          contentContainerStyle={[styles.questionOptions, { paddingBottom: Spacing.lg }]}
                          showsVerticalScrollIndicator={false}
                          bounces={false}
                        >
                          {carUsageOptions.map((option) => {
                            const isSelected = data.carUsage === option;
                            return (
                              <TouchableOpacity
                                key={option}
                                style={[
                                  styles.questionOption,
                                  isSelected && styles.questionOptionSelected,
                                  isSmallScreen && styles.questionOptionCompact
                                ]}
                                onPress={() => handleSelectCarUsage(option)}
                                activeOpacity={0.8}
                              >
                                <Text style={[
                                  styles.questionOptionText,
                                  isSelected && styles.questionOptionTextSelected,
                                  isSmallScreen && { fontSize: FontSize.sm }
                                ]}>
                                  {option}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : questionStep === 'decisionHelper' ? (
                      <View style={styles.questionCard}>
                        <Text style={styles.questionTitle}>Who usually helps you with car decisions?</Text>
                        <ScrollView
                          style={[styles.questionOptionsScroll, { maxHeight: optionsScrollMaxHeight }]}
                          contentContainerStyle={[styles.questionOptions, { paddingBottom: Spacing.lg }]}
                          showsVerticalScrollIndicator={false}
                          bounces={false}
                        >
                          {decisionHelperOptions.map((option) => {
                            const isSelected = data.decisionHelper === option;
                            return (
                              <TouchableOpacity
                                key={option}
                                style={[
                                  styles.questionOption,
                                  isSelected && styles.questionOptionSelected,
                                  isSmallScreen && styles.questionOptionCompact
                                ]}
                                onPress={() => handleSelectDecisionHelper(option)}
                                activeOpacity={0.8}
                              >
                                <Text style={[
                                  styles.questionOptionText,
                                  isSelected && styles.questionOptionTextSelected,
                                  isSmallScreen && { fontSize: FontSize.sm }
                                ]}>
                                  {option}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    ) : questionStep === 'stressNote' ? (
                      <View style={styles.questionCard}>
                        <Text style={styles.questionTitle}>
                          Optional: Is there anything that makes getting your car serviced stressful?
                        </Text>
                        <ScrollView
                          style={[styles.questionOptionsScroll, { maxHeight: optionsScrollMaxHeight }]}
                          contentContainerStyle={[styles.questionOptions, { paddingBottom: Spacing.lg }]}
                          keyboardShouldPersistTaps="handled"
                          showsVerticalScrollIndicator={false}
                          bounces={false}
                        >
                          <TextInput
                            style={styles.stressInput}
                            placeholder="Type your answer (optional)"
                            placeholderTextColor="rgba(255,255,255,0.5)"
                            multiline
                            value={stressNote}
                            onChangeText={setStressNote}
                            returnKeyType="done"
                            onSubmitEditing={handleFinishQuestionnaire}
                          />
                          <TouchableOpacity
                            style={styles.finishButton}
                            onPress={handleFinishQuestionnaire}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.finishButtonText}>Done</Text>
                          </TouchableOpacity>
                        </ScrollView>
                      </View>
                    ) : (
                      <View style={styles.questionCard}>
                        <Text style={styles.questionTitle}>
                          What matters most when getting your car serviced?
                        </Text>
                        <Text style={styles.questionSubtitle}>
                          Choose 3 out of the 6 items ({servicePrioritySelection.length}/3)
                        </Text>
                        <ScrollView
                          style={[styles.questionOptionsScroll, { maxHeight: optionsScrollMaxHeight }]}
                          contentContainerStyle={[styles.questionOptions, { paddingBottom: Spacing.lg }]}
                          showsVerticalScrollIndicator={false}
                          bounces={false}
                        >
                          {servicePriorityOptions.map((option) => {
                            const rankIndex = servicePrioritySelection.indexOf(option.id);
                            const isSelected = rankIndex !== -1;
                            const isDisabled = !isSelected && servicePrioritySelection.length >= 3;
                            return (
                              <TouchableOpacity
                                key={option.id}
                                style={[
                                  styles.questionOption,
                                  isSelected && styles.questionOptionSelected,
                                  isSmallScreen && styles.questionOptionCompact,
                                  isDisabled && styles.questionOptionDisabled,
                                ]}
                                onPress={() => handleToggleServicePriority(option.id)}
                                activeOpacity={0.8}
                                disabled={isDisabled}
                              >
                                <View style={styles.rankRow}>
                                  {isSelected ? (
                                    <View style={styles.rankBadge}>
                                      <Text style={styles.rankBadgeText}>{rankIndex + 1}</Text>
                                    </View>
                                  ) : (
                                    <View style={styles.rankBadgePlaceholder} />
                                  )}
                                  <Text style={[
                                    styles.questionOptionText,
                                    isSelected && styles.questionOptionTextSelected,
                                    isSmallScreen && { fontSize: FontSize.sm }
                                  ]}>
                                    {option.label}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </ScrollView>
                      </View>
                    )}
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
  questionCard: {
    marginTop: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: Spacing.md,
  },
  questionTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.white,
    lineHeight: 22,
  },
  questionSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.7,
    marginTop: -Spacing.xs,
  },
  questionOptions: {
    gap: Spacing.sm,
  },
  questionOptionsScroll: {
    marginBottom: Spacing['2xl'],
    borderRadius: 12,
    overflow: 'hidden',
  },
  questionOption: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  questionOptionSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: 'rgba(106, 160, 255, 0.12)',
  },
  questionOptionCompact: {
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
  },
  questionOptionText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.white,
  },
  questionOptionTextSelected: {
    color: BrandColors.secondary,
  },
  questionOptionDisabled: {
    opacity: 0.5,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: BrandColors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankBadgeText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bold,
    color: '#0B1220',
  },
  rankBadgePlaceholder: {
    width: 22,
    height: 22,
  },
  progressRow: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
    minHeight: 60, // matches default circle size; small screens override via inline size
  },
  progressBackButton: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  stressInput: {
    minHeight: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: Spacing.md,
    color: BrandColors.white,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    textAlignVertical: 'top',
  },
  finishButton: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 10,
    backgroundColor: BrandColors.secondary,
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#0B1220',
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
  },
});
