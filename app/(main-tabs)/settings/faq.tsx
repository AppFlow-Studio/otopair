/**
 * FAQRootScreen
 *
 * PURPOSE: Root FAQ screen with search, popular items, and category navigation.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <FAQRootScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  X,
  Award,
  BadgeCheck,
  CalendarDays,
  Car,
  ChevronRight,
  CreditCard,
  Headset,
  Rocket,
  Search,
} from 'lucide-react-native';
import Animated from 'react-native-reanimated';

import { BrandColors, Spacing, Text } from '@/components/shared-ui';
import { ScrollDrivenGradientBackground } from '@/components/shared-ui/ScrollDrivenGradientBackground';
import { FadeHeaderContainer } from '@/components/shared-ui/FadeHeaderContainer';
import { getSheetContentPadding } from '@/constants/theme';

const HEADER_FADE_COLORS: [string, string, string, string] = [
  'rgba(82, 153, 254, 1)',    // Opaque blue (BrandColors.secondary)
  'rgba(82, 153, 254, 0.7)',
  'rgba(82, 153, 254, 0.3)',
  'rgba(82, 153, 254, 0)',    // Transparent
];

const POPULAR_ITEMS = [
  {
    id: 'popular-1',
    title: 'How do I earn Points?',
    subtitle: 'Loyalty & rewards',
    category: 'loyalty',
  },
  {
    id: 'popular-2',
    title: 'How to book a mobile service?',
    subtitle: 'Bookings & services',
    category: 'bookings',
  },
  {
    id: 'popular-3',
    title: 'Where is Otopair available?',
    subtitle: 'General',
    category: 'general',
  },
];

const CATEGORIES = [
  { id: 'getting-started', label: 'Getting started', icon: Rocket },
  { id: 'bookings', label: 'Bookings & services', icon: CalendarDays },
  { id: 'vehicles', label: 'Vehicles', icon: Car },
  { id: 'payments', label: 'Payments & billing', icon: CreditCard },
  { id: 'loyalty', label: 'Loyalty & rewards', icon: Award },
  { id: 'pass', label: 'Otopair Pass', icon: BadgeCheck },
];

export default function FAQRootScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const handleOpenCategory = (category: string) => {
    router.push({ pathname: '/settings/faq-category', params: { category } });
  };

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
                  FAQ
                </Text>
                <View style={{ width: 40 }} />
              </View>
            </FadeHeaderContainer>

            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[styles.container, { paddingTop: insets.top + 80, paddingBottom: getSheetContentPadding(true, insets.bottom) }]}
            >
              <View style={styles.searchWrapper}>
                <Search size={18} color="#86868B" style={styles.searchIcon} />
                <TextInput
                  placeholder="Search FAQs"
                  placeholderTextColor="#86868B"
                  style={styles.searchInput}
                />
              </View>

        <View style={styles.section}>
          <Text weight="semiBold" size="xs" color="#1F2937" style={styles.sectionLabel}>
            POPULAR
          </Text>
          <View style={[styles.card, styles.listCard]}>
            {POPULAR_ITEMS.map((item, index) => (
              <Pressable
                key={item.id}
                onPress={() => handleOpenCategory(item.category)}
                style={({ pressed }) => [
                  styles.listRow,
                  index !== 0 && styles.listRowDivider,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.listRowText}>
                  <Text weight="medium" size="md" color="#111827">
                    {item.title}
                  </Text>
                  <Text size="sm" color="#6B7280">
                    {item.subtitle}
                  </Text>
                </View>
                <ChevronRight size={18} color="#9CA3AF" />
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text weight="semiBold" size="xs" color="#1F2937" style={styles.sectionLabel}>
            BROWSE BY CATEGORY
          </Text>
          <View style={[styles.card, styles.listCard]}>
            {CATEGORIES.map((item, index) => {
              const Icon = item.icon;
              return (
                <Pressable
                  key={item.id}
                  onPress={() => handleOpenCategory(item.id)}
                  style={({ pressed }) => [
                    styles.categoryRow,
                    index !== 0 && styles.listRowDivider,
                    pressed && styles.rowPressed,
                  ]}
                >
                  <View style={styles.categoryLeft}>
                    <Icon size={18} color={BrandColors.secondary} />
                    <Text weight="medium" size="md" color="#111827">
                      {item.label}
                    </Text>
                  </View>
                  <ChevronRight size={18} color="#9CA3AF" />
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.supportSection}>
          <View style={styles.card}>
            <View style={styles.supportIcon}>
              <Headset size={22} color={BrandColors.secondary} />
            </View>
            <Text weight="bold" size="lg" color="#111827">
              Still need help?
            </Text>
            <Text size="sm" color="#6B7280" style={styles.supportBody}>
              Submit a support ticket and we’ll get back to you.
            </Text>
            <Pressable style={styles.supportButton} onPress={() => console.log('Submit ticket')}>
              <Text weight="semiBold" size="md" color={BrandColors.white}>
                Submit a ticket
              </Text>
            </Pressable>
          </View>
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
  container: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    zIndex: 10,
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
  title: {
    letterSpacing: -0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  searchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
    marginTop: 6,
    marginBottom: 18,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    padding: 0,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
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
    alignItems: 'center',
    paddingVertical: 4,
  },
  listCard: {
    overflow: 'hidden',
    alignItems: 'stretch',
    paddingVertical: 0,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listRowText: {
    gap: 2,
  },
  categoryLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listRowDivider: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(156, 163, 175, 0.2)',
  },
  rowPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
  },
  supportSection: {
    paddingBottom: Spacing['2xl'],
  },
  supportIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(36, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  supportBody: {
    textAlign: 'center',
    marginTop: 4,
  },
  supportButton: {
    marginTop: 16,
    backgroundColor: BrandColors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
});
