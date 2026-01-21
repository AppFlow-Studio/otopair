/**
 * FAQScreen
 *
 * PURPOSE: General Frequently Asked Questions screen for the app.
 *          Features accordion-style items for questions and answers.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <FAQScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState } from 'react';
import { 
  Pressable, 
  ScrollView, 
  StyleSheet, 
  View 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
  X, 
  ChevronDown 
} from 'lucide-react-native';
import Animated, { 
  FadeIn, 
  FadeOut, 
  LinearTransition, 
  useAnimatedStyle, 
  withTiming 
} from 'react-native-reanimated';

import { BrandColors, Spacing, Text } from '@/components/shared-ui';
import { Layout, getSheetContentPadding } from '@/constants/theme';

const FAQ_ITEMS = [
  {
    id: '1',
    question: 'How do I add a new vehicle?',
    answer: 'You can add a vehicle by tapping "Add Vehicle" on the main Settings screen or by going to the "My Vehicles" section and clicking the plus icon.',
  },
  {
    id: '2',
    question: 'How do Otopair points work?',
    answer: 'You earn points for every service you book through the app. These points can be redeemed for discounts on future services or Otopair Pass subscriptions.',
  },
  {
    id: '3',
    question: 'What is Otopair Pass?',
    answer: 'Otopair Pass is our premium subscription that gives you access to exclusive discounts, priority booking, and free emergency roadside assistance.',
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

export default function FAQScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <View style={styles.screen}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <X size={18} color="#111827" />
        </Pressable>
        <Text weight="bold" size="lg" color="#111827" style={styles.headerTitle}>
          FAQ
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: getSheetContentPadding(true, insets.bottom) }]}
      >
        <View style={styles.introSection}>
          <Text weight="semiBold" size="xs" color="#94A3B8" style={styles.introLabel}>
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
      </ScrollView>

      {/* Sticky Support Footer */}
      <View style={[styles.supportFooter, { paddingBottom: insets.bottom + Layout.footerHeight }]}>
        <View style={styles.supportSection}>
          <Text size="sm" color="#94A3B8" style={styles.supportLabel}>
            Still have questions?
          </Text>
          <Pressable onPress={() => console.log('Contact Support')}>
            <Text weight="bold" size="md" color={BrandColors.secondary}>
              Contact Support
            </Text>
          </Pressable>
        </View>
      </View>
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
    paddingTop: 20,
  },
  introSection: {
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  introLabel: {
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
  supportSection: {
    alignItems: 'center',
    gap: 8,
  },
  supportLabel: {
    textAlign: 'center',
  },
  supportFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#E8ECF0',
    paddingTop: 20,
    paddingHorizontal: Spacing['2xl'],
  },
});
