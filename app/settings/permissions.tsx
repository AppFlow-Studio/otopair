/**
 * PermissionsHubScreen
 *
 * PURPOSE: Allows users to view and manage key app permissions (Location, Camera, Photos, Notifications).
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Platform,
  Linking,
  Alert,
  AppState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { useFocusEffect } from '@react-navigation/native';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import {
  MapPin,
  Camera as CameraIcon,
  Image as ImageIcon,
  Bell,
} from 'lucide-react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { BlurHeaderOverlay, BrandColors, Spacing, Text } from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';

type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'limited';

interface PermissionRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  status: PermissionStatus;
  isLast?: boolean;
}

const PermissionDisplaySwitch = ({ value }: { value: boolean }) => {
  const progress = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    progress.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [progress, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      ['#D1D5DB', BrandColors.secondary]
    ),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: progress.value * 20 }],
  }));

  return (
    <View style={styles.switchHit} pointerEvents="none" accessibilityState={{ disabled: true }}>
      <Animated.View style={[styles.switchTrack, trackStyle]}>
        <Animated.View style={[styles.switchThumb, thumbStyle]} />
      </Animated.View>
    </View>
  );
};

const PermissionRow = ({ icon, label, description, status, isLast }: PermissionRowProps) => {
  const isEnabled = status === 'granted' || status === 'limited';

  return (
    <React.Fragment>
      <View style={styles.formRow}>
        <View style={styles.rowIconWrapper}>
          {icon}
        </View>
        <View style={styles.rowContent}>
          <Text weight="medium" size="md" color="#111318">
            {label}
          </Text>
          <Text size="xs" color="#6B7280" numberOfLines={1}>
            {description}
          </Text>
        </View>
        <View style={styles.rowRight}>
          <PermissionDisplaySwitch value={isEnabled} />
        </View>
      </View>
      {!isLast && <View style={styles.separator} />}
    </React.Fragment>
  );
};

export default function PermissionsHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [statuses, setStatuses] = useState<{
    location: PermissionStatus;
    camera: PermissionStatus;
    photos: PermissionStatus;
    notifications: PermissionStatus;
  }>({
    location: 'undetermined',
    camera: 'undetermined',
    photos: 'undetermined',
    notifications: 'undetermined',
  });

  const fetchStatuses = async () => {
    try {
      const promises: [Promise<any>, Promise<any>, Promise<any>, Promise<any>] = [
        Location.getForegroundPermissionsAsync(),
        Camera.getCameraPermissionsAsync(),
        Platform.OS === 'ios' ? ImagePicker.getMediaLibraryPermissionsAsync() : Promise.resolve({ status: 'granted' }),
        Notifications.getPermissionsAsync(),
      ];

      const [location, camera, photos, notifications] = await Promise.all(promises);

      const getPhotosStatus = (): PermissionStatus => {
        if (Platform.OS !== 'ios') return 'granted'; // Android uses system picker
        
        if (photos.status === 'granted') {
          if (photos.accessPrivileges === 'limited') {
            return 'limited';
          }
          return 'granted';
        }
        return photos.status as PermissionStatus;
      };

      setStatuses({
        location: location.status as PermissionStatus,
        camera: camera.status as PermissionStatus,
        photos: getPhotosStatus(),
        notifications: notifications.status as PermissionStatus,
      });
    } catch (error) {
      console.error('Error fetching permission statuses:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchStatuses();
    }, [])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        fetchStatuses();
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  const handleOpenSettings = async () => {
    await Linking.openSettings();
  };

  return (
    <View style={styles.screen}>
      <BlurHeaderOverlay title="Permissions" onBack={() => router.back()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 80,
            paddingBottom: getSheetContentPadding(true, insets.bottom),
          },
        ]}
      >
        <View style={styles.heroArea}>
          <Text weight="bold" style={styles.heroTitle}>Permissions Hub</Text>
          <Text size="md" color="#6B7280">Manage how Otopair accesses your device.</Text>
        </View>

        <View style={styles.glassCard}>
          <PermissionRow
            icon={<MapPin size={20} color={BrandColors.secondary} />}
            label="Location"
            description="Find nearby mechanics and availability"
            status={statuses.location}
          />
          <PermissionRow
            icon={<CameraIcon size={20} color={BrandColors.secondary} />}
            label="Camera"
            description="Take photos of your vehicle"
            status={statuses.camera}
          />
          {Platform.OS === 'ios' && (
            <PermissionRow
              icon={<ImageIcon size={20} color={BrandColors.secondary} />}
              label="Photos"
              description="Upload vehicle and profile images"
              status={statuses.photos}
            />
          )}
          <PermissionRow
            icon={<Bell size={20} color={BrandColors.secondary} />}
            label="Notifications"
            description="Service updates and offers"
            status={statuses.notifications}
            isLast
          />
        </View>

        <View style={styles.submitArea}>
          <Pressable 
            style={styles.submitButton} 
            onPress={handleOpenSettings}
          >
            <Text weight="semiBold" size="md" color="#FFF">Open System Settings</Text>
          </Pressable>
          <Text size="xs" color="#8E8E93" center style={styles.footnote}>
            You can manage all app permissions in your device settings.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  heroArea: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: '#111318',
    marginBottom: 8,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: Spacing["2xl"],
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  formRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    paddingHorizontal: 16,
  },
  rowPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  rowIconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  rowContent: {
    flex: 1,
    justifyContent: 'center',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  switchHit: {
    paddingLeft: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  switchTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
    marginLeft: 64,
  },
  submitArea: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  submitButton: {
    backgroundColor: BrandColors.secondary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  footnote: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
});
