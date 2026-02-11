/**
 * PermissionsHubScreen
 *
 * PURPOSE: Allows users to view and manage key app permissions (Location, Camera, Photos, Notifications).
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 */

import React, { useState, useCallback } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  Platform,
  Linking,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
  ChevronRight,
} from 'lucide-react-native';

import { BlurHeaderOverlay, BrandColors, Spacing, Text } from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';

interface PermissionRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  status: PermissionStatus;
  onPress: () => void;
  isLast?: boolean;
}

const PermissionRow = ({ icon, label, description, status, onPress, isLast }: PermissionRowProps) => {
  const getStatusText = () => {
    switch (status) {
      case 'granted':
        return 'Allowed';
      case 'denied':
        return 'Not allowed';
      case 'undetermined':
      default:
        return 'Not set';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'granted':
        return '#10B981'; // Green
      case 'denied':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray
    }
  };

  return (
    <React.Fragment>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.formRow,
          pressed && styles.rowPressed,
        ]}
      >
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
          <Text weight="medium" size="sm" style={{ color: getStatusColor() }}>
            {getStatusText()}
          </Text>
          <ChevronRight size={18} color="#C7C7CC" style={styles.chevron} />
        </View>
      </Pressable>
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
      const [location, camera, photos, notifications] = await Promise.all([
        Location.getForegroundPermissionsAsync(),
        Camera.getCameraPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
        Notifications.getPermissionsAsync(),
      ]);

      setStatuses({
        location: location.status as PermissionStatus,
        camera: camera.status as PermissionStatus,
        photos: photos.status as PermissionStatus,
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

  const handleOpenSettings = async (type?: keyof typeof statuses) => {
    if (Platform.OS === 'ios') {
      await Linking.openSettings();
    } else {
      // Android specific logic
      if (type === 'notifications') {
        try {
          // Land directly on the Notifications toggle page for this app
          await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
            { key: 'android.provider.extra.APP_PACKAGE', value: 'com.otopair.app' },
          ]);
          return;
        } catch (e) {
          // Fallback to general app settings if specific intent fails
          await Linking.openSettings();
        }
      } else {
        // For Location, Camera, and Photos, landing on the "App Info" screen (the one in your screenshot)
        // is the standard Android behavior. From there, the user clicks "Permissions".
        await Linking.openSettings();
      }
    }
  };

  const handlePermissionAction = async (type: keyof typeof statuses) => {
    const currentStatus = statuses[type];

    if (currentStatus === 'granted') {
      // Allow opening settings even if already allowed
      Alert.alert(
        'Permission Allowed',
        `You have already granted ${type} permission. Would you like to manage it in device settings?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => handleOpenSettings(type) },
        ]
      );
      return;
    }

    if (currentStatus === 'denied') {
      Alert.alert(
        'Permission Required',
        `To enable ${type}, please go to your device settings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => handleOpenSettings(type) },
        ]
      );
      return;
    }

    // Not set, request in-app
    try {
      let result;
      switch (type) {
        case 'location':
          result = await Location.requestForegroundPermissionsAsync();
          break;
        case 'camera':
          result = await Camera.requestCameraPermissionsAsync();
          break;
        case 'photos':
          result = await ImagePicker.requestMediaLibraryPermissionsAsync();
          break;
        case 'notifications':
          result = await Notifications.requestPermissionsAsync();
          break;
      }
      
      if (result) {
        setStatuses(prev => ({ ...prev, [type]: result.status as PermissionStatus }));
      }
    } catch (error) {
      console.error(`Error requesting ${type} permission:`, error);
    }
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
            onPress={() => handlePermissionAction('location')}
          />
          <PermissionRow
            icon={<CameraIcon size={20} color={BrandColors.secondary} />}
            label="Camera"
            description="Take photos of your vehicle"
            status={statuses.camera}
            onPress={() => handlePermissionAction('camera')}
          />
          <PermissionRow
            icon={<ImageIcon size={20} color={BrandColors.secondary} />}
            label="Photos"
            description="Upload vehicle and profile images"
            status={statuses.photos}
            onPress={() => handlePermissionAction('photos')}
          />
          <PermissionRow
            icon={<Bell size={20} color={BrandColors.secondary} />}
            label="Notifications"
            description="Service updates and offers"
            status={statuses.notifications}
            onPress={() => handlePermissionAction('notifications')}
            isLast
          />
        </View>

        <Text size="xs" color="#8E8E93" center style={styles.footnote}>
          Some permissions must be enabled in your device Settings.
        </Text>
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
    marginBottom: 24,
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
  chevron: {
    marginLeft: 8,
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
    marginLeft: 64,
  },
  footnote: {
    marginTop: 8,
    paddingHorizontal: 20,
  },
});
