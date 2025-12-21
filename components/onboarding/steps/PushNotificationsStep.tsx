/**
 * PushNotificationsStep
 *
 * PURPOSE: Push notifications permission step for OnboardingFlow.
 *
 * OWNER: Daniel Chelala
 */

import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { useState, useRef, useEffect } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    View,
    useWindowDimensions,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingProgress } from '../common/OnboardingProgress';
import { OnboardingFooterButton } from '../common/OnboardingFooterButton';
import { OnboardingBackButton } from '../common/OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { Bell } from 'lucide-react-native';

interface PushNotificationsStepProps {
    onNext: () => void;
    onBack: () => void;
}

export function PushNotificationsStep({ onNext, onBack }: PushNotificationsStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
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
                    // Don't auto-advance in the flow, let user continue manually
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

    const handleEnableNotifications = async () => {
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
            // onNext will check location permissions and navigate accordingly
            onNext();
        }
    };

    const handleNotNow = () => {
        updateData({
            pushNotificationsGranted: false,
            pushNotificationStatus: 'denied',
        });
        // onNext will check location permissions and navigate accordingly
        onNext();
    };

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                <OnboardingProgress
                    total={6}
                    filled={4}
                    leftElement={<OnboardingBackButton onBack={onBack} alwaysShow />}
                />

                <View style={styles.content}>
                    {/* Bell Icon */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconWrapper}>
                            <Bell size={80} color={BrandColors.white} strokeWidth={1.5} />
                        </View>
                    </View>

                    {/* Title and Subtitle */}
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>
                            Get real-time updates and notifications
                        </Text>
                        <Text style={styles.subtitle}>
                            Allow Otopair push notifications to receive service status, mechanic updates, and promotional offers. You can change this in Settings at any time.
                        </Text>
                    </View>
                </View>

                {/* Buttons */}
                <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                    <OnboardingFooterButton
                        label={requesting ? 'Requesting...' : 'Enable push notifications'}
                        onPress={handleEnableNotifications}
                        disabled={requesting}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant="primary"
                        rightIcon={
                            requesting ? (
                                <ActivityIndicator color={BrandColors.white} size="small" />
                            ) : undefined
                        }
                    />
                    <View style={styles.buttonSpacer} />
                    <OnboardingFooterButton
                        label="Not now"
                        onPress={handleNotNow}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant="secondary"
                    />
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing['2xl'],
    },
    iconContainer: {
        marginBottom: Spacing['3xl'],
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconWrapper: {
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    headerContent: {
        alignItems: 'center',
        gap: Spacing.md,
    },
    title: {
        fontSize: FontSize['3xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.white,
        textAlign: 'center',
        letterSpacing: 1,
        lineHeight: Spacing['3xl'],
        marginBottom: Spacing['2xl'],
    },
    subtitle: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        textAlign: 'center',
        opacity: 0.9,
        lineHeight: Spacing['2xl'],
        paddingHorizontal: Spacing.lg,
    },
    bottomContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
    },
    buttonSpacer: {
        height: Spacing.md,
    },
});

