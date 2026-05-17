/**
 * EmailConfirmStep
 *
 * PURPOSE: Shows the user's email and asks if it's a good email to reach them at.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
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
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useOnboardingPersistence } from '@/hooks/useOnboardingPersistence';
import { Mail } from 'lucide-react-native';

interface EmailConfirmStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

export function EmailConfirmStep({ onNext, onBack, progress }: EmailConfirmStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { data, updateData } = useOnboardingStore();
    const { persistProfileField } = useOnboardingPersistence();

    const [isEditing, setIsEditing] = useState(false);
    const [editEmail, setEditEmail] = useState(data.email || '');

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleConfirm = async () => {
        updateData({ emailConfirmed: true });
        await persistProfileField({
            email: data.email || undefined,
            emailConfirmed: true,
            ...(data.authProvider && { auth_provider: data.authProvider }),
        });
        onNext();
    };

    const handleEdit = () => {
        setIsEditing(true);
    };

    const handleSaveEdit = async () => {
        updateData({ email: editEmail.trim(), emailConfirmed: true });
        await persistProfileField({
            email: editEmail.trim(),
            emailConfirmed: true,
            ...(data.authProvider && { auth_provider: data.authProvider }),
        });
        setIsEditing(false);
        onNext();
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                <ProgressBar
                    total={progress.total}
                    filled={progress.filled}
                    leftElement={<BackButton onBack={onBack} alwaysShow />}
                />

                <View style={styles.content}>
                    <View style={styles.iconContainer}>
                        <Mail size={64} color={BrandColors.secondary} strokeWidth={1.5} />
                    </View>

                    <View style={styles.headerContent}>
                        <Text style={styles.title}>
                            Is this a good email to reach you at?
                        </Text>
                    </View>

                    {isEditing ? (
                        <View style={styles.editContainer}>
                            <TextInput
                                style={styles.input}
                                value={editEmail}
                                onChangeText={setEditEmail}
                                autoCapitalize="none"
                                autoComplete="email"
                                keyboardType="email-address"
                                autoFocus
                            />
                        </View>
                    ) : (
                        <View style={styles.emailDisplay}>
                            <Text style={styles.emailText}>{data.email || 'No email set'}</Text>
                        </View>
                    )}

                    <View style={styles.actionsContainer}>
                        {isEditing ? (
                            <FooterButton
                                label="Save & Continue"
                                onPress={handleSaveEdit}
                                disabled={editEmail.trim().length === 0}
                                size={buttonSize}
                                paddingVertical={buttonPaddingVertical}
                                variant="primary"
                            />
                        ) : (
                            <>
                                <FooterButton
                                    label="Yes, this is correct"
                                    onPress={handleConfirm}
                                    size={buttonSize}
                                    paddingVertical={buttonPaddingVertical}
                                    variant="primary"
                                />
                                <FooterButton
                                    label="Edit email"
                                    onPress={handleEdit}
                                    size={buttonSize}
                                    paddingVertical={buttonPaddingVertical}
                                    variant="secondary"
                                />
                            </>
                        )}
                    </View>
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    container: { flex: 1 },
    content: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: Spacing['2xl'],
        gap: Spacing.lg,
    },
    iconContainer: {
        marginBottom: Spacing['3xl'],
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#E2E8F0',
    },
    headerContent: {
        alignItems: 'center',
        marginBottom: Spacing['2xl'],
    },
    title: {
        fontSize: FontSize['4xl'],
        fontFamily: FontFamily.bold,
        color: '#0F172A',
        textAlign: 'center',
        lineHeight: Spacing['5xl'],
    },
    emailDisplay: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: Spacing.xl,
        paddingVertical: Spacing.lg,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        width: '100%',
    },
    emailText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.medium,
        color: '#0F172A',
        textAlign: 'center',
    },
    editContainer: {
        width: '100%',
    },
    input: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: '#0F172A',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    actionsContainer: {
        width: '100%',
        gap: Spacing.lg,
    },
});
