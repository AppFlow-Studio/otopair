/**
 * PrimaryReasonStep
 *
 * PURPOSE: Allows users to select what brings them to Otopair.
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <PrimaryReasonStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 7, filled: 4 }} 
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
    BorderRadius,
    ProgressBar,
    FooterButton,
    BackButton,
    FadeFooterContainer,
} from '@/components/shared-ui';
import { useState } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    View,
    Pressable,
    ScrollView,
    TextInput,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useOnboardingQuestion } from '@/hooks/useOnboardingQuestion';

interface PrimaryReasonStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const PRIMARY_REASONS = [
    { id: 'scheduled', emoji: '📅', label: 'Scheduled maintenance coming up' },
    { id: 'repair', emoji: '🔧', label: 'Specific repair needed' },
    { id: 'comparing', emoji: '⚖️', label: 'Comparing shops for quality/specialization' },
    { id: 'trust', emoji: '🤝', label: 'Looking for a shop I can trust long-term' },
    { id: 'exploring', emoji: '🔍', label: 'Just exploring options' },
] as const;

export function PrimaryReasonStep({ onNext, onBack, progress }: PrimaryReasonStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    const { answers, saveAnswer } = useOnboardingQuestion('primaryReason');

    const [selectedId, setSelectedId] = useState<string | null>(() => {
        if (!data.primaryReason) return null;
        if (data.primaryReason.startsWith('Specific repair needed:')) return 'repair';
        return PRIMARY_REASONS.find(r => r.label === data.primaryReason)?.id ?? null;
    });

    const [repairDetails, setRepairDetails] = useState<string>(() => {
        if (data.primaryReason?.startsWith('Specific repair needed:')) {
            return data.primaryReason.replace('Specific repair needed:', '').trim();
        }
        return '';
    });

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleSelect = (id: string) => {
        setSelectedId(id);
        const reason = PRIMARY_REASONS.find(r => r.id === id);
        if (id !== 'repair' && reason) {
            updateData({ primaryReason: reason.label });
        } else if (id === 'repair') {
            const detail = repairDetails.trim();
            updateData({ primaryReason: detail ? `Specific repair needed: ${detail}` : 'Specific repair needed' });
        }
    };

    const handleRepairDetailsChange = (text: string) => {
        setRepairDetails(text);
        if (selectedId === 'repair') {
            const trimmed = text.trim();
            updateData({ primaryReason: trimmed ? `Specific repair needed: ${trimmed}` : 'Specific repair needed' });
        }
    };

    const handleContinue = () => {
        if (canContinue) {
            const selectedAnswer = answers.find(a => a.answer_value === selectedId);
            saveAnswer({ answerId: selectedAnswer?._id, freeTextAnswer: selectedId === 'repair' && repairDetails.trim() ? repairDetails.trim() : undefined });
            onNext();
        }
    };

    const canContinue = selectedId !== null;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                <ProgressBar
                    total={progress.total}
                    filled={progress.filled}
                    leftElement={<BackButton onBack={onBack} alwaysShow />}
                />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>
                            What brings you to Otopair?
                        </Text>
                        <Text style={styles.subtitle}>
                            Select the option that best fits your situation
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {PRIMARY_REASONS.map((option) => {
                            const isSelected = selectedId === option.id;
                            
                            return (
                                <View key={option.id} style={styles.optionWrapper}>
                                    <Pressable
                                        onPress={() => handleSelect(option.id)}
                                        style={({ pressed }) => [
                                            styles.optionButton,
                                            isSelected && styles.optionButtonSelected,
                                            pressed && styles.optionButtonPressed,
                                        ]}
                                    >
                                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                                        <Text
                                            style={[
                                                styles.optionText,
                                                isSelected && styles.optionTextSelected,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </Pressable>
                                    
                                    {isSelected && option.id === 'repair' && (
                                        <TextInput
                                            style={styles.detailInput}
                                            placeholder="What repair do you need?"
                                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                                            value={repairDetails}
                                            onChangeText={handleRepairDetailsChange}
                                            autoFocus
                                            returnKeyType="done"
                                        />
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </ScrollView>

                <FadeFooterContainer paddingBottom={insets.bottom + Spacing.lg}>
                    <FooterButton
                        label="Continue"
                        onPress={handleContinue}
                        disabled={!canContinue}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant={canContinue ? 'primary' : undefined}
                        backgroundColor={canContinue ? undefined : '#6B7280'}
                        textColor={canContinue ? undefined : BrandColors.white}
                    />
                </FadeFooterContainer>
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
        paddingBottom: Spacing.xl,
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
        lineHeight: Spacing['5xl'],
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.9,
        lineHeight: Spacing['2xl'],
    },
    optionsContainer: {
        paddingHorizontal: Spacing['2xl'],
        gap: Spacing.md,
    },
    optionWrapper: {
        gap: Spacing.sm,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        gap: Spacing.md,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    optionButtonSelected: {
        backgroundColor: BrandColors.white,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    optionButtonPressed: {
        opacity: 0.7,
    },
    optionEmoji: {
        fontSize: FontSize['2xl'],
    },
    optionText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        flex: 1,
    },
    optionTextSelected: {
        color: BrandColors.secondary,
        fontFamily: FontFamily.semiBold,
    },
    detailInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        marginLeft: Spacing.lg,
    },
});

