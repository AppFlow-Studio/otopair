/**
 * ServicePrioritiesStep
 *
 * PURPOSE: Allows users to select their priorities for car service.
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <ServicePrioritiesStep 
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

interface ServicePrioritiesStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const SERVICE_PRIORITY_OPTIONS = [
    { id: 'quick_turnaround_time', emoji: '⏰', label: 'Quick turnaround time' },
    { id: 'high_quality_service', emoji: '🏆', label: 'High-quality service' },
    { id: 'convenience_location', emoji: '📍', label: 'Convenience/location' },
    { id: 'transparent_pricing', emoji: '🧾', label: 'Transparent pricing/no surprises' },
    { id: 'trusted_reviews_reputation', emoji: '⭐', label: 'Trusted reviews/reputation' },
] as const;

type ServicePriority = typeof SERVICE_PRIORITY_OPTIONS[number]['id'];

export function ServicePrioritiesStep({ onNext, onBack, progress }: ServicePrioritiesStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    const { saveQuestionAnswer } = useOnboardingQuestion('servicePriorities');

    const [selectedPriorities, setSelectedPriorities] = useState<ServicePriority[]>(
        (data.servicePriorities as ServicePriority[]) ?? []
    );

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleTogglePriority = (id: ServicePriority) => {
        setSelectedPriorities((prev) => {
            const isSelected = prev.includes(id);
            if (isSelected) {
                const next = prev.filter((x) => x !== id);
                updateData({ servicePriorities: next.length ? next : null });
                return next;
            }
            const next = [...prev, id];
            updateData({ servicePriorities: next });
            return next;
        });
    };

    const handleContinue = () => {
        if (selectedPriorities.length > 0) {
            const labels = selectedPriorities
                .map(id => SERVICE_PRIORITY_OPTIONS.find(o => o.id === id)?.label)
                .filter(Boolean) as string[];
            const questionText = 'What are your priorities for car service?';
            saveQuestionAnswer(questionText, labels.join(', '));
            onNext();
        }
    };

    const canContinue = selectedPriorities.length > 0;

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
                            What matters most when getting your car serviced?
                        </Text>
                        <Text style={styles.subtitle}>
                            Select all that apply
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {SERVICE_PRIORITY_OPTIONS.map((option) => {
                            const isSelected = selectedPriorities.includes(option.id);
                            
                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() => handleTogglePriority(option.id)}
                                    style={({ pressed }) => [
                                        styles.optionButton,
                                        isSelected && styles.optionButtonSelected,
                                        pressed && styles.optionButtonPressed,
                                    ]}
                                >
                                    <View style={styles.rankRow}>
                                        <Text style={styles.optionEmoji}>{option.emoji}</Text>
                                        <Text
                                            style={[
                                                styles.optionText,
                                                isSelected && styles.optionTextSelected,
                                            ]}
                                        >
                                            {option.label}
                                        </Text>
                                    </View>
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>

                <FadeFooterContainer paddingBottom={insets.bottom + Spacing.lg}>
                    <FooterButton
                        label="Finish"
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
    rankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        flex: 1,
    },
    rankBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: BrandColors.secondary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankBadgeText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.bold,
        color: '#1E40AF',
    },
    optionEmoji: {
        fontSize: FontSize['2xl'],
        width: 28,
        textAlign: 'center',
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

