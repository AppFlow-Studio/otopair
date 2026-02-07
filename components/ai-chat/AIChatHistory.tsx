/**
 * AIChatHistory
 *
 * PURPOSE: Slide-from-left sidebar displaying past conversation history
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (overlay when showHistory is true)
 *
 * PROPS:
 *   - visible (boolean): Whether sidebar is visible
 *   - onClose (() => void): Callback to close sidebar
 *   - conversations (Conversation[]): Array of past conversations
 *   - onSelectConversation ((conversationId: string) => void): Callback when conversation selected
 *   - isLoading (boolean): Whether conversations are loading
 *
 * EXAMPLE:
 *   <AIChatHistory
 *     visible={showHistory}
 *     onClose={() => setShowHistory(false)}
 *     conversations={conversations}
 *     onSelectConversation={(id) => loadConversation(id)}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useEffect, useState, useCallback, useRef } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Dimensions, TouchableWithoutFeedback, TextInput } from 'react-native';

// 2. Expo & Third-party
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X, Search } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  runOnJS,
  interpolate,
} from 'react-native-reanimated';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, Shadows } from '@/constants/theme';
import type { Conversation } from '@/stores/useAIChatStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SIDEBAR_WIDTH = Math.min(SCREEN_WIDTH * 0.8, 320);
const EXPANDED_SIDEBAR_WIDTH = SCREEN_WIDTH;
const ANIMATION_DURATION = 300;

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
  const insets = useSafeAreaInsets();
  
  // Reanimated shared values
  const slideProgress = useSharedValue(0);
  const expandProgress = useSharedValue(0);
  const [isRendered, setIsRendered] = useState(false);
  
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchInputRef = useRef<TextInput>(null);

  // Spring config for smooth expansion
  const springConfig = {
    damping: 20,
    stiffness: 150,
    mass: 0.8,
  };

  // Handle search focus - expand sidebar with smooth spring animation
  const handleSearchFocus = useCallback(() => {
    setIsSearchFocused(true);
    expandProgress.value = withSpring(1, springConfig);
  }, [expandProgress]);

  // Handle search blur - collapse sidebar (only if search is empty)
  const handleSearchBlur = useCallback(() => {
    setIsSearchFocused(false);
    if (!searchQuery) {
      expandProgress.value = withSpring(0, springConfig);
    }
  }, [searchQuery, expandProgress]);

  // Clear search and collapse
  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setIsSearchFocused(false);
    searchInputRef.current?.blur();
    expandProgress.value = withSpring(0, springConfig);
  }, [expandProgress]);

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conversation) =>
    conversation.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle visibility changes
  useEffect(() => {
    if (visible) {
      setIsRendered(true);
      slideProgress.value = withTiming(1, {
        duration: ANIMATION_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      // Reset search state
      setSearchQuery('');
      setIsSearchFocused(false);
      expandProgress.value = 0;
      
      slideProgress.value = withTiming(0, {
        duration: ANIMATION_DURATION,
        easing: Easing.in(Easing.cubic),
      }, (finished) => {
        if (finished) {
          runOnJS(setIsRendered)(false);
        }
      });
    }
  }, [visible, slideProgress, expandProgress]);

  // Animated styles for backdrop
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: slideProgress.value,
  }));

  // Animated styles for sidebar with smooth width expansion
  const sidebarStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      slideProgress.value,
      [0, 1],
      [-SIDEBAR_WIDTH, 0]
    );
    
    const width = interpolate(
      expandProgress.value,
      [0, 1],
      [SIDEBAR_WIDTH, EXPANDED_SIDEBAR_WIDTH]
    );

    return {
      transform: [{ translateX }],
      width,
    };
  });

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Don't render if not visible
  if (!isRendered) {
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Backdrop with fade animation */}
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.backdrop, backdropStyle]} />
      </TouchableWithoutFeedback>
      
      {/* Sidebar with slide and expand animation */}
      <Animated.View
        style={[
          styles.sidebar,
          { paddingTop: insets.top },
          sidebarStyle,
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text size="xl" weight="semiBold" style={styles.title}>
            Chat History
          </Text>
        </View>

        {/* Search Bar Row */}
        <View style={styles.searchRow}>
          <View style={[
            styles.searchInputWrapper,
            (isSearchFocused || searchQuery.length > 0) && styles.searchInputWrapperFocused,
          ]}>
            <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search"
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              onFocus={handleSearchFocus}
              onBlur={handleSearchBlur}
              returnKeyType="search"
            />
            {(searchQuery.length > 0 || isSearchFocused) && (
              <Pressable onPress={handleClearSearch} style={styles.clearBtn}>
                <X size={18} color="#6B7280" />
              </Pressable>
            )}
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Conversations List */}
        <ScrollView
          style={styles.conversationsList}
          contentContainerStyle={styles.conversationsContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filteredConversations.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>
                {searchQuery ? 'No results found' : 'No conversations yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery 
                  ? 'Try a different search term'
                  : 'Start a new chat to see your history here'}
              </Text>
            </View>
          ) : (
            filteredConversations.map((conversation) => (
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
                  {formatDate(conversation.updatedAt)}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
  },
  title: {
    color: BrandColors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginHorizontal: Spacing.lg,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchInputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchInputWrapperFocused: {
    borderColor: '#9CA3AF',
    backgroundColor: BrandColors.white,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: BrandColors.primary,
    paddingVertical: 0,
  },
  clearBtn: {
    padding: Spacing.xs,
    marginLeft: Spacing.xs,
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
