/**
 * NotificationPreferencesScreen
 *
 * PURPOSE: Allows users to manage their push notification preferences for various app features.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <NotificationPreferencesScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { BrandColors, Button, Spacing, Text, BlurHeaderOverlay } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

type NotificationKey = 'offers' | 'rewards' | 'pass' | 'other' | 'bookings';

const ToggleRow = ({
  title,
  description,
  value,
  onValueChange,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) => (
  <Pressable onPress={() => onValueChange(!value)} style={styles.toggleRow}>
    <View style={styles.toggleText}>
      <Text weight="semiBold" size="md" color="#111827">
        {title}
      </Text>
      <Text size="sm" color="#6B7280" style={styles.toggleDescription}>
        {description}
      </Text>
    </View>
    <ToggleSwitch value={value} onValueChange={onValueChange} />
  </Pressable>
);

const ToggleSwitch = ({
  value,
  onValueChange,
}: {
  value: boolean;
  onValueChange: (next: boolean) => void;
}) => {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#D1D5DB', BrandColors.secondary]
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <Pressable onPress={() => onValueChange(!value)} style={styles.switchHit}>
      <Animated.View style={[styles.switchTrack, trackStyle]}>
        <Animated.View style={[styles.switchThumb, thumbStyle]} />
      </Animated.View>
    </Pressable>
  );
};

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { data, updateData } = useOnboardingStore();

  const [values, setValues] = useState({
    offers: data.notificationOffersEnabled,
    rewards: data.notificationRewardsEnabled,
    pass: data.notificationPassEnabled,
    other: data.notificationOtherEnabled,
    bookings: data.notificationBookingsEnabled,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setValues({
      offers: data.notificationOffersEnabled,
      rewards: data.notificationRewardsEnabled,
      pass: data.notificationPassEnabled,
      other: data.notificationOtherEnabled,
      bookings: data.notificationBookingsEnabled,
    });
  }, [
    data.notificationOffersEnabled,
    data.notificationRewardsEnabled,
    data.notificationPassEnabled,
    data.notificationOtherEnabled,
    data.notificationBookingsEnabled,
  ]);

  const handleToggle = useCallback((key: NotificationKey, next: boolean) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSuccessMessage(null);
    setErrorMessage(null);

    try {
      updateData({
        notificationOffersEnabled: values.offers,
        notificationRewardsEnabled: values.rewards,
        notificationPassEnabled: values.pass,
        notificationOtherEnabled: values.other,
        notificationBookingsEnabled: values.bookings,
      });
      setSuccessMessage('Preferences updated.');
      setTimeout(() => setSuccessMessage(null), 1500);
    } catch (error) {
      setErrorMessage('Unable to save changes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [updateData, values.other, values.offers, values.pass, values.rewards, values.bookings]);

  const toggleRows = useMemo(
    () => [
      {
        key: 'offers' as const,
        title: 'Offers',
        description: 'Discounts and promotions for inviting friends',
      },
      {
        key: 'rewards' as const,
        title: 'Otopair Rewards',
        description: 'Our loyalty program to increase your status as you book',
      },
      {
        key: 'pass' as const,
        title: 'Otopair Pass',
        description: 'Updates and benefits for our monthly pass to exclusive deals',
      },
      {
        key: 'other' as const,
        title: 'Other',
        description: 'Events, recommendations, and other service messages',
      },
      {
        key: 'bookings' as const,
        title: 'Bookings',
        description: 'Updates and reminders about your service appointments',
      },
    ],
    []
  );

  return (
    <View style={styles.screen}>
      <BlurHeaderOverlay
        title="Notification Settings"
        titleColor="#111827"
        onBack={() => router.back()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 80 }]}
      >
        {toggleRows.map((row) => (
          <ToggleRow
            key={row.key}
            title={row.title}
            description={row.description}
            value={values[row.key]}
            onValueChange={(next) => handleToggle(row.key, next)}
          />
        ))}

        {errorMessage ? (
          <View style={styles.messageBox}>
            <Text size="sm" color="#EF4444" style={styles.messageText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={[styles.messageBox, styles.successBox]}>
            <Text size="sm" color="#10B981" style={styles.messageText}>
              {successMessage}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 100 }]}>
        <Button
          variant="primary"
          fullWidth
          disabled={isSaving}
          loading={isSaving}
          style={styles.saveButton}
          onPress={handleSave}
        >
          Update Settings
        </Button>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    paddingHorizontal: 20,
  },
  content: {
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },
  sectionTitle: {
    marginBottom: Spacing.sm,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  toggleText: {
    flex: 1,
  },
  toggleDescription: {
    marginTop: 4,
    lineHeight: 18,
  },
  switchHit: {
    paddingLeft: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  footer: {
    paddingTop: Spacing.lg,
  },
  saveButton: {
    borderRadius: 14,
    paddingVertical: 14,
  },
  messageBox: {
    marginTop: Spacing.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    padding: Spacing.md,
  },
  successBox: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
  },
  messageText: {
    textAlign: 'center',
  },
});
