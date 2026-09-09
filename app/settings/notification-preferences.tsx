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
import { Pressable, ScrollView, StyleSheet, Switch, View, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { Tag, Gift, CreditCard, Bell, Calendar, Check } from 'lucide-react-native';
import { useQuery } from 'convex/react';

import { BrandColors, Spacing, Text, BlurHeaderOverlay } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { api } from '@/convex/_generated/api';
import { usePreferencesPersistence } from '@/hooks/usePreferencesPersistence';
import { useToast } from '@/hooks/useToast';

type NotificationKey = 'offers' | 'rewards' | 'pass' | 'other' | 'bookings';

const ToggleRow = ({
  title,
  description,
  value,
  onValueChange,
  icon: Icon,
}: {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
  icon: any;
}) => (
  // Plain row — the native Switch is the only toggle control (tapping the
  // row too would double-fire and cancel the switch out).
  <View style={styles.toggleRow}>
    <View style={styles.iconContainer}>
      <Icon size={22} color="#4B5563" />
    </View>
    <View style={styles.toggleText}>
      <Text weight="semiBold" size="md" color="#111827">
        {title}
      </Text>
      <Text size="sm" color="#6B7280" style={styles.toggleDescription}>
        {description}
      </Text>
    </View>
    {/* Native iOS toggle. */}
    <Switch
      value={value}
      onValueChange={onValueChange}
      trackColor={{ false: '#D1D5DB', true: BrandColors.secondary }}
      ios_backgroundColor="#D1D5DB"
    />
  </View>
);

export default function NotificationPreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { data, updateData } = useOnboardingStore();

  // Convex integration
  const preferences = useQuery(api.preferences.getMyPreferences);
  const { persistNotificationPreferences } = usePreferencesPersistence();

  const [values, setValues] = useState({
    offers: data.notificationOffersEnabled,
    rewards: data.notificationRewardsEnabled,
    pass: data.notificationPassEnabled,
    other: data.notificationOtherEnabled,
    bookings: data.notificationBookingsEnabled,
  });

  // Sync with Convex data when it loads
  useEffect(() => {
    if (preferences?.notification_preferences) {
      const { offers, rewards, pass, other, bookings } = preferences.notification_preferences;
      setValues({ offers, rewards, pass, other, bookings });
      
      // Also sync Zustand for consistency
      updateData({
        notificationOffersEnabled: offers,
        notificationRewardsEnabled: rewards,
        notificationPassEnabled: pass,
        notificationOtherEnabled: other,
        notificationBookingsEnabled: bookings,
      });
    }
  }, [preferences, updateData]);

  const [isSaving, setIsSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleToggle = useCallback((key: NotificationKey, next: boolean) => {
    setValues((prev) => ({ ...prev, [key]: next }));
  }, []);

  const handleSave = useCallback(async () => {
    console.log('Saving notification preferences...', values);
    setIsSaving(true);
    setJustSaved(false);
    setErrorMessage(null);

    try {
      // 1. Update Zustand store for immediate UI update
      updateData({
        notificationOffersEnabled: values.offers,
        notificationRewardsEnabled: values.rewards,
        notificationPassEnabled: values.pass,
        notificationOtherEnabled: values.other,
        notificationBookingsEnabled: values.bookings,
      });
      console.log('Successfully updated Zustand store');

      // 2. Persist to Convex database
      await persistNotificationPreferences({
        offers: values.offers,
        rewards: values.rewards,
        pass: values.pass,
        other: values.other,
        bookings: values.bookings,
      });
      console.log('Successfully updated Convex database');

      // Emotional confirmation: success haptic + toast (fires the haptic
      // itself) and a brief "Saved!" button state before we leave.
      setIsSaving(false);
      setJustSaved(true);
      toast.success('Preferences saved', 'Your notification settings are up to date.', { icon: Bell });

      // Stay on the page — just revert the button after the "Saved!" moment.
      setTimeout(() => setJustSaved(false), 1600);
    } catch (error) {
      console.error('Error saving notification preferences:', error);
      toast.error("Couldn't save your notification settings.");
      setErrorMessage('Unable to save changes. Please try again.');
      setIsSaving(false);
    }
  }, [updateData, values, persistNotificationPreferences, toast]);

  const toggleRows = useMemo(
    () => [
      {
        key: 'offers' as const,
        title: 'Offers',
        description: 'Discounts and promotions for inviting friends',
        icon: Tag,
      },
      {
        key: 'rewards' as const,
        title: 'Otopair Rewards',
        description: 'Our loyalty program to increase your status as you book',
        icon: Gift,
      },
      {
        key: 'pass' as const,
        title: 'Otopair Pass',
        description: 'Updates and benefits for our monthly pass to exclusive deals',
        icon: CreditCard,
      },
      {
        key: 'other' as const,
        title: 'Other',
        description: 'Events, recommendations, and other service messages',
        icon: Bell,
      },
      {
        key: 'bookings' as const,
        title: 'Bookings',
        description: 'Updates and reminders about your service appointments',
        icon: Calendar,
      },
    ],
    []
  );

  return (
    <View style={styles.screen}>
      <BlurHeaderOverlay
        title="Notification Preferences"
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
            icon={row.icon}
          />
        ))}

        {errorMessage ? (
          <View style={styles.messageBox}>
            <Text size="sm" color="#EF4444" style={styles.messageText}>
              {errorMessage}
            </Text>
          </View>
        ) : null}

      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 100 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.saveButton,
            (pressed || isSaving) && { opacity: 0.7 }
          ]}
          onPress={handleSave}
          disabled={isSaving || justSaved}
        >
          {isSaving ? (
            <ActivityIndicator color="#FFF" />
          ) : justSaved ? (
            <View style={styles.savedRow}>
              <Check size={18} color="#FFF" strokeWidth={3} />
              <Text weight="semiBold" size="md" color="#FFF">
                Saved!
              </Text>
            </View>
          ) : (
            <Text weight="semiBold" size="md" color="#FFF">
              Update Preferences
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BrandColors.background,
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
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleText: {
    flex: 1,
  },
  toggleDescription: {
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    paddingTop: Spacing.lg,
  },
  saveButton: {
    backgroundColor: BrandColors.secondary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  messageBox: {
    marginTop: Spacing.lg,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 12,
    padding: Spacing.md,
  },
  messageText: {
    textAlign: 'center',
  },
});
