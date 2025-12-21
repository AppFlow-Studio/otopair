/**
 * CarUsageStep
 *
 * PURPOSE: Car usage selection step for TellUsAboutFlow.
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

interface CarUsageStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const CAR_USAGE_OPTIONS = [
    { emoji: '🎉', label: 'Rarely (special occasions)' },
    { emoji: '🛒', label: 'Weekend errands only' },
    { emoji: '🚙', label: 'Daily commute to work/school' },
    { emoji: '🗺️', label: 'Frequent long trips' },
    { emoji: '🚕', label: 'Uber/Lyft/delivery driving' },
] as const;

type CarUsageOption = `${typeof CAR_USAGE_OPTIONS[number]['emoji']} ${typeof CAR_USAGE_OPTIONS[number]['label']}`;

export function CarUsageStep({ onNext, onBack, progress }: CarUsageStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    
    const [selectedUsage, setSelectedUsage] = useState<string | null>(
        data.carUsage ?? null
    );

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleSelectUsage = (option: typeof CAR_USAGE_OPTIONS[number]) => {
        const value = `${option.emoji} ${option.label}`;
        setSelectedUsage(value);
        updateData({ carUsage: value });
    };

    const handleContinue = () => {
        if (selectedUsage) {
            onNext();
        }
    };

    const canContinue = selectedUsage !== null;

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
                            How do you typically use your car?
                        </Text>
                        <Text style={styles.subtitle}>
                            This helps us understand your driving habits
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {CAR_USAGE_OPTIONS.map((option) => {
                            const value = `${option.emoji} ${option.label}`;
                            const isSelected = selectedUsage === value;
                            
                            return (
                                <Pressable
                                    key={option.label}
                                    onPress={() => handleSelectUsage(option)}
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

                <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                    <OnboardingFooterButton
                        label="Continue"
                        onPress={handleContinue}
                        disabled={!canContinue}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant={canContinue ? 'primary' : undefined}
                        backgroundColor={canContinue ? undefined : '#6B7280'}
                        textColor={canContinue ? undefined : BrandColors.white}
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

