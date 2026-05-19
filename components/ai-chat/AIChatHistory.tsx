/**
 * AIChatHistory
 *
 * PURPOSE: Sidebar displaying past conversation history (rendered as base layer behind chat card)
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (drawer sidebar pattern)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from 'react';
import { View, ScrollView, Pressable, StyleSheet, Dimensions } from 'react-native';

// 2. Expo & Third-party
import { ChevronRight } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from '@/constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface AIChatHistoryItem {
  id: string;
  title: string;
}

interface AIChatHistoryProps {
  onClose: () => void;
  conversations: AIChatHistoryItem[];
  onSelectConversation: (conversationId: string) => void;
  isLoading?: boolean;
  paddingTop: number;
}

export function AIChatHistory({
  onClose,
  conversations,
  onSelectConversation,
  isLoading = false,
  paddingTop,
}: AIChatHistoryProps) {
  return (
    <View style={styles.sidebar}>
      {/* Oto branding */}
      <View style={styles.header}>
        <Text style={styles.brandTitle}>Oto</Text>
      </View>

      {/* Recents label */}
      <Text style={styles.recentsLabel} weight="semiBold">Recents</Text>

      {/* Conversations List */}
      <ScrollView
        style={styles.conversationsList}
        contentContainerStyle={styles.conversationsContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {conversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No Conversations yet</Text>
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
              }}
            >
              <View style={styles.conversationRow}>
                <View style={styles.conversationTextContainer}>
                  <Text style={styles.conversationTitle} weight="medium" numberOfLines={1}>
                    {conversation.title}
                  </Text>
                </View>
                <ChevronRight size={16} color="rgba(0,0,0,0.2)" />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing['5xl'],
    paddingBottom: Spacing['2xl'],
  },
  brandTitle: {
    fontSize: 34,
    lineHeight: 44,
    fontFamily: FontFamily.bold,
    color: '#000000',
  },
  recentsLabel: {
    fontSize: 13,
    lineHeight: 18,
    color: '#000000',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.xl,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  conversationsList: {
    flex: 1,
  },
  conversationsContent: {
    paddingVertical: Spacing.xs,
  },
  conversationItem: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.sm,
    marginBottom: 2,
  },
  conversationItemPressed: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6CB4E4',
    marginRight: 12,
  },
  conversationTextContainer: {
    flex: 1,
  },
  conversationTitle: {
    color: '#000000',
    fontSize: 15,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
    paddingHorizontal: Spacing.lg,
  },
  emptyText: {
    color: '#000000',
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
  emptySubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    textAlign: 'center',
  },
});
