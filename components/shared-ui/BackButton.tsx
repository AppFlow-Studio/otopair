/**
 * BackButton
 *
 * PURPOSE: Reusable back button positioned consistently across flows (onboarding, etc.).
 *
 * USED IN: Various flow steps (Onboarding, TellUsAbout, etc.).
 *
 * PROPS:
 *   - noHorizontalPadding (boolean): If true, removes horizontal padding [optional]
 *   - onBack (() => void): Custom back action, defaults to router.back() [optional]
 *   - alwaysShow (boolean): If true, shows button even on the initial flow screens [optional]
 *
 * EXAMPLE:
 *   <BackButton
 *     onBack={() => goToStep('welcome')}
 *     noHorizontalPadding
 *     alwaysShow
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import { router, usePathname } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { Pressable, StyleSheet } from 'react-native';
import { FontSize, Spacing, BrandColors } from '@/constants/theme';

interface BackButtonProps {
    noHorizontalPadding?: boolean;
    onBack?: () => void;
    /** If true, always shows the button regardless of pathname */
    alwaysShow?: boolean;
}

export function BackButton({ 
    noHorizontalPadding = false, 
    onBack,
    alwaysShow = false,
}: BackButtonProps = {}) {
    const pathname = usePathname();
    
    // Only hide if we're on a "welcome" or "root" flow screen
    const isRootFlowScreen = 
        pathname === '/(onboarding)' || 
        pathname === '/(onboarding)/' ||
        pathname.endsWith('/(onboarding)');
    
    if (isRootFlowScreen && !alwaysShow) {
        return null;
    }

    const handleBack = () => {
        if (onBack) {
            onBack();
        } else {
            router.back();
        }
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
            <ArrowLeft size={FontSize['3xl']} color={BrandColors.white} />
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

