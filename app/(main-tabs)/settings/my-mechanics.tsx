/**
 * MyMechanicsScreen
 *
 * PURPOSE: Allows users to view, search, and manage their favorite and recently booked mechanics.
 *          Features a high-fidelity list with status indicators and preferred toggles.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  Animated as RNAnimated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Search,
  MoreHorizontal,
  Plus,
  Users,
  Calendar,
  MessageSquare,
  Settings,
  ArrowLeft,
  Bell,
  Clock,
  Heart,
  ShieldAlert,
  Trash2,
  UserMinus,
} from 'lucide-react-native';
import Animated, { FadeInUp, FadeOut, LinearTransition, ZoomOut } from 'react-native-reanimated';
import { useMutation, useQuery } from "convex/react";

import {
  BlurHeaderOverlay,
  BrandColors,
  Spacing,
  Text,
} from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const MENU_WIDTH = 220;
const MENU_HEIGHT = 150; // Increased height to account for potential text wrapping

interface Mechanic {
  id: string;
  name: string;
  image?: string;
  initials?: string;
  isPreferred?: boolean;
  lastVisit?: string;
}

const FILTERS = ['All Mechanics', 'Favorites', 'Hidden'];

interface MechanicListItemProps {
  mechanic: Mechanic;
  fromFavorites?: boolean;
  onOpenMenu: (mechanic: Mechanic, fromFavorites: boolean, anchorRef: React.RefObject<View | null>) => void;
}

const MechanicListItem = ({ mechanic, fromFavorites = false, onOpenMenu }: MechanicListItemProps) => {
  const anchorRef = useRef<View>(null);
  
  return (
    <Animated.View 
      layout={LinearTransition.duration(400)}
      entering={FadeInUp.duration(300)}
      exiting={ZoomOut.duration(200)}
    >
      <Pressable
        key={mechanic.id}
        style={({ pressed }) => [
          styles.mechanicRow,
          pressed && styles.rowPressed
        ]}
      >
        <View style={styles.mechanicLeft}>
          <View style={styles.avatarContainer}>
            {mechanic.image ? (
              <Image source={{ uri: mechanic.image }} style={styles.avatar} />
            ) : (
              <LinearGradient
                colors={['#6366F1', BrandColors.primary]}
                style={styles.avatarPlaceholder}
              >
                <Text weight="bold" size="lg" color="#FFF">
                  {mechanic.initials ?? mechanic.name[0]}
                </Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.mechanicInfo}>
            <Text weight="bold" size="md" color="#111318">
              {mechanic.name}
            </Text>
            {mechanic.lastVisit ? (
              <View style={styles.lastVisitRow}>
                <Clock size={12} color="#86868B" />
                <Text size="sm" color="#86868B" weight="medium">
                  Last visit: {mechanic.lastVisit}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View ref={anchorRef} collapsable={false}>
          <Pressable 
            style={styles.moreButton}
            onPress={() => onOpenMenu(mechanic, fromFavorites, anchorRef)}
          >
            <MoreHorizontal size={20} color="#9CA3AF" />
          </Pressable>
        </View>
      </Pressable>
    </Animated.View>
  );
};

export default function MyMechanicsScreen() {
  const insets = useSafeAreaInsets();
  const { userId } = useUserFromConvex();
  const data = useQuery(
    (api as any).mechanics.getMyMechanicsForUser,
    userId ? { userId } : "skip",
  );
  const setFavoriteForUser = useMutation((api as any).mechanics.setFavoriteForUser);
  const setHiddenForUser = useMutation((api as any).mechanics.setHiddenForUser);
  const [query, setQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Mechanics');

  const favorites = (data?.favorites ?? []) as Mechanic[];
  const recentlyBooked = (data?.recentlyBooked ?? []) as Mechanic[];
  const hiddenMechanics = (data?.hidden ?? []) as Mechanic[];

  // Menu state
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [selectedMechanic, setSelectedMechanic] = useState<Mechanic | null>(null);
  const [isFromFavorites, setIsFromFavorites] = useState(false);

  // Action Menu Animation Values
  const backdropAnim = useRef(new RNAnimated.Value(0)).current;
  const menuAnim = useRef(new RNAnimated.Value(0)).current;

  const closeMenu = useCallback(() => {
    RNAnimated.parallel([
      RNAnimated.timing(backdropAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      RNAnimated.timing(menuAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setIsMenuVisible(false);
    });
  }, [backdropAnim, menuAnim]);

  // Handle menu animations
  useEffect(() => {
    if (isMenuVisible) {
      RNAnimated.parallel([
        RNAnimated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        RNAnimated.timing(menuAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isMenuVisible, backdropAnim, menuAnim]);

  const openMenu = useCallback((mechanic: Mechanic, fromFavorites: boolean, anchorRef: React.RefObject<View | null>) => {
    anchorRef.current?.measureInWindow?.((x, y, w, h) => {
      const left = Math.min(Math.max(12, x + w - MENU_WIDTH), SCREEN_WIDTH - MENU_WIDTH - 12);
      
      // Calculate available space
      const spaceBelow = SCREEN_HEIGHT - (y + h + 150); // Increased buffer to 150px to flip to top position much sooner
      const spaceAbove = y - 100; // 100px buffer for header/safe area
      
      let top;
      // If it fits below, put it below (default preference)
      if (spaceBelow >= MENU_HEIGHT) {
        top = y + h + 8;
      } 
      // If it doesn't fit below but fits above, flip it
      else if (spaceAbove >= MENU_HEIGHT) {
        top = y - MENU_HEIGHT - 8;
      } 
      // If it fits neither perfectly, pick the side with more space
      else {
        top = spaceBelow > spaceAbove ? y + h + 8 : y - MENU_HEIGHT - 8;
      }

      setMenuPosition({ top, left });
      setSelectedMechanic(mechanic);
      setIsFromFavorites(fromFavorites);
      backdropAnim.setValue(0);
      menuAnim.setValue(0);
      setIsMenuVisible(true);
    });
  }, [backdropAnim, menuAnim]);

  const handleToggleFavorite = useCallback(async () => {
    if (!selectedMechanic || !userId) return;
    await setFavoriteForUser({
      userId,
      mechanicId: selectedMechanic.id as Id<"mechanics">,
      isFavorite: !isFromFavorites,
    });
    closeMenu();
  }, [selectedMechanic, userId, isFromFavorites, setFavoriteForUser, closeMenu]);

  const handleHideMechanic = useCallback(async () => {
    if (!selectedMechanic || !userId) return;
    await setHiddenForUser({
      userId,
      mechanicId: selectedMechanic.id as Id<"mechanics">,
      isHidden: true,
    });
    closeMenu();
  }, [selectedMechanic, userId, setHiddenForUser, closeMenu]);

  return (
    <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
      <BlurHeaderOverlay title="My Mechanics" />

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
        <Animated.View entering={FadeInUp.duration(400)}>
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" />
            <TextInput
              placeholder="Search name..."
              placeholderTextColor="#9CA3AF"
              value={query}
              onChangeText={setQuery}
              style={styles.searchInput}
            />
          </View>

          {/* Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            style={styles.chipScroll}
          >
            {FILTERS.map((filter) => {
              const isActive = activeFilter === filter;
              return (
                <Pressable
                  key={filter}
                  onPress={() => setActiveFilter(filter)}
                  style={[styles.chip, isActive && styles.chipActive]}
                >
                  <Text
                    weight={isActive ? 'bold' : 'medium'}
                    size="sm"
                    color={isActive ? '#FFFFFF' : '#6B7280'}
                  >
                    {filter}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Your Favorites Section */}
          {(activeFilter === 'Favorites' || activeFilter === 'All Mechanics') && favorites.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text weight="semiBold" size="lg" color="#111318">
                  Your Favorites
                </Text>
              </View>
              <Animated.View layout={LinearTransition.duration(400)} style={styles.glassCard}>
                {favorites
                  .filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
                  .map((m) => (
                    <MechanicListItem 
                      key={m.id}
                      mechanic={m} 
                      fromFavorites={true} 
                      onOpenMenu={openMenu} 
                    />
                  ))}
              </Animated.View>
            </View>
          )}

          {/* Recently Booked Section */}
          {activeFilter === 'All Mechanics' && recentlyBooked.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text weight="semiBold" size="lg" color="#111318">
                  Recently Booked
                </Text>
              </View>
              <Animated.View layout={LinearTransition.duration(400)} style={styles.glassCard}>
                {recentlyBooked
                  .filter(m => m.name.toLowerCase().includes(query.toLowerCase()))
                  .map((m) => (
                    <MechanicListItem 
                      key={m.id}
                      mechanic={m} 
                      fromFavorites={false} 
                      onOpenMenu={openMenu} 
                    />
                  ))}
              </Animated.View>
            </View>
          )}

          {/* Hidden Section */}
          {activeFilter === 'Hidden' && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text weight="semiBold" size="lg" color="#111318">
                  Hidden Mechanics
                </Text>
              </View>
              <Animated.View layout={LinearTransition.duration(400)} style={styles.glassCard}>
                {hiddenMechanics.length > 0 ? (
                  hiddenMechanics
                    .map(m => (
                      <Animated.View 
                        key={m.id} 
                        layout={LinearTransition.duration(400)}
                        entering={FadeInUp.duration(300)}
                        exiting={ZoomOut.duration(200)}
                        style={styles.mechanicRow}
                      >
                        <View style={styles.mechanicLeft}>
                          <View style={styles.avatarContainer}>
                            {m.image ? (
                              <Image source={{ uri: m.image }} style={styles.avatar} />
                            ) : (
                              <LinearGradient
                                colors={['#6366F1', BrandColors.primary]}
                                style={styles.avatarPlaceholder}
                              >
                                <Text weight="bold" size="lg" color="#FFF">
                                  {m.initials ?? m.name[0]}
                                </Text>
                              </LinearGradient>
                            )}
                          </View>
                          <View style={styles.mechanicInfo}>
                            <Text weight="bold" size="md" color="#111318">{m.name}</Text>
                            {m.lastVisit ? (
                              <View style={styles.lastVisitRow}>
                                <Clock size={12} color="#86868B" />
                                <Text size="sm" color="#86868B" weight="medium">
                                  Last visit: {m.lastVisit}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                        <Pressable 
                          onPress={async () => {
                            if (!userId) return;
                            await setHiddenForUser({
                              userId,
                              mechanicId: m.id as Id<"mechanics">,
                              isHidden: false,
                            });
                          }}
                          style={styles.unhideButton}
                        >
                          <Text weight="bold" size="xs" color={BrandColors.primary}>UNHIDE</Text>
                        </Pressable>
                      </Animated.View>
                    ))
                ) : (
                  <View style={styles.emptyState}>
                    <Text size="sm" color="#86868B">No hidden mechanics</Text>
                  </View>
                )}
              </Animated.View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Action Menu */}
      <Modal transparent visible={isMenuVisible} animationType="none">
        <TouchableWithoutFeedback onPress={closeMenu}>
          <RNAnimated.View 
            style={[
              styles.menuOverlay,
              {
                opacity: backdropAnim
              }
            ]}
          >
            <TouchableWithoutFeedback>
              <RNAnimated.View
                style={[
                  styles.menuContainer,
                  {
                    top: menuPosition?.top ?? 0,
                    left: menuPosition?.left ?? 0,
                    opacity: menuAnim,
                    transform: [
                      { scale: menuAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.95, 1]
                        }) 
                      }
                    ]
                  },
                ]}
              >
                <View style={styles.menuContent}>
                  <Pressable
                    style={styles.menuItem}
                    onPress={handleToggleFavorite}
                  >
                    <View style={styles.menuIconBox}>
                      {isFromFavorites ? (
                        <UserMinus size={18} color="#EF4444" />
                      ) : (
                        <Heart size={18} color={BrandColors.primary} />
                      )}
                    </View>
                    <Text 
                      weight="medium" 
                      size="md" 
                      color={isFromFavorites ? "#EF4444" : "#1F2937"}
                      style={styles.menuItemText}
                    >
                      {isFromFavorites ? "Remove from Favorites" : "Add to Favorites"}
                    </Text>
                  </Pressable>
                  
                  <View style={styles.menuSeparator} />
                  
                  <Pressable
                    style={styles.menuItem}
                    onPress={handleHideMechanic}
                  >
                    <View style={styles.menuIconBox}>
                      <ShieldAlert size={18} color="#EF4444" />
                    </View>
                    <Text weight="medium" size="md" color="#EF4444" style={styles.menuItemText}>
                      Hide mechanic
                    </Text>
                  </Pressable>
                </View>
              </RNAnimated.View>
            </TouchableWithoutFeedback>
          </RNAnimated.View>
        </TouchableWithoutFeedback>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 16,
    height: 52,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111318',
    marginLeft: 12,
  },
  chipScroll: {
    marginBottom: 24,
  },
  chipRow: {
    gap: 12,
  },
  chip: {
    paddingHorizontal: 20,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  chipActive: {
    backgroundColor: BrandColors.secondary,
    borderColor: BrandColors.secondary,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    paddingHorizontal: 8,
    marginBottom: 12,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  mechanicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  rowPressed: {
    backgroundColor: 'rgba(81, 146, 251, 0.05)',
  },
  mechanicLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mechanicInfo: {
    flex: 1,
    gap: 2,
  },
  lastVisitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  moreButton: {
    padding: 8,
    marginRight: -8,
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.1)",
  },
  menuContainer: {
    position: "absolute",
    width: MENU_WIDTH,
    borderRadius: 16,
    backgroundColor: "#FFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  menuContent: {
    padding: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  menuItemText: {
    flex: 1,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.03)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuSeparator: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginHorizontal: 8,
  },
  unhideButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(81, 146, 251, 0.1)',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
