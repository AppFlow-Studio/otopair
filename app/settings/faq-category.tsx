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

import React, { useMemo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { ChevronRight } from 'lucide-react-native';
import Animated from 'react-native-reanimated';

import { BrandColors, Spacing, Text, BlurHeaderOverlay } from '@/components/shared-ui';
import { CATEGORY_CONTENT, CategoryKey } from '@/constants/faq';


export default function FAQCategoryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { category } = useLocalSearchParams<{ category?: CategoryKey }>();

  const content = useMemo(() => {
    return CATEGORY_CONTENT[category ?? 'loyalty'] ?? CATEGORY_CONTENT.loyalty;
  }, [category]);

  const handleAction = (label?: string) => {
    if (label === 'Go to Referrals') {
      router.push('/settings/refer-a-friend');
    }
  };

  return (
    <View style={styles.screen}>
      <BlurHeaderOverlay title={content.title} />

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 80, paddingBottom: insets.bottom + Spacing['3xl'] },
        ]}
      >
        <View style={styles.headerContainer}>
          <Text size="md" color="#1F2937" style={styles.descriptionText}>
            {content.description}
          </Text>
        </View>

        <View style={styles.mainCard}>
          {content.items.map((item, index) => (
            <React.Fragment key={item.id}>
              <View style={styles.faqSection}>
                <Text weight="bold" size="lg" color="#111827" style={styles.questionText}>
                  {item.question}
                </Text>
                <Text size="md" color="#4B5563" style={styles.answerText}>
                  {item.answer}
                </Text>
                {item.actionLabel && (
                  <Pressable 
                    style={styles.deepLinkButton} 
                    onPress={() => handleAction(item.actionLabel)}
                  >
                    <Text weight="medium" size="sm" color={BrandColors.secondary}>
                      {item.actionLabel}
                    </Text>
                    <ChevronRight size={18} color={BrandColors.secondary} />
                  </Pressable>
                )}
              </View>
              {index < content.items.length - 1 && <View style={styles.separator} />}
            </React.Fragment>
          ))}
        </View>

        <View style={styles.footerContainer}>
          <View style={styles.supportCard}>
            <View style={styles.supportInfo}>
              <Text weight="bold" size="lg" color="#111827">Still need help?</Text>
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
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  content: {
    paddingHorizontal: 20,
    gap: 20,
  },
  headerContainer: {
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  descriptionText: {
    lineHeight: 22,
  },
  mainCard: {
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
  faqSection: {
    padding: 20,
  },
  questionText: {
    marginBottom: 8,
  },
  answerText: {
    lineHeight: 22,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: 20,
  },
  deepLinkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  footerContainer: {
    marginTop: 4,
  },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  supportInfo: {
    flex: 1,
    marginRight: 16,
  },
  supportHint: {
    marginTop: 4,
  },
  supportButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
