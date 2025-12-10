/**
 * PushNotifications
 *
 * PURPOSE: Request push notification permissions from the user.
 *
 * USED IN: app/(onboarding)/push-notifications.tsx
 *
 * PATH: Onboarding flow
 *
 * OWNER: Daniel Chelala
 */

import {
    BrandColors,
    Colors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { OnboardingFooterButton } from './OnboardingFooterButton';
import { OnboardingBackButton } from './OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Platform,
    StyleSheet,
    View,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';

export function PushNotifications() {
    const insets = useSafeAreaInsets();
    const { updateData } = useOnboardingStore();
    const [requesting, setRequesting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const notificationsModule = useRef<any>(null);
    const [moduleReady, setModuleReady] = useState(false);

    useEffect(() => {
        // Lazy-load expo-notifications to avoid crashing if the module is missing
        (async () => {
            try {
                // @ts-ignore expo-notifications is provided at runtime; suppress type resolution
                const mod = await import('expo-notifications');
                notificationsModule.current = mod;
                const res = await mod.getPermissionsAsync();
                const normalized = normalizePushStatus(res.status);
                setStatus(normalized);
                setModuleReady(true);

                // Auto-skip if already granted/provisional
                const granted = normalized === 'granted' || normalized === 'provisional';
                if (granted) {
                    updateData({
                        pushNotificationsGranted: granted,
                        pushNotificationStatus: normalized,
                    });
                    router.replace('/(onboarding)/location-services');
                }
            } catch (err) {
                // Module missing or failed to load; proceed without blocking the app
                setModuleReady(false);
            }
        })();
    }, [updateData]);

    const ensureAndroidChannel = async () => {
        if (Platform.OS !== 'android') return;
        const mod = notificationsModule.current;
        if (!mod) return;
        await mod.setNotificationChannelAsync('default', {
            name: 'Default',
            importance: mod.AndroidImportance?.DEFAULT ?? 3,
        });
    };

    const normalizePushStatus = (
        s: string | null | undefined
    ): 'granted' | 'provisional' | 'denied' | 'undetermined' | null => {
        if (s === 'granted' || s === 'provisional' || s === 'denied' || s === 'undetermined') {
            return s;
        }
        return 'undetermined';
    };

    const normalizeLocationStatus = (
        s: string | null | undefined
    ): 'granted' | 'denied' | 'undetermined' | null => {
        if (s === 'granted' || s === 'denied' || s === 'undetermined') return s;
        return 'undetermined';
    };

    const refreshLocationPermission = async () => {
        try {
            // @ts-ignore
            const mod = await import('expo-location');
            const res = await mod.getForegroundPermissionsAsync();
            const normalized = normalizeLocationStatus(res.status);
            const granted = normalized === 'granted' || res.granted === true;
            updateData({
                locationGranted: granted,
                locationPermissionStatus: normalized,
            });
            return { granted, normalized };
        } catch {
            return { granted: false, normalized: 'undetermined' as const };
        }
    };

    const handleAccept = async () => {
        if (requesting) return;
        setRequesting(true);
        let granted = false;
        let recordedStatus: 'granted' | 'provisional' | 'denied' | 'undetermined' | null = null;
        try {
            // Ensure module is loaded (lazy load here too, in case it wasn't ready yet)
            if (!notificationsModule.current) {
                try {
                    // @ts-ignore
                    const mod = await import('expo-notifications');
                    notificationsModule.current = mod;
                    setModuleReady(true);
                } catch (err) {
                    setModuleReady(false);
                }
            }

            if (notificationsModule.current) {
                await ensureAndroidChannel();
                const res = await notificationsModule.current.requestPermissionsAsync();
                const normalized = normalizePushStatus(res.status);
                setStatus(normalized);
                recordedStatus = normalized;
                granted = normalized === 'granted' || normalized === 'provisional';
            }
        } finally {
            setRequesting(false);
            updateData({
                pushNotificationsGranted: granted,
                pushNotificationStatus: recordedStatus,
            });
            // Decide next step based on location permission (fresh check)
            const loc = await refreshLocationPermission();
            if (loc.granted) {
                //router.replace('/(main-tabs)');
                router.push('/(onboarding)/vin');
            } else {
                router.push('/(onboarding)/location-services');
            }
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
            <OnboardingBackButton noHorizontalPadding />
            <View style={styles.content}>
                <Text style={styles.title}>
                    Get real-time updates
                    {'\n'}and notifications
                </Text>
                <Text style={styles.subtitle}>
                    Allow RepairConnect push notifications to receive service status, mechanic updates, and promotional offers. You can change this in Settings at any time.
                </Text>

                <View style={styles.iconWrapper}>
                    <Image
                        source={require('@/assets/images/onboarding/Notification.gif')}
                        style={styles.icon}
                        contentFit="contain"
                    />
                </View>
            </View>

            <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
                <OnboardingFooterButton
                    label={requesting ? 'Requesting...' : 'Accept & Continue'}
                    onPress={handleAccept}
                    disabled={requesting}
                    size="lg"
                    paddingVertical={Spacing.md}
                    rightIcon={
                        requesting ? (
                            <ActivityIndicator color={BrandColors.white} />
                        ) : undefined
                    }
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dee2ee',
        paddingHorizontal: Spacing['2xl'],
    },
    content: {
        flex: 1,
        gap: Spacing.lg,
    },
    title: {
        marginTop: Spacing['2xl'],
        fontSize: FontSize['3xl'],
        lineHeight: 36,
        fontFamily: FontFamily.bold,
        color: BrandColors.primary,
    },
    subtitle: {
        fontSize: FontSize.md,
        lineHeight: 22,
        color: Colors.light.icon,
        fontFamily: FontFamily.regular,
    },
    iconWrapper: {
        marginTop: Spacing['3xl'],
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        overflow: 'hidden',
    },
    icon: {
        width: 180,
        height: 180,
    },
    footer: {
        paddingTop: Spacing.md,
    },
});

