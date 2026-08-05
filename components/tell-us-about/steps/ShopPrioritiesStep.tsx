/**
 * ShopPrioritiesStep
 *
 * PURPOSE: Allows users to select their top 3 priorities for a car shop.
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <ShopPrioritiesStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 7, filled: 5 }} 
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

interface ShopPrioritiesStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const SHOP_PRIORITY_OPTIONS = [
    { id: 'make_specialization', label: 'Specialization in my make/model', emoji: '🏎️' },
    { id: 'ase_certified', label: 'ASE certified technicians', emoji: '📜' },
    { id: 'parts_quality', label: 'Quality of parts used (OEM vs aftermarket)', emoji: '⚙️' },
    { id: 'diagnostic_equip', label: 'Advanced diagnostic equipment', emoji: '💻' },
    { id: 'complex_repairs', label: 'Track record with complex repairs', emoji: '🛠️' },
    { id: 'labor_rates', label: 'Transparent labor rates', emoji: '🧾' },
    { id: 'turnaround_time', label: 'Turnaround time', emoji: '⏰' },
] as const;

export function ShopPrioritiesStep({ onNext, onBack, progress }: ShopPrioritiesStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    const { saveQuestionAnswer } = useOnboardingQuestion('shopPriorities');

    const [selectedPriorities, setSelectedPriorities] = useState<string[]>(
        data.shopPriorities ?? []
    );

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleTogglePriority = (id: string) => {
        setSelectedPriorities((prev) => {
            const isSelected = prev.includes(id);
            if (isSelected) {
                const next = prev.filter((x) => x !== id);
                updateData({ shopPriorities: next.length ? next : null });
                return next;
            }
            if (prev.length >= 3) return prev;
            const next = [...prev, id];
            updateData({ shopPriorities: next });
            return next;
        });
    };

    const handleContinue = () => {
        if (selectedPriorities.length === 3) {
            const labels = selectedPriorities
                .map(id => SHOP_PRIORITY_OPTIONS.find(o => o.id === id)?.label)
                .filter(Boolean) as string[];
            const questionText = 'What are your top 3 priorities for a car shop?';
            saveQuestionAnswer(questionText, labels.join(', '));
            onNext();
        }
    };

    const canContinue = selectedPriorities.length === 3;

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
                            What's important in a shop for YOUR car?
                        </Text>
                        <Text style={styles.subtitle}>
                            Choose 3 out of the 7 items ({selectedPriorities.length}/3)
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {SHOP_PRIORITY_OPTIONS.map((option) => {
                            const rankIndex = selectedPriorities.indexOf(option.id);
                            const isSelected = rankIndex !== -1;
                            const isDisabled = !isSelected && selectedPriorities.length >= 3;
                            
                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() => handleTogglePriority(option.id)}
                                    disabled={isDisabled}
                                    style={({ pressed }) => [
                                        styles.optionButton,
                                        isSelected && styles.optionButtonSelected,
                                        isDisabled && styles.optionButtonDisabled,
                                        pressed && !isDisabled && styles.optionButtonPressed,
                                    ]}
                                >
                                    <View style={styles.rankRow}>
                                        {isSelected ? (
                                            <View style={styles.rankBadge}>
                                                <Text style={styles.rankBadgeText}>{rankIndex + 1}</Text>
                                            </View>
                                        ) : (
                                            <Text style={styles.optionEmoji}>{option.emoji}</Text>
                                        )}
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
        width: 36,
        lineHeight: 34,
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
});

