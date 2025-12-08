/**
 * ProServices
 *
 * PURPOSE: Ask users about their services in the past 12 months
 *
 * USED IN: app/(onboarding)/pro-services.tsx
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
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
    StyleSheet,
    View,
    TextInput,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    Keyboard,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ServicesOption =
    | 'oil_change'
    | 'brake_replacement'
    | 'ny_state_inspection'
    | 'ac_heating_service'
    | 'tire_rotation_replacement'
    | 'battery_change'
    | string;

export function ProServices() {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const scrollViewRef = useRef<ScrollView>(null);
    
    const isCompact = height < 720;
    const isLarge = height >= 900;

    const [selected, setSelected] = useState<ServicesOption[]>(
        () => useOnboardingStore.getState().data.services12months ?? []
    );
    const [otherService, setOtherService] = useState('');
    const [inputFocused, setInputFocused] = useState(false);

    const { updateData } = useOnboardingStore();

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

    const options = useMemo(
        () => [
            { label: 'Oil Change', value: 'oil_change' as ServicesOption },
            { label: 'Tire Rotation / Replacement', value: 'tire_rotation_replacement' as ServicesOption },
            { label: 'Brake Replacement', value: 'brake_replacement' as ServicesOption },
            { label: 'Battery Change', value: 'battery_change' as ServicesOption },
            { label: 'NY State Inspection', value: 'ny_state_inspection' as ServicesOption },
            { label: 'Air Conditioning / Heating Service', value: 'ac_heating_service' as ServicesOption },
        ],
        []
    );

    const toggleSelect = (value: ServicesOption) => {
        setSelected((prev) =>
            prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
        );
    };

    const handleNext = () => {
        const extras = otherService.trim();
        const payload = extras ? [...selected, extras] : selected;

        updateData({
            services12months: payload,
        });

        router.push('/(onboarding)/pro-mileage');
    };

    const optionsHorizontalPadding = isLarge
        ? Spacing['3xl']
        : isCompact
        ? Spacing.xl
        : Spacing['2xl'];

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
                    <OnboardingProgress total={5} filled={1} />

                    <View
                        style={[
                            styles.headerContent,
                            { paddingHorizontal: optionsHorizontalPadding },
                        ]}
                    >
                        <Text style={styles.title}>
                            Which services have you had done in the past 12 months?
                        </Text>
                    </View>

                    <View
                        style={[
                            isLarge ? styles.optionsContainerLarge : styles.optionsContainer,
                            { paddingHorizontal: optionsHorizontalPadding },
                        ]}
                    >
                        {options.map((opt) => (
                            <OnboardingOption
                                key={opt.value}
                                label={opt.label}
                                value={opt.value}
                                selected={selected.includes(opt.value)}
                                onSelect={toggleSelect}
                                size={isLarge ? 'md' : 'sm'}
                                style={isLarge ? undefined : styles.optionChip}
                            />
                        ))}
                    </View>

                    <TextInput
                        style={[
                            styles.input,
                            { marginHorizontal: optionsHorizontalPadding },
                        ]}
                        placeholder="Other... Please mention"
                        placeholderTextColor="#7a7f89"
                        value={otherService}
                        onChangeText={setOtherService}
                        multiline
                        onFocus={() => setInputFocused(true)}
                        onBlur={() => setInputFocused(false)}
                    />

                    {/* Spacer to push button down */}
                    <View style={styles.spacer} />

                    {/* Button inside ScrollView */}
                    <View
                        style={[
                            styles.bottomContainer,
                            { paddingHorizontal: optionsHorizontalPadding },
                        ]}
                    >
                        <OnboardingFooterButton
                            label="Next"
                            onPress={handleNext}
                            disabled={false}
                            size={isCompact ? 'md' : 'lg'}
                            paddingVertical={isCompact ? Spacing.sm : Spacing.lg}
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
        rowGap: Spacing.sm,
        columnGap: Spacing.sm,
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    optionsContainerLarge: {
        gap: Spacing.md,
    },
    optionChip: {
        alignSelf: 'flex-start',
    },
    input: {
        marginTop: Spacing.lg,
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
        paddingTop: Spacing.sm,
    },
});
