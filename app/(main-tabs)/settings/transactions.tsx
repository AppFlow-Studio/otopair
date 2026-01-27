/**
 * TransactionsScreen
 *
 * PURPOSE: Settings entry screen for viewing and filtering transactions,
 *          with a receipt detail bottom sheet.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 */

import React, { useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  Car,
  ChevronRight,
  Download,
  Mail,
  Search,
  Sparkles,
  Wrench,
  Fuel,
  CreditCard,
  BadgeCheck,
} from 'lucide-react-native';

import {
  AppBottomSheetModal,
  BlurHeaderOverlay,
  BrandColors,
  Button,
  Spacing,
  Text,
} from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';

type TransactionFilter = 'all' | 'charge' | 'credit' | 'refund';
type TransactionStatus = 'completed' | 'pending';

interface LineItem {
  label: string;
  amount: string;
}

interface TransactionDetail {
  dateLabel: string;
  status: TransactionStatus;
  lineItems: LineItem[];
  subtotal: string;
  taxLabel: string;
  taxAmount: string;
  total: string;
  paymentMethod: string;
  rewards: string;
}

interface TransactionItem {
  id: string;
  title: string;
  subtitle: string;
  timeLabel?: string;
  amount: string;
  type: Exclude<TransactionFilter, 'all'>;
  status?: TransactionStatus;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  detail?: TransactionDetail;
}

interface TransactionSection {
  id: string;
  title: string;
  muted?: boolean;
  items: TransactionItem[];
}

const FILTERS: Array<{ id: TransactionFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'charge', label: 'Charges' },
  { id: 'credit', label: 'Credits' },
  { id: 'refund', label: 'Refunds' },
];

const TRANSACTION_SECTIONS: TransactionSection[] = [
  {
    id: 'oct-24',
    title: 'October 24',
    items: [
      {
        id: 'tx-hawk',
        title: 'Hawk Precision Auto Works',
        subtitle: '10:30 AM • 3 items',
        amount: '-$94.72',
        type: 'charge',
        status: 'completed',
        icon: Wrench,
        iconColor: '#111827',
        iconBg: '#F3F4F6',
        detail: {
          dateLabel: 'Oct 24, 2024 • 10:30 AM',
          status: 'completed',
          lineItems: [
            { label: 'Basic oil change', amount: '$45.00' },
            { label: 'Basic filter change', amount: '$25.00' },
            { label: 'Tire rotation', amount: '$15.00' },
          ],
          subtotal: '$85.00',
          taxLabel: 'Tax (8.875%)',
          taxAmount: '$9.72',
          total: '$94.72',
          paymentMethod: 'VISA •••• 1234',
          rewards: '+95 pts',
        },
      },
      {
        id: 'tx-credit',
        title: 'Ownership credits',
        subtitle: '9:15 AM • Referral reward',
        amount: '+$100.00',
        type: 'credit',
        status: 'completed',
        icon: Sparkles,
        iconColor: '#16A34A',
        iconBg: 'rgba(22, 163, 74, 0.12)',
        detail: {
          dateLabel: 'Oct 24, 2024 • 9:15 AM',
          status: 'completed',
          lineItems: [{ label: 'Referral reward', amount: '$100.00' }],
          subtotal: '$100.00',
          taxLabel: 'Tax (0%)',
          taxAmount: '$0.00',
          total: '$100.00',
          paymentMethod: 'Otopair credits',
          rewards: '+0 pts',
        },
      },
    ],
  },
  {
    id: 'yesterday',
    title: 'Yesterday',
    items: [
      {
        id: 'tx-lb',
        title: 'L & B Auto Repair',
        subtitle: 'Yesterday',
        amount: '-$70.77',
        type: 'charge',
        status: 'pending',
        icon: Car,
        iconColor: '#EA580C',
        iconBg: 'rgba(234, 88, 12, 0.12)',
        detail: {
          dateLabel: 'Yesterday • Pending',
          status: 'pending',
          lineItems: [{ label: 'Repair estimate', amount: '$70.77' }],
          subtotal: '$70.77',
          taxLabel: 'Tax (0%)',
          taxAmount: '$0.00',
          total: '$70.77',
          paymentMethod: 'VISA •••• 1234',
          rewards: '+0 pts',
        },
      },
    ],
  },
  {
    id: 'oct-22',
    title: 'October 22',
    muted: true,
    items: [
      {
        id: 'tx-shell',
        title: 'Shell Station',
        subtitle: '8:20 PM • Fuel',
        amount: '-$45.00',
        type: 'charge',
        icon: Fuel,
        iconColor: '#111827',
        iconBg: '#F3F4F6',
      },
      {
        id: 'tx-premium',
        title: 'Otopair Premium',
        subtitle: 'Monthly Subscription',
        amount: '-$12.99',
        type: 'charge',
        icon: CreditCard,
        iconColor: '#2563EB',
        iconBg: 'rgba(37, 99, 235, 0.12)',
      },
    ],
  },
];

