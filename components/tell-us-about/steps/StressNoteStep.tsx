/**
 * StressNoteStep
 *
 * PURPOSE: Optional stress note input step for TellUsAboutFlow.
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
    TextInput,
    ScrollView,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingProgress } from '@/components/onboarding/common/OnboardingProgress';
import { OnboardingFooterButton } from '@/components/onboarding/common/OnboardingFooterButton';
import { OnboardingBackButton } from '@/components/onboarding/common/OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

interface StressNoteStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
    isLastStep?: boolean;
}

export function StressNoteStep({ onNext, onBack, progress, isLastStep = false }: StressNoteStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    
    const [stressNote, setStressNote] = useState<string>(
        data.carStressNote ?? ''
    );

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleContinue = () => {
        updateData({ carStressNote: stressNote.trim() || null });
        onNext();
    };

    // This step is always skippable (optional)
    const buttonLabel = isLastStep ? 'Finish' : 'Continue';

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
                            Is there anything that makes getting your car serviced stressful?
                        </Text>
                        <Text style={styles.subtitle}>
                            Optional — Share any concerns or frustrations you've had
                        </Text>
                    </View>

                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.textInput}
                            placeholder="Type your answer (optional)"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            multiline
                            value={stressNote}
                            onChangeText={setStressNote}
                            textAlignVertical="top"
                        />
                    </View>
                </ScrollView>

                <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                    <OnboardingFooterButton
                        label={buttonLabel}
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
    inputContainer: {
        paddingHorizontal: Spacing['2xl'],
    },
    textInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        minHeight: 150,
    },
    bottomContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
        backgroundColor: 'transparent',
    },
});

