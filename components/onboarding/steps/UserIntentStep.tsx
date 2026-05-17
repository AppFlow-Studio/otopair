/**
 * UserIntentStep
 *
 * PURPOSE: Allows users to select multiple reasons for using the app to tailor their experience.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <UserIntentStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 8, filled: 5 }} 
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
    FinishLater,
} from '@/components/shared-ui';
import { useState, useEffect } from 'react';
import {
    BackHandler,
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
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import {
    BookOpen,
    Search,
    Wrench,
    Car,
    Calendar,
    AlertCircle,
    DollarSign,
    FileText,
    Settings,
    TrendingUp,
} from 'lucide-react-native';

interface UserIntentStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

interface IntentOption {
    id: string;
    label: string;
    icon: React.ComponentType<{ size: number; color: string }>;
}

const INTENT_OPTIONS: IntentOption[] = [
    {
        id: 'education',
        label: 'Education / Learn about my car',
        icon: BookOpen,
    },
    {
        id: 'find_shop',
        label: 'Find a shop',
        icon: Search,
    },
    {
        id: 'understand_maintenance',
        label: 'Understand car maintenance',
        icon: Wrench,
    },
    {
        id: 'track_vehicle_health',
        label: 'Track vehicle health',
        icon: Car,
    },
    {
        id: 'maintenance_reminders',
        label: 'Maintenance reminders',
        icon: Calendar,
    },
    {
        id: 'diagnose_issues',
        label: 'Diagnose car issues',
        icon: AlertCircle,
    },
    {
        id: 'save_money',
        label: 'Save money on repairs',
        icon: DollarSign,
    },
    {
        id: 'service_history',
        label: 'Track service history',
        icon: FileText,
    },
    {
        id: 'car_settings',
        label: 'Manage car settings',
        icon: Settings,
    },
    {
        id: 'improve_performance',
        label: 'Improve car performance',
        icon: TrendingUp,
    },
];

export function UserIntentStep({ onNext, onBack, progress }: UserIntentStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData, data } = useOnboardingStore();
    const saveUserIntentions = useMutation(api.onboarding_questions_answers.saveUserIntentions);
    
    const [selectedIntents, setSelectedIntents] = useState<string[]>(
        data.userIntentions || []
    );

    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
        return () => sub.remove();
    }, [onBack]);

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleToggleIntent = (intentId: string) => {
        setSelectedIntents((prev) => {
            if (prev.includes(intentId)) {
                return prev.filter((id) => id !== intentId);
            } else {
                return [...prev, intentId];
            }
        });
    };

    const handleContinue = async () => {
        updateData({
            userIntentions: selectedIntents,
        });
        if (selectedIntents.length > 0) {
            saveUserIntentions({
                question: 'What do you want to use Otopair for?',
                intentions: selectedIntents,
            }).catch((err) =>
                console.error('Failed to save user intentions:', err)
            );
        }
        onNext();
    };

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
                <FinishLater />

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>
                            What do you want to use Otopair for?
                        </Text>
                        <Text style={styles.subtitle}>
                            We want to know this so we can tailor the app to your needs. Also, we're curious!
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        {INTENT_OPTIONS.map((option) => {
                            const Icon = option.icon;
                            const isSelected = selectedIntents.includes(option.id);
                            
                            return (
                                <Pressable
                                    key={option.id}
                                    onPress={() => handleToggleIntent(option.id)}
                                    style={({ pressed }) => [
                                        styles.optionButton,
                                        isSelected && styles.optionButtonSelected,
                                        pressed && styles.optionButtonPressed,
                                    ]}
                                >
                                    <Icon
                                        size={24}
                                        color={isSelected ? BrandColors.secondary : BrandColors.white}
                                    />
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
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant="primary"
                        disabled={selectedIntents.length === 0}
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
        paddingVertical: Spacing.md,
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