const DEFAULT_DETAIL: TransactionDetail = {
  dateLabel: 'Oct 24, 2024 • 10:30 AM',
  status: 'completed',
  lineItems: [{ label: 'Service item', amount: '$0.00' }],
  subtotal: '$0.00',
  taxLabel: 'Tax (0%)',
  taxAmount: '$0.00',
  total: '$0.00',
  paymentMethod: 'VISA •••• 1234',
  rewards: '+0 pts',
};

export default function TransactionsScreen() {
  const insets = useSafeAreaInsets();
  const sheetRef = useRef<BottomSheetModal>(null);

  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);

  const filteredSections = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return TRANSACTION_SECTIONS.map((section) => {
      const items = section.items.filter((item) => {
        const matchesFilter = activeFilter === 'all' || item.type === activeFilter;
        if (!matchesFilter) return false;

        if (!normalizedQuery) return true;
        const content = `${item.title} ${item.subtitle}`.toLowerCase();
        return content.includes(normalizedQuery);
      });

      return { ...section, items };
    }).filter((section) => section.items.length > 0);
  }, [activeFilter, query]);

  const handleOpenDetail = (item: TransactionItem) => {
    setSelectedTransaction(item);
    sheetRef.current?.present();
  };

  const detail = selectedTransaction?.detail ?? DEFAULT_DETAIL;
  const isPending = detail.status === 'pending';

  return (
    <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
      <BlurHeaderOverlay title="Transactions" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 90,
            paddingBottom: getSheetContentPadding(false, insets.bottom),
          },
        ]}
      >
        <View style={styles.controlsSection}>
          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" />
            <TextInput
              placeholder="Search"
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
          </View>

          <View style={styles.segmentedControl}>
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter.id;
              return (
                <Pressable
                  key={filter.id}
                  onPress={() => setActiveFilter(filter.id)}
                  style={[styles.segmentButton, isActive && styles.segmentButtonActive]}
                >
                  <Text
                    weight={isActive ? 'semiBold' : 'medium'}
                    size="xs"
                    color={isActive ? '#111827' : '#6B7280'}
                  >
                    {filter.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.listSection}>
          {filteredSections.map((section) => (
            <View key={section.id} style={[section.muted && styles.sectionMuted]}>
              <Text weight="medium" size="xs" color="#6B7280" style={styles.sectionLabel}>
                {section.title.toUpperCase()}
              </Text>
              <View style={styles.sectionCard}>
                {section.items.map((item, index) => {
                  const Icon = item.icon;
                  const isLast = index === section.items.length - 1;
                  const amountColor =
                    item.type === 'credit' ? '#16A34A' : item.status === 'pending' ? '#9CA3AF' : '#111827';

                  return (
                    <Pressable
                      key={item.id}
                      onPress={() => handleOpenDetail(item)}
                      style={({ pressed }) => [
                        styles.row,
                        pressed && styles.rowPressed,
                      ]}
                    >
                      <View style={styles.rowLeft}>
                        <View style={[styles.iconBox, { backgroundColor: item.iconBg }]}>
                          <Icon size={20} color={item.iconColor} />
                        </View>
                        <View style={styles.rowText}>
                          <Text weight="semiBold" size="md" color="#111827">
                            {item.title}
                          </Text>
                          <View style={styles.rowMeta}>
                            <Text size="sm" color="#6B7280">
                              {item.subtitle}
                            </Text>
                            {item.status === 'pending' && (
                              <View style={styles.pendingBadge}>
                                <Text weight="bold" size="xs" color="#6B7280">
                                  Pending
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={styles.rowRight}>
                        <Text weight="medium" size="md" color={amountColor}>
                          {item.amount}
                        </Text>
                        <ChevronRight size={18} color="rgba(107, 114, 128, 0.7)" />
                      </View>
                      {!isLast && <View style={styles.rowDivider} />}
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <AppBottomSheetModal
        ref={sheetRef}
        title="Receipt"
        snapPoints={['80%', '92%']}
        contentContainerStyle={{ paddingBottom: getSheetContentPadding(false, insets.bottom) }}
        onClose={() => setSelectedTransaction(null)}
      >
        <View style={styles.sheetHeader}>
          <Text weight="bold" size="lg" color="#111318" style={styles.sheetTitle}>
            {selectedTransaction?.title ?? 'Transaction details'}
          </Text>
          <Text size="sm" color="#616E89">
            {detail.dateLabel}
          </Text>
        <View style={[styles.statusBadge, isPending && styles.statusBadgePending]}>
          <BadgeCheck size={16} color={isPending ? '#6B7280' : BrandColors.secondary} />
          <Text
            weight="semiBold"
            size="xs"
            color={isPending ? '#6B7280' : BrandColors.secondary}
          >
            {isPending ? 'Pending' : 'Completed'}
          </Text>
        </View>
        </View>

        <View style={styles.amountHero}>
          <Text weight="extraBold" size="4xl" color="#111318">
            {detail.total}
          </Text>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.lineItems}>
            {detail.lineItems.map((line, index) => (
              <View key={`${line.label}-${index}`} style={styles.lineItem}>
                <Text size="sm" color="#1F2937">
                  {line.label}
                </Text>
                <Text weight="semiBold" size="sm" color="#111318">
                  {line.amount}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.cardDivider} />
          <View style={styles.summaryRow}>
            <Text size="sm" color="#6B7280">
              Subtotal
            </Text>
            <Text weight="medium" size="sm" color="#111318">
              {detail.subtotal}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text size="sm" color="#6B7280">
              {detail.taxLabel}
            </Text>
            <Text weight="medium" size="sm" color="#111318">
              {detail.taxAmount}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text weight="bold" size="md" color="#111318">
              Total
            </Text>
            <Text weight="bold" size="md" color="#111318">
              {detail.total}
            </Text>
          </View>
        </View>

        <View style={styles.detailCard}>
          <View style={styles.paymentRow}>
            <View style={styles.paymentLeft}>
              <View style={styles.cardBadge}>
                <Text weight="bold" size="xs" color="#FFF">
                  VISA
                </Text>
              </View>
              <View>
                <Text size="xs" color="#6B7280">
                  Payment method
                </Text>
                <Text weight="semiBold" size="sm" color="#111318">
                  {detail.paymentMethod}
                </Text>
              </View>
            </View>
            <View style={styles.paymentRight}>
              <Text size="xs" color="#6B7280">
                Rewards
              </Text>
              <View style={styles.rewardsRow}>
                <Sparkles size={14} color={BrandColors.secondary} />
                <Text weight="bold" size="sm" color={BrandColors.secondary}>
                  {detail.rewards}
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.actionGroup}>
          <Button
            fullWidth
            backgroundColor={BrandColors.secondary}
            textColor="#FFF"
            leftIcon={<Download size={18} color="#FFF" />}
            style={styles.actionButton}
          >
            Download receipt
          </Button>
          <Button
            fullWidth
            backgroundColor="rgba(255, 255, 255, 0.7)"
            textColor="#111318"
            leftIcon={<Mail size={18} color="#111318" />}
            style={[styles.actionButton, styles.secondaryAction]}
          >
            Email receipt
          </Button>
          <Pressable style={styles.reportAction}>
            <Text weight="medium" size="sm" color="rgba(239, 68, 68, 0.85)">
              Report an issue
            </Text>
          </Pressable>
        </View>
      </AppBottomSheetModal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
  },
  controlsSection: {
    marginBottom: Spacing['2xl'],
    gap: Spacing.lg,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    borderRadius: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    borderRadius: 16,
    padding: 4,
    gap: 4,
  },
  segmentButton: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  listSection: {
    gap: Spacing['2xl'],
  },
  sectionLabel: {
    letterSpacing: 1,
    marginLeft: 8,
    marginBottom: 10,
  },
  sectionCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    overflow: 'hidden',
  },
  sectionMuted: {
    opacity: 0.6,
  },
  row: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  rowPressed: {
    backgroundColor: 'rgba(15, 23, 42, 0.04)',
  },
  rowDivider: {
    position: 'absolute',
    bottom: 0,
    left: 72,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  rowText: {
    flex: 1,
    gap: 6,
  },
  rowMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowRight: {
    position: 'absolute',
    right: Spacing.lg,
    top: Spacing.md,
    alignItems: 'flex-end',
    gap: 4,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pendingBadge: {
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sheetHeader: {
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: Spacing['2xl'],
  },
  sheetTitle: {
    textAlign: 'center',
    marginBottom: 6,
  },
  statusBadge: {
    marginTop: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(36, 99, 235, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(36, 99, 235, 0.1)',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(148, 163, 184, 0.25)',
    borderColor: 'rgba(148, 163, 184, 0.25)',
  },
  amountHero: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  detailCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  lineItems: {
    gap: 10,
    marginBottom: Spacing.md,
  },
  lineItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardDivider: {
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.35)',
    marginBottom: Spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.35)',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardBadge: {
    backgroundColor: '#1E3A8A',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  paymentRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  rewardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionGroup: {
    marginTop: Spacing.lg,
    gap: 12,
  },
  actionButton: {
    borderRadius: 16,
    paddingVertical: 12,
  },
  secondaryAction: {
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  reportAction: {
    alignItems: 'center',
    paddingVertical: 6,
  },
});
