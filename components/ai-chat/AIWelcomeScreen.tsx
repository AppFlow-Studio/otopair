/**
 * AIWelcomeScreen
 *
 * PURPOSE: Initial disclaimer/welcome screen shown before AI chat begins (ChatGPT-style onboarding)
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown when hasSeenWelcome is false)
 *
 * PROPS:
 *   - onContinue (() => void): Callback when user presses Continue button
 *
 * EXAMPLE:
 *   <AIWelcomeScreen onContinue={() => setHasSeenWelcome(true)} />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from 'react';
import { View, StyleSheet, Pressable, Image, ScrollView, Platform, useWindowDimensions } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  FadeIn,
  FadeInUp,
  FadeInDown,
  SlideInDown,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarHeightContext } from '@react-navigation/bottom-tabs';
import { MessageSquare, Shield, AlertTriangle } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';

// OtoPair AI Logo
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

function AILogo({ compact = false }: { compact?: boolean }) {
  return (
    <Animated.View 
      style={[styles.logoContainer, compact && styles.logoContainerCompact]}
      entering={FadeIn.duration(600)}
    >
      <Image 
        source={OTOPAIR_AI_LOGO} 
        style={[styles.logoImage, compact && styles.logoImageCompact]}
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
  compact = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
  compact?: boolean;
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
        <Text style={[styles.infoTitle, compact && styles.infoTitleCompact]} weight="semiBold">
          {title}
        </Text>
        <Text style={[styles.infoDescription, compact && styles.infoDescriptionCompact]} size="sm">
          {description}
        </Text>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIWelcomeScreen({ onContinue }: AIWelcomeScreenProps) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const tabBarHeightCtx = React.useContext(BottomTabBarHeightContext);
  const isIOS26 =
    Platform.OS === 'ios' && parseInt(String(Platform.Version), 10) >= 26;
  const isVeryShortScreen = windowHeight < 700;
  const useTightLayout = Platform.OS === 'android' || windowHeight < 760;
  const useCompactTypography = !isIOS26 && isVeryShortScreen;
  // tabBarHeightCtx already includes insets.bottom when available.
  // Fall back to manual calc on iOS 26 (native tab bar) or if context is missing.
  const tabBarFallbackOffset = isIOS26 ? 18 : Platform.OS === 'android' ? 52 : 48;
  const measuredTabBarHeight =
    typeof tabBarHeightCtx === 'number' && tabBarHeightCtx > 0
      ? tabBarHeightCtx
      : undefined;
  const bottomPadding = measuredTabBarHeight !== undefined
    ? measuredTabBarHeight
    : insets.bottom + tabBarFallbackOffset;
  const effectiveBottomPadding = bottomPadding + (isIOS26 ? 8 : 0);
  const topPadding = isIOS26
    ? Math.max(insets.top - 16, 0)
    : insets.top + (useTightLayout ? 8 : 16);
  const contentMinHeight = Math.max(0, windowHeight - topPadding - effectiveBottomPadding);
  const footerEntering = Platform.OS === 'android'
    ? undefined
    : FadeInDown.delay(700).duration(400);
  const androidTermsEntering = Platform.OS === 'android'
    ? FadeInDown.delay(700).duration(320)
    : undefined;
  const androidButtonEntering = Platform.OS === 'android'
    ? SlideInDown.delay(760).duration(320)
    : undefined;

  return (
    <View style={styles.container}>
      {/* Background gradient - off-white */}
      <LinearGradient
        colors={['#E8ECF0', '#dde2ee', '#E8ECF0']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: topPadding,
            paddingBottom: effectiveBottomPadding,
            minHeight: contentMinHeight,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* Content Wrapper */}
        <View style={[styles.content, useTightLayout && styles.contentCompact]}>
          {/* Logo */}
          <AILogo compact={useTightLayout} />

          {/* Title Section */}
          <Animated.View 
            style={[styles.titleSection, useTightLayout && styles.titleSectionCompact]}
            entering={FadeInUp.delay(200).duration(500)}
          >
            <Text style={[styles.welcomeTitle, useCompactTypography && styles.welcomeTitleCompact]} weight="bold">
              Welcome to Oto AI
            </Text>
            <Text style={[styles.welcomeSubtitle, useCompactTypography && styles.welcomeSubtitleCompact]}>
              Your AI assistant for car diagnostics, repair tips, and maintenance scheduling.
            </Text>
          </Animated.View>

          {/* Info Items - ChatGPT style, no boxes */}
          <View style={[styles.infoContainer, useTightLayout && styles.infoContainerCompact]}>
            <InfoItem
              icon={<MessageSquare size={22} color={BrandColors.secondary} />}
              title="Responses can be inaccurate"
              description="Oto AI may provide inaccurate information about cars, repairs, or maintenance."
              delay={400}
              compact={useCompactTypography}
            />
            <InfoItem
              icon={<Shield size={22} color={BrandColors.secondary} />}
              title="Don't share sensitive info"
              description="Chats may be reviewed to improve our service."
              delay={500}
              compact={useCompactTypography}
            />
            <InfoItem
              icon={<AlertTriangle size={22} color="#F59E0B" />}
              title="Not emergency advice"
              description="For immediate safety concerns, pull over safely and call roadside assistance."
              delay={600}
              compact={useCompactTypography}
            />
          </View>

          {/* Footer inside content so the whole onboarding block centers together */}
          <Animated.View 
            style={[styles.footer, useTightLayout && styles.footerCompact]}
            entering={footerEntering}
          >
            <Animated.View entering={androidTermsEntering}>
              <Text style={[styles.termsText, useTightLayout && styles.termsTextCompact]} size="sm">
                By continuing, you agree to our{' '}
                <Text style={styles.termsLink} size="sm" weight="semiBold">
                  Terms of Service
                </Text>
                {' '}and{' '}
                <Text style={styles.termsLink} size="sm" weight="semiBold">
                  Privacy Policy
                </Text>
              </Text>
            </Animated.View>

            <Animated.View entering={androidButtonEntering}>
              <Pressable
                onPress={onContinue}
                style={({ pressed }) => [
                  styles.continueButton,
                  useTightLayout && styles.continueButtonCompact,
                  pressed && styles.continueButtonPressed,
                ]}
              >
                <Text style={styles.continueButtonText} weight="semiBold">
                  Continue
                </Text>
              </Pressable>
            </Animated.View>
          </Animated.View>
        </View>
      </ScrollView>
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: Spacing.xl,
  },
  contentCompact: {
    paddingBottom: Spacing.lg,
  },
  // Logo
  logoContainer: {
    marginBottom: Spacing.lg,
  },
  logoContainerCompact: {
    marginBottom: Spacing.md,
  },
  logoImage: {
    width: 72,
    height: 72,
    borderRadius: 16,
  },
  logoImageCompact: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  // Title Section
  titleSection: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  titleSectionCompact: {
    marginBottom: Spacing.lg,
  },
  welcomeTitle: {
    fontSize: 26,
    color: BrandColors.primary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
    fontFamily: FontFamily.bold,
  },
  welcomeTitleCompact: {
    fontSize: 22,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
  welcomeSubtitleCompact: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  // Info Items (ChatGPT style - no boxes)
  infoContainer: {
    width: '100%',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.sm,
  },
  infoContainerCompact: {
    gap: Spacing.md,
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
  infoTitleCompact: {
    fontSize: 14,
    marginBottom: 1,
  },
  infoDescription: {
    color: '#6B7280',
    lineHeight: 22,
    fontSize: 15,
  },
  infoDescriptionCompact: {
    fontSize: 13,
    lineHeight: 18,
  },
  // Footer
  footer: {
    width: '100%',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  footerCompact: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  termsText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  termsTextCompact: {
    marginBottom: Spacing.sm,
    lineHeight: 18,
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
  continueButtonCompact: {
    paddingVertical: 12,
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
