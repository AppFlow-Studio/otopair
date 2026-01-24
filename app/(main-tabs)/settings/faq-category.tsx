/**
 * FAQCategoryScreen
 *
 * PURPOSE: Category-specific FAQ screen with accordion items and support footer.
 *
 * USED IN: app/(main-tabs)/settings/faq.tsx
 *
 * PROPS: None (accessed via router params)
 *
 * EXAMPLE:
 *   <FAQCategoryScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { X, ChevronDown, ChevronRight } from 'lucide-react-native';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, withTiming } from 'react-native-reanimated';

import { BrandColors, Spacing, Text } from '@/components/shared-ui';
import { ScrollDrivenGradientBackground } from '@/components/shared-ui/ScrollDrivenGradientBackground';
import { FadeHeaderContainer } from '@/components/shared-ui/FadeHeaderContainer';

const HEADER_FADE_COLORS: [string, string, string, string] = [
  'rgba(82, 153, 254, 1)',    // Opaque blue (BrandColors.secondary)
  'rgba(82, 153, 254, 0.7)',
  'rgba(82, 153, 254, 0.3)',
  'rgba(82, 153, 254, 0)',    // Transparent
];

type CategoryKey = 'getting-started' | 'bookings' | 'vehicles' | 'payments' | 'loyalty' | 'pass' | 'general';

const CATEGORY_CONTENT: Record<
  CategoryKey,
  { title: string; description: string; items: Array<{ id: string; question: string; answer: string; actionLabel?: string }> }
> = {
  'getting-started': {
    title: 'Getting started',
    description: 'Learn the basics of setting up your account and booking your first service.',
    items: [
      { id: 'gs-1', question: 'How do I create an account?', answer: 'Tap Sign Up and follow the prompts to set up your profile and vehicle details.' },
      { id: 'gs-2', question: 'How do I add my first vehicle?', answer: 'From Settings, go to My Vehicles and tap Add Vehicle to enter your car information.' },
      { id: 'gs-3', question: 'How do I book my first service?', answer: 'Choose a service, select a time, and confirm your booking to get started.' },
    ],
  },
  bookings: {
    title: 'Bookings & services',
    description: 'Everything you need to know about scheduling and managing services.',
    items: [
      { id: 'bk-1', question: 'How do I book a mobile service?', answer: 'Pick a service, choose your address and time window, then confirm your booking.' },
      { id: 'bk-2', question: 'Can I reschedule a booking?', answer: 'Yes. Open the booking in your history and select Reschedule to pick a new time.' },
      { id: 'bk-3', question: 'What services are available?', answer: 'Otopair offers maintenance and repair services based on your vehicle and location.' },
    ],
  },
  vehicles: {
    title: 'Vehicles',
    description: 'Manage your vehicles and mileage tracking.',
    items: [
      { id: 'vh-1', question: 'How do I add multiple vehicles?', answer: 'Go to My Vehicles and tap Add Vehicle for each additional car.' },
      { id: 'vh-2', question: 'Can I remove a vehicle?', answer: 'Yes. Open a vehicle and choose Remove Vehicle at the bottom of the screen.' },
      { id: 'vh-3', question: 'How do I update mileage?', answer: 'Open the vehicle details and edit the mileage field.' },
    ],
  },
  payments: {
    title: 'Payments & billing',
    description: 'Learn how billing works and how to manage payment methods.',
    items: [
      { id: 'pm-1', question: 'Which payment methods are supported?', answer: 'We accept major credit and debit cards. More methods will be added soon.' },
      { id: 'pm-2', question: 'How do I update my card?', answer: 'Go to Payment Methods and add or remove cards from your wallet.' },
      { id: 'pm-3', question: 'Where can I find my receipts?', answer: 'Receipts are available under Transactions & Receipts in Settings.' },
    ],
  },
  loyalty: {
    title: 'Loyalty & rewards',
    description: 'Learn how to earn and redeem Points within the Otopair ecosystem.',
    items: [
      {
        id: 'lr-1',
        question: 'How do I earn Points?',
        answer:
          'You earn Points for every dollar spent on repairs and by referring friends. Points are automatically added to your wallet after service completion.',
        actionLabel: 'Go to Referrals',
      },
      {
        id: 'lr-2',
        question: 'When do Points expire?',
        answer:
          'Points expire 12 months after they are earned if there is no account activity. Any new earning or redemption activity extends the expiration of all points by another 12 months.',
      },
      {
        id: 'lr-3',
        question: 'Can I transfer Points?',
        answer:
          'Currently, Points are non-transferable and can only be used by the account holder. You can use your points to pay for a service booked for a family member’s vehicle registered under your account.',
      },
    ],
  },
  pass: {
    title: 'Otopair Pass',
    description: 'Details about Otopair Pass benefits and billing.',
    items: [
      { id: 'op-1', question: 'What is Otopair Pass?', answer: 'Otopair Pass gives you exclusive discounts, priority booking, and added service perks.' },
      { id: 'op-2', question: 'How do I subscribe?', answer: 'Go to Settings > Otopair Pass to view plans and subscribe.' },
      { id: 'op-3', question: 'Can I cancel anytime?', answer: 'Yes. You can cancel from the Otopair Pass screen and keep access until the end of the billing period.' },
    ],
  },
  general: {
    title: 'General',
    description: 'General questions about availability and coverage.',
    items: [
      { id: 'gn-1', question: 'Where is Otopair available?', answer: 'Otopair is expanding city by city. Check the app for your current coverage area.' },
      { id: 'gn-2', question: 'How do I contact support?', answer: 'Use the Submit a ticket button below or visit the Help Center in Settings.' },
      { id: 'gn-3', question: 'Is my data secure?', answer: 'We use secure encryption and follow industry best practices to protect your data.' },
    ],
  },
};

const FAQAccordionItem = ({
  item,
  isExpanded,
  onToggle,
}: {
  item: { question: string; answer: string; actionLabel?: string };
  isExpanded: boolean;
  onToggle: () => void;
}) => {
  const rotationStyle = useAnimatedStyle(() => {
    return {
      transform: [{ rotate: withTiming(isExpanded ? '180deg' : '0deg') }],
    };
  }, [isExpanded]);

  return (
    <Animated.View layout={LinearTransition.duration(280)} style={styles.accordionRow}>
      <Pressable onPress={onToggle} style={styles.accordionHeader}>
        <Text weight="semiBold" size="md" color="#111318" style={styles.accordionTitle}>
          {item.question}
        </Text>
        <Animated.View style={rotationStyle}>
          <ChevronDown size={20} color={isExpanded ? '#111318' : '#616E89'} />
        </Animated.View>
      </Pressable>
      {isExpanded && (
        <Animated.View entering={FadeIn.duration(250)} exiting={FadeOut.duration(180)} style={styles.accordionBody}>
          <Text size="sm" color="#616E89" style={styles.accordionBodyText}>
            {item.answer}
          </Text>
          {item.actionLabel ? (
            <Pressable style={styles.deepLinkButton} onPress={() => console.log('Go to referrals')}>
              <Text weight="medium" size="sm" color={BrandColors.secondary}>
                {item.actionLabel}
              </Text>
              <ChevronRight size={18} color={BrandColors.secondary} />
            </Pressable>
          ) : null}
        </Animated.View>
      )}
    </Animated.View>
  );
};

export default function FAQCategoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: CategoryKey }>();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const content = useMemo(() => {
    return CATEGORY_CONTENT[category ?? 'loyalty'] ?? CATEGORY_CONTENT.loyalty;
  }, [category]);

  useEffect(() => {
    setExpandedId(content.items[0]?.id ?? null);
  }, [content]);

  return (
    <View style={styles.screen}>
      <ScrollDrivenGradientBackground>
        {(scrollHandler) => (
          <>
            <FadeHeaderContainer
              paddingTop={insets.top + 10}
              paddingHorizontal={20}
              colors={HEADER_FADE_COLORS}
              fadeHeight={20}
            >
              <View style={styles.header}>
                <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
                  <X size={18} color="#1F2937" />
                </Pressable>
                <Text weight="semiBold" size="lg" color="#FFFFFF" style={styles.headerTitle}>
                  {content.title}
                </Text>
                <View style={{ width: 40 }} />
              </View>
            </FadeHeaderContainer>

            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.content,
                { paddingTop: insets.top + 80, paddingBottom: insets.bottom + Spacing['3xl'] },
              ]}
            >
              <View style={styles.descriptionCard}>
                <Text size="sm" color="#1F2937" style={styles.descriptionText}>
                  {content.description}
                </Text>
              </View>

              <View style={styles.card}>
                {content.items.map((item, index) => (
                  <View
                    key={item.id}
                    style={[styles.accordionDivider, index === 0 && styles.accordionDividerFirst]}
                  >
                    <FAQAccordionItem
                      item={item}
                      isExpanded={expandedId === item.id}
                      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    />
                  </View>
                ))}
              </View>

              <View style={styles.supportCard}>
                <View>
                  <Text weight="bold" size="md" color="#111827">
                    Still need help?
                  </Text>
                  <Text size="xs" color="#6B7280" style={styles.supportHint}>
                    Include screenshots for faster help.
                  </Text>
                </View>
                <Pressable style={styles.supportButton} onPress={() => console.log('Submit ticket')}>
                  <Text weight="semiBold" size="sm" color={BrandColors.white}>
                    Submit a ticket
                  </Text>
                </Pressable>
              </View>
            </Animated.ScrollView>
          </>
        )}
      </ScrollDrivenGradientBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 18,
  },
  header: {
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
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
  descriptionCard: {
    paddingHorizontal: 4,
  },
  descriptionText: {
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  accordionDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  accordionDividerFirst: {
    borderTopWidth: 0,
  },
  accordionRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  accordionTitle: {
    flex: 1,
  },
  accordionBody: {
    marginTop: 10,
    gap: 12,
  },
  accordionBodyText: {
    lineHeight: 20,
  },
  deepLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  supportHint: {
    marginTop: 4,
  },
  supportButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 3,
  },
});
