/**
 * DoItYourselfStep
 *
 * PURPOSE: Allows Level 3 users to select which maintenance tasks they perform themselves.
 *
 * USED IN: components/tell-us-about/TellUsAboutFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <DoItYourselfStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 12, filled: 2 }} 
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

interface DoItYourselfStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

const DIY_OPTIONS = [
    { emoji: '🛢️', label: 'Oil changes' },
    { emoji: '🛑', label: 'Brake pad replacement' },
    { emoji: '💨', label: 'Air filter replacement' },
    { emoji: '🔍', label: 'Basic diagnostics' },
    { emoji: '💻', label: 'Complex diagnostics' },
    { emoji: '⚙️', label: 'Transmission/engine work' },
    { emoji: '⚡', label: 'Electrical issues' },
    { emoji: '🛠️', label: 'Bodywork' },
    { emoji: '🔧', label: 'Everything (I do it all myself)' },
    { emoji: '👨‍🔧', label: 'Nothing (I prefer professionals)' },
] as const;

export function DoItYourselfStep({ onNext, onBack, progress }: DoItYourselfStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    
    const presetList = DIY_OPTIONS.map(o => `${o.emoji} ${o.label}`);
    const presets = new Set<string>(presetList);
    
    const [selectedOptions, setSelectedOptions] = useState<string[]>(
        data.diyTasks ?? []
    );
    const [otherInput, setOtherInput] = useState<string>(() => {
        const custom = (data.diyTasks ?? []).find((v) => !presets.has(v));
        return custom ?? '';
    });

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleToggleOption = (option: typeof DIY_OPTIONS[number]) => {
        const value = `${option.emoji} ${option.label}`;
        setSelectedOptions((prev) => {
            const exists = prev.includes(value);
            const next = exists ? prev.filter((v) => v !== value) : [...prev, value];
            updateData({ diyTasks: next.length ? next : null });
            return next;
        });
    };

    const handleChangeOther = (text: string) => {
        setOtherInput(text);
        setSelectedOptions((prev) => {
            const filtered = prev.filter((v) => presets.has(v));
            const trimmed = text.trim();
            const next = trimmed ? [...filtered, trimmed] : filtered;
            updateData({ diyTasks: next.length ? next : null });
            return next;
        });
    };

    const handleContinue = () => {
        if (selectedOptions.length > 0) {
            onNext();
        }
    };

    const canContinue = selectedOptions.length > 0;

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
                            What do you typically do yourself, as opposed to having a shop do?
                        </Text>
                        <Text style={styles.subtitle}>
                            Select all that apply
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {DIY_OPTIONS.map((option) => {
                            const value = `${option.emoji} ${option.label}`;
                            const isSelected = selectedOptions.includes(value);
                            
                            return (
                                <Pressable
                                    key={option.label}
                                    onPress={() => handleToggleOption(option)}
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
                        
                        <TextInput
                            style={styles.otherInput}
                            placeholder="Other (Please specify)"
                            placeholderTextColor="rgba(255, 255, 255, 0.5)"
                            value={otherInput}
                            onChangeText={handleChangeOther}
                            returnKeyType="done"
                        />
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
    otherInput: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: BorderRadius.lg,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.lg,
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        marginTop: Spacing.sm,
    },
    bottomContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
        backgroundColor: 'transparent',
    },
});

