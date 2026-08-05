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

import React, { useState } from 'react';
import { View, Pressable, StyleSheet, Platform, Dimensions, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import MaskedView from '@react-native-masked-view/masked-view';
import { Pin, PinOff, Pencil, Trash2 } from 'lucide-react-native';
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
  pinned?: boolean;
}

interface AIChatHistoryProps {
  onClose: () => void;
  conversations: AIChatHistoryItem[];
  onSelectConversation: (conversationId: string) => void;
  /** Delete a conversation (with confirm). */
  onDeleteConversation?: (conversationId: string) => void;
  /** Rename a conversation (opens a text prompt). */
  onRenameConversation?: (conversationId: string, currentTitle: string) => void;
  /** Pin / unpin a conversation to the top of the list. */
  onTogglePinConversation?: (conversationId: string, pinned: boolean) => void;
  isLoading?: boolean;
  paddingTop: number;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MENU_WIDTH = 220;
const MENU_HEIGHT = 168;

// Height of the sticky Oto title area (safe area gets added on top).
const HEADER_HEIGHT = 60;

// When the sidebar is revealed the chat card peeks over the right ~22%
// of the screen (parent's DRAWER_TRANSLATE = width * 0.78), so the
// visually usable sidebar is the left 78%. Center full-width content
// (like the empty state) within that, or it reads as shifted right.
const SIDEBAR_VISIBLE_WIDTH = Dimensions.get('window').width * 0.78;
// Scroll offset at which the frosted-blur backdrop reaches full opacity.
const BLUR_FADE_END = 16;

export function AIChatHistory({
  onClose: _onClose,
  conversations,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onTogglePinConversation,
  isLoading: _isLoading = false,
  paddingTop,
}: AIChatHistoryProps) {
  const insets = useSafeAreaInsets();
  // Long-press context menu (ChatGPT-style): Pin / Rename / Delete.
  const [menu, setMenu] = useState<{
    item: AIChatHistoryItem;
    top: number;
    left: number;
  } | null>(null);
  // Capture where the finger went down so the menu anchors near the row.
  const pressPos = React.useRef({ x: 0, y: 0 });

  const openMenu = (item: AIChatHistoryItem) => {
    const { x, y } = pressPos.current;
    const top = Math.min(y, SCREEN_HEIGHT - MENU_HEIGHT - insets.bottom - 16);
    const left = Math.min(Math.max(x - 20, 12), SIDEBAR_VISIBLE_WIDTH - MENU_WIDTH);
    setMenu({ item, top: Math.max(top, insets.top + 8), left: Math.max(left, 12) });
  };
  const closeMenu = () => setMenu(null);

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
          {
            paddingTop: paddingTop + HEADER_HEIGHT + Spacing.md,
            // Clear the floating bottom tab bar (~56pt) so the last
            // conversation isn't hidden behind it — plus a small margin.
            paddingBottom: insets.bottom + 56,
          },
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
              onPressIn={(e) => {
                pressPos.current = {
                  x: e.nativeEvent.pageX,
                  y: e.nativeEvent.pageY,
                };
              }}
              onPress={() => {
                onSelectConversation(conversation.id);
              }}
              onLongPress={() => openMenu(conversation)}
              delayLongPress={350}
            >
              <View style={styles.conversationRow}>
                {conversation.pinned ? (
                  <Pin
                    size={13}
                    color="#8A94A6"
                    fill="#8A94A6"
                    style={styles.pinIcon}
                  />
                ) : null}
                <Text
                  style={styles.conversationTitle}
                  weight="regular"
                  numberOfLines={1}
                >
                  {conversation.title}
                </Text>
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
          {/* MaskedView feathers the blur to zero at the bottom
              edge of the header so there's no hard cutoff line
              between the frosted title area and the sharp
              scrolling list below. Mask: opaque top → opaque
              through 70% → transparent at the bottom. */}
          <MaskedView
            style={StyleSheet.absoluteFill}
            maskElement={
              <LinearGradient
                colors={['#000', '#000', 'transparent']}
                locations={[0, 0.7, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
            }
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={30}
                tint="light"
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View style={[StyleSheet.absoluteFill, styles.headerFallback]} />
            )}
          </MaskedView>
        </Animated.View>
        <View style={styles.headerContent}>
          <Text style={styles.brandTitle}>Oto</Text>
        </View>
      </View>

      {/* Long-press context menu — Pin / Rename / Delete (ChatGPT-style). */}
      <Modal
        visible={!!menu}
        transparent
        animationType="fade"
        onRequestClose={closeMenu}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={closeMenu} />
        {menu ? (
          <View style={[styles.menuCard, { top: menu.top, left: menu.left }]}>
            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => {
                const it = menu.item;
                closeMenu();
                onTogglePinConversation?.(it.id, !it.pinned);
              }}
            >
              {menu.item.pinned ? (
                <PinOff size={18} color="#1A1D21" />
              ) : (
                <Pin size={18} color="#1A1D21" />
              )}
              <Text style={styles.menuLabel} weight="regular">
                {menu.item.pinned ? 'Unpin' : 'Pin'}
              </Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => {
                const it = menu.item;
                closeMenu();
                onRenameConversation?.(it.id, it.title);
              }}
            >
              <Pencil size={18} color="#1A1D21" />
              <Text style={styles.menuLabel} weight="regular">
                Rename
              </Text>
            </Pressable>

            <View style={styles.menuDivider} />

            <Pressable
              style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
              onPress={() => {
                const it = menu.item;
                closeMenu();
                onDeleteConversation?.(it.id);
              }}
            >
              <Trash2 size={18} color="#DC2626" />
              <Text style={[styles.menuLabel, { color: '#DC2626' }]} weight="regular">
                Delete
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Modal>
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
    // paddingBottom is set inline (safe-area + tab-bar clearance).
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
    fontSize: 26,
    lineHeight: 32,
    fontFamily: FontFamily.bold,
    color: '#000000',
  },
  recentsLabel: {
    fontSize: 12,
    lineHeight: 16,
    color: '#8A94A6',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  conversationItem: {
    paddingVertical: 9,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
    marginHorizontal: Spacing.sm,
  },
  conversationItemPressed: {
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinIcon: {
    marginTop: 1,
  },
  conversationTitle: {
    flexShrink: 1,
    color: '#1A1D21',
    fontSize: 14,
    lineHeight: 18,
  },
  // ── Long-press context menu ──────────────────────────────────────────
  menuCard: {
    position: 'absolute',
    width: MENU_WIDTH,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  menuItemPressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  menuLabel: {
    fontSize: 15,
    color: '#1A1D21',
  },
  menuDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginHorizontal: 12,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: Spacing['4xl'],
    paddingHorizontal: Spacing.lg,
    // Match the revealed sidebar width so the text centers in the
    // visible area rather than the full (partially covered) screen.
    width: SIDEBAR_VISIBLE_WIDTH,
  },
  emptyText: {
    color: '#000000',
    fontSize: 16,
    marginBottom: Spacing.xs,
  },
});
