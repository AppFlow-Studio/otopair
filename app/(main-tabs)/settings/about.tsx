/**
 * AboutOtopairScreen
 *
 * PURPOSE: Highlights app features and version details.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 */

import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  Check,
  CheckCheck,
  Droplet,
  Rocket,
  Share2,
  Sparkles,
  Wrench,
} from 'lucide-react-native';

import { OtoPairIcon } from '@/components/icons/oto-pair';
import { BlurHeaderOverlay, BrandColors, Button, Text, buildReferralCode, buildReferralShareMessage } from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

export default function AboutOtopairScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useOnboardingStore((s) => s.data);

  const referralCode = useMemo(
    () => buildReferralCode(data),
    [data.email, data.firstName, data.lastName, data.username]
  );

  const displayCode = referralCode.toUpperCase();

  const handleShare = useCallback(async () => {
    await Share.share({ message: buildReferralShareMessage(displayCode) });
  }, [displayCode]);

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
            <View style={styles.miniRow}>
              <View style={styles.miniRowLeft}>
                <View style={styles.iconBubble}>
                  <Droplet size={18} color="#EA580C" />
                </View>
                <View>
                  <Text weight="bold" size="sm" color="#111318">
                    Oil Change
                  </Text>
                  <Text weight="medium" size="xs" color="#EF4444">
                    Due in 2 days
                  </Text>
                </View>
              </View>
              <Pressable style={styles.miniButton}>
                <Text weight="semiBold" size="xs" color="#FFFFFF">
                  Book
                </Text>
              </Pressable>
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
              <View style={[styles.chatBubble, styles.chatBubbleLight]}>
                <Text size="xs" color="#111318">
                  It could mean low brake fluid or worn pads. Let&apos;s check your last service.
                </Text>
              </View>
              <View style={styles.chatActions}>
                <View style={styles.chatChip}>
                  <Text weight="medium" size="xs" color={BrandColors.secondary}>
                    Schedule checkup
                  </Text>
                </View>
                <View style={styles.chatChip}>
                  <Text weight="medium" size="xs" color={BrandColors.secondary}>
                    Dismiss
                  </Text>
                </View>
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
            <View style={styles.receiptCard}>
              <View style={styles.receiptRow}>
                <Text size="xs" color="#6B7280">
                  Synthetic Oil 5W-30
                </Text>
                <Text weight="bold" size="xs" color="#111318">
                  $45.00
                </Text>
              </View>
              <View style={styles.receiptRow}>
                <Text size="xs" color="#6B7280">
                  Labor (0.5hr)
                </Text>
                <Text weight="bold" size="xs" color="#111318">
                  $50.00
                </Text>
              </View>
              <View style={[styles.receiptRow, styles.receiptTotalRow]}>
                <Text weight="bold" size="sm" color="#111318">
                  Total Paid
                </Text>
                <Text weight="bold" size="sm" color={BrandColors.secondary}>
                  $95.00
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text weight="bold" size="lg" color="#111318" style={styles.featureTitle}>
              Points that unlock real rewards
            </Text>
            <Text size="sm" color="#616E89" style={styles.featureBody}>
              Earn points on every service. Redeem them for discounts, free washes, or maintenance
              credits.
            </Text>
            <View style={styles.rewardsCard}>
              <View style={styles.rewardsHeader}>
                <Text weight="bold" size="xs" color="#9CA3AF">
                  GOLD TIER
                </Text>
                <Text weight="bold" size="sm" color={BrandColors.secondary}>
                  840 / 1000 pts
                </Text>
              </View>
              <View style={styles.rewardsTrack}>
                <View style={styles.rewardsFill} />
              </View>
              <Text size="xs" color="#9CA3AF" style={styles.rewardsFootnote}>
                160 pts to next reward
              </Text>
            </View>
          </View>

          <View style={styles.featureCard}>
            <Text weight="bold" size="lg" color="#111318" style={styles.featureTitle}>
              Invite friends. You both get points.
            </Text>
            <Text size="sm" color="#616E89" style={styles.featureBody}>
              Share your unique code. When they book their first service, you each earn 250 points.
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

      </ScrollView>

      <BlurHeaderOverlay title="About" onBack={() => router.back()} />
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
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    padding: 12,
  },
  miniRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(251, 146, 60, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 6,
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
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    maxWidth: '85%',
  },
  chatBubblePrimary: {
    backgroundColor: BrandColors.secondary,
    alignSelf: 'flex-end',
    borderTopRightRadius: 6,
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
  receiptCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    padding: 14,
    gap: 10,
  },
  receiptRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(209, 213, 219, 0.7)',
    paddingBottom: 8,
  },
  receiptTotalRow: {
    borderBottomWidth: 0,
    paddingBottom: 0,
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
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
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
});
