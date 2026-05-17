/**
 * RepairQuoteNeedsStep
 *
 * PURPOSE: Allows users to select what information they need most in a repair quote.
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <RepairQuoteNeedsStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 12, filled: 11 }} 
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
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useOnboardingQuestion } from '@/hooks/useOnboardingQuestion';

interface RepairQuoteNeedsStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const REPAIR_QUOTE_NEEDS_OPTIONS = [
    { emoji: '🧾', label: 'Detailed breakdown of costs' },
    { emoji: '🔍', label: "Explanation of what's wrong" },
    { emoji: '⏳', label: 'How urgent it really is' },
    { emoji: '🧠', label: 'Alternative options/solutions' },
    { emoji: '🕐', label: 'Time it will take' },
] as const;

export function RepairQuoteNeedsStep({ onNext, onBack, progress }: RepairQuoteNeedsStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    const { saveQuestionAnswer } = useOnboardingQuestion('repairQuoteNeeds');

    const [selectedNeed, setSelectedNeed] = useState<string | null>(
        data.repairQuoteNeeds?.[0] ?? null
    );

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleSelectNeed = (option: typeof REPAIR_QUOTE_NEEDS_OPTIONS[number]) => {
        const value = `${option.emoji} ${option.label}`;
        setSelectedNeed(value);
        updateData({ repairQuoteNeeds: [value] });
    };

    const handleContinue = () => {
        if (selectedNeed) {
            const label = REPAIR_QUOTE_NEEDS_OPTIONS.find(o => `${o.emoji} ${o.label}` === selectedNeed)?.label ?? selectedNeed;
            const questionText = 'What do you need most in a repair quote?';
            saveQuestionAnswer(questionText, label);
            onNext();
        }
    };

    const canContinue = selectedNeed !== null;

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
                            When getting a repair quote, what do you need to decide?
                        </Text>
                        <Text style={styles.subtitle}>
                            Select the most important information
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {REPAIR_QUOTE_NEEDS_OPTIONS.map((option) => {
                            const value = `${option.emoji} ${option.label}`;
                            const isSelected = selectedNeed === value;
                            
                            return (
                                <Pressable
                                    key={option.label}
                                    onPress={() => handleSelectNeed(option)}
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
        color: '#0F172A',
        marginBottom: Spacing.md,
        lineHeight: Spacing['5xl'],
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: '#0F172A',
        opacity: 0.9,
        lineHeight: Spacing['2xl'],
    },
    optionsContainer: {
        paddingHorizontal: Spacing['2xl'],
        gap: Spacing.md,
    },
    optionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        gap: Spacing.md,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    optionButtonSelected: {
        backgroundColor: '#EFF6FF',
        borderColor: '#5299FE',
    },
    optionButtonDisabled: {
        opacity: 0.5,
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
        color: '#0F172A',
        flex: 1,
    },
    optionTextSelected: {
        color: BrandColors.secondary,
        fontFamily: FontFamily.semiBold,
    },
    bottomContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
        backgroundColor: 'transparent',
    },
});

