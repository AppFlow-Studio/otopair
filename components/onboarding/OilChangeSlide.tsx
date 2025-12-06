/**
 * OilChangeSlide
 *
 * PURPOSE: Ask beginner users about their last oil change
 *
 * USED IN: app/(onboarding)/oil-change.tsx
 *
 * PATH: Beginner flow only
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-031
 */

// TODO: Use themes.ts for colors and spacing
// TODO: Create dashed component animation at top of screen to fill during onboarding progression

import { Button, Text } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type OilChangeOption = 'last_3_months' | '3_6_months' | '6_plus_months' | 'dont_remember';

interface OptionProps {
    label: string;
    value: OilChangeOption;
    selected: boolean;
    onSelect: (value: OilChangeOption) => void;
}

function OilChangeOptionItem({ label, value, selected, onSelect }: OptionProps) {
    return (
        <Pressable
            style={[styles.option, selected && styles.optionSelected]}
            onPress={() => onSelect(value)}
        >
            <Text
                size="md"
                weight={selected ? 'semiBold' : 'regular'}
                color={selected ? '#141C24' : '#5A6B7A'}
            >
                {label}
            </Text>
            <Check
                size={20}
                color={selected ? '#5299FE' : '#D1D5DB'}
                strokeWidth={2.5}
            />
        </Pressable>
    );
}

export function OilChangeSlide() {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [selected, setSelected] = useState<OilChangeOption | null>(null);

    const { updateData, completeStep } = useOnboardingStore();

    const responsiveMargin = height * 0.03;

    const handleNext = () => {
        if (!selected) return;

        // Save selection to store (you may want to add this field to OnboardingData)
        // updateData({ lastOilChange: selected });
        
        // Navigate to next step or main app
        router.replace('/(main-tabs)');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
            {/* Header */}
            <View style={[styles.headerContent, { marginTop: responsiveMargin }]}>
                <Text size="3xl" weight="bold" color="#141C24" style={styles.title}>
                    When was your last oil change?
                </Text>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
                <OilChangeOptionItem
                    label="Last 3 months"
                    value="last_3_months"
                    selected={selected === 'last_3_months'}
                    onSelect={setSelected}
                />
                <OilChangeOptionItem
                    label="3–6 months ago"
                    value="3_6_months"
                    selected={selected === '3_6_months'}
                    onSelect={setSelected}
                />
                <OilChangeOptionItem
                    label="6+ months ago"
                    value="6_plus_months"
                    selected={selected === '6_plus_months'}
                    onSelect={setSelected}
                />
                <OilChangeOptionItem
                    label="I don't remember"
                    value="dont_remember"
                    selected={selected === 'dont_remember'}
                    onSelect={setSelected}
                />
            </View>

            {/* Spacer to push button to bottom */}
            <View style={styles.spacer} />

            {/* Bottom Button */}
            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
                <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    borderRadius={100}
                    paddingVertical={16}
                    onPress={handleNext}
                    disabled={!selected}
                >
                    Next
                </Button>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#E8ECF0',
    },
    headerContent: {
        paddingHorizontal: 24,
        marginBottom: 32,
    },
    title: {
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    optionsContainer: {
        paddingHorizontal: 24,
        gap: 12,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        paddingVertical: 16,
        paddingHorizontal: 20,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: 'transparent',
    },
    optionSelected: {
        borderColor: '#5299FE',
        backgroundColor: '#F8FBFF',
    },
    spacer: {
        flex: 1,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingTop: 8,
    },
});

