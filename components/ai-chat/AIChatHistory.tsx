/**
 * AI Chat History Sidebar Component
 * Displays past conversations
 */

import React from 'react';
import {
  View,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
  Dimensions,
} from 'react-native';
import { Text } from '@/components/shared-ui';
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';
import { X } from 'lucide-react-native';
import type { Conversation } from '@/services/types/ai.types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);

interface AIChatHistoryProps {
  visible: boolean;
  onClose: () => void;
  conversations: Conversation[];
  onSelectConversation: (conversationId: string) => void;
  isLoading?: boolean;
}

export function AIChatHistory({
  visible,
  onClose,
  conversations,
  onSelectConversation,
  isLoading = false,
}: AIChatHistoryProps) {
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.sidebar}>
          {/* Header */}
          <View style={styles.header}>
            <Text size="xl" weight="semiBold" style={styles.title}>
              Chat History
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={24} color={BrandColors.primary} />
            </Pressable>
          </View>

          {/* Divider */}
          <View style={styles.divider} />

          {/* Conversations List */}
          <ScrollView
            style={styles.conversationsList}
            contentContainerStyle={styles.conversationsContent}
            showsVerticalScrollIndicator={false}
          >
            {conversations.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No conversations yet</Text>
                <Text style={styles.emptySubtext}>
                  Start a new chat to see your history here
                </Text>
              </View>
            ) : (
              conversations.map((conversation) => (
                <Pressable
                  key={conversation.id}
                  style={({ pressed }) => [
                    styles.conversationItem,
                    pressed && styles.conversationItemPressed,
                  ]}
                  onPress={() => {
                    onSelectConversation(conversation.id);
                    onClose();
                  }}
                >
                  <Text style={styles.conversationTitle} weight="medium" numberOfLines={1}>
                    {conversation.title}
                  </Text>
                  <Text style={styles.conversationDate} size="sm">
                    {formatDate(conversation.timestamp)}
                  </Text>
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  sidebar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,
    backgroundColor: BrandColors.white,
    ...Shadows.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['4xl'],
    paddingBottom: Spacing.lg,
  },
  title: {
    color: BrandColors.primary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: Spacing.lg,
  },
  conversationsList: {
    flex: 1,
  },
  conversationsContent: {
    paddingVertical: Spacing.md,
  },
  conversationItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  conversationItemPressed: {
    backgroundColor: '#F3F4F6',
  },
  conversationTitle: {
    color: BrandColors.primary,
    marginBottom: 2,
  },
  conversationDate: {
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
  },
});

