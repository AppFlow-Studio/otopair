import React, { useCallback, useMemo, useState } from 'react';
import { Image, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { X, Copy, Gift, HelpCircle, ArrowRight } from 'lucide-react-native';

import { BrandColors, Button, Text } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

function stableShortHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return String(h % 1000000).padStart(6, '0');
}

export default function ReferAFriendScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  const data = useOnboardingStore((s) => s.data);

  const referralCode = useMemo(() => {
    const base =
      (data.username ?? '').trim() ||
      (data.email ?? '').split('@')[0]?.trim() ||
      `${(data.firstName ?? '').trim()}${(data.lastName ?? '').trim()}`.trim() ||
      'user';

    const normalized = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'user';
    return `otopair-${normalized}${stableShortHash(normalized)}`;
  }, [data.email, data.firstName, data.lastName, data.username]);

  const handleCopy = useCallback(async () => {
    await Clipboard.setStringAsync(referralCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  }, [referralCode]);

  const handleInvite = useCallback(async () => {
    const message =
      `Join Otopair and get 250 points on your first booking!\n\n` +
      `Use my referral code: ${referralCode}\n`;
    await Share.share({ message });
  }, [referralCode]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton} hitSlop={10}>
          <X size={18} color="#111827" />
        </Pressable>
        <Text weight="semiBold" size="lg" color="#111827" style={styles.headerTitle}>
          Refer A Friend
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        // Extra padding so the bottom CTA isn't obscured by the bottom tab bar.
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroImageWrap}>
            <Image
              source={require('@/assets/images/settings/stack-blue-tokens.png')}
              style={styles.heroImage}
              resizeMode="contain"
            />
          </View>

          <Text weight="bold" size="2xl" color="#111827" style={styles.heroTitle}>
            Get 250 points for referring friends
          </Text>
          <Text size="md" color="#6B7280" style={styles.heroSubtitle}>
            Refer up to 50 friends who are new to Otopair. If they create an account:
          </Text>
        </View>

        {/* Info cards */}
        <View style={styles.cards}>
          <View style={styles.infoCard}>
            <View style={styles.infoIconBox}>
              <Gift size={18} color={BrandColors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="semiBold" size="md" color="#111827">
                You get 250 points for your next booking
              </Text>
              <Text size="sm" color="#6B7280" style={{ marginTop: 4 }}>
                $25 minimum order • Next booking only • Some merchants excluded • Valid for 90 days
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <View style={styles.infoIconBox}>
              <Gift size={18} color={BrandColors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="semiBold" size="md" color="#111827">
                Your friend gets 250 points for their first booking
              </Text>
              <Text size="sm" color="#6B7280" style={{ marginTop: 4 }}>
                $25 minimum order • Next booking only • Some merchants excluded • Valid for 90 days
              </Text>
            </View>
          </View>

          <Pressable style={styles.faqCard} onPress={() => console.log('Referral FAQ pressed')}>
            <View style={styles.infoIconBox}>
              <HelpCircle size={18} color={BrandColors.secondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight="semiBold" size="md" color="#111827">
                Referral FAQ
              </Text>
              <Text size="sm" color="#6B7280" style={{ marginTop: 2 }}>
                See offer terms, eligibility rules, and FAQ
              </Text>
            </View>
            <ArrowRight size={18} color="#9CA3AF" />
          </Pressable>
        </View>

        {/* Code row */}
        <View style={styles.codeSection}>
          <View style={styles.codeRow}>
            <Text weight="semiBold" size="md" color="#111827" style={styles.codeText} numberOfLines={1}>
              {referralCode}
            </Text>
            <Pressable onPress={handleCopy} style={styles.copyButton}>
              <Copy size={16} color="#111827" />
              <Text weight="medium" size="sm" color="#111827" style={{ marginLeft: 8 }}>
                {copied ? 'Copied' : 'Copy Code'}
              </Text>
            </Pressable>
          </View>

          <Button variant="primary" fullWidth style={styles.inviteButton} onPress={handleInvite}>
            Invite Friends
          </Button>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    paddingHorizontal: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 0,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
  },
  hero: {
    // Keep the hero tight so the illustration doesn't push content too far down
    paddingBottom: 14,
  },
  heroImageWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -25,
    marginBottom: -25,
  },
  heroImage: {
    width: 500,
    height: 250,
  },
  heroTitle: {
    marginTop: 0,
    lineHeight: 32,
  },
  heroSubtitle: {
    marginTop: 8,
    lineHeight: 22,
  },
  cards: {
    gap: 12,
  },
  infoCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
  },
  faqCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
  },
  infoIconBox: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: 'rgba(82, 153, 254, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  codeSection: {
    marginTop: 18,
    gap: 14,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF2F7',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  codeText: {
    flex: 1,
    marginRight: 10,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.06)',
  },
  inviteButton: {
    borderRadius: 16,
    paddingVertical: 14,
  },
});

