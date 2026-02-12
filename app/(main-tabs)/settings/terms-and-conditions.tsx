/**
 * TermsAndConditionsScreen
 *
 * PURPOSE: Displays the legal agreement between Otopair and the user.
 *          Features a high-fidelity iOS-style layout with frosted glass panels.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx (via navigation)
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <TermsAndConditionsScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState } from 'react';
import { StyleSheet, View, Pressable, ScrollView, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp, FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming, interpolateColor, useDerivedValue } from 'react-native-reanimated';
import {
  FileText,
  Mail,
  ChevronRight,
} from 'lucide-react-native';

import { 
  BlurHeaderOverlay, 
  BrandColors, 
  Text 
} from '@/components/shared-ui';
import { getSheetContentPadding, BorderRadius, Spacing } from '@/constants/theme';

const AnimatedChevron = ({ isExpanded }: { isExpanded: boolean }) => {
  const rotation = useDerivedValue(() => {
    return withTiming(isExpanded ? 90 : 0, { duration: 200 });
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: `${rotation.value}deg` }],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <ChevronRight 
        size={18} 
        color={isExpanded ? BrandColors.secondary : "#9CA3AF"} 
      />
    </Animated.View>
  );
};

export default function TermsAndConditionsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleSendEmail = () => {
    Linking.openURL('mailto:legal@otopair.com?subject=Terms and Conditions Request');
  };

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const LOREM_IPSUM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.";

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 60,
            paddingBottom: getSheetContentPadding(false, insets.bottom),
          },
        ]}
      >
        {/* Header Area */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.headerArea}>
          <View style={styles.iconCircle}>
            <FileText size={40} color={BrandColors.secondary} />
          </View>
          <Text size="sm" color="#6B7280">
            Last updated February 12, 2026
          </Text>
        </Animated.View>

        {/* Action Area */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.actionArea}>
          <Pressable 
            style={({ pressed }) => [styles.emailButton, pressed && styles.buttonPressed]} 
            onPress={handleSendEmail}
          >
            <Mail size={18} color={BrandColors.secondary} />
            <Text weight="semiBold" size="md" color={BrandColors.secondary}>
              Send by Email
            </Text>
          </Pressable>
        </Animated.View>

        {/* Main Content Card */}
        <Animated.View 
          entering={FadeInUp.delay(300)} 
          layout={LinearTransition}
          style={styles.glassCard}
        >
          <Text size="md" color="#4B5563" style={styles.introText}>
            Please read the following terms before using Otopair. By using your device, you are agreeing to be bound by the Otopair Terms and Conditions. If you choose to use Premium Features, you are agreeing to be bound by the respective Billing and Privacy policies.
          </Text>

          <View style={styles.separator} />

          <Animated.View layout={LinearTransition} style={styles.sectionStack}>
            {/* Section A */}
            <Animated.View layout={LinearTransition}>
              <Pressable 
                style={({ pressed }) => [styles.sectionItem, pressed && styles.itemPressed]}
                onPress={() => toggleSection('A')}
              >
                <View style={styles.sectionLeft}>
                  <Text weight="bold" size="md" color={BrandColors.secondary}>
                    A. Otopair General Terms
                  </Text>
                  <Text size="xs" color="#6B7280" numberOfLines={1}>
                    Usage rights, limitations, and user conduct.
                  </Text>
                </View>
                <AnimatedChevron isExpanded={expandedSection === 'A'} />
              </Pressable>
              {expandedSection === 'A' && (
                <Animated.View 
                  entering={FadeInUp.duration(200)} 
                  exiting={FadeOut.duration(180)} 
                  style={styles.expandedContent}
                >
                  <Text size="sm" color="#4B5563" style={styles.loremText}>
                    {LOREM_IPSUM}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>

            <View style={styles.innerSeparator} />

            {/* Section B */}
            <Animated.View layout={LinearTransition}>
              <Pressable 
                style={({ pressed }) => [styles.sectionItem, pressed && styles.itemPressed]}
                onPress={() => toggleSection('B')}
              >
                <View style={styles.sectionLeft}>
                  <Text weight="bold" size="md" color={BrandColors.secondary}>
                    B. Billing & Subscription Terms
                  </Text>
                  <Text size="xs" color="#6B7280" numberOfLines={1}>
                    Payments, renewals, and cancellation policy.
                  </Text>
                </View>
                <AnimatedChevron isExpanded={expandedSection === 'B'} />
              </Pressable>
              {expandedSection === 'B' && (
                <Animated.View 
                  entering={FadeInUp.duration(200)} 
                  exiting={FadeOut.duration(180)} 
                  style={styles.expandedContent}
                >
                  <Text size="sm" color="#4B5563" style={styles.loremText}>
                    {LOREM_IPSUM}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>

            <View style={styles.innerSeparator} />

            {/* Section C */}
            <Animated.View layout={LinearTransition}>
              <Pressable 
                style={({ pressed }) => [styles.sectionItem, pressed && styles.itemPressed]}
                onPress={() => toggleSection('C')}
              >
                <View style={styles.sectionLeft}>
                  <Text weight="bold" size="md" color={BrandColors.secondary}>
                    C. Privacy Policy & Data Usage
                  </Text>
                  <Text size="xs" color="#6B7280" numberOfLines={1}>
                    How we collect, store, and process your data.
                  </Text>
                </View>
                <AnimatedChevron isExpanded={expandedSection === 'C'} />
              </Pressable>
              {expandedSection === 'C' && (
                <Animated.View 
                  entering={FadeInUp.duration(200)} 
                  exiting={FadeOut.duration(180)} 
                  style={styles.expandedContent}
                >
                  <Text size="sm" color="#4B5563" style={styles.loremText}>
                    {LOREM_IPSUM}
                  </Text>
                </Animated.View>
              )}
            </Animated.View>
          </Animated.View>
        </Animated.View>

        
      </ScrollView>

      <BlurHeaderOverlay
        title="Terms & Conditions"
        onBack={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  container: {
    paddingHorizontal: 20,
    gap: 24,
  },
  headerArea: {
    alignItems: 'center',
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  title: {
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  actionArea: {
    width: '100%',
  },
  emailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    paddingVertical: 14,
    borderRadius: 16,
  },
  buttonPressed: {
    opacity: 0.7,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: 24,
    gap: 20,
  },
  introText: {
    lineHeight: 22,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  sectionStack: {
    gap: 4,
  },
  sectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  itemPressed: {
    opacity: 0.6,
  },
  sectionLeft: {
    flex: 1,
    gap: 4,
    paddingRight: 16,
  },
  innerSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginLeft: 0,
  },
  footerNote: {
    textAlign: 'center',
    marginTop: 8,
  },
  expandedContent: {
    paddingBottom: 16,
    paddingHorizontal: 4,
  },
  loremText: {
    lineHeight: 20,
  },
});
