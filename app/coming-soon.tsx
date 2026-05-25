/**
 * ComingSoonScreen
 *
 * PURPOSE: Generic "coming soon" screen that lets users subscribe to notifications
 *          for a given service type and shows basic marketing copy.
 *
 * USED IN: Navigated from Home flow components (SuggestionsSection, FinishCarSetupCard,
 *          FinishAccountSetupCard, AIAssistantButton) when a feature is not yet live.
 *
 * PROPS:
 *   - None (screen reads `serviceType` and `serviceName` from route params)
 *
 * EXAMPLE:
 *   // app/coming-soon.tsx is registered as a route; navigate with:
 *   // router.push({ pathname: '/coming-soon', params: { serviceType: 'mechanic', serviceName: 'Mechanic' } })
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Bell, Check } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';
import { useToast } from '@/hooks/useToast';

// ============================================================================
// COMPONENT
// ============================================================================

export default function ComingSoonScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { serviceName } = useLocalSearchParams<{
    serviceType: string;
    serviceName: string;
  }>();

  const handleBack = () => {
    router.back();
  };

  const handleNotifyMe = async () => {
    try {
      // Check current permission status
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // If not already granted, request permission
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        toast.info(
          'Notifications stay off — change anytime in Settings.',
        );
        return;
      }

      // Permission granted - mark as subscribed
      setIsSubscribed(true);
      console.log('Subscribed to notifications for:', serviceName);

      toast.success(
        'You\'re on the list.',
        `We'll let you know when ${serviceName} launches.`,
      );
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Couldn\'t update notification settings.');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={handleBack}
          style={({ pressed }) => [
            styles.backButton,
            pressed && styles.backButtonPressed,
          ]}
          hitSlop={12}
        >
          <ArrowLeft size={24} color="#141C24" strokeWidth={2} />
        </Pressable>

        <Text weight="semiBold" size="lg" color="#141C24">
          {serviceName || 'Service'}
        </Text>

        {/* Spacer to center title */}
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <View style={styles.content}>
        {/* Coming Soon Badge */}
        <Text weight="bold" size="4xl" color="#5299FE" style={styles.comingSoonText}>
          COMING{'\n'}SOON!
        </Text>

        {/* Launch Date */}
        <Text weight="bold" size="3xl" color="#141C24" center style={styles.launchDate}>
          Launching Winter{'\n'}2025
        </Text>

        {/* Description */}
        <Text size="lg" color="#6B7280" center style={styles.description}>
          Book Services At Your Home
        </Text>

        {/* Notify Me Button */}
        <Pressable
          onPress={handleNotifyMe}
          disabled={isSubscribed}
          style={({ pressed }) => [
            styles.notifyButton,
            isSubscribed && styles.notifyButtonSubscribed,
            pressed && !isSubscribed && styles.notifyButtonPressed,
          ]}
        >
          {isSubscribed ? (
            <Check size={20} color="#FFFFFF" strokeWidth={2} />
          ) : (
            <Bell size={20} color="#FFFFFF" strokeWidth={2} />
          )}
          <Text weight="semiBold" size="md" color="#FFFFFF">
            {isSubscribed ? 'Subscribed' : 'Notify Me'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E8ECF0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  backButtonPressed: {
    opacity: 0.6,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 100,
  },
  comingSoonText: {
    textAlign: 'center',
    lineHeight: 48,
    marginBottom: 24,
    letterSpacing: 2,
  },
  launchDate: {
    marginBottom: 12,
    lineHeight: 40,
  },
  description: {
    marginBottom: 40,
  },
  notifyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#141C24',
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 200,
  },
  notifyButtonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  notifyButtonSubscribed: {
    backgroundColor: '#22C55E',
  },
});

