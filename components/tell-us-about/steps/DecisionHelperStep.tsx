/**
 * DecisionHelperStep
 *
 * PURPOSE: Allows users to select who typically helps them with car decisions.
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <DecisionHelperStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 12, filled: 4 }} 
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

interface DecisionHelperStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const DECISION_HELPER_OPTIONS = [
    { emoji: '🧠', label: 'I handle it myself' },
    { emoji: '👨‍👩‍👧‍👦', label: 'Family member/friend who knows cars' },
    { emoji: '🗣️', label: 'I ask the mechanic to explain everything' },
    { emoji: '🤝', label: "I just trust the mechanic's recommendation" },
] as const;

export function DecisionHelperStep({ onNext, onBack, progress }: DecisionHelperStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    
    const [selectedHelper, setSelectedHelper] = useState<string | null>(
        data.decisionHelper ?? null
    );

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleSelectHelper = (option: typeof DECISION_HELPER_OPTIONS[number]) => {
        const value = `${option.emoji} ${option.label}`;
        setSelectedHelper(value);
        updateData({ decisionHelper: value });
    };

    const handleContinue = () => {
        if (selectedHelper) {
            onNext();
        }
    };

    const canContinue = selectedHelper !== null;

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
                            Who usually helps you with car decisions?
                        </Text>
                        <Text style={styles.subtitle}>
                            We'll tailor our recommendations based on your answer
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {DECISION_HELPER_OPTIONS.map((option) => {
                            const value = `${option.emoji} ${option.label}`;
                            const isSelected = selectedHelper === value;
                            
                            return (
                                <Pressable
                                    key={option.label}
                                    onPress={() => handleSelectHelper(option)}
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

