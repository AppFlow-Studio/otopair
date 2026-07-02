/**
 * AIChatHistory
 *
 * PURPOSE: Sidebar displaying past conversation history (rendered as base layer behind chat card).
 *          ChatGPT-style scroll behavior — the entire page (RECENTS label + all rows) scrolls,
 *          only the "Oto" brand title stays pinned at the top. On scroll a soft frosted blur
 *          appears under the title so the content that slides beneath fades out gracefully.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (drawer sidebar pattern)
 *
 * OWNER: Waleed Mansour
 */

import React from 'react';
import { View, Pressable, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { ChevronRight } from 'lucide-react-native';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/shared-ui';
import { BorderRadius, Spacing, FontFamily } from '@/constants/theme';

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

// Height of the sticky Oto title area (safe area gets added on top).
const HEADER_HEIGHT = 60;
// Scroll offset at which the frosted-blur backdrop reaches full opacity.
const BLUR_FADE_END = 16;

export function AIChatHistory({
  onClose: _onClose,
  conversations,
  onSelectConversation,
  isLoading: _isLoading = false,
  paddingTop,
}: AIChatHistoryProps) {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const blurStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollY.value,
      [0, BLUR_FADE_END],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <View style={styles.sidebar}>
      {/* Scrollable content. Everything except the Oto title lives
          in here — RECENTS label AND the conversation rows all
          scroll together, ChatGPT-style. */}
      <Animated.ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: paddingTop + HEADER_HEIGHT + Spacing.md },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <Text style={styles.recentsLabel} weight="semiBold">
          Recents
        </Text>

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
                  <Text
                    style={styles.conversationTitle}
                    weight="medium"
                    numberOfLines={1}
                  >
                    {conversation.title}
                  </Text>
                </View>
                <ChevronRight size={16} color="rgba(0,0,0,0.2)" />
              </View>
            </Pressable>
          ))
        )}
      </Animated.ScrollView>

      {/* Sticky "Oto" header pinned above the ScrollView. The
          BlurView + soft tint underneath fade in as the user
          scrolls so the content sliding under the title reads
          as being "beneath" it rather than getting sharply
          clipped. iOS gets the real BlurView; Android falls
          back to a translucent white pane (BlurView on Android
          is unreliable). */}
      <View
        pointerEvents="none"
        style={[
          styles.headerBar,
          {
            height: paddingTop + HEADER_HEIGHT,
            paddingTop,
          },
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, blurStyle]}>
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={30}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.headerFallback]} />
          )}
        </Animated.View>
        <View style={styles.headerContent}>
          <Text style={styles.brandTitle}>Oto</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: Spacing['4xl'],
  },
  headerBar: {
    // Pinned at the very top of the sidebar. `pointerEvents="none"`
    // so taps still reach the ScrollView beneath.
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  headerFallback: {
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
  },
  headerContent: {
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    height: HEADER_HEIGHT,
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
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
});
