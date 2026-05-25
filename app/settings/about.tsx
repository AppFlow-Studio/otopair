/**
 * AboutOtopairScreen
 *
 * PURPOSE: Highlights app features and version details.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * EXAMPLE:
 *   <Stack.Screen name="about" />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useMemo, useState, useEffect } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import Animated from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  Check,
  CheckCheck,
  Droplet,
  FileText,
  Info,
  Rocket,
  Share2,
  Sparkles,
  Wrench,
} from 'lucide-react-native';

import { OtoPairIcon } from '@/components/icons/oto-pair';
import { BlurHeaderOverlay, BrandColors, Button, ScrollDrivenGradientBackground, Text, buildReferralShareMessage, useReferralCode } from '@/components/shared-ui';
import { getSheetContentPadding, BorderRadius, Spacing } from '@/constants/theme';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

export default function AboutOtopairScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useOnboardingStore((s: ReturnType<typeof useOnboardingStore.getState>) => s.data);

  const referralCode = useReferralCode(data);

  const displayCode = referralCode.toUpperCase();

  const handleShare = useCallback(async () => {
    await Share.share({ message: buildReferralShareMessage(displayCode) });
  }, [displayCode]);

  return (
    <View style={styles.screen}>
      <ScrollDrivenGradientBackground scrollPerTransition={800}>
        {(scrollHandler) => (
          <Animated.ScrollView
            onScroll={scrollHandler}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.container,
              {
                paddingTop: insets.top + 90,
                paddingBottom: getSheetContentPadding(false, insets.bottom),
              },
            ]}
          >
        <View style={styles.identityCard}>
          <View style={styles.appIcon}>
            <View style={styles.appIconMark}>
              <OtoPairIcon />
            </View>
          </View>
          <Text weight="bold" size="2xl" color="#111827" style={styles.appName}>
            Otopair
          </Text>
          <View style={styles.versionPill}>
            <Text weight="medium" size="xs" color="#6B7280">
              Version 1.0.0
            </Text>
          </View>
          <Text weight="medium" size="sm" color="#616E89">
            Car care, simplified.
          </Text>
        </View>

        <View style={styles.featureStack}>
          <View style={styles.featureCard}>
            <Text weight="bold" size="lg" color="#111318" style={styles.featureTitle}>
              Live service progress
            </Text>
            <Text size="sm" color="#616E89" style={styles.featureBody}>
              Track your repairs in real-time. Know exactly when your car is checked in, being
              serviced, or ready for pickup.
            </Text>
            <View style={styles.miniCard}>
              <View style={styles.progressLine} />
              <View style={styles.progressRow}>
                <View style={styles.progressStep}>
                  <View style={[styles.progressDot, styles.progressDotActive]}>
                    <Check size={12} color="#FFFFFF" />
                  </View>
                  <Text weight="semiBold" size="xs" color={BrandColors.secondary}>
                    In
                  </Text>
                </View>
                <View style={styles.progressStep}>
                  <View style={[styles.progressDot, styles.progressDotActive]}>
                    <Wrench size={12} color="#FFFFFF" />
                  </View>
                  <Text weight="semiBold" size="xs" color={BrandColors.secondary}>
                    Service
                  </Text>
                </View>
                <View style={styles.progressStep}>
                  <View style={[styles.progressDot, styles.progressDotMuted]}>
                    <CheckCheck size={12} color="#9CA3AF" />
                  </View>
                  <Text weight="medium" size="xs" color="#9CA3AF">
                    Ready
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text weight="bold" size="lg" color="#111318" style={styles.featureTitle}>
              Maintenance into action
            </Text>
            <Text size="sm" color="#616E89" style={styles.featureBody}>
              Get notified for upcoming due dates and book appointments instantly with one tap.
            </Text>
            <View style={styles.showcaseCardOuter}>
              <BlurView intensity={22} tint="light" style={styles.showcaseBlurContainer}>
                <View style={styles.showcaseWhiteOverlay} />
              </BlurView>
              <View style={styles.showcaseCard}>
                <View style={styles.showcaseCardRow}>
                  <View style={styles.showcaseLeftColumn}>
                    <Text weight="semiBold" size="lg" color="#111827">
                      Oil Change
                    </Text>
                    <View style={styles.showcaseDetailSection}>
                      <View style={styles.showcaseStatusIconContainer}>
                        <Svg width={18} height={18}>
                          <Circle
                            cx={9}
                            cy={9}
                            r={7.5}
                            stroke="#FDBA74"
                            strokeWidth={3}
                            fill="none"
                            strokeDasharray={2 * Math.PI * 7.5}
                            strokeDashoffset={(2 * Math.PI * 7.5) * (1 - 0.6)}
                            strokeLinecap="round"
                            rotation={-90}
                            origin="9, 9"
                          />
                        </Svg>
                      </View>
                      <View style={styles.showcaseDetailTextContainer}>
                        <Text size="xs" color="#111827">
                          Last oil change
                        </Text>
                        <Text weight="semiBold" size="xs" color="#111827">
                          Mar 2025
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.showcaseRightColumn}>
                    <View style={[styles.showcaseBadge, { backgroundColor: '#FDEAD7' }]}>
                      <Text weight="semiBold" size="xs" color="#f89829">
                        Due Soon
                      </Text>
                    </View>

                    <Pressable style={styles.showcasePrimaryButton}>
                      <Text weight="semiBold" size="xs" color="#FFFFFF">
                        Book Now
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text weight="bold" size="lg" color="#111318" style={styles.featureTitle}>
              Otopair AI for car questions
            </Text>
            <Text size="sm" color="#616E89" style={styles.featureBody}>
              Not sure what that sound is? Ask our AI assistant for instant diagnostics and advice.
            </Text>
            <View style={styles.chatCard}>
              <View style={[styles.chatBubble, styles.chatBubblePrimary]}>
                <Text size="xs" color="#FFFFFF">
                  Why is my brake light on?
                </Text>
              </View>
              <View style={styles.showcaseAiTextContainer}>
                <Text style={styles.showcaseMessageText}>
                  It could mean low brake fluid or worn pads. Let&apos;s check your last service.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text weight="bold" size="lg" color="#111318" style={styles.featureTitle}>
              Receipts that actually make sense
            </Text>
            <Text size="sm" color="#616E89" style={styles.featureBody}>
              Clear, itemized breakdowns of every service. No hidden fees, just transparent pricing.
            </Text>
            <View style={styles.showcaseServiceCard}>
              <View style={styles.showcaseServiceHeader}>
                <Text size="md" weight="bold" color={BrandColors.primary}>
                  Service Breakdown
                </Text>
                <FileText size={20} color="#9CA3AF" />
              </View>

              <View style={styles.showcaseServiceRow}>
                <Text size="sm" weight="medium" color={BrandColors.primary}>
                  Oil Change
                </Text>
                <Text size="sm" weight="semiBold" color={BrandColors.primary}>
                  $65.00
                </Text>
              </View>

              <View style={styles.showcaseBreakdownSection}>
                <View style={styles.showcaseBreakdownRow}>
                  <Text size="sm" weight="regular" color="#6B7280">
                    Labor (1.5 hrs)
                  </Text>
                  <Text size="sm" weight="medium" color="#6B7280">
                    $45.00
                  </Text>
                </View>

                <View style={styles.showcaseBreakdownRow}>
                  <Text size="sm" weight="regular" color="#6B7280">
                    Parts (Oil, Filter)
                  </Text>
                  <Text size="sm" weight="medium" color="#6B7280">
                    $20.00
                  </Text>
                </View>

                <View style={styles.showcaseBreakdownRow}>
                  <Text size="sm" weight="regular" color="#6B7280">
                    Taxes & Fees
                  </Text>
                  <Text size="sm" weight="medium" color="#6B7280">
                    $5.00
                  </Text>
                </View>
              </View>

              <View style={styles.showcaseServiceRow}>
                <View style={styles.showcaseFeeRow}>
                  <Text size="sm" weight="regular" color="#6B7280">
                    Service Fee — 7%
                  </Text>
                  <View style={styles.showcaseInfoButton}>
                    <Info size={14} color="#9CA3AF" />
                  </View>
                </View>
                <Text size="sm" weight="medium" color="#6B7280">
                  $4.99
                </Text>
              </View>

              <View style={styles.showcaseServiceDivider} />

              <View style={styles.showcaseTotalSection}>
                <View style={styles.showcaseTotalLeft}>
                  <Text size="md" weight="bold" color={BrandColors.primary}>
                    Total
                  </Text>
                  <View style={styles.showcaseSavingsBadge}>
                    <Text size="xs" weight="semiBold" color={BrandColors.secondary}>
                      → Saved $25 vs Dealership
                    </Text>
                  </View>
                </View>
                <Text size="2xl" weight="bold" color={BrandColors.secondary}>
                  $74.99
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text weight="bold" size="lg" color="#111318" style={styles.featureTitle}>
              Credits that unlock real savings
            </Text>
            <Text size="sm" color="#616E89" style={styles.featureBody}>
              Earn dollar credits on every service. Redeem them for your next booking or as a gift
              card.
            </Text>
            <View style={styles.rewardsCard}>
              <View style={styles.rewardsHeader}>
                <Text weight="bold" size="xs" color="#9CA3AF">
                  OWNERSHIP CREDIT
                </Text>
                <Text weight="bold" size="sm" color={BrandColors.secondary}>
                  $12.40
                </Text>
              </View>
              <View style={styles.rewardsTrack}>
                <View style={styles.rewardsFill} />
              </View>
              <Text size="xs" color="#9CA3AF" style={styles.rewardsFootnote}>
                Earn 1% on every service
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text weight="bold" size="lg" color="#111318" style={styles.featureTitle}>
              Invite friends. You both earn credit.
            </Text>
            <Text size="sm" color="#616E89" style={styles.featureBody}>
              Share your unique code. When they book their first service, you each earn $15 credit.
            </Text>
            <View style={styles.inviteRow}>
              <View style={styles.inviteCode}>
                <Text weight="bold" size="sm" color="#111318" style={styles.codeText}>
                  {displayCode}
                </Text>
              </View>
              <Pressable onPress={handleShare} style={styles.inviteShare}>
                <Share2 size={18} color={BrandColors.secondary} />
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.comingSoonCard}>
          <View style={styles.comingSoonIcon}>
            <Rocket size={18} color="#7C3AED" />
          </View>
          <Text weight="bold" size="sm" color="#111318">
            Coming Soon
          </Text>
          <Text size="sm" color="#616E89" style={styles.comingSoonText}>
            Mobile mechanics & professional detailers at your doorstep.
          </Text>
        </View>

        <View style={styles.actionGroup}>
          <Button
            fullWidth
            backgroundColor={BrandColors.secondary}
            textColor="#FFFFFF"
            style={styles.primaryButton}
          >
            Rate Otopair
          </Button>
          <Button
            fullWidth
            backgroundColor="rgba(255, 255, 255, 0.5)"
            textColor={BrandColors.secondary}
            style={styles.secondaryButton}
            onPress={handleShare}
          >
            Share with friends
          </Button>
        </View>

          </Animated.ScrollView>
        )}
      </ScrollDrivenGradientBackground>

      <BlurHeaderOverlay
        title="About"
        titleColor={BrandColors.white}
        onBack={() => router.back()}
        gradientColors={[
          'rgba(82, 153, 254, 1)',
          'rgba(82, 153, 254, 0.7)',
          'rgba(82, 153, 254, 0.3)',
          'rgba(82, 153, 254, 0)',
        ]}
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
    gap: 20,
  },
  identityCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 20,
    gap: 8,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  appIconMark: {
    transform: [{ scale: 0.6 }],
  },
  appName: {
    marginTop: 2,
  },
  versionPill: {
    backgroundColor: 'rgba(156, 163, 175, 0.15)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  featureStack: {
    gap: 16,
  },
  featureCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: 20,
    gap: 12,
  },
  featureTitle: {
    marginBottom: 2,
  },
  featureBody: {
    lineHeight: 20,
  },
  miniCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    padding: 14,
    marginTop: 4,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  progressLine: {
    position: 'absolute',
    left: 20,
    right: 20,
    top: 26,
    height: 2,
    backgroundColor: '#E5E7EB',
  },
  progressStep: {
    alignItems: 'center',
    gap: 6,
  },
  progressDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressDotActive: {
    backgroundColor: BrandColors.secondary,
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
  },
  progressDotMuted: {
    backgroundColor: '#E5E7EB',
  },
  chatCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    padding: 14,
    gap: 10,
  },
  chatBubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    maxWidth: '80%',
  },
  chatBubblePrimary: {
    backgroundColor: BrandColors.secondary,
    alignSelf: 'flex-end',
  },
  chatBubbleLight: {
    backgroundColor: 'rgba(229, 231, 235, 0.8)',
    alignSelf: 'flex-start',
    borderTopLeftRadius: 6,
  },
  chatActions: {
    flexDirection: 'row',
    gap: 8,
  },
  chatChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  rewardsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    padding: 14,
    gap: 10,
  },
  rewardsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rewardsTrack: {
    height: 10,
    backgroundColor: '#E5E7EB',
    borderRadius: 999,
    overflow: 'hidden',
  },
  rewardsFill: {
    height: '100%',
    width: '84%',
    backgroundColor: BrandColors.secondary,
    borderRadius: 999,
  },
  rewardsFootnote: {
    textAlign: 'right',
  },
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  inviteCode: {
    flex: 1,
    backgroundColor: 'rgba(243, 244, 246, 0.7)',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(209, 213, 219, 0.9)',
    borderStyle: 'dashed',
    paddingVertical: 10,
    alignItems: 'center',
  },
  codeText: {
    letterSpacing: 1.6,
  },
  inviteShare: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(82, 153, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  comingSoonCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  comingSoonIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  comingSoonText: {
    textAlign: 'center',
  },
  actionGroup: {
    gap: 12,
    paddingTop: 4,
  },
  primaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
  },
  secondaryButton: {
    borderRadius: 16,
    paddingVertical: 14,
  },
  // Showcase card styles (mirrored from MaintenanceTracker)
  showcaseCardOuter: {
    marginTop: 4,
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  showcaseBlurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 16,
  },
  showcaseWhiteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },
  showcaseCard: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderRadius: 16,
  },
  showcaseCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  showcaseLeftColumn: {
    flex: 1,
    justifyContent: 'flex-start',
    gap: 6,
  },
  showcaseRightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
    gap: 10,
  },
  showcaseBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  showcaseDetailSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  showcaseDetailTextContainer: {
    flex: 1,
    gap: 2,
  },
  showcaseStatusIconContainer: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  showcasePrimaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    minWidth: 90,
    backgroundColor: 'rgba(20, 28, 36, 0.9)',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  showcaseAiTextContainer: {
    paddingVertical: 4, // Spacing.xs
  },
  showcaseMessageText: {
    color: '#141C24', // BrandColors.primary
    lineHeight: 20,
    fontSize: 13,
  },
  showcaseServiceCard: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  showcaseServiceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  showcaseServiceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  showcaseBreakdownSection: {
    marginTop: Spacing.xs,
    paddingTop: Spacing.xs,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  showcaseBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  showcaseFeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  showcaseInfoButton: {
    padding: 2,
  },
  showcaseServiceDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: Spacing.sm,
  },
  showcaseTotalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  showcaseTotalLeft: {
    gap: 2,
  },
  showcaseSavingsBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
});
