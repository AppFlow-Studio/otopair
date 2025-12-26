/**
 * ServicePrioritiesStep
 *
 * PURPOSE: Allows users to select their top 3 priorities for car service.
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

interface ServicePrioritiesStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const SERVICE_PRIORITY_OPTIONS = [
    { id: '💰 Getting the best price', emoji: '💰', label: 'Getting the best price' },
    { id: '⏰ Quick turnaround time', emoji: '⏰', label: 'Quick turnaround time' },
    { id: '🏆 High-quality service', emoji: '🏆', label: 'High-quality service' },
    { id: '📍 Convenience/location', emoji: '📍', label: 'Convenience/location' },
    { id: '🧾 Transparent pricing/no surprises', emoji: '🧾', label: 'Transparent pricing/no surprises' },
    { id: '⭐ Trusted reviews/reputation', emoji: '⭐', label: 'Trusted reviews/reputation' },
] as const;

export function ServicePrioritiesStep({ onNext, onBack, progress }: ServicePrioritiesStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    
    const [selectedPriorities, setSelectedPriorities] = useState<string[]>(
        data.servicePriorities ?? []
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
                updateData({ servicePriorities: next.length ? next : null });
                return next;
            }
            if (prev.length >= 3) return prev;
            const next = [...prev, id];
            updateData({ servicePriorities: next });
            return next;
        });
    };

    const handleContinue = () => {
        if (selectedPriorities.length === 3) {
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
                            What matters most when getting your car serviced?
                        </Text>
                        <Text style={styles.subtitle}>
                            Choose 3 out of the 6 items ({selectedPriorities.length}/3)
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {SERVICE_PRIORITY_OPTIONS.map((option) => {
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
        color: '#0B1220',
    },
    optionEmoji: {
        fontSize: FontSize['2xl'],
        width: 28,
        textAlign: 'center',
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

