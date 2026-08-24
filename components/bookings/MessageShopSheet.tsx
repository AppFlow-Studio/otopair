/**
 * MessageShopSheet
 *
 * PURPOSE: The Message Shop surface — a controlled support-ticket flow with an
 *          open-chat fallback. Replaces the local-only MechanicChatSheet. Three
 *          views:
 *            • list    — existing tickets for this booking (shown when any exist)
 *            • intents — state-aware quick-action buttons + free-text ("open_chat")
 *            • thread  — a ticket's message thread (bubbles + shop action cards)
 *          Backed by Convex (convex/shop_tickets.ts); replies are realtime.
 *
 * USED IN: components/bookings/BookingDetailsSheet.tsx (via onOpenChat)
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, Plus, Send, User } from 'lucide-react-native';
import { useMutation } from 'convex/react';

import { Text } from '@/components/shared-ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { BookingStatus } from '@/components/bookings/BookingCard';
import {
  intentsForStatus,
  OPEN_CHAT_CATEGORY,
  type TicketIntent,
} from '@/constants/shopTicketIntents';
import {
  useShopTicketsForBooking,
  useShopTicketThread,
} from '@/hooks/useShopTicketsFromConvex';

// ============================================================================
// TYPES
// ============================================================================

export interface MessageShopSheetRef {
  open: (params: OpenParams) => void;
  close: () => void;
}

interface OpenParams {
  bookingId: string;
  status: BookingStatus;
  mechanicName: string;
  shopName: string;
  mechanicImage?: string;
}

type SheetView = 'list' | 'intents' | 'thread';

// ============================================================================
// HELPERS
// ============================================================================

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Awaiting shop',
  shop_responded: 'Shop replied',
  resolved: 'Resolved',
  closed: 'Closed',
};

// One-line summary of a structured shop action, rendered under its bubble.
function actionSummary(action: {
  kind: string;
  status?: string;
  params?: any;
}): string {
  const status = action.status ? ` · ${action.status}` : '';
  switch (action.kind) {
    case 'propose_reschedule': {
      const p = action.params ?? {};
      const when = [p.newScheduledDate, p.newScheduledTime]
        .filter(Boolean)
        .join(' ');
      return `🗓 New time proposed${when ? `: ${when}` : ''}${status}`;
    }
    case 'request_approval':
      return `🧾 Approval requested${status}`;
    case 'pickup_response':
      return `🚗 Pickup: ${action.params?.response ?? 'answered'}`;
    case 'send_eta':
      return `⏱ ${action.params?.etaLabel ?? 'Ready-by time shared'}`;
    default:
      return `Update${status}`;
  }
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MessageShopSheet = forwardRef<MessageShopSheetRef>((_props, ref) => {
  const insets = useSafeAreaInsets();
  const [params, setParams] = useState<OpenParams | null>(null);
  const [view, setView] = useState<SheetView>('intents');
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const viewInitedRef = useRef(false);

  const visible = params != null;

  const { tickets, isLoading: ticketsLoading } = useShopTicketsForBooking(
    params?.bookingId,
  );

  const createTicket = useMutation(api.shop_tickets.createTicket);
  const sendMyMessage = useMutation(api.shop_tickets.sendMyMessage);
  const markRead = useMutation(api.shop_tickets.markTicketReadByCustomer);

  const open = useCallback((p: OpenParams) => {
    setParams(p);
    setActiveTicketId(null);
    setDraft('');
    viewInitedRef.current = false;
    setView('intents'); // adjusted to 'list' once tickets load, if any exist
  }, []);

  const close = useCallback(() => {
    setParams(null);
    setActiveTicketId(null);
    setDraft('');
  }, []);

  useImperativeHandle(ref, () => ({ open, close }));

  // Pick the landing view once tickets resolve for a freshly-opened sheet.
  useEffect(() => {
    if (!visible || viewInitedRef.current || ticketsLoading) return;
    viewInitedRef.current = true;
    setView(tickets.length > 0 ? 'list' : 'intents');
  }, [visible, ticketsLoading, tickets.length]);

  const intents = useMemo<TicketIntent[]>(
    () => (params ? intentsForStatus(params.status) : []),
    [params],
  );

  // --- actions -------------------------------------------------------------

  const openTicket = useCallback((ticketId: string) => {
    setActiveTicketId(ticketId);
    setView('thread');
  }, []);

  const startTicket = useCallback(
    async (category: string, text?: string) => {
      if (!params || busy) return;
      setBusy(true);
      try {
        const res = await createTicket({
          bookingId: params.bookingId as Id<'bookings'>,
          category,
          text,
        });
        setDraft('');
        openTicket(res.ticketId);
      } catch (e: any) {
        Alert.alert('Message not sent', e?.message ?? 'Please try again.');
      } finally {
        setBusy(false);
      }
    },
    [params, busy, createTicket, openTicket],
  );

  const sendInThread = useCallback(async () => {
    const text = draft.trim();
    if (!activeTicketId || !text || busy) return;
    setBusy(true);
    try {
      await sendMyMessage({
        ticketId: activeTicketId as Id<'shop_tickets'>,
        text,
      });
      setDraft('');
    } catch (e: any) {
      Alert.alert('Message not sent', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  }, [draft, activeTicketId, busy, sendMyMessage]);

  const goBack = useCallback(() => {
    if (view === 'thread') {
      setDraft('');
      setView(tickets.length > 0 ? 'list' : 'intents');
      setActiveTicketId(null);
    } else if (view === 'intents' && tickets.length > 0) {
      setView('list');
    } else {
      close();
    }
  }, [view, tickets.length, close]);

  // ------------------------------------------------------------------------

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={goBack}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <Header
          params={params}
          view={view}
          onBack={goBack}
          onClose={close}
        />

        {view === 'list' && (
          <ListView
            tickets={tickets}
            onOpenTicket={openTicket}
            onNew={() => setView('intents')}
            bottomInset={insets.bottom}
          />
        )}

        {view === 'intents' && (
          <IntentsView
            intents={intents}
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            onPickIntent={(cat) => startTicket(cat)}
            onPickChip={(cat, text) => startTicket(cat, text)}
            onSendFreeText={() =>
              startTicket(OPEN_CHAT_CATEGORY, draft.trim())
            }
            bottomInset={insets.bottom}
          />
        )}

        {view === 'thread' && activeTicketId && (
          <ThreadView
            ticketId={activeTicketId}
            draft={draft}
            setDraft={setDraft}
            busy={busy}
            onSend={sendInThread}
            onSeen={() =>
              markRead({ ticketId: activeTicketId as Id<'shop_tickets'> }).catch(
                () => {},
              )
            }
            bottomInset={insets.bottom}
          />
        )}
      </View>
    </Modal>
  );
});

MessageShopSheet.displayName = 'MessageShopSheet';

// ============================================================================
// SUBVIEWS
// ============================================================================

function Header({
  params,
  view,
  onBack,
  onClose,
}: {
  params: OpenParams | null;
  view: SheetView;
  onBack: () => void;
  onClose: () => void;
}) {
  const title =
    view === 'thread'
      ? params?.mechanicName ?? 'Message shop'
      : view === 'list'
        ? 'Your messages'
        : 'Message shop';
  const subtitle = view === 'thread' ? params?.shopName ?? '' : params?.shopName ?? '';
  return (
    <View style={styles.header}>
      <TouchableOpacity
        onPress={onBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <ArrowLeft size={24} color="#1A1A1A" />
      </TouchableOpacity>
      <View style={styles.headerCenter}>
        {view === 'thread' ? (
          <View style={styles.avatar}>
            {params?.mechanicImage ? (
              <Image source={{ uri: params.mechanicImage }} style={styles.avatarImage} />
            ) : (
              <User size={20} color="#9CA3AF" />
            )}
          </View>
        ) : null}
        <View style={styles.headerText}>
          <Text size="md" weight="semiBold" color="#1A1A1A" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text size="xs" weight="regular" color="#8E8E93" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.headerSpacer} />
    </View>
  );
}

function ListView({
  tickets,
  onOpenTicket,
  onNew,
  bottomInset,
}: {
  tickets: any[];
  onOpenTicket: (id: string) => void;
  onNew: () => void;
  bottomInset: number;
}) {
  return (
    <View style={styles.flex}>
      <FlatList
        data={tickets}
        keyExtractor={(t) => String(t._id)}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const unread = (item.customer_unread_count ?? 0) > 0;
          return (
            <Pressable
              style={({ pressed }) => [styles.ticketRow, pressed && styles.pressed]}
              onPress={() => onOpenTicket(String(item._id))}
            >
              <View style={styles.flex}>
                <View style={styles.ticketTitleRow}>
                  <Text size="md" weight="semiBold" color="#1A1A1A" numberOfLines={1}>
                    {item.subject ?? 'Message shop'}
                  </Text>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </View>
                {item.last_message_preview ? (
                  <Text size="sm" color="#6B7280" numberOfLines={1}>
                    {item.last_message_preview}
                  </Text>
                ) : null}
                <Text size="xs" color="#9CA3AF">
                  {STATUS_LABEL[item.status] ?? item.status}
                </Text>
              </View>
              <ChevronRight size={18} color="#C7C7CC" />
            </Pressable>
          );
        }}
      />
      <View style={[styles.footer, { paddingBottom: Math.max(bottomInset, 12) }]}>
        <Pressable
          style={({ pressed }) => [styles.primaryBtn, pressed && styles.pressed]}
          onPress={onNew}
        >
          <Plus size={18} color="#FFFFFF" />
          <Text size="md" weight="semiBold" color="#FFFFFF">
            New request
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function IntentsView({
  intents,
  draft,
  setDraft,
  busy,
  onPickIntent,
  onPickChip,
  onSendFreeText,
  bottomInset,
}: {
  intents: TicketIntent[];
  draft: string;
  setDraft: (s: string) => void;
  busy: boolean;
  onPickIntent: (category: string) => void;
  onPickChip: (category: string, text: string) => void;
  onSendFreeText: () => void;
  bottomInset: number;
}) {
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={intents}
        keyExtractor={(i) => i.category}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <Text size="md" weight="semiBold" color="#1A1A1A" style={styles.sectionTitle}>
            How can the shop help?
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.intentBlock}>
            <Pressable
              disabled={busy}
              style={({ pressed }) => [styles.intentBtn, pressed && styles.pressed]}
              onPress={() => onPickIntent(item.category)}
            >
              <Text size="md" weight="semiBold" color="#1A1A1A">
                {item.label}
              </Text>
            </Pressable>
            {item.chips ? (
              <View style={styles.chipRow}>
                {item.chips.map((chip) => (
                  <Pressable
                    key={chip.label}
                    disabled={busy}
                    style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
                    onPress={() => onPickChip(item.category, chip.text)}
                  >
                    <Text size="sm" weight="semiBold" color="#5299FE">
                      {chip.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        )}
        ListFooterComponent={
          <Text size="xs" color="#9CA3AF" style={styles.freeTextHint}>
            Or write your own message below.
          </Text>
        }
      />
      <View style={[styles.inputBar, { paddingBottom: Math.max(bottomInset, 10) }]}>
        <TextInput
          style={styles.input}
          placeholder="Message the shop…"
          placeholderTextColor="#8E8E93"
          value={draft}
          onChangeText={setDraft}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[styles.sendButton, (!draft.trim() || busy) && styles.sendButtonDisabled]}
          onPress={onSendFreeText}
          disabled={!draft.trim() || busy}
          activeOpacity={0.85}
        >
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function ThreadView({
  ticketId,
  draft,
  setDraft,
  busy,
  onSend,
  onSeen,
  bottomInset,
}: {
  ticketId: string;
  draft: string;
  setDraft: (s: string) => void;
  busy: boolean;
  onSend: () => void;
  onSeen: () => void;
  bottomInset: number;
}) {
  const { ticket, messages } = useShopTicketThread(ticketId);
  const listRef = useRef<FlatList<any>>(null);

  // Mark read whenever new shop content arrives while the thread is open.
  const lastShopAt = ticket?.last_message_at ?? 0;
  useEffect(() => {
    onSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, lastShopAt]);

  useEffect(() => {
    const t = setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length]);

  const closed = ticket?.status === 'closed';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(m) => String(m._id)}
        contentContainerStyle={styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item }) => {
          const isCustomer = item.sender_role === 'customer';
          const isSystem = item.sender_role === 'system';
          if (isSystem) {
            return (
              <Text size="xs" color="#9CA3AF" style={styles.systemMsg}>
                {item.content}
              </Text>
            );
          }
          return (
            <View
              style={[
                styles.row,
                isCustomer ? styles.rowUser : styles.rowShop,
              ]}
            >
              {item.content ? (
                <View
                  style={[
                    styles.bubble,
                    isCustomer ? styles.bubbleUser : styles.bubbleShop,
                  ]}
                >
                  <Text size="md" color={isCustomer ? '#FFFFFF' : '#1A1A1A'}>
                    {item.content}
                  </Text>
                </View>
              ) : null}
              {item.action ? (
                <View style={styles.actionCard}>
                  <Text size="sm" weight="semiBold" color="#1D4ED8">
                    {actionSummary(item.action)}
                  </Text>
                </View>
              ) : null}
              <Text
                size="xs"
                color="#8E8E93"
                style={isCustomer ? styles.timeUser : styles.timeShop}
              >
                {formatTimestamp(item.timestamp)}
              </Text>
            </View>
          );
        }}
      />
      <View style={[styles.inputBar, { paddingBottom: Math.max(bottomInset, 10) }]}>
        <TextInput
          style={styles.input}
          placeholder={closed ? 'This conversation is closed' : 'Message…'}
          placeholderTextColor="#8E8E93"
          value={draft}
          onChangeText={setDraft}
          editable={!closed}
          multiline
          maxLength={1000}
        />
        <TouchableOpacity
          style={[
            styles.sendButton,
            (!draft.trim() || busy || closed) && styles.sendButtonDisabled,
          ]}
          onPress={onSend}
          disabled={!draft.trim() || busy || closed}
          activeOpacity={0.85}
        >
          <Send size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
    gap: 12,
  },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerText: { flex: 1, gap: 1 },
  headerSpacer: { width: 24 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: 36, height: 36, borderRadius: 18 },
  listContent: { padding: 16, gap: 10 },
  sectionTitle: { marginBottom: 4 },
  // Ticket list
  ticketRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  ticketTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5299FE',
  },
  // Intents
  intentBlock: { gap: 8 },
  intentBtn: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: '#EEF4FF',
  },
  freeTextHint: { marginTop: 4, textAlign: 'center' },
  // Footer / primary button
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 12,
    backgroundColor: '#5299FE',
  },
  // Thread bubbles
  row: { maxWidth: '82%', gap: 2 },
  rowUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  rowShop: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { backgroundColor: '#5299FE', borderBottomRightRadius: 6 },
  bubbleShop: { backgroundColor: '#F2F2F7', borderBottomLeftRadius: 6 },
  actionCard: {
    marginTop: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  systemMsg: { alignSelf: 'center', textAlign: 'center', paddingVertical: 4 },
  timeUser: { marginRight: 4 },
  timeShop: { marginLeft: 4 },
  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    backgroundColor: '#FFFFFF',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#F2F2F7',
    borderRadius: 20,
    fontSize: 15,
    color: '#1A1A1A',
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#5299FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
