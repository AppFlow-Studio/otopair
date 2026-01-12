/**
 * AI Welcome Screen Component
 * Initial disclaimer/welcome screen shown before chat begins
 * Inspired by ChatGPT's onboarding with Otopair branding
 */

import React from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  Image,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/shared-ui';
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';
import { MessageSquare, Shield, AlertTriangle } from 'lucide-react-native';

// Otopair AI Logo
const OTOPAIR_AI_LOGO = require('@/assets/images/otopair-ai-logo.png');

// ============================================================================
// TYPES
// ============================================================================

interface AIWelcomeScreenProps {
  onContinue: () => void;
}

// ============================================================================
// LOGO COMPONENT
// ============================================================================

function AILogo() {
  return (
    <Animated.View 
      style={styles.logoContainer}
      entering={FadeIn.duration(600)}
    >
      <Image 
        source={OTOPAIR_AI_LOGO} 
        style={styles.logoImage}
        resizeMode="contain"
      />
    </Animated.View>
  );
}

// ============================================================================
// INFO ITEM COMPONENT (ChatGPT-style, no boxes)
// ============================================================================

function InfoItem({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <Animated.View 
      style={styles.infoItem}
      entering={FadeInUp.delay(delay).duration(400).springify()}
    >
      <View style={styles.infoIconContainer}>
        {icon}
      </View>
      <View style={styles.infoContent}>
        <Text style={styles.infoTitle} weight="semiBold">
          {title}
        </Text>
        <Text style={styles.infoDescription} size="sm">
          {description}
        </Text>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Default tab bar height fallback (standard iOS/Android tab bar is ~49-83px)
const TAB_BAR_HEIGHT = 80;

export function AIWelcomeScreen({ onContinue }: AIWelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  // Use bottom inset + tab bar height to account for the native tab bar
  const bottomPadding = Math.max(insets.bottom, TAB_BAR_HEIGHT);

  return (
    <View style={styles.container}>
      {/* Background gradient - off-white */}
      <LinearGradient
        colors={['#E8ECF0', '#dde2ee', '#E8ECF0']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Content */}
      <View style={[styles.content, { paddingTop: insets.top + 20 }]}>
        {/* Logo */}
        <AILogo />

        {/* Title Section */}
        <Animated.View 
          style={styles.titleSection}
          entering={FadeInUp.delay(200).duration(500)}
        >
          <Text style={styles.welcomeTitle} weight="bold">
            Welcome to Otopair AI
          </Text>
          <Text style={styles.welcomeSubtitle}>
            Your AI assistant for car diagnostics, repair tips, and maintenance scheduling.
          </Text>
        </Animated.View>

        {/* Info Items - ChatGPT style, no boxes */}
        <View style={styles.infoContainer}>
          <InfoItem
            icon={<MessageSquare size={22} color={BrandColors.secondary} />}
            title="Responses can be inaccurate"
            description="Otopair AI may provide inaccurate information about cars, repairs, or maintenance."
            delay={400}
          />
          <InfoItem
            icon={<Shield size={22} color={BrandColors.secondary} />}
            title="Don't share sensitive info"
            description="Chats may be reviewed to improve our service. Learn more."
            delay={500}
          />
          <InfoItem
            icon={<AlertTriangle size={22} color="#F59E0B" />}
            title="Not emergency advice"
            description="For immediate safety concerns, pull over safely and call roadside assistance."
            delay={600}
          />
        </View>
      </View>

      {/* Footer */}
      <Animated.View 
        style={[styles.footer, { paddingBottom: bottomPadding + Spacing.md }]}
        entering={FadeInDown.delay(700).duration(400)}
      >
        <Text style={styles.termsText} size="sm">
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink} size="sm" weight="semiBold">
            Terms of Service
          </Text>
          {' '}and{' '}
          <Text style={styles.termsLink} size="sm" weight="semiBold">
            Privacy Policy
          </Text>
        </Text>

        <Pressable
          onPress={onContinue}
          style={({ pressed }) => [
            styles.continueButton,
            pressed && styles.continueButtonPressed,
          ]}
        >
          <Text style={styles.continueButtonText} weight="semiBold">
            Continue
          </Text>
        </Pressable>
      </Animated.View>
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
  content: {
    flex: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
  },
  // Logo
  logoContainer: {
    marginBottom: Spacing.xl,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  // Title Section
  titleSection: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  welcomeTitle: {
    fontSize: 26,
    color: BrandColors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontFamily: FontFamily.bold,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  // Info Items (ChatGPT style - no boxes)
  infoContainer: {
    width: '100%',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  infoIconContainer: {
    width: 28,
    marginRight: Spacing.md,
    marginTop: 2,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    color: BrandColors.primary,
    marginBottom: 4,
    fontFamily: FontFamily.semiBold,
  },
  infoDescription: {
    color: '#6B7280',
    lineHeight: 22,
    fontSize: 15,
  },
  // Footer
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
  },
  termsText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  termsLink: {
    color: BrandColors.secondary,
  },
  continueButton: {
    backgroundColor: BrandColors.primary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    alignItems: 'center',
    ...Shadows.md,
  },
  continueButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  continueButtonText: {
    color: BrandColors.white,
    fontSize: 16,
    fontFamily: FontFamily.semiBold,
  },
});
