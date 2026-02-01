/**
 * SignUpMethodsStep
 *
 * PURPOSE: Provides various sign-up options (Email, Google, Apple) following the initial welcome.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React from 'react';
import {
    StyleSheet,
    View,
    Platform,
    Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    BrandColors,
    Spacing,
    Text,
    FontSize,
    FontFamily,
} from '@/components/shared-ui';
import { FooterButton } from '@/components/shared-ui/FooterButton';
import { ProgressBar } from '@/components/shared-ui/ProgressBar';
import { BackButton } from '@/components/shared-ui/BackButton';
import { FontAwesome } from '@expo/vector-icons';
import { Mail } from 'lucide-react-native';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

interface SignUpMethodsStepProps {
    onNext: () => void;
    onBack: () => void;
}

export function SignUpMethodsStep({ onNext, onBack }: SignUpMethodsStepProps) {
    const insets = useSafeAreaInsets();
    const { updateData } = useOnboardingStore();

    const handleEmailSignUp = () => {
        updateData({ signUpMethod: 'email' });
        // Proceed to email entry step
        onNext();
    };

    const handleGoogleSignUp = () => {
        updateData({ signUpMethod: 'google' });
        onNext();
    };

    const handleAppleSignUp = () => {
        updateData({ signUpMethod: 'apple' });
        onNext();
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
            <View style={styles.backButtonContainer}>
                <BackButton onBack={onBack} alwaysShow />
            </View>

            <View style={styles.content}>
                <View style={styles.headerContent}>
                    <Text style={styles.title}>Sign up to start your journey</Text>
                </View>
                
                <View style={styles.buttonContainer}>
                    <FooterButton
                        label="Continue with email"
                        onPress={handleEmailSignUp}
                        variant="primary"
                        leftIcon={<Mail size={20} color={BrandColors.white} />}
                    />

                    <FooterButton
                        label="Continue with Google"
                        onPress={handleGoogleSignUp}
                        variant="secondary"
                        backgroundColor="rgba(255, 255, 255, 0.1)"
                        textColor={BrandColors.white}
                        leftIcon={<FontAwesome name="google" size={20} color={BrandColors.white} />}
                        style={styles.socialButton}
                    />

                    {Platform.OS === 'ios' && (
                        <FooterButton
                            label="Continue with Apple"
                            onPress={handleAppleSignUp}
                            variant="secondary"
                            backgroundColor="rgba(255, 255, 255, 0.1)"
                            textColor={BrandColors.white}
                            leftIcon={<FontAwesome name="apple" size={22} color={BrandColors.white} style={{ marginBottom: 2 }} />}
                            style={styles.socialButton}
                        />
                    )}
                </View>

                <View style={styles.loginContainer}>
                    <Text style={styles.loginText}>Already have an account?</Text>
                    <Pressable onPress={onBack}>
                        <Text weight="bold" style={styles.loginLink}>Log in</Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    backButtonContainer: {
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing.xl,
        paddingTop: Spacing.sm,
        alignItems: 'flex-start',
    },
    content: {
        flex: 1,
        paddingHorizontal: Spacing['2xl'],
        justifyContent: 'center',
        paddingBottom: 60,
    },
    headerContent: {
        marginBottom: Spacing['3xl'],
    },
    title: {
        fontSize: FontSize['4xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.white,
        textAlign: 'center',
        lineHeight: 44,
    },
    buttonContainer: {
        gap: Spacing.md,
        width: '100%',
    },
    socialButton: {
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing['3xl'],
        gap: 8,
    },
    loginText: {
        color: BrandColors.white,
        opacity: 0.8,
        fontSize: FontSize.md,
        fontFamily: FontFamily.medium,
    },
    loginLink: {
        color: BrandColors.white,
        fontSize: FontSize.md,
        fontFamily: FontFamily.bold,
        textDecorationLine: 'underline',
    },
});
