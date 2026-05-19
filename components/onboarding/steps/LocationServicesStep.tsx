/**
 * LocationServicesStep
 *
 * PURPOSE: Requests and handles location services permissions during onboarding.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <LocationServicesStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 8, filled: 7 }} 
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { ProgressBar } from '@/components/shared-ui/ProgressBar';
import { FooterButton } from '@/components/shared-ui/FooterButton';
import { BackButton } from '@/components/shared-ui/BackButton';
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
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { MapPin } from 'lucide-react-native';

interface LocationServicesStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

export function LocationServicesStep({ onNext, onBack, progress }: LocationServicesStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
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

                // Auto-skip if already granted
                const granted = nextStatus === 'granted';
                if (granted) {
                    updateData({
                        locationGranted: true,
                        locationPermissionStatus: 'granted',
                    });
                    // Don't auto-advance in the flow, let user continue manually
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

    const handleEnableLocation = async () => {
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
            console.log('Permissions granted');
            onNext();
        }
    };

    const handleNotNow = () => {
        updateData({
            locationGranted: false,
            locationPermissionStatus: 'denied',
        });
        console.log('Permissions denied');
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
                <ProgressBar
                    total={progress.total}
                    filled={progress.filled}
                    leftElement={<BackButton onBack={onBack} alwaysShow />}
                />

                <View style={styles.content}>
                    {/* MapPin Icon */}
                    <View style={styles.iconContainer}>
                        <View style={styles.iconWrapper}>
                            <MapPin size={80} color={BrandColors.secondary} strokeWidth={1.5} />
                        </View>
                    </View>

                    {/* Title and Subtitle */}
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>
                            Get real-time services on your location
                        </Text>
                        <Text style={styles.subtitle}>
                            Allow Otopair location services to receive real-time services from mechanics in your location. You can change this in Settings at any time.
                        </Text>
                    </View>
                </View>

                <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                    <FooterButton
                        label={requesting ? 'Requesting...' : 'Enable location services'}
                        onPress={handleEnableLocation}
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
                    <FooterButton
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
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    headerContent: {
        alignItems: 'center',
        gap: Spacing.md,
    },
    title: {
        fontSize: FontSize['3xl'],
        fontFamily: FontFamily.bold,
        color: '#0F172A',
        textAlign: 'center',
        letterSpacing: 1,
        lineHeight: Spacing['3xl'],
        marginBottom: Spacing['2xl'],
    },
    subtitle: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: '#0F172A',
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

