/**
 * OnboardingBackButton
 *
 * PURPOSE: Reusable back button for onboarding screens, positioned on the same line as progress indicator.
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
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { FontSize, Spacing, BrandColors } from '@/components/shared-ui';

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
        <Pressable
            onPress={handleBack}
            style={({ pressed }) => [
                styles.button,
                noHorizontalPadding && styles.buttonNoPadding,
                pressed && styles.buttonPressed,
            ]}
        >
            <ArrowLeft size={FontSize['3xl']} color = {BrandColors.white} />
        </Pressable>
    );
}

const styles = StyleSheet.create({
    button: {
        paddingTop: Spacing.xs,
        paddingRight: Spacing.xs,
        paddingBottom: Spacing.xs,
        paddingLeft: 0,
        marginLeft: -Spacing.xs,
        marginRight: Spacing.md,
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonNoPadding: {
        marginLeft: -4,
    },
    buttonPressed: {
        opacity: 0.6,
    },
});

