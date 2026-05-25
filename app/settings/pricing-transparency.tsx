/**
 * PricingTransparencyScreen
 *
 * PURPOSE: Provides a detailed breakdown of Otopair's pricing model, 
 *          explaining labor rates, parts policies, and fee structures.
 *          Uses a frosted-glass aesthetic matching the About screen.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx (via navigation)
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <PricingTransparencyScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React from 'react';
import { StyleSheet, View, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeInUp } from 'react-native-reanimated';
import {
  Wrench,
  Settings,
  ShieldCheck,
  Lock,
  CheckCircle,
  Headset,
  Info,
} from 'lucide-react-native';

import { 
  BlurHeaderOverlay, 
  BrandColors, 
  Text 
} from '@/components/shared-ui';
import { getSheetContentPadding, BorderRadius, Spacing } from '@/constants/theme';

export default function PricingTransparencyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 90,
            paddingBottom: getSheetContentPadding(false, insets.bottom),
          },
        ]}
      >
        {/* Hero Section */}
        <Animated.View entering={FadeInUp.delay(100)} style={styles.identityCard}>
          <Text weight="bold" size="2xl" color="#111827" style={styles.heroTitle}>
            Pricing{'\n'}Transparency
          </Text>
          <Text weight="medium" size="sm" color="#616E89" style={styles.heroSubtitle}>
            At Otopair, we are committed to rebuilding trust in car repair. That starts with honest, upfront pricing—no hidden markups, no surprise fees.
          </Text>
        </Animated.View>

        {/* Section 1: How pricing works */}
        <Animated.View entering={FadeInUp.delay(200)} style={styles.featureCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: BrandColors.secondary }]} />
            <Text weight="bold" size="lg" color={BrandColors.secondary}>How pricing works</Text>
          </View>

          <View style={styles.cardStack}>
            {/* Labor Rate */}
            <View style={styles.miniFeatureItem}>
              <View style={styles.iconContainer}>
                <Wrench size={20} color={BrandColors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text weight="semiBold" size="sm" color="#111827" style={styles.cardTitle}>Labor Rate</Text>
                <Text size="xs" color="#616E89" style={styles.cardBody}>
                  We charge transparent, shop-specific labor rates. You pay exactly what the mechanic charges, verified by Otopair.
                </Text>
              </View>
            </View>

            {/* Parts Policy */}
            <View style={styles.miniFeatureItem}>
              <View style={styles.iconContainer}>
                <Settings size={20} color={BrandColors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text weight="semiBold" size="sm" color="#111827" style={styles.cardTitle}>Parts Policy</Text>
                <Text size="xs" color="#616E89" style={styles.cardBody}>
                  We source quality parts directly with zero hidden markups. You see the original cost of every component.
                </Text>
              </View>
            </View>

            {/* Otopair Service Fee */}
            <View style={styles.miniFeatureItem}>
              <View style={styles.iconContainer}>
                <ShieldCheck size={20} color={BrandColors.primary} />
              </View>
              <View style={styles.cardContent}>
                <Text weight="semiBold" size="sm" color="#111827" style={styles.cardTitle}>Service Fee</Text>
                <Text size="xs" color="#616E89" style={styles.cardBody}>
                  A 7% service fee (minimum $4.99) is applied to each booking to support the app, insurance, and customer support team. Waived for Preferred and Elite subscribers.
                </Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Section 2: Pricing Labels */}
        <Animated.View entering={FadeInUp.delay(300)} style={styles.featureCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: BrandColors.secondary }]} />
            <Text weight="bold" size="lg" color={BrandColors.secondary}>Pricing labels</Text>
          </View>

          <View style={styles.timelineContainer}>
            <View style={styles.timelineLine} />
            
            {/* Verified Pricing */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: BrandColors.primary }]} />
              <View style={styles.timelineContent}>
                <View style={[styles.labelBadge, { backgroundColor: '#DCFCE7' }]}>
                  <Text weight="bold" size="xs" color="#166534">Verified Pricing</Text>
                </View>
                <Text size="sm" color="#616E89">The final, confirmed price locked in after a remote or physical inspection of your vehicle.</Text>
              </View>
            </View>

            {/* Estimated Pricing */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: BrandColors.primary, opacity: 0.6 }]} />
              <View style={styles.timelineContent}>
                <View style={[styles.labelBadge, { backgroundColor: '#FEF9C3' }]}>
                  <Text weight="bold" size="xs" color="#854D0E">Estimated Pricing</Text>
                </View>
                <Text size="sm" color="#616E89">A data-driven range based on common repair costs for your specific vehicle make and model.</Text>
              </View>
            </View>

            {/* Price on Request */}
            <View style={styles.timelineItem}>
              <View style={[styles.timelineDot, { backgroundColor: '#9CA3AF' }]} />
              <View style={styles.timelineContent}>
                <View style={[styles.labelBadge, { backgroundColor: '#F3F4F6' }]}>
                  <Text weight="bold" size="xs" color="#374151">Price on Request</Text>
                </View>
                <Text size="sm" color="#616E89">Used for complex diagnostic issues where a physical inspection is mandatory before a quote can be given.</Text>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Section 3: What can change the price? */}
        <Animated.View entering={FadeInUp.delay(400)} style={styles.featureCard}>
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionAccent, { backgroundColor: BrandColors.secondary }]} />
            <Text weight="bold" size="lg" color={BrandColors.secondary}>What can change the price?</Text>
          </View>

          <View style={styles.infoContent}>
            <Text size="sm" color="#616E89" style={styles.infoIntro}>
              While we strive for 100% accuracy, real-world repairs can be unpredictable. Price adjustments may occur due to:
            </Text>
            
            <View style={styles.checkRow}>
              <CheckCircle size={16} color={BrandColors.primary} />
              <Text size="sm" color="#111827">Hidden rust or corrosion requiring extra labor.</Text>
            </View>
            
            <View style={styles.checkRow}>
              <CheckCircle size={16} color={BrandColors.primary} />
              <Text size="sm" color="#111827">Additional faults discovered during disassembly.</Text>
            </View>

            <View style={styles.guaranteeBox}>
              <View style={styles.guaranteeHeader}>
                <Lock size={14} color={BrandColors.primary} />
                <Text weight="bold" size="xs" color={BrandColors.primary}>Approval Guarantee</Text>
              </View>
              <Text size="xs" color="#616E89" style={styles.guaranteeText}>
                We will never begin extra work without your explicit digital approval via the app. You stay in control.
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Footer */}
        <Animated.View entering={FadeInUp.delay(500)} style={styles.footer}>
          <Pressable style={styles.supportLink} onPress={() => router.push('/settings/contact-us')}>
            <Headset size={18} color={BrandColors.secondary} />
            <Text weight="bold" size="sm" color={BrandColors.secondary}>Contact support</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>

      <BlurHeaderOverlay
        title="Pricing"
        titleColor="#000"
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
    gap: 16,
  },
  identityCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 12,
    alignItems: 'center',
  },
  heroTitle: {
    lineHeight: 40,
    textAlign: 'center',
  },
  heroSubtitle: {
    lineHeight: 20,
    textAlign: 'center',
  },
  divider: {
    display: 'none',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionAccent: {
    height: 20,
    width: 4,
    backgroundColor: BrandColors.primary,
    borderRadius: 2,
  },
  cardStack: {
    gap: 12,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: 20,
  },
  miniFeatureItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    padding: 14,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'flex-start',
  },
  iconContainer: {
    padding: 8,
    backgroundColor: 'rgba(80, 146, 251, 0.1)',
    borderRadius: 999,
  },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    marginBottom: 2,
  },
  cardBody: {
    lineHeight: 18,
  },
  timelineContainer: {
    paddingLeft: 8,
    gap: 24,
    marginTop: 8,
  },
  timelineLine: {
    position: 'absolute',
    left: 15,
    top: 8,
    bottom: 8,
    width: 2,
    backgroundColor: 'rgba(80, 146, 251, 0.2)',
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 20,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: BrandColors.white,
    marginTop: 4,
    zIndex: 1,
  },
  timelineContent: {
    flex: 1,
    gap: 8,
  },
  labelBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  infoContent: {
    gap: 12,
  },
  infoIntro: {
    lineHeight: 20,
    marginBottom: 4,
  },
  checkRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  guaranteeBox: {
    marginTop: 8,
    backgroundColor: 'rgba(80, 146, 251, 0.05)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(80, 146, 251, 0.1)',
    gap: 4,
  },
  guaranteeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  guaranteeText: {
    lineHeight: 16,
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  supportLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 8,
  },
});
