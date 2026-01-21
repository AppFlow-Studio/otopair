/**
 * ReferAFriendScreen
 *
 * PURPOSE: Referral program page where users can share their unique code and view rewards.
 *          Features hero card, referral stats, and history list.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <ReferAFriendScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useMemo, useState, useRef } from 'react';
import { 
  Pressable, 
  ScrollView, 
  Share, 
  StyleSheet, 
  View
} from 'react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  FadeInDown,
  FadeOutUp,
  LinearTransition, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { 
  X, 
  HelpCircle, 
  Handshake, 
  UserCircle2, 
  UserPlus2, 
  BarChart3,
  Share2,
  User,
  ChevronDown,
} from 'lucide-react-native';

import { AppBottomSheetModal, BrandColors, Spacing, Text } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { Layout } from '@/constants/theme';
import { IntersectSquareIcon } from 'phosphor-react-native';

const FAQ_ITEMS = [
  {
    id: '1',
    question: 'How do referral codes work?',
    answer: 'Share your unique code with friends. When they complete their first service using Otopair, you each automatically earn 250 bonus points in your wallet.',
  },
  {
    id: '2',
    question: 'When do I get my points?',
    answer: "Points are credited to your account instantly after your referred friend's service is marked as \"Completed\" by the technician.",
  },
  {
    id: '3',
    question: 'Is there a minimum order?',
    answer: 'Yes, the referred friend must book a service with a minimum value of $25.00 for the referral bonus to be activated for both parties.',
  },
  {
    id: '4',
    question: 'Do points expire?',
    answer: "Referral points are valid for 90 days from the date they are credited. We'll send you a reminder notification 30 days before they expire.",
  },
  {
    id: '5',
    question: 'Can I refer multiple friends?',
    answer: 'Absolutely! You can refer up to 50 friends. The more friends you bring to Otopair, the more points you earn towards free services.',
  },
];

const FAQAccordionItem = ({ 
  item, 
  isExpanded, 
  onToggle 
}: { 
  item: typeof FAQ_ITEMS[0], 
  isExpanded: boolean, 
  onToggle: () => void 
}) => {
  const rotationStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: withTiming(isExpanded ? '180deg' : '0deg') }],
    };
  }, [isExpanded]);

  return (
    <Animated.View 
      layout={LinearTransition.duration(300)}
      style={[styles.faqItem, isExpanded && styles.faqItemExpanded]}
    >
      <Pressable onPress={onToggle}>
        <View style={styles.faqQuestionRow}>
          <Text weight="semiBold" size="md" color="#111827" style={styles.faqQuestionText}>
            {item.question}
          </Text>
          <Animated.View style={rotationStyle}>
            <ChevronDown size={20} color={isExpanded ? BrandColors.secondary : "#94A3B8"} />
          </Animated.View>
        </View>
        {isExpanded && (
          <Animated.View 
            entering={FadeIn.duration(300)} 
            exiting={FadeOut.duration(200)}
            style={styles.faqAnswerContainer}
          >
            <Text size="sm" color="#6B7280" style={styles.faqAnswerText}>
              {item.answer}
            </Text>
          </Animated.View>
        )}
      </Pressable>
    </Animated.View>
  );
};

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
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['85%'], []);

  const handleOpenFaq = useCallback(() => {
    bottomSheetRef.current?.present();
  }, []);

  const handleCloseFaq = useCallback(() => {
    bottomSheetRef.current?.dismiss();
  }, []);


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

  const handleInvite = useCallback(async () => {
    const message =
      `Join Otopair and get 250 points on your first booking!\n\n` +
      `Use my referral code: ${referralCode}\n`;
    await Share.share({ message });
  }, [referralCode]);

  // Mock data for history to match screenshot
const history = [
    { id: '1', name: 'Sarah Jenkins', date: 'Joined Oct 24, 2023', points: '+250 pts', status: 'Completed', color: '#E2E8F0', initials: 'SJ' },
    { id: '2', name: 'Mike Ross', date: 'Invite sent Oct 22, 2023', points: '0 pts', status: 'Pending', color: '#F3E8FF', initials: 'MR' },
    { id: '3', name: 'Jessica Pearson', date: 'Joined Oct 15, 2023', points: '+250 pts', status: 'Completed', color: '#FFEDD5', initials: 'JP' },
    { id: '4', name: 'Louis Spector', date: 'Joined Oct 10, 2023', points: '+250 pts', status: 'Completed', color: '#DBEAFE', initials: 'LS' },
    { id: '5', name: 'Donna Paulsen', date: 'Joined Oct 05, 2023', points: '+250 pts', status: 'Completed', color: '#FEE2E2', initials: 'DP' },
    { id: '6', name: 'Harvey Specter', date: 'Joined Sep 28, 2023', points: '+250 pts', status: 'Completed', color: '#FEF3C7', initials: 'HS' },
  ];

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <X size={18} color="#111827" />
        </Pressable>
        <Text weight="bold" size="lg" color="#111827" style={styles.headerTitle}>
          Refer a Friend
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + Layout.footerHeight }]}
      >
        {/* Main Hero Card */}
        <View style={styles.heroCard}>
          <View style={styles.heroIllustrationBox}>
            <View style={styles.handshakeCircle}>
              <Handshake size={48} color={BrandColors.secondary} strokeWidth={1.5} />
            </View>
          </View>

          <View style={styles.heroTextContainer}>
            <Text weight="bold" size="xs" color={BrandColors.secondary} style={styles.heroLabel}>
              OTOPAIR REFERRAL
            </Text>
            <Text weight="bold" size="2xl" color="#111827" style={styles.heroTitle}>
              Give 250, Get 250
            </Text>
            <Text size="sm" color="#6B7280" style={styles.heroDesc}>
              Share your unique code. When your friend books their first service, you both earn rewards.
            </Text>
          </View>

          {/* Give/Get Mini Cards */}
          <View style={styles.miniCardsRow}>
            <View style={styles.miniCard}>
              <View style={[styles.miniIconBox, { backgroundColor: '#EFF6FF' }]}>
                <UserCircle2 size={20} color="#3B82F6" />
              </View>
              <Text weight="semiBold" size="xs" color="#9CA3AF" style={styles.miniLabel}>YOU GET</Text>
              <Text weight="bold" size="sm" color="#111827">250 points</Text>
            </View>
            <View style={styles.miniCard}>
              <View style={[styles.miniIconBox, { backgroundColor: '#EFF6FF' }]}>
                <UserPlus2 size={20} color="#3B82F6" />
              </View>
              <Text weight="semiBold" size="xs" color="#9CA3AF" style={styles.miniLabel}>FRIEND GETS</Text>
              <Text weight="bold" size="sm" color="#111827">250 points</Text>
            </View>
          </View>

          <Pressable style={styles.faqLink} onPress={handleOpenFaq}>
            <HelpCircle size={16} color={BrandColors.secondary} />
            <Text weight="medium" size="sm" color={BrandColors.secondary}>Referral FAQ</Text>
          </Pressable>

          {/* Referral Code Box */}
          <View style={styles.codeBox}>
            <Text weight="bold" size="md" color="#111827" style={styles.codeText}>
              {referralCode}
            </Text>
            <Pressable onPress={handleInvite} style={styles.copyBtn}>
              <Share2 size={18} color="#FFF" />
            </Pressable>
          </View>
        </View>

        {/* Stats Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text weight="bold" size="lg" color="#111827">Referral Stats</Text>
            <BarChart3 size={18} color="#94A3B8" />
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text weight="medium" size="sm" color="#64748B">Points Earned</Text>
              <View>
                <Text weight="extraBold" size="2xl" color={BrandColors.secondary}>1,250</Text>
                <Text size="xs" color="#94A3B8">Lifetime earnings</Text>
              </View>
            </View>
            
            <View style={styles.statCard}>
              <Text weight="medium" size="sm" color="#64748B">Successful Referrals</Text>
              <View style={styles.statBottom}>
                <Text weight="extraBold" size="2xl" color="#111827">5</Text>
                <View style={styles.highFiveBadge}>
                  <Text weight="bold" size="xs" color="#16A34A">High Five!</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* History Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text weight="bold" size="lg" color="#111827">Referral History</Text>
            <Pressable>
              <Text weight="semiBold" size="sm" color={BrandColors.secondary}>View All</Text>
            </Pressable>
          </View>

          <View style={styles.historyList}>
            {history.map((item, index) => (
              <View 
                key={item.id} 
                style={[
                  styles.historyItem,
                  index === history.length - 1 && { borderBottomWidth: 0 }
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: item.color }]}>
                  {item.initials ? (
                    <Text weight="bold" size="sm" color="#1F2937">{item.initials}</Text>
                  ) : (
                    <User size={20} color="#64748B" />
                  )}
                </View>
                <View style={styles.itemInfo}>
                  <Text weight="bold" size="sm" color="#111827">{item.name}</Text>
                  <Text size="xs" color="#64748B" style={{ marginTop: 2 }}>{item.date}</Text>
                </View>
                <View style={styles.itemRight}>
                  <Text weight="bold" size="sm" color={item.points === '0 pts' ? '#94A3B8' : BrandColors.secondary}>
                    {item.points}
                  </Text>
                  <View style={[
                    styles.statusBadge,
                    item.status === 'Completed' ? styles.statusCompleted : styles.statusPending
                  ]}>
                    <Text weight="bold" size="xs" color={item.status === 'Completed' ? '#16A34A' : '#64748B'}>
                      {item.status}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      {/* Sticky Footer Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
        <Pressable style={styles.shareBtn} onPress={handleInvite}>
          <Share2 size={20} color="#FFF" />
          <Text weight="bold" size="lg" color="#FFF">Share Your Link</Text>
        </Pressable>
      </View>

      <AppBottomSheetModal 
        ref={bottomSheetRef} 
        snapPoints={[ '85%', '90%' ]} 
        initialIndex={1} 
        title="Referral FAQ"
        footer={
          <View style={[ styles.faqSupportSection, {paddingBottom: insets.bottom + Spacing['2xl'] } ]}>
            <Text size="sm" color="#94A3B8" style={styles.faqSupportLabel}>
              Still have questions?
            </Text>
            <Pressable onPress={() => console.log('Contact Support')}>
              <Text weight="bold" size="md" color={BrandColors.secondary}>
                Contact Support
              </Text>
            </Pressable>
          </View>
        }
      >
        <View style={styles.faqSectionLabel}>
          <Text weight="semiBold" size="xs" color="#94A3B8" style={styles.faqSectionLabelText}>
            TOP QUESTIONS
          </Text>
        </View>

        {FAQ_ITEMS.map((item) => (
          <FAQAccordionItem
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
          />
        ))}
      </AppBottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    paddingHorizontal: Spacing['2xl'],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
  },
  backButton: {
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
  scrollContent: {
    paddingTop: 10,
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 3,
    marginBottom: 24,
  },
  heroIllustrationBox: {
    width: '100%',
    aspectRatio: 2,
    backgroundColor: '#F1F5F9',
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  handshakeCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTextContainer: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: 24,
  },
  heroLabel: {
    letterSpacing: 1,
    marginBottom: 4,
  },
  heroTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  heroDesc: {
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  miniCardsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  miniCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 20,
    padding: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  miniIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  miniLabel: {
    marginBottom: 4,
  },
  faqLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 20,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
    borderRadius: 20,
    padding: 6,
    paddingLeft: 20,
  },
  codeText: {
    letterSpacing: 0.5,
  },
  copyBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: BrandColors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statCard: {
    flex: 1,
    height: 120,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 16,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  statBottom: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  highFiveBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  historyList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusCompleted: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  statusPending: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 20,
    backgroundColor: 'rgba(232, 236, 240, 0.95)',
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BrandColors.secondary,
    borderRadius: 20,
    height: 60,
    gap: 12,
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 15,
    elevation: 5,
  },
  faqSectionLabel: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  faqSectionLabelText: {
    letterSpacing: 1,
  },
  faqItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  faqItemExpanded: {
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  faqQuestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  faqQuestionText: {
    flex: 1,
    paddingRight: 16,
  },
  faqAnswerContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  faqAnswerText: {
    lineHeight: 20,
  },
  faqSupportSection: {
    alignItems: 'center',
    gap: 8,
  },
  faqSupportLabel: {
    textAlign: 'center',
  },
});
