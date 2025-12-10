/**
 * OnboardingBackButton
 *
 * PURPOSE: Reusable back button for onboarding screens, positioned above progress indicator.
 *          Only shows when navigation history allows going back.
 *
 * USED IN: Onboarding screens that use OnboardingScreenLayout
 *
 * PROPS:
 *   - noHorizontalPadding (optional): If true, removes horizontal padding to align with content
 *
 * OWNER: Daniel Chelala
 */

import { router, usePathname } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FontFamily, FontSize, Spacing } from '@/components/shared-ui';

interface OnboardingBackButtonProps {
    noHorizontalPadding?: boolean;
}

export function OnboardingBackButton({ noHorizontalPadding = false }: OnboardingBackButtonProps = {}) {
    const pathname = usePathname();
    
    // Only show if we're not on the welcome/index screen
    // In expo-router, route groups (folders in parentheses) are included in the pathname
    // The welcome screen at app/(onboarding)/index.tsx has pathname '/(onboarding)' or '/(onboarding)/'
    const isOnWelcomeScreen = 
        pathname === '/(onboarding)' || 
        pathname === '/(onboarding)/' ||
        pathname.endsWith('/(onboarding)');
    
    if (isOnWelcomeScreen) {
        return null;
    }

    const handleBack = () => {
        router.back();
    };

    return (
        <View style={[styles.container, noHorizontalPadding && styles.containerNoPadding]}>
            <Pressable
                onPress={handleBack}
                style={({ pressed }) => [
                    styles.button,
                    noHorizontalPadding && styles.buttonNoPadding,
                    pressed && styles.buttonPressed,
                ]}
            >
                <ChevronLeft size={FontSize.md} color="#52525b" />
                <Text style={styles.text}>Back</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.xs,
    },
    containerNoPadding: {
        paddingHorizontal: 0,
    },
    button: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.xs,
        alignSelf: 'flex-start',
    },
    buttonNoPadding: {
        marginLeft: -4,
    },
    buttonPressed: {
        opacity: 0.6,
    },
    text: {
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        color: '#52525b',
    },
});

