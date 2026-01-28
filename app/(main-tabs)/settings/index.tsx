/**
 * SettingsHomeScreen
 *
 * PURPOSE: Main settings screen providing user profile overview and access to various app settings.
 *
 * USED IN: app/(main-tabs)/_layout.tsx (as a tab screen)
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <SettingsHomeScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  LayoutChangeEvent,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import {
  Ellipsis,
  LogOut,
  Pencil,
  Car,
  Award,
  UserPlus,
  CreditCard,
  Receipt,
  Bell,
  Headset,
  HelpCircle,
  Star,
  ShieldCheck,
  Fingerprint,
  ScanFace,
  Shield,
  FileText,
  Info,
  MessageSquare,
  RotateCcw,
  ChevronRight,
} from 'lucide-react-native';
import { CarIcon } from 'phosphor-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  interpolateColor,
  Extrapolation,
} from 'react-native-reanimated';
import { useShallow } from 'zustand/react/shallow';
import { LinearGradient } from 'expo-linear-gradient';
// @ts-ignore Expo module available at runtime
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as StoreReview from 'expo-store-review';

import { BrandColors, Button, FeedbackModal, Text, ScrollDrivenGradientBackground } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const MENU_WIDTH = 190;

const AnimatedText = Animated.createAnimatedComponent(Text);

// ============================================================================
// CONSTANTS
// ============================================================================
const HEADER_MAX_HEIGHT = 440; // Total height of the profile area
const HEADER_MIN_HEIGHT = 80;  // Height of the collapsed sticky bar
const SHEET_TOP_RADIUS = 32;

// ============================================================================
// SETTINGS LIST ITEM COMPONENT
// ============================================================================

interface SettingsListItemProps {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  isLast?: boolean;
}

const SettingsListItem = ({ icon, label, onPress, isLast }: SettingsListItemProps) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
  >
    <View style={styles.listItemIcon}>{icon}</View>
    <Text weight="medium" size="md" color="#1F2937" style={styles.listItemLabel}>
      {label}
    </Text>
    <ChevronRight size={20} color="#9CA3AF" />
    {!isLast && <View style={styles.listItemSeparator} />}
  </Pressable>
);

export default function SettingsHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const scrollY = useSharedValue(0);

  const [nameWidth, setNameWidth] = useState(0);
  const [biometricLabel, setBiometricLabel] = useState('Biometric Login');

  const handleNameLayout = useCallback((e: LayoutChangeEvent) => {
    setNameWidth(e.nativeEvent.layout.width);
  }, []);

  const { data, updateData, reset, isCreateAccountComplete, addFeedbackSubmission } = useOnboardingStore(
    useShallow((state) => ({
      data: state.data,
      updateData: state.updateData,
      reset: state.reset,
      isCreateAccountComplete: state.isCreateAccountComplete(),
      addFeedbackSubmission: state.addFeedbackSubmission,
    })),
  );

  // ─────────────────────────────────────────────────────────────
  // Log Notification Preferences on Screen Open
  // ─────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const checkBiometrics = async () => {
        try {
          const hardware = await LocalAuthentication.hasHardwareAsync();
          const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();
          
          if (hardware && supportedTypes.length > 0) {
            if (Platform.OS === 'ios') {
              if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
                setBiometricLabel('Face ID');
              } else if (supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
                setBiometricLabel('Touch ID');
              } else {
                setBiometricLabel('Biometric Login');
              }
            } else {
              // Android often has multiple, keeping generic
              setBiometricLabel('Biometric Login');
            }
          }
        } catch (error) {
          console.error('Error checking biometrics:', error);
        }
      };

      checkBiometrics();
      
      console.log('Notification Preferences Status:', {
        twoFactorEmailEnabled: data.twoFactorEmailEnabled,
        twoFactorSmsEnabled: data.twoFactorSmsEnabled,
        notificationOffersEnabled: data.notificationOffersEnabled,
        notificationRewardsEnabled: data.notificationRewardsEnabled,
        notificationPassEnabled: data.notificationPassEnabled,
        notificationOtherEnabled: data.notificationOtherEnabled,
        notificationBookingsEnabled: data.notificationBookingsEnabled,
      });
    }, [data.twoFactorEmailEnabled, data.twoFactorSmsEnabled, data.notificationOffersEnabled, data.notificationRewardsEnabled, data.notificationPassEnabled, data.notificationOtherEnabled, data.notificationBookingsEnabled])
  );

  // ─────────────────────────────────────────────────────────────
  // Computed Data
  // ─────────────────────────────────────────────────────────────
  const fullName = useMemo(() => {
    const name = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
    return name.length > 0 ? name : 'John Doe';
  }, [data.firstName, data.lastName]);

  const initials = useMemo(() => {
    const first = (data.firstName ?? '').trim();
    const last = (data.lastName ?? '').trim();
    const a = first.length > 0 ? first[0] : '';
    const b = last.length > 0 ? last[0] : '';
    const value = `${a}${b}`.toUpperCase();
    return value.length > 0 ? value : 'AJ';
  }, [data.firstName, data.lastName]);

  const totalBookingsText = useMemo(() => {
    if (isCreateAccountComplete) return '12';
    const n = Number.isFinite(data.totalBookings) ? data.totalBookings : 0;
    return String(n);
  }, [data.totalBookings, isCreateAccountComplete]);

  const pointsText = useMemo(() => {
    if (isCreateAccountComplete) return '1,240';
    const n = Number.isFinite(data.points) ? data.points : 0;
    try {
      return n.toLocaleString();
    } catch {
      return String(n);
    }
  }, [data.points, isCreateAccountComplete]);

  const membershipTier = useMemo(() => {
    if (isCreateAccountComplete) return 'Gold';
    return data.membershipTier ?? 'No';
  }, [data.membershipTier, isCreateAccountComplete]);

  // ─────────────────────────────────────────────────────────────
  // Animated Styles
  // ─────────────────────────────────────────────────────────────
  const scrollDistance = HEADER_MAX_HEIGHT - HEADER_MIN_HEIGHT;

  // The sticky bar background fades in as you scroll
  const stickyBarBackgroundStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      // Fade in earlier so the collapsed header never reads as "floating over" the list
      [scrollDistance * 0.35, scrollDistance * 0.65],
      [0, 1],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // Avatar scales down and moves to the top-left corner
  const avatarStyle = useAnimatedStyle(() => {
    // Base centered (left: '50%', marginLeft: -50).
    // Original center Y: insets.top + 20 (top) + 50 (half of 100) = insets.top + 70
    // Collapsed: 60px avatar centered in 80px sticky bar => center at insets.top + 40
    // translateY needed: (insets.top + 40) - (insets.top + 70) = -30
    //
    // Collapsed target X: left edge at 16px => center at 16 + 30 = 46.
    const targetAvatarCenterX = -52;
    const collapsedAvatarTranslateX = targetAvatarCenterX - SCREEN_WIDTH / 2;

    const scale = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [1, 0.6],
      Extrapolation.CLAMP
    );
    const translateY = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [0, -50],
      Extrapolation.CLAMP
    );
    const translateX = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [0, collapsedAvatarTranslateX],
      Extrapolation.CLAMP
    );

    return {
      transform: [{ scale }, { translateY }, { translateX }],
    };
  });

  // Expanded profile details (name, email, stats, buttons) fade out
  const expandedDetailsStyle = useAnimatedStyle(() => {
    const opacity = interpolate(
      scrollY.value,
      [0, scrollDistance * 0.4],
      [1, 0],
      Extrapolation.CLAMP
    );
    return { opacity };
  });

  // Single name instance that moves with the avatar (no fade/replace)
  const nameTransformStyle = useAnimatedStyle(() => {
    // Name starts centered.
    // Collapsed target: Sit 12px to the right of the 60px avatar (which is at 16px).
    // Target left edge = 16 + 60 + 12 = 88.
    const targetNameLeft = 88;
    const targetNameCenterX = targetNameLeft + nameWidth / 2;
    const collapsedNameTranslateX = targetNameCenterX - SCREEN_WIDTH / 2;

    const translateY = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [120, 6], // 8 yields top 28, centering ~24px text in 80px bar
      Extrapolation.CLAMP
    );
    const translateX = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [0, collapsedNameTranslateX],
      Extrapolation.CLAMP
    );
    const scale = interpolate(
      scrollY.value,
      [0, scrollDistance],
      [1, 0.9],
      Extrapolation.CLAMP
    );
    return {
      transform: [{ translateY }, { translateX }, { scale }],
    };
  });

  // Animated color for the name (transitions from black to white as header collapses)
  const nameColorStyle = useAnimatedStyle(() => {
    const color = interpolateColor(
      scrollY.value,
      [scrollDistance * 0.35, scrollDistance * 0.65], // Sync with header fade
      ['#111827', BrandColors.white],
      'RGB'
    );
    return { color };
  });

  // ─────────────────────────────────────────────────────────────
  // Menu (three dots)
  // ─────────────────────────────────────────────────────────────
  const menuAnchorRef = useRef<View>(null);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const openMenu = useCallback(() => {
    menuAnchorRef.current?.measureInWindow?.((x, y, w, h) => {
      const left = Math.min(Math.max(12, x + w - MENU_WIDTH), SCREEN_WIDTH - MENU_WIDTH - 12);
      const top = y + h + 8;
      setMenuPosition({ top, left });
      setIsMenuVisible(true);
    });
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Edit Profile modal
  // ─────────────────────────────────────────────────────────────
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [isPhotoModalVisible, setIsPhotoModalVisible] = useState(false);
  // Prefer new MediaType enum when available to avoid deprecation warnings; fall back for older SDKs.
  const mediaTypeImages =
    // @ts-ignore - MediaType may not exist on older versions
    (ImagePicker as any).MediaType?.Images ?? ImagePicker.MediaTypeOptions.Images;

  const openEditProfile = useCallback(() => {
    const name = `${data.firstName ?? ''} ${data.lastName ?? ''}`.trim();
    setEditName(name);
    setEditEmail((data.email ?? '').toLowerCase());
    setEditPhone(data.phoneNumber ?? '');
    setIsEditVisible(true);
  }, [data.email, data.firstName, data.lastName, data.phoneNumber]);

  const handleSaveProfile = useCallback(() => {
    const normalizedName = editName.trim().replace(/\s+/g, ' ');
    const nameParts = normalizedName.length > 0 ? normalizedName.split(' ') : [];
    const firstName = nameParts.length > 0 ? nameParts[0] : null;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;

    const normalizedEmail = editEmail.trim().toLowerCase();
    const email = normalizedEmail.length > 0 ? normalizedEmail : null;

    const normalizedPhone = editPhone.trim();
    const phoneNumber = normalizedPhone.length > 0 ? normalizedPhone : null;

    updateData({ firstName, lastName, email, phoneNumber });
    setIsEditVisible(false);
  }, [editEmail, editName, editPhone, updateData]);

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  };

  const persistProfilePhoto = (uri: string | null) => {
    updateData({ profilePhotoUri: uri });
  };

  const handleChooseFromLibrary = useCallback(async () => {
    setIsPhotoModalVisible(false);
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: mediaTypeImages,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    if (!result.canceled && result.assets?.length) {
      persistProfilePhoto(result.assets[0].uri);
    }
  }, [mediaTypeImages]);

  const handleTakePhoto = useCallback(async () => {
    setIsPhotoModalVisible(false);
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) return;
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      mediaTypes: mediaTypeImages,
    });
    if (!result.canceled && result.assets?.length) {
      persistProfilePhoto(result.assets[0].uri);
    }
  }, [mediaTypeImages]);

  const handleRemovePhoto = useCallback(() => {
    setIsPhotoModalVisible(false);
    persistProfilePhoto(null);
  }, []);

  // ─────────────────────────────────────────────────────────────
  // Logout confirmation
  // ─────────────────────────────────────────────────────────────
  const [isLogoutVisible, setIsLogoutVisible] = useState(false);
  const [isFeedbackVisible, setIsFeedbackVisible] = useState(false);

  const handleConfirmLogout = useCallback(() => {
    setIsLogoutVisible(false);
    reset();
    router.replace('/(onboarding)');
  }, [reset, router]);

  const handleRateUs = useCallback(async () => {
    try {
      const available = await StoreReview.isAvailableAsync();
      if (available) {
        await StoreReview.requestReview();
      }
    } catch {
      // In-app review not available (e.g. simulator) or request failed; no-op.
    }
  }, []);

    return (
    <View style={styles.screen}>
      <ScrollDrivenGradientBackground 
        scrollY={scrollY}
        scrollPerTransition={500}
        colors={[BrandColors.secondary, BrandColors.secondary, '#f4f1f8', '#f4f1f8']}
      >
        {(bgScrollHandler) => (
          <>
            {/* ═══════════════════════════════════════════════════════════════
                LAYER 10: Sticky Header Elements (Always on top)
                ═══════════════════════════════════════════════════════════════ */}
            <View style={[styles.stickyContainer, { height: HEADER_MIN_HEIGHT + insets.top }]}>
              {/* Sticky Background Bar (fades in) */}
              <Animated.View style={[StyleSheet.absoluteFill, styles.stickyBarBackground, stickyBarBackgroundStyle]} />

              {/* Transforming Avatar */}
              <Animated.View style={[styles.avatarWrapper, { top: insets.top + 20 }, avatarStyle]}>
                {data.profilePhotoUri ? (
                  <Image source={{ uri: data.profilePhotoUri }} style={styles.avatarImage} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text weight="semiBold" size="xl" color={BrandColors.secondary}>
                      {initials}
                    </Text>
                  </View>
                )}
              </Animated.View>

              {/* Single Name that moves beside the avatar */}
              <Animated.View style={[styles.movingNameContainer, { top: insets.top + 20 }, nameTransformStyle]}>
                <AnimatedText 
                  weight="bold" 
                  size="lg" 
                  onLayout={handleNameLayout}
                  numberOfLines={1}
                  style={[
                    { maxWidth: SCREEN_WIDTH * 0.6 },
                    nameColorStyle
                  ]}
                >
                  {fullName}
                </AnimatedText>
              </Animated.View>

              {/* Ellipsis Menu */}
              <View ref={menuAnchorRef} collapsable={false} style={[styles.menuAnchor, { top: insets.top + 30 }]}>
                <Pressable onPress={openMenu} hitSlop={10}>
                  <Ellipsis size={24} color={BrandColors.white} />
                </Pressable>
              </View>
            </View>

            {/* ═══════════════════════════════════════════════════════════════
                LAYER 5: Scrollable Content
                ═══════════════════════════════════════════════════════════════ */}
            <Animated.ScrollView
              onScroll={bgScrollHandler}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
              style={styles.scrollView}
            >
              {/* Expanded Profile Info (Will scroll up and fade out) */}
              <Animated.View style={[styles.profileInfoArea, { paddingTop: insets.top + 180 }, expandedDetailsStyle]}>
                <View style={styles.statsRow}>
                  <View style={styles.statItem}>
                    <Text weight="bold" size="lg" color="#111827">{totalBookingsText}</Text>
                    <Text size="xs" color="#6B7280">Bookings</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text weight="bold" size="lg" color="#111827">{membershipTier}</Text>
                    <Text size="xs" color="#6B7280">Member</Text>
                  </View>
                  <View style={styles.statDivider} />
                  <View style={styles.statItem}>
                    <Text weight="bold" size="lg" color="#111827">{pointsText}</Text>
                    <Text size="xs" color="#6B7280">Points</Text>
                  </View>
                </View>

                <View style={styles.headerActions}>
                  <Pressable onPress={() => console.log('View Loyalty')} style={styles.headerButtonPill}>
                    <Award size={20} color="#374151" />
                    <Text weight="medium" size="md" color="#374151">
                      View Loyalty
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => router.push('/cars')} style={styles.headerButtonPill}>
                    <CarIcon size={20} color="#374151" weight="bold" />
                    <Text weight="medium" size="md" color="#374151">
                      Add Vehicle
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>

              {/* White Settings Sheet */}
              <View style={styles.sheetContainer}>
                {/* Section 1 */}
                <View style={styles.section}>
                  <Text weight="bold" size="sm" color="#6B7280" style={styles.sectionTitle}>VEHICLES & LOYALTY</Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<Car size={20} color="#1F2937" />}
                      label="My Vehicles"
                      onPress={() => router.push('/cars')}
                    />
                    <SettingsListItem
                      icon={<Award size={20} color="#1F2937" />}
                      label="Loyalty & Rewards"
                      onPress={() => console.log('Loyalty')}
                    />
                    <SettingsListItem
                      icon={<UserPlus size={20} color="#1F2937" />}
                      label="Refer a Friend"
                      onPress={() => router.push('/settings/refer-a-friend')}
                    />
                    <SettingsListItem
                      icon={<CreditCard size={20} color="#1F2937" />}
                      label="Payment Methods"
                      onPress={() => router.push('/payments')}
                    />
                    <SettingsListItem
                      icon={<Receipt size={20} color="#1F2937" />}
                      label="Transactions & Receipts"
                      onPress={() => router.push('/settings/transactions')}
                      isLast
                    />
                  </View>
                </View>

                {/* Section 2 */}
                <View style={styles.section}>
                  <Text weight="bold" size="sm" color="#6B7280" style={styles.sectionTitle}>GENERAL</Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<Bell size={20} color="#1F2937" />}
                      label="Notification Preferences"
                      onPress={() => router.push('/settings/notification-preferences')}
                    />
                    <SettingsListItem
                      icon={<Headset size={20} color="#1F2937" />}
                      label="Contact Us"
                      onPress={() => router.push('/settings/contact-us')}
                    />
                    <SettingsListItem
                      icon={<HelpCircle size={20} color="#1F2937" />}
                      label="FAQ"
                      onPress={() => router.push('/settings/faq')}
                    />
                    <SettingsListItem
                      icon={<MessageSquare size={20} color="#1F2937" />}
                      label="Feedback"
                      onPress={() => setIsFeedbackVisible(true)}
                    />
                    <SettingsListItem
                      icon={<Star size={20} color="#1F2937" />}
                      label="Rate Us"
                      onPress={handleRateUs}
                      isLast
                    />
                  </View>
                </View>

                {/* Section 3 */}
                <View style={styles.section}>
                  <Text weight="bold" size="sm" color="#6B7280" style={styles.sectionTitle}>SECURITY & PRIVACY</Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<ShieldCheck size={20} color="#1F2937" />}
                      label="Two-Factor Authentication (2FA)"
                      onPress={() => router.push('/settings/two-factor-method')}
                    />
                    <SettingsListItem
                      icon={biometricLabel === 'Face ID' ? <ScanFace size={20} color="#1F2937" /> : <Fingerprint size={20} color="#1F2937" />}
                      label={biometricLabel}
                      onPress={() => router.push('/settings/biometric-setup')}
                      isLast
                    />
                  </View>
                </View>

                {/* Section 4 */}
                <View style={styles.section}>
                  <Text weight="bold" size="sm" color="#6B7280" style={styles.sectionTitle}>LEGAL</Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<Shield size={20} color="#1F2937" />}
                      label="Privacy Policy"
                      onPress={() => router.push('/settings/privacy-policy')}
                    />
                    <SettingsListItem
                      icon={<FileText size={20} color="#1F2937" />}
                      label="Terms of service"
                      onPress={() => router.push('/settings/terms-of-service')}
                      isLast
                    />
                  </View>
                </View>

                {/* Section 5 */}
                <View style={styles.section}>
                  <Text weight="bold" size="sm" color="#6B7280" style={styles.sectionTitle}>MORE</Text>
                  <View style={styles.sectionCard}>
                    <SettingsListItem
                      icon={<Info size={20} color="#1F2937" />}
                      label="About Otopair v1.0.0"
                      onPress={() => router.push('/settings/about')}
                    />
                    <SettingsListItem
                      icon={<LogOut size={20} color="#1F2937" />}
                      label="Logout"
                      onPress={() => setIsLogoutVisible(true)}
                    />
                  </View>
                </View>

                <View style={{ height: insets.bottom + 60 }} />
              </View>
            </Animated.ScrollView>
          </>
        )}
      </ScrollDrivenGradientBackground>

      {/* Modals remain same */}
      <Modal transparent visible={isMenuVisible} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setIsMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <View style={[styles.menuContainer, { top: menuPosition?.top ?? insets.top + 80, left: menuPosition?.left ?? SCREEN_WIDTH - MENU_WIDTH - 12 }]}>
              <View style={styles.menuContent}>
                <Pressable style={styles.menuItem} onPress={() => { setIsMenuVisible(false); openEditProfile(); }}>
                  <View style={styles.menuIconBox}><Pencil size={18} color="#1F2937" /></View>
                  <Text weight="medium" size="md" color="#1F2937">Edit Profile</Text>
                </Pressable>
                <View style={styles.menuSeparator} />
                <Pressable style={styles.menuItem} onPress={() => { setIsMenuVisible(false); setIsLogoutVisible(true); }}>
                  <View style={styles.menuIconBox}><LogOut size={18} color="#1F2937" /></View>
                  <Text weight="medium" size="md" color="#1F2937">Logout</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal transparent visible={isEditVisible} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setIsEditVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.editModalCard}>
                <Text weight="semiBold" size="xl" color="#111827" style={styles.editModalTitle}>Edit Profile</Text>
                <View style={styles.editAvatarRow}>
                  <Pressable style={styles.editAvatarWrapper} onPress={() => setIsPhotoModalVisible(true)}>
                    {data.profilePhotoUri ? <Image source={{ uri: data.profilePhotoUri }} style={styles.editAvatarImage} /> : <View style={styles.editAvatarPlaceholder}><Text weight="semiBold" size="xl" color={BrandColors.secondary}>{initials}</Text></View>}
                    <View style={styles.cameraBadge}><Text weight="semiBold" size="sm" color="#FFF">+</Text></View>
                  </Pressable>
                </View>
                <View style={styles.field}><Text weight="medium" size="sm" color="#374151">Name</Text><TextInput value={editName} onChangeText={setEditName} placeholder="Your name" style={styles.input} autoCapitalize="words" /></View>
                <View style={styles.field}><Text weight="medium" size="sm" color="#374151">Email</Text><TextInput value={editEmail} onChangeText={(value) => setEditEmail(value.toLowerCase())} placeholder="you@example.com" style={styles.input} keyboardType="email-address" autoCapitalize="none" /></View>
                <View style={styles.field}><Text weight="medium" size="sm" color="#374151">Phone Number</Text><TextInput value={editPhone} onChangeText={setEditPhone} placeholder="+1 (555) 123-4567" style={styles.input} keyboardType="phone-pad" autoCapitalize="none" /></View>
                <View style={styles.editActionsRow}>
                  <Button
                    variant="ghost"
                    fullWidth
                    style={styles.modalActionButton}
                    onPress={() => setIsEditVisible(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="secondary"
                    fullWidth
                    style={styles.modalActionButton}
                    onPress={handleSaveProfile}
                  >
                    Save
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal transparent visible={isPhotoModalVisible} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setIsPhotoModalVisible(false)}>
          <View style={styles.photoModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.photoModalCard}>
                <Text weight="semiBold" size="lg" color="#111827" style={styles.photoModalTitle}>Profile photo</Text>
                <Text size="sm" color="#6B7280" style={styles.photoModalSubtitle}>Select an option</Text>
                <View style={styles.photoModalButtons}>
                  <Pressable style={styles.photoModalPrimaryButton} onPress={handleChooseFromLibrary}>
                    <Text weight="semiBold" size="md" color={BrandColors.white}>Choose from library</Text>
                  </Pressable>
                  <Pressable style={styles.photoModalSecondaryButton} onPress={handleTakePhoto}>
                    <Text weight="semiBold" size="md" color="#111827">Take a photo</Text>
                  </Pressable>
                  {data.profilePhotoUri ? (
                    <Pressable style={styles.photoModalRemoveButton} onPress={handleRemovePhoto}>
                      <Text weight="semiBold" size="md" color="#EF4444">Remove photo</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal transparent visible={isLogoutVisible} animationType="fade">
        <TouchableWithoutFeedback onPress={() => setIsLogoutVisible(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.confirmCard}>
                <Text weight="semiBold" size="lg" color="#111827">Logout?</Text>
                <Text size="sm" color="#6B7280" style={styles.confirmText}>You'll need to sign in again to access your account.</Text>
                <View style={styles.confirmActionsRow}>
                  <Button
                    variant="ghost"
                    fullWidth
                    style={styles.modalActionButton}
                    onPress={() => setIsLogoutVisible(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    fullWidth
                    style={[styles.modalActionButton, { backgroundColor: '#EF4444' }]}
                    onPress={handleConfirmLogout}
                  >
                    Logout
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Feedback modal (tap outside does NOT dismiss) */}
      <FeedbackModal
        visible={isFeedbackVisible}
        onClose={() => setIsFeedbackVisible(false)}
        onSubmit={async (text) => {
          addFeedbackSubmission(text);
          const latest = useOnboardingStore.getState().data.feedbackSubmissions.slice(-1)[0];
          console.log('Feedback submitted:', latest);
          // Small delay so the loading state is visible (feels intentional)
          await new Promise((r) => setTimeout(r, 450));
        }}
      />
        </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  stickyContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10, // On top of EVERYTHING
  },
  stickyBarBackground: {
    backgroundColor: BrandColors.secondary, // Matches the gray background
  },
  avatarWrapper: {
    position: 'absolute',
    left: '50%',
    marginLeft: -50,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collapsedNameContainer: {
    // removed
  },
  menuAnchor: {
    position: 'absolute',
    right: 20,
  },
  scrollView: {
    flex: 1,
    zIndex: 1, // Under the sticky bar
  },
  scrollContent: {
    flexGrow: 1,
  },
  profileInfoArea: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  userName: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emailPill: {
    backgroundColor: 'rgba(82, 153, 254, 0.12)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  movingNameContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    paddingHorizontal: 20,
  },
  headerButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
  },
  headerButtonPill: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(107, 114, 128, 0.12)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  sheetContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: SHEET_TOP_RADIUS,
    borderTopRightRadius: SHEET_TOP_RADIUS,
    paddingTop: 32,
    paddingHorizontal: 20,
    minHeight: 800,
    // Shadow to pop out against the profile info as it scrolls
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    marginLeft: 4,
    marginBottom: 12,
    letterSpacing: 1,
  },
  sectionCard: {
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    position: 'relative',
  },
  listItemPressed: {
    backgroundColor: '#F3F4F6',
  },
  listItemIcon: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  listItemLabel: {
    flex: 1,
  },
  listItemSeparator: {
    position: 'absolute',
    bottom: 0,
    left: 56,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuContainer: {
    position: 'absolute',
    width: MENU_WIDTH,
    borderRadius: 16,
    backgroundColor: '#FFF',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  menuContent: {
    padding: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuSeparator: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginHorizontal: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  editModalCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
  },
  editModalTitle: {
    textAlign: 'center',
    marginBottom: 20,
  },
  editAvatarRow: {
    alignItems: 'center',
    marginBottom: 20,
  },
  editAvatarWrapper: {
    position: 'relative',
  },
  editAvatarImage: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  editAvatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: BrandColors.secondary,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
  },
  field: {
    marginBottom: 16,
    gap: 8,
  },
  input: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    fontSize: 16,
  },
  editActionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalActionButton: {
    flex: 1,
  },
  photoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  photoModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  photoModalTitle: {
    marginBottom: 6,
  },
  photoModalSubtitle: {
    marginBottom: 18,
    textAlign: 'center',
  },
  photoModalButtons: {
    width: '100%',
    gap: 12,
  },
  photoModalPrimaryButton: {
    backgroundColor: BrandColors.secondary,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  photoModalSecondaryButton: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoModalRemoveButton: {
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  confirmCard: {
    width: '100%',
    backgroundColor: '#FFF',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  confirmText: {
    textAlign: 'center',
    marginVertical: 16,
  },
  confirmActionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
});
