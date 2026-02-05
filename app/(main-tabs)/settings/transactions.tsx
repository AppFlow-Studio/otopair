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
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import {
  AlertTriangle,
  BadgeCheck,
  ChevronRight,
  Download,
  Fuel,
  Mail,
  Plus,
  Receipt,
  Search,
  Settings,
  Sparkles,
  Wrench,
  Car,
  CreditCard,
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
import { useUserFromConvex } from '@/hooks/useUserFromConvex';
import { useTransactionsFromConvex } from '@/hooks/useTransactionsFromConvex';
import type { Doc } from '@/convex/_generated/dataModel';

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
  amount: string;
  type: Exclude<TransactionFilter, 'all'>;
  icon: React.ElementType;
  iconColor: string;
  iconBg: string;
  amountColor?: string;
  badge?: { label: string; bgColor: string; textColor: string };
  muted?: boolean;
  strike?: boolean;
  status?: TransactionStatus;
  detail?: TransactionDetail;
}

interface TransactionSection {
  title: string;
  data: TransactionItem[];
}

const FILTERS: Array<{ id: TransactionFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'charge', label: 'Charges' },
  { id: 'credit', label: 'Credits' },
  { id: 'refund', label: 'Refunds' },
];

const ICON_MAP: Record<
  string,
  { icon: typeof Wrench; iconColor: string; iconBg: string }
> = {
  wrench: { icon: Wrench, iconColor: '#111827', iconBg: '#F3F4F6' },
  leaf: { icon: Sparkles, iconColor: '#16A34A', iconBg: 'rgba(22, 163, 74, 0.12)' },
  sparkles: { icon: Sparkles, iconColor: '#16A34A', iconBg: 'rgba(22, 163, 74, 0.12)' },
  car: { icon: Car, iconColor: '#EA580C', iconBg: 'rgba(234, 88, 12, 0.12)' },
  fuel: { icon: Fuel, iconColor: '#111827', iconBg: '#F3F4F6' },
  card: { icon: CreditCard, iconColor: '#2563EB', iconBg: 'rgba(37, 99, 235, 0.12)' },
};

function formatSectionTitle(createdAtMs: number): string {
  const d = new Date(createdAtMs);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  if (dayStart === today) return 'Today';
  if (dayStart === yesterday) return 'Yesterday';
  const month = d.toLocaleString('en-US', { month: 'long' });
  return `${month} ${d.getDate()}`;
}

