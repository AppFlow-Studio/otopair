/**
 * Name
 *
 * PURPOSE: Display the name entry screen for account creation.
 *
 * USED IN: app/(onboarding)/name.tsx
 *
 * PROPS:
 *   - None (self-contained screen component)
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
import { GradientBackground } from './GradientBackground';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingFooterButton } from './OnboardingFooterButton';
import { OnboardingBackButton } from './OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';

export function Name() {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData } = useOnboardingStore();
    
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [alias, setAlias] = useState('');

    // Dynamic styles (safe area insets are device-specific and must be computed at runtime)
    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleContinue = () => {
        // Store name data in onboarding store
        updateData({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
        });
        
        // TODO: Navigate to next step
        console.log('Name saved:', { firstName, lastName, alias });
        // router.push('/(onboarding)/next-step');
    };

    const canContinue = firstName.trim().length > 0 && lastName.trim().length > 0;

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={[styles.container, dynamicStyles.container]}>
                    <OnboardingProgress total={4} filled={3} leftElement={<OnboardingBackButton />} />
                    
                    {/* Header Content */}
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>
                            What's your name?
                        </Text>
                        <Text style={styles.subtitle}>
                            Let us know how to properly address you
                        </Text>
                    </View>

                    {/* Input Fields */}
                    <View style={styles.inputsContainer}>
                        {/* First Name */}
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder="First name"
                                placeholderTextColor="#9CA3AF"
                                value={firstName}
                                onChangeText={setFirstName}
                                autoCapitalize="words"
                                autoComplete="given-name"
                                textContentType="givenName"
                                autoFocus={true}
                            />
                            {/* <Text style={styles.helperText}>
                                e.g. Daniel, not "Dan"
                            </Text> */}
                        </View>

                        {/* Last Name */}
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder="Last name"
                                placeholderTextColor="#9CA3AF"
                                value={lastName}
                                onChangeText={setLastName}
                                autoCapitalize="words"
                                autoComplete="family-name"
                                textContentType="familyName"
                            />
                        </View>

                        {/* Alias 
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                placeholder="Alias"
                                placeholderTextColor="#9CA3AF"
                                value={alias}
                                onChangeText={setAlias}
                                autoCapitalize="words"
                            />
                            <Text style={styles.helperText}>
                                Optional
                            </Text>
                        </View>
                        */}
                    </View>

                    {/* Spacer */}
                    <View style={{ flex: 1 }} />

                    {/* Continue Button */}
                    <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                        <OnboardingFooterButton
                            label="Continue"
                            onPress={handleContinue}
                            disabled={!canContinue}
                            size={buttonSize}
                            paddingVertical={buttonPaddingVertical}
                            variant={canContinue ? "primary" : undefined}
                            backgroundColor={canContinue ? undefined : "#6B7280"}
                            textColor={canContinue ? undefined : BrandColors.white}
                        />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    headerContent: {
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing['3xl'],
    },
    title: {
        fontSize: FontSize['4xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.white,
        marginBottom: Spacing.md,
        lineHeight: 48,
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.9,
        lineHeight: 24,
    },
    inputsContainer: {
        paddingHorizontal: Spacing['2xl'],
        gap: Spacing.lg,
    },
    inputWrapper: {
        marginBottom: Spacing.md,
    },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    helperText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.7,
        marginTop: Spacing.xs,
        paddingHorizontal: Spacing.md,
    },
    bottomContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
    },
});

