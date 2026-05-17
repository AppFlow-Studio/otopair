/**
 * MaintenanceApproachStepLevel3
 *
 * PURPOSE: Allows users to select their approach to car maintenance.
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <MaintenanceApproachStepLevel3 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 12, filled: 3 }} 
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

interface MaintenanceApproachStepLevel3Props {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const APPROACH_OPTIONS = [
    { emoji: '🗓️', label: 'Preventive: I follow the schedule strictly' },
    { emoji: '📊', label: 'Data-driven: I track everything and service based on actual wear' },
    { emoji: '🛠️', label: 'Problem-solving: I address issues as they come up' },
    { emoji: '🏎️', label: 'Performance-focused: I maintain for optimal performance' },
    { emoji: '💰', label: "Budget-conscious: I do what's necessary when necessary" },
] as const;

export function MaintenanceApproachStepLevel3({ onNext, onBack, progress }: MaintenanceApproachStepLevel3Props) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    const { saveQuestionAnswer } = useOnboardingQuestion('maintenanceApproachLevel3');

    const [selectedApproach, setSelectedApproach] = useState<string | null>(
        data.maintenanceApproachLevel3 ?? null
    );

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleSelectApproach = (option: typeof APPROACH_OPTIONS[number]) => {
        const value = `${option.emoji} ${option.label}`;
        setSelectedApproach(value);
        updateData({ maintenanceApproachLevel3: value });
    };

    const handleContinue = () => {
        if (selectedApproach) {
            const label = APPROACH_OPTIONS.find(o => `${o.emoji} ${o.label}` === selectedApproach)?.label ?? selectedApproach;
            const questionText = 'How do you approach car maintenance?';
            saveQuestionAnswer(questionText, label);
            onNext();
        }
    };

    const canContinue = selectedApproach !== null;

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
                            How do you typically approach car maintenance?
                        </Text>
                        <Text style={styles.subtitle}>
                            Select the style that matches you best
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {APPROACH_OPTIONS.map((option) => {
                            const value = `${option.emoji} ${option.label}`;
                            const isSelected = selectedApproach === value;
                            
                            return (
                                <Pressable
                                    key={option.label}
                                    onPress={() => handleSelectApproach(option)}
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