function formatTime(createdAtMs: number): string {
  return new Date(createdAtMs).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatAmount(amount: number): string {
  const abs = Math.abs(amount);
  const formatted = `$${abs.toFixed(2)}`;
  return amount >= 0 ? `+${formatted}` : `-${formatted}`;
}

function formatDateLabel(createdAtMs: number): string {
  const d = new Date(createdAtMs);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' • ' + formatTime(createdAtMs);
}

function transactionDocToItem(doc: Doc<'transactions'>): TransactionItem {
  const iconType = doc.icon_type ?? 'wrench';
  const { icon, iconColor, iconBg } = ICON_MAP[iconType] ?? ICON_MAP.wrench;
  const amountStr = formatAmount(doc.amount);
  const subtitle = doc.sub_description ?? formatTime(doc.created_at);
  const status = doc.status as TransactionStatus;
  const detail: TransactionDetail = {
    dateLabel: formatDateLabel(doc.created_at),
    status,
    lineItems: [{ label: doc.description, amount: formatAmount(Math.abs(doc.amount)) }],
    subtotal: formatAmount(Math.abs(doc.amount)),
    taxLabel: 'Tax (0%)',
    taxAmount: '$0.00',
    total: amountStr.startsWith('+') ? amountStr : amountStr.slice(1),
    paymentMethod: doc.transaction_type === 'credit' ? 'Otopair credits' : 'VISA •••• 1234',
    rewards: '+0 pts',
  };
  return {
    id: doc._id as string,
    title: doc.description,
    subtitle,
    amount: amountStr,
    type: doc.transaction_type as Exclude<TransactionFilter, 'all'>,
    icon,
    iconColor,
    iconBg,
    status,
    detail,
  };
}

function buildSectionsFromTransactions(
  transactions: Doc<'transactions'>[]
): TransactionSection[] {
  const sections: { title: string; data: TransactionItem[]; sortKey: number }[] = [];
  const byTitle: Record<string, { data: TransactionItem[]; sortKey: number }> = {};
  for (const doc of transactions) {
    const title = formatSectionTitle(doc.created_at);
    if (!byTitle[title]) {
      byTitle[title] = { data: [], sortKey: doc.created_at };
    }
    byTitle[title].data.push(transactionDocToItem(doc));
  }
  return Object.entries(byTitle)
    .map(([title, { data, sortKey }]) => ({ title, data, sortKey }))
    .sort((a, b) => b.sortKey - a.sortKey)
    .map(({ title, data }) => ({ title, data }));
}

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
  const { userId } = useUserFromConvex();
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<TransactionFilter>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionItem | null>(null);

  const transactionType =
    activeFilter === 'all' ? undefined : (activeFilter as 'charge' | 'credit' | 'refund');
  const { transactions } = useTransactionsFromConvex(userId, transactionType);

  const filteredSections = useMemo(() => {
    const sections = buildSectionsFromTransactions(transactions);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return sections;
    return sections
      .map((section) => ({
        ...section,
        data: section.data.filter((item) => {
          const content = `${item.title} ${item.subtitle}`.toLowerCase();
          return content.includes(normalizedQuery);
        }),
      }))
      .filter((section) => section.data.length > 0);
  }, [transactions, query]);

  const handleOpenDetail = (item: TransactionItem) => {
    setSelectedTransaction(item);
    sheetRef.current?.present();
  };

  const detail = selectedTransaction?.detail ?? DEFAULT_DETAIL;
  const isPending = detail.status === 'pending';

  return (
    <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
      <BlurHeaderOverlay title="Transactions" />

      <SectionList
        sections={filteredSections}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={true}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 90,
            paddingBottom: getSheetContentPadding(false, insets.bottom),
          },
        ]}
        ListHeaderComponent={
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

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipRow}
            >
              {FILTERS.map((filter) => {
                const isActive = activeFilter === filter.id;
                return (
                  <Pressable
                    key={filter.id}
                    onPress={() => setActiveFilter(filter.id)}
                    style={[styles.chip, isActive && styles.chipActive]}
                  >
                    <Text
                      weight={isActive ? 'bold' : 'medium'}
                      size="sm"
                      color={isActive ? '#FFFFFF' : '#86868B'}
                    >
                      {filter.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text weight="bold" size="xs" color="#86868B" style={styles.sectionHeaderText}>
              {section.title.toUpperCase()}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const Icon = item.icon;
          const amountColor = item.amountColor ?? (item.amount.startsWith('+') ? '#34C759' : '#1D1D1F');
          
          return (
            <Pressable
              onPress={() => handleOpenDetail(item)}
              style={({ pressed }) => [
                styles.transactionRow,
                pressed && styles.transactionRowPressed,
                item.muted && styles.transactionRowMuted,
              ]}
            >
              <View style={styles.transactionLeft}>
                <View style={styles.transactionIconOuter}>
                  <View style={[styles.transactionIconInner, { backgroundColor: item.iconBg }]}>
                    <Icon size={20} color={item.iconColor} strokeWidth={2} />
                  </View>
                </View>
                <View style={styles.transactionText}>
                  <Text 
                    weight="bold" 
                    size="md" 
                    color="#1D1D1F" 
                    numberOfLines={1}
                    style={[item.strike && styles.strikeText]}
                  >
                    {item.title}
                  </Text>
                  <Text size="sm" color="#86868B" style={styles.transactionSubtitle}>
                    {item.subtitle}
                  </Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text 
                  weight="bold" 
                  size="md" 
                  color={amountColor} 
                  style={[styles.amountText, item.strike && styles.strikeText]}
                >
                  {item.amount}
                </Text>
                {(item.badge || item.status === 'pending') && (
                  <View style={[
                    styles.badge, 
                    { backgroundColor: item.badge?.bgColor ?? '#FEF3C7' }
                  ]}>
                    <Text 
                      weight="bold" 
                      size="xs" 
                      color={item.badge?.textColor ?? '#B45309'} 
                      style={styles.badgeText}
                    >
                      {(item.badge?.label ?? 'PENDING').toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </Pressable>
          );
        }}
      />

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
    paddingHorizontal: Spacing.lg,
  },
  controlsSection: {
    paddingTop: Spacing.sm,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    paddingHorizontal: 16,
    height: 48,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 10,
  },
  searchIconBox: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#1D1D1F',
  },
  chipRow: {
    gap: 12,
    paddingBottom: 8,
  },
  chip: {
    paddingHorizontal: 24,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.03)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 8,
  },
  chipActive: {
    backgroundColor: '#1D1D1F',
    borderColor: '#1D1D1F',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  sectionHeader: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(245, 245, 247, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
    marginHorizontal: -Spacing.lg,
    paddingLeft: Spacing.lg + Spacing.md,
  },
  sectionHeaderText: {
    letterSpacing: 1.5,
    fontSize: 11,
    color: '#86868B',
  },
  transactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 4,
    height: 72,
    borderRadius: 16,
  },
  transactionRowPressed: {
    backgroundColor: '#FFFFFF',
  },
  transactionRowMuted: {
    opacity: 0.6,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  transactionIconOuter: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  transactionIconInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionText: {
    flex: 1,
    justifyContent: 'center',
    gap: 2,
  },
  transactionSubtitle: {
    marginTop: 2,
  },
  transactionRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 4,
  },
  amountText: {
    letterSpacing: -0.5,
  },
  strikeText: {
    textDecorationLine: 'line-through',
    textDecorationColor: 'rgba(0, 0, 0, 0.3)',
  },
  rightActionArea: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.02)',
  },
  badgeText: {
    letterSpacing: 0.6,
  },
  pendingBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  chevron: {
    marginLeft: 4,
  },
  rowDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    marginLeft: 64,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1D1D1F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
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
