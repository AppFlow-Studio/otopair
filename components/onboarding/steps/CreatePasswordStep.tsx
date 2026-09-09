/**
 * CreatePasswordStep
 *
 * PURPOSE: Collects user's password and confirmation for sign-up.
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
    TouchableOpacity,
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
import { Eye, EyeOff } from 'lucide-react-native';

interface CreatePasswordStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

export function CreatePasswordStep({ onNext, onBack, progress }: CreatePasswordStepProps) {
    const insets = useSafeAreaInsets();
    const { updateData, data } = useOnboardingStore();
    const [password, setPassword] = useState(data.password || "");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);
    const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleContinue = () => {
        setError(null);
        
        if (password.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        updateData({ password });
        onNext();
    };

    const canContinue = password.length >= 8 && confirmPassword.length >= 8 && password === confirmPassword;

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
                        <Text style={styles.title}>Create a password</Text>
                        <Text style={styles.subtitle}>
                            Secure your account with a strong password.
                        </Text>
                    </View>

                    <View style={styles.formContainer}>
                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>Password</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="At least 8 characters"
                                    placeholderTextColor="#829BAD"
                                    value={password}
                                    onChangeText={(text) => {
                                        setPassword(text);
                                        setError(null);
                                    }}
                                    secureTextEntry={!isPasswordVisible}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="newPassword"
                                />
                                <TouchableOpacity 
                                    onPress={() => setIsPasswordVisible(!isPasswordVisible)}
                                    style={styles.eyeIcon}
                                    hitSlop={10}
                                >
                                    {isPasswordVisible ? (
                                        <EyeOff size={20} color="#374151" />
                                    ) : (
                                        <Eye size={20} color="#374151" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={styles.inputWrapper}>
                            <Text style={styles.label}>Confirm password</Text>
                            <View style={styles.inputContainer}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Re-enter your password"
                                    placeholderTextColor="#829BAD"
                                    value={confirmPassword}
                                    onChangeText={(text) => {
                                        setConfirmPassword(text);
                                        setError(null);
                                    }}
                                    secureTextEntry={!isConfirmPasswordVisible}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    textContentType="newPassword"
                                />
                                <TouchableOpacity 
                                    onPress={() => setIsConfirmPasswordVisible(!isConfirmPasswordVisible)}
                                    style={styles.eyeIcon}
                                    hitSlop={10}
                                >
                                    {isConfirmPasswordVisible ? (
                                        <EyeOff size={20} color="#374151" />
                                    ) : (
                                        <Eye size={20} color="#374151" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {error && (
                            <View style={styles.errorContainer}>
                                <Text style={styles.errorText}>{error}</Text>
                            </View>
                        )}
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
        color: '#0F172A',
        marginBottom: Spacing.md,
        lineHeight: 44,
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: '#0F172A',
        opacity: 0.9,
        lineHeight: 28,
    },
    formContainer: {
        gap: Spacing.xl,
    },
    inputWrapper: {
        gap: Spacing.xs,
    },
    label: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.semiBold,
        color: '#0F172A',
        opacity: 0.8,
        marginLeft: 4,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Platform.OS === 'ios' ? Spacing.lg : Spacing.md,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    input: {
        flex: 1,
        fontSize: FontSize.lg,
        fontFamily: FontFamily.medium,
        color: '#0F172A',
    },
    eyeIcon: {
        marginLeft: Spacing.sm,
    },
    errorContainer: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: Spacing.md,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorText: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: '#DC2626',
        textAlign: 'center',
    },
    bottomContainer: {
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.md,
    },
});
