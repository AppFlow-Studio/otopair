/**
 * EmailEntryStep
 *
 * PURPOSE: Collects the user's email address during the onboarding flow.
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
    TextInput,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
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
import { useOnboardingStore } from '@/stores/useOnboardingStore';

interface EmailEntryStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

export function EmailEntryStep({ onNext, onBack, progress }: EmailEntryStepProps) {
    const insets = useSafeAreaInsets();
    const { updateData, data } = useOnboardingStore();
    const [email, setEmail] = useState(data.email || "");

    const handleContinue = () => {
        const trimmedEmail = email.trim();
        if (trimmedEmail) {
            updateData({ email: trimmedEmail });
            onNext();
        }
    };

    const isEmailValid = (emailStr: string) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(emailStr);
    };

    const canContinue = email.trim().length > 0 && isEmailValid(email.trim());

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
        >
            <View style={[styles.container, { paddingTop: insets.top + Spacing.lg }]}>
                <ProgressBar
                    total={progress.total}
                    filled={progress.filled}
                    leftElement={<BackButton onBack={onBack} alwaysShow />}
                />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>What's your email?</Text>
                        <Text style={styles.subtitle}>
                            We'll use this to send you receipts and important updates.
                        </Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Email address"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            autoCorrect={false}
                            autoFocus={true}
                            textContentType="emailAddress"
                        />
                    </View>

                    <View style={styles.infoContainer}>
                        <Text style={styles.infoText}>
                            You will have to confirm this email later.
                        </Text>
                    </View>
                </ScrollView>

                <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
                    <FooterButton
                        label="Continue"
                        onPress={handleContinue}
                        disabled={!canContinue}
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
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingHorizontal: Spacing['2xl'],
    },
    headerContent: {
        marginBottom: Spacing['3xl'],
    },
    title: {
        fontSize: FontSize['4xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.white,
        marginBottom: Spacing.md,
        lineHeight: 44,
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.9,
        lineHeight: 28,
    },
    inputContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    input: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.medium,
        color: BrandColors.white,
    },
    infoContainer: {
        marginTop: Spacing.xl,
    },
    infoText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.7,
        textAlign: 'center',
    },
    bottomContainer: {
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.md,
    },
});
