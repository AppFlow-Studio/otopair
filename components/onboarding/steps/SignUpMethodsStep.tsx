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

import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Platform,
    Pressable,
    Text as RNText,
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
import { Mail, Check } from 'lucide-react-native';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

interface SignUpMethodsStepProps {
    onNext: () => void;
    onBack: () => void;
}

export function SignUpMethodsStep({ onNext, onBack }: SignUpMethodsStepProps) {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { updateData } = useOnboardingStore();

    // Legal consent gate. Unchecked by default; all sign-up methods (email,
    // Google, Apple) are blocked until the user agrees — so OAuth can't skip
    // the Terms/Privacy acceptance. This is the single choke point for account
    // creation, so consent here binds every path.
    const [agreed, setAgreed] = useState(false);

    const handleEmailSignUp = () => {
        if (!agreed) return;
        updateData({ signUpMethod: 'email' });
        // Proceed to email entry step
        onNext();
    };

    const handleGoogleSignUp = () => {
        if (!agreed) return;
        updateData({ signUpMethod: 'google' });
        onNext();
    };

    const handleAppleSignUp = () => {
        if (!agreed) return;
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
                
                {/* Consent gate — unchecked by default; every sign-up method
                    below is disabled until this is checked. Doc titles are
                    tappable links that open the full text in-app. */}
                <View style={styles.consentRow}>
                    <Pressable
                        onPress={() => setAgreed((a) => !a)}
                        hitSlop={10}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: agreed }}
                        style={[styles.checkbox, agreed && styles.checkboxChecked]}
                    >
                        {agreed ? <Check size={14} color={BrandColors.white} strokeWidth={3} /> : null}
                    </Pressable>
                    <RNText style={styles.consentText}>
                        I agree to the{' '}
                        <RNText
                            style={styles.consentLink}
                            onPress={() => router.push('/settings/terms-and-conditions')}
                        >
                            Terms of Use
                        </RNText>
                        {' '}and{' '}
                        <RNText
                            style={styles.consentLink}
                            onPress={() => router.push('/settings/privacy-policy')}
                        >
                            Privacy Policy
                        </RNText>
                        .
                    </RNText>
                </View>

                <View style={styles.buttonContainer}>
                    <FooterButton
                        label="Continue with email"
                        onPress={handleEmailSignUp}
                        variant="primary"
                        disabled={!agreed}
                        leftIcon={<Mail size={20} color={BrandColors.white} />}
                    />

                    <FooterButton
                        label="Continue with Google"
                        onPress={handleGoogleSignUp}
                        variant="secondary"
                        backgroundColor="#FFFFFF"
                        textColor={BrandColors.white}
                        disabled={!agreed}
                        leftIcon={<FontAwesome name="google" size={20} color={BrandColors.white} />}
                        style={styles.socialButton}
                    />

                    {Platform.OS === 'ios' && (
                        <FooterButton
                            label="Continue with Apple"
                            onPress={handleAppleSignUp}
                            variant="secondary"
                            backgroundColor="#FFFFFF"
                            textColor={BrandColors.white}
                            disabled={!agreed}
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
        color: '#0F172A',
        textAlign: 'center',
        lineHeight: 44,
    },
    consentRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: Spacing.lg,
        paddingHorizontal: 2,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    checkboxChecked: {
        backgroundColor: BrandColors.secondary,
        borderColor: BrandColors.secondary,
    },
    consentText: {
        flex: 1,
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: '#475569',
        lineHeight: 20,
    },
    consentLink: {
        color: BrandColors.secondary,
        fontFamily: FontFamily.semiBold,
        textDecorationLine: 'underline',
    },
    buttonContainer: {
        gap: Spacing.md,
        width: '100%',
    },
    socialButton: {
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    loginContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: Spacing['3xl'],
        gap: 8,
    },
    loginText: {
        color: '#0F172A',
        opacity: 0.8,
        fontSize: FontSize.md,
        fontFamily: FontFamily.medium,
    },
    loginLink: {
        color: '#0F172A',
        fontSize: FontSize.md,
        fontFamily: FontFamily.bold,
        textDecorationLine: 'underline',
    },
});
