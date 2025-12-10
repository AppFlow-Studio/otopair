/**
 * LocationServices
 *
 * PURPOSE: Request location permissions from the user.
 *
 * USED IN: app/(onboarding)/location-services.tsx
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

export function LocationServices() {
    const insets = useSafeAreaInsets();
    const { updateData } = useOnboardingStore();
    const [requesting, setRequesting] = useState(false);
    const [status, setStatus] = useState<string | null>(null);
    const locationModule = useRef<any>(null);
    const [moduleReady, setModuleReady] = useState(false);

    useEffect(() => {
        // Lazy-load expo-location to avoid crashing if the module is missing
        (async () => {
            try {
                // @ts-ignore expo-location is provided at runtime; suppress type resolution
                const mod = await import('expo-location');
                locationModule.current = mod;
                const res = await mod.getForegroundPermissionsAsync();
                const nextStatus =
                    res.status !== undefined
                        ? res.status
                        : res.granted
                        ? 'granted'
                        : 'undetermined';
                setStatus(nextStatus);
                setModuleReady(true);

                const granted = nextStatus === 'granted';
                if (granted) {
                    updateData({
                        locationGranted: true,
                        locationPermissionStatus: 'granted',
                    });
                    router.replace('/(main-tabs)');
                }
            } catch (err) {
                // Module missing or failed to load; proceed without blocking the app
                setModuleReady(false);
            }
        })();
    }, [updateData]);

    const normalizeLocationStatus = (
        s: string | null | undefined
    ): 'granted' | 'denied' | 'undetermined' | null => {
        if (s === 'granted' || s === 'denied' || s === 'undetermined') return s;
        return 'undetermined';
    };

    const handleAccept = async () => {
        if (requesting) return;
        setRequesting(true);
        let granted = false;
        let recordedStatus: 'granted' | 'denied' | 'undetermined' | null = null;
        try {
            // Ensure module is loaded (lazy load here too, in case it wasn't ready yet)
            if (!locationModule.current) {
                try {
                    // @ts-ignore
                    const mod = await import('expo-location');
                    locationModule.current = mod;
                    setModuleReady(true);
                } catch (err) {
                    setModuleReady(false);
                }
            }

            if (locationModule.current) {
                const res = await locationModule.current.requestForegroundPermissionsAsync();
                // expo-location returns { status, granted }
                const normalized = normalizeLocationStatus(res.status);
                setStatus(normalized);
                recordedStatus = normalized;
                granted = normalized === 'granted' || res.granted === true;
            }
        } finally {
            setRequesting(false);
            updateData({
                locationGranted: granted,
                locationPermissionStatus: recordedStatus,
            });
            // Proceed regardless of decision so onboarding can continue
            //router.replace('/(main-tabs)');
            router.push('/(onboarding)/vin');
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
            <OnboardingBackButton noHorizontalPadding />
            <View style={styles.content}>
                <Text style={styles.title}>
                    Get real-time services
                    {'\n'}on your location
                </Text>
                <Text style={styles.subtitle}>
                    Allow RepairConnect location services to receive real-time services from mechanics on your location. You can change this in Settings at any time.
                </Text>

                <View style={styles.iconWrapper}>
                    <Image
                        source={require('@/assets/images/onboarding/JumpingLocation.gif')}
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

