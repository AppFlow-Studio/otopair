/**
 * MechanicChatSheet
 *
 * PURPOSE: Full-screen modal chat thread with the mechanic for a given booking.
 *          Messages are stored in useChatStore (local). Opens slide-from-bottom.
 *
 * USED IN: components/bookings/BookingDetailsSheet.tsx
 */

import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Send, User } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { useChatStore, type ChatMessage } from "@/stores/useChatStore";

// ============================================================================
// TYPES
// ============================================================================

export interface MechanicChatSheetRef {
  open: (params: { bookingId: string; mechanicName: string; shopName: string; mechanicImage?: string }) => void;
  close: () => void;
}

interface ThreadParams {
  bookingId: string;
  mechanicName: string;
  shopName: string;
  mechanicImage?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  let h = d.getHours();
  const m = d.getMinutes().toString().padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

// ============================================================================
// COMPONENT
// ============================================================================

export const MechanicChatSheet = forwardRef<MechanicChatSheetRef>((_props, ref) => {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [thread, setThread] = useState<ThreadParams | null>(null);
  const [draft, setDraft] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const ensureThread = useChatStore((s) => s.ensureThread);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const messagesByThread = useChatStore((s) => s.messages);

  const open = useCallback(
    (params: ThreadParams) => {
      setThread(params);
      ensureThread(params.bookingId, params.mechanicName);
      setVisible(true);
    },
    [ensureThread],
  );

  const close = useCallback(() => {
    setVisible(false);
    setThread(null);
    setDraft("");
  }, []);

  useImperativeHandle(ref, () => ({ open, close }));

  const messages = useMemo(() => {
    if (!thread) return [];
    return messagesByThread[thread.bookingId] ?? [];
  }, [messagesByThread, thread]);

  // Scroll to the newest message when messages change or the sheet opens.
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      listRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [visible, messages.length]);

  const handleSend = useCallback(() => {
    if (!thread) return;
    const text = draft.trim();
    if (!text) return;
    sendMessage(thread.bookingId, text);
    setDraft("");
  }, [draft, sendMessage, thread]);

  const renderItem = useCallback(({ item }: { item: ChatMessage }) => {
    const isUser = item.sender === "user";
    return (
      <View style={[styles.row, isUser ? styles.rowUser : styles.rowMechanic]}>
        <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleMechanic]}>
          <Text size="md" color={isUser ? "#FFFFFF" : "#1A1A1A"}>
            {item.text}
          </Text>
        </View>
        <Text size="xs" color="#8E8E93" style={isUser ? styles.timeUser : styles.timeMechanic}>
          {formatTimestamp(item.timestamp)}
        </Text>
      </View>
    );
  }, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={close} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <ArrowLeft size={24} color="#1A1A1A" />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <View style={styles.avatar}>
              {thread?.mechanicImage ? (
                <Image source={{ uri: thread.mechanicImage }} style={styles.avatarImage} />
              ) : (
                <User size={20} color="#9CA3AF" />
              )}
            </View>
            <View style={styles.headerText}>
              <Text size="md" weight="semiBold" color="#1A1A1A" numberOfLines={1}>
                {thread?.mechanicName ?? "Mechanic"}
              </Text>
              <Text size="xs" weight="regular" color="#8E8E93" numberOfLines={1}>
                {thread?.shopName ?? ""}
              </Text>
            </View>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {/* Messages */}
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            contentContainerStyle={styles.listContent}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          />

          {/* Input bar */}
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              style={styles.input}
              placeholder="Message..."
              placeholderTextColor="#8E8E93"
              value={draft}
              onChangeText={setDraft}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[styles.sendButton, !draft.trim() && styles.sendButtonDisabled]}
              onPress={handleSend}
              disabled={!draft.trim()}
              activeOpacity={0.85}
            >
              <Send size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
});

MechanicChatSheet.displayName = "MechanicChatSheet";

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E5EA",
    gap: 12,
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 1,
  },
  headerSpacer: {
    width: 24,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  listContent: {
    padding: 16,
    gap: 10,
  },
  row: {
    maxWidth: "82%",
    gap: 2,
  },
  rowUser: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  rowMechanic: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  bubbleUser: {
    backgroundColor: "#5299FE",
    borderBottomRightRadius: 6,
  },
  bubbleMechanic: {
    backgroundColor: "#F2F2F7",
    borderBottomLeftRadius: 6,
  },
  timeUser: {
    marginRight: 4,
  },
  timeMechanic: {
    marginLeft: 4,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
    backgroundColor: "#FFFFFF",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    fontSize: 15,
    color: "#1A1A1A",
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#5299FE",
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
});
