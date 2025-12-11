/**
 * ProMileage
 *
 * PURPOSE: Ask users about their car's mileage at last oil change
 *
 * USED IN: app/(onboarding)/pro-mileage.tsx
 *
 * PATH: Pro flow only
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-031
 */

import {
    BorderRadius,
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingOption } from './OnboardingButton';
import { OnboardingFooterButton } from './OnboardingFooterButton';
import { OnboardingBackButton } from './OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    StyleSheet,
    View,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function ProMileage() {
    const insets = useSafeAreaInsets();
    const scrollViewRef = useRef<ScrollView>(null);
    const [mileage, setMileage] = useState('');
    const [dontRemember, setDontRemember] = useState(false);
    const [inputFocused, setInputFocused] = useState(false);

    const { updateData } = useOnboardingStore();

    const canProceed = mileage.trim().length > 0 || dontRemember;

    // Listen for keyboard events and scroll when keyboard appears
    useEffect(() => {
        const keyboardDidShowListener = Keyboard.addListener(
            Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
            () => {
                if (inputFocused) {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }
            }
        );

        return () => {
            keyboardDidShowListener.remove();
        };
    }, [inputFocused]);

    const handleMileageChange = (text: string) => {
        const numericText = text.replace(/[^0-9]/g, '');
        setMileage(numericText);
        if (numericText.length > 0) {
            setDontRemember(false);
        }
    };

    const handleDontRemember = () => {
        setDontRemember(true);
        setMileage('');
        Keyboard.dismiss();
    };

    const handleNext = () => {
        if (!canProceed) return;

        updateData({
            lastOilMileage: dontRemember ? 'dont_remember' : mileage,
        });

        router.push('/(onboarding)/pro-brakes');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + Spacing.sm }]}>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.flex}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + Spacing['3xl'] },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <OnboardingProgress total={5} filled={2} leftElement={<OnboardingBackButton />} />

                    <View style={styles.headerContent}>
                        <Text style={styles.title}>
                            What was your car's mileage at your last oil change?
                        </Text>
                    </View>

                    <View style={styles.optionsContainer}>
                        <TextInput
                            style={styles.input}
                            placeholder="Enter Mileage"
                            placeholderTextColor="#7a7f89"
                            value={mileage}
                            onChangeText={handleMileageChange}
                            keyboardType="number-pad"
                            returnKeyType="done"
                            onSubmitEditing={Keyboard.dismiss}
                            onFocus={() => setInputFocused(true)}
                            onBlur={() => setInputFocused(false)}
                        />

                        <OnboardingOption
                            label="I don't remember"
                            value="dont_remember"
                            selected={dontRemember}
                            onSelect={handleDontRemember}
                        />
                    </View>

                    {/* Spacer to push button down */}
                    <View style={styles.spacer} />

                    {/* Button inside ScrollView */}
                    <View style={styles.bottomContainer}>
                        <OnboardingFooterButton
                            label="Next"
                            onPress={handleNext}
                            disabled={!canProceed}
                        />
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dee2ee',
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
    },
    headerContent: {
        paddingHorizontal: Spacing['2xl'],
        marginTop: Spacing['2xl'],
        marginBottom: Spacing['3xl'],
    },
    title: {
        lineHeight: 40,
        letterSpacing: -0.5,
        fontSize: FontSize['3xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.primary,
    },
    optionsContainer: {
        paddingHorizontal: Spacing['2xl'],
        gap: Spacing.md,
    },
    input: {
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.lg,
        backgroundColor: '#f4f5f9',
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: BrandColors.primary,
        borderWidth: 1,
        borderColor: '#e1e4ec',
    },
    spacer: {
        flex: 1,
        minHeight: Spacing['2xl'],
    },
    bottomContainer: {
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
    },
});
