/**
 * WelcomeScreen
 *
 * PURPOSE: Display the welcome slide for the onboarding process.
 *
 * USED IN: app/(onboarding)/index.tsx
 *
 * PROPS:
 *   - None (self-contained screen component)
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-009
 */

// TODO: Remove color hardcoding once theme.ts is updated
// TODO: Create proper tracking of completed steps

import {
    BorderRadius,
    BrandColors,
    Colors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MoveRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { OnboardingFooterButton } from './OnboardingFooterButton';

export function WelcomeSlide() {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { setStep, completeStep } = useOnboardingStore();

    // Dynamic styles (safe area insets are device-specific and must be computed at runtime)
    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing['2xl'] },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    useEffect(() => {
        setStep('welcome');
        //console.log('onboarding currentStep', useOnboardingStore.getState().currentStep);
    }, [setStep]);

    const handleGetStarted = () => {
        //completeStep('welcome');
        router.push('/(onboarding)/flow');
    };
    const handleLogIn = () => {
        router.push('/(onboarding)/car-experience');
    }

    return (
        <View style={[styles.container, dynamicStyles.container]}>
            {/* Header Content */}
            <View style={styles.headerContent}>
                <Text style={styles.title}>
                    Welcome to OtoPair
                </Text>
                <Text 
                    style={styles.subtitle}
                >
                    Your smart assistant for car health, repair tips, and maintenance reminders.
                </Text>
            </View>

            {/* Hero Image */}
            <View style={styles.imageContainer}>
                <Image
                    source={require('@/assets/images/onboarding/onboarding-home.png')}
                    style={styles.heroImage}
                    contentFit="contain"
                />
            </View>

            {/* Bottom Button */}
            <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                <OnboardingFooterButton
                    label="Create Account"
                    onPress={handleGetStarted}
                    rightIcon={<MoveRight size={FontSize.md} color={BrandColors.white} />}
                    size={buttonSize}
                    paddingVertical={buttonPaddingVertical}
                    variant="primary"
                />
            </View>
            <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                <OnboardingFooterButton
                    label="Log In"
                    onPress={handleLogIn}
                    rightIcon={<MoveRight size={FontSize.md} color={BrandColors.white} />}
                    size={buttonSize}
                    paddingVertical={buttonPaddingVertical}
                    variant="secondary"
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        //backgroundColor: Colors.light.background,
        backgroundColor: '#dee2ee',
    },
    headerContent: {
        paddingHorizontal: Spacing['2xl'],
        //marginTop: Spacing.xs,
        marginBottom: Spacing.md,
    },
    title: {
        lineHeight: 40,
        letterSpacing: -0.5,
        fontSize: FontSize['3xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.primary,
    },
    subtitle: {
        marginTop: Spacing.md,
        marginBottom: Spacing['2xl'],
        lineHeight: 24,
        fontSize: FontSize.lg,
        color: Colors.light.icon,
    },
    imageContainer: {
        flex: 1,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.lg,
    },
    heroImage: {
        flex: 1,
        width: '100%',
        borderRadius: BorderRadius['2xl'],
    },
    bottomContainer: {
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
    },
});
