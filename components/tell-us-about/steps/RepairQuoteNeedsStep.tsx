/**
 * RepairQuoteNeedsStep
 *
 * PURPOSE: Repair quote needs multi-select step for TellUsAboutFlow.
 *          User selects up to 3 needs.
 *
 * OWNER: Daniel Chelala
 */

import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
    BorderRadius,
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
import { OnboardingProgress } from '@/components/onboarding/common/OnboardingProgress';
import { OnboardingFooterButton } from '@/components/onboarding/common/OnboardingFooterButton';
import { OnboardingBackButton } from '@/components/onboarding/common/OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

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
    { emoji: '💵', label: 'Comparison to typical prices' },
    { emoji: '🕐', label: 'Time it will take' },
] as const;

export function RepairQuoteNeedsStep({ onNext, onBack, progress }: RepairQuoteNeedsStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    
    const [selectedNeeds, setSelectedNeeds] = useState<string[]>(
        data.repairQuoteNeeds ?? []
    );

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleToggleNeed = (option: typeof REPAIR_QUOTE_NEEDS_OPTIONS[number]) => {
        const value = `${option.emoji} ${option.label}`;
        setSelectedNeeds((prev) => {
            const exists = prev.includes(value);
            if (exists) {
                const next = prev.filter((v) => v !== value);
                updateData({ repairQuoteNeeds: next.length ? next : null });
                return next;
            }
            if (prev.length >= 3) return prev;
            const next = [...prev, value];
            updateData({ repairQuoteNeeds: next });
            return next;
        });
    };

    const handleContinue = () => {
        onNext();
    };

    // This step allows skipping (can continue with 0 selections)
    // but provides better experience with some selections

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                <OnboardingProgress
                    total={progress.total}
                    filled={progress.filled}
                    leftElement={<OnboardingBackButton onBack={onBack} alwaysShow />}
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
                            Select up to 3 ({selectedNeeds.length}/3)
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {REPAIR_QUOTE_NEEDS_OPTIONS.map((option) => {
                            const value = `${option.emoji} ${option.label}`;
                            const isSelected = selectedNeeds.includes(value);
                            const isDisabled = !isSelected && selectedNeeds.length >= 3;
                            
                            return (
                                <Pressable
                                    key={option.label}
                                    onPress={() => handleToggleNeed(option)}
                                    disabled={isDisabled}
                                    style={({ pressed }) => [
                                        styles.optionButton,
                                        isSelected && styles.optionButtonSelected,
                                        isDisabled && styles.optionButtonDisabled,
                                        pressed && !isDisabled && styles.optionButtonPressed,
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

                <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                    <OnboardingFooterButton
                        label="Finish"
                        onPress={handleContinue}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant="primary"
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
        color: BrandColors.white,
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

