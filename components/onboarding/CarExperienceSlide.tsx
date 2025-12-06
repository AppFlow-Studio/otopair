/**
 * CarExperienceSlide
 *
 * PURPOSE: Ask the user about their car experience level (Beginner/Average/Professional)
 *          and route them to the appropriate onboarding path based on their selection.
 *
 * USED IN: app/(onboarding)/car-experience.tsx
 *
 * PROPS:
 *   - None (self-contained screen component)
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-011
 */

// TODO: Use themes.ts for colors and spacing

// components/onboarding/CarExperienceSlide.tsx
import { useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';


type ExperienceLevel = 'beginner' | 'average' | 'professional';

// Map UI values to store values (1-5 scale)
const experienceToLevel: Record<ExperienceLevel, 1 | 3 | 5> = {
    beginner: 1,
    average: 3,
    professional: 5,
};

interface OptionProps {
    label: string;
    value: ExperienceLevel;
    selected: boolean;
    onSelect: (value: ExperienceLevel) => void;
}

function ExperienceOption({ label, value, selected, onSelect }: OptionProps) {
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

export function CarExperienceSlide() {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const [selected, setSelected] = useState<ExperienceLevel | null>(null);

    // Get store actions
    const { updateData, completeStep } = useOnboardingStore();

    const responsiveMargin = height * 0.03;

    const handleNext = () => {
        if (!selected) return;

        // Save selection to store
        updateData({ carKnowledgeLevel: experienceToLevel[selected] });
        completeStep('car_knowledge');

        // Navigate based on experience level
        switch (selected) {
            case 'beginner':
                router.push('/(onboarding)/oil-change');
                break;
            case 'average':
                // TODO: Create average flow
                router.replace('/(main-tabs)');
                break;
            case 'professional':
                // TODO: Create professional flow
                router.replace('/(main-tabs)');
                break;
        }
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
            {/* Header */}
            <View style={[styles.headerContent, { marginTop: responsiveMargin }]}>
                <Text size="3xl" weight="bold" color="#141C24" style={styles.title}>
                    How would you explain your experience with cars in general?
                </Text>
            </View>

            {/* Options */}
            <View style={styles.optionsContainer}>
                <ExperienceOption
                    label="Beginner"
                    value="beginner"
                    selected={selected === 'beginner'}
                    onSelect={setSelected}
                />
                <ExperienceOption
                    label="Average"
                    value="average"
                    selected={selected === 'average'}
                    onSelect={setSelected}
                />
                <ExperienceOption
                    label="Professional"
                    value="professional"
                    selected={selected === 'professional'}
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

