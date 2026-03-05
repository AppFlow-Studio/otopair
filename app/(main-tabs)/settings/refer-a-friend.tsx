/**
 * ReferAFriendScreen
 *
 * PURPOSE: iOS 26-style rewards dashboard converted from provided HTML.
 */

import React, { useCallback, useMemo } from 'react';
import {
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Gift,
  Copy,
  Share2,
  Smartphone,
} from 'lucide-react-native';

import { BrandColors, Text, BlurHeaderOverlay, buildReferralShareMessage, useReferralCode } from '@/components/shared-ui';
import { ScrollDrivenGradientBackground } from '@/components/shared-ui/ScrollDrivenGradientBackground';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

const COLORS = {
  primary: '#2463eb',
  backgroundLight: '#F5F5F7',
  glassLight: 'rgba(255, 255, 255, 0.72)',
  textDark: '#1c1c1e',
  textMuted: '#6B7280',
};

const GlassPanel = ({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) => {
  return (
    <BlurView
      intensity={20}
      tint="light"
      style={[
        styles.glassPanel,
        { backgroundColor: COLORS.glassLight },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
};

export default function ReferAFriendScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const data = useOnboardingStore((s) => s.data);

  const referralCode = useReferralCode(data);

  const displayCode = referralCode.toUpperCase();

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(displayCode);
  }, [displayCode]);

  const handleShare = useCallback(async () => {
    await Share.share({ message: buildReferralShareMessage(displayCode) });
  }, [displayCode]);

  return (
    <View style={styles.screen}>
      <ScrollDrivenGradientBackground>
        {(scrollHandler) => (
          <>
            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.content,
                { paddingTop: insets.top + 80, paddingBottom: insets.bottom + 32 },
              ]}
            >
            <GlassPanel style={styles.heroCard}>
              <View style={styles.heroIconWrap}>
                <Gift size={36} color={COLORS.primary} strokeWidth={1.75} />
              </View>
              <View style={styles.heroTextGroup}>
                <Text
                  weight="extraBold"
                  style={[styles.heroTitle, { color: COLORS.textDark } ]}
                >
                  Give $15, get $15
                </Text>
                <Text
                  size="md"
                  color={COLORS.textMuted}
                  style={styles.heroDescription}
                >
                  Invite your friends to Otopair. They get $15 credit for their first booking,
                  and you get $15 credit.
                </Text>
              </View>
              <View
                style={[
                  styles.codeRow,
                  { backgroundColor: '#FFFFFF' },
                ]}
              >
                <View style={styles.codeTextContainer}>
                  <Text
                    weight="bold"
                    numberOfLines={1}
                    ellipsizeMode="clip"
                    style={[
                      styles.codeText,
                      { color: COLORS.textDark },
                    ]}
                  >
                    {displayCode}
                  </Text>
                </View>
                <Pressable
                  onPress={handleCopy}
                  style={({ pressed }) => [
                    styles.copyButton,
                    pressed && styles.pressed,
                  ]}
                >
                  <Copy size={18} color={COLORS.primary} strokeWidth={2.2} />
                  <Text weight="semiBold" style={styles.copyLabel}>
                    Copy
                  </Text>
                </Pressable>
              </View>
              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.shareButton,
                  pressed && styles.sharePressed,
                ]}
              >
                <Share2 size={20} color="#FFFFFF" strokeWidth={2} />
                <Text weight="bold" size="md" color="#FFFFFF">
                  Share invite
                </Text>
              </Pressable>
            </GlassPanel>

            <View style={styles.statsRow}>
              <GlassPanel style={styles.statCard}>
                <Text
                  size="xs"
                  color={COLORS.textMuted}
                  style={styles.statLabel}
                >
                  Total credit{'\n'}earned
                </Text>
                <Text
                  weight="bold"
                  style={[styles.statValue, { color: COLORS.textDark }]}
                >
                  $45
                </Text>
              </GlassPanel>
              <GlassPanel style={styles.statCard}>
                <Text
                  size="xs"
                  color={COLORS.textMuted}
                  style={styles.statLabel}
                >
                  Successful{'\n'}referrals
                </Text>
                <Text
                  weight="bold"
                  style={[styles.statValue, { color: COLORS.textDark }]}
                >
                  3
                </Text>
              </GlassPanel>
            </View>

            <GlassPanel style={styles.activityCard}>
              <View style={styles.activityHeader}>
                <Text
                  weight="bold"
                  size="md"
                  style={{ color: COLORS.textDark }}
                >
                  Activity
                </Text>
              </View>

              <Pressable style={styles.activityRow}>
                <LinearGradient
                  colors={['#DBEAFE', '#EFF6FF']}
                  style={styles.avatarGradient}
                >
                  <Text weight="bold" size="sm" color={COLORS.primary}>
                    SM
                  </Text>
                </LinearGradient>
                <View style={styles.activityText}>
                  <View style={styles.activityTopRow}>
                    <Text
                      weight="semiBold"
                      size="sm"
                      style={{ color: COLORS.textDark }}
                    >
                      Sarah M.
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text weight="semiBold" size="xs" color={COLORS.primary}>
                        Completed
                      </Text>
                    </View>
                  </View>
                  <Text size="xs" color={COLORS.textMuted}>
                    Earned $15 credit
                  </Text>
                </View>
              </Pressable>

              <View style={styles.activityDivider} />

              <Pressable style={styles.activityRow}>
                <View
                  style={[
                    styles.phoneAvatar,
                    { backgroundColor: '#F3F4F6' },
                  ]}
                >
                  <Smartphone size={20} color="#6B7280" />
                </View>
                <View style={styles.activityText}>
                  <View style={styles.activityTopRow}>
                    <Text
                      weight="semiBold"
                      size="sm"
                      style={{ color: COLORS.textDark }}
                    >
                      Phone ending in 9021
                    </Text>
                    <View style={styles.pendingBadge}>
                      <Text weight="semiBold" size="xs" color="#9CA3AF">
                        Pending
                      </Text>
                    </View>
                  </View>
                  <Text size="xs" color={COLORS.textMuted}>
                    Waiting for first service
                  </Text>
                </View>
              </Pressable>
            </GlassPanel>

            <View style={styles.footer}>
              <Text size="xs" color="#9CA3AF">
                Terms apply.{' '}
                <Text
                  size="xs"
                  color={COLORS.primary}
                  onPress={() => {}}
                  style={styles.footerLink}
                >
                  View referral terms
                </Text>
              </Text>
            </View>
            </Animated.ScrollView>
          </>
        )}
      </ScrollDrivenGradientBackground>

      <BlurHeaderOverlay
        title="Refer a Friend"
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
  },
  glassPanel: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 16,
  },
  heroCard: {
    padding: 24,
    alignItems: 'center',
  },
  heroIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 16,
    backgroundColor: 'rgba(37, 99, 235, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroTextGroup: {
    gap: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 28,
    letterSpacing: -0.5,
    textAlign: 'center',
    paddingBottom: 6
  },
  heroDescription: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 300,
  },
  codeRow: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    marginBottom: 16,
    justifyContent: 'space-between',
  },
  codeTextContainer: {
    flex: 1,
    marginRight: 12,
    overflow: 'hidden',
  },
  codeText: {
    fontFamily: 'JetBrains Mono',
    fontSize: 16,
    letterSpacing: 1.2,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  copyLabel: {
    color: COLORS.primary,
    fontSize: 15,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 52,
    borderRadius: 12,
    gap: 8,
    backgroundColor: COLORS.primary,
  },
  pressed: {
    opacity: 0.7,
  },
  sharePressed: {
    transform: [{ scale: 0.98 }],
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    padding: 20,
    minHeight: 100,
    justifyContent: 'space-between',
  },
  statLabel: {
    lineHeight: 16,
  },
  statValue: {
    fontSize: 28,
  },
  activityCard: {
    padding: 0,
  },
  activityHeader: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  avatarGradient: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
    gap: 4,
  },
  activityTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusBadge: {
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  pendingBadge: {
    backgroundColor: 'rgba(0,0,0,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  activityDivider: {
    height: 1,
    marginLeft: 68,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  footer: {
    paddingBottom: 12,
    alignItems: 'center',
  },
  footerLink: {
    textDecorationLine: 'underline',
  },
});
