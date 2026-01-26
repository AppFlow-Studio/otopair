/**
 * WelcomeStep
 *
 * PURPOSE: First screen in the onboarding process, providing options to create an account or log in.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *
 * EXAMPLE:
 *   <WelcomeStep onNext={handleNext} onBack={handleBack} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

// TODO: Edit login button, as it currently navigates to home screen for testing purposes

import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
    BorderRadius,
} from '@/components/shared-ui';
import { FooterButton } from '@/components/shared-ui/FooterButton';
import { Image } from 'expo-image';
import { MoveRight } from 'lucide-react-native';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/useAuthStore';

interface WelcomeStepProps {
    onNext: () => void;
    onBack: () => void;
}

export function WelcomeStep({ onNext, onBack }: WelcomeStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { setIsNewUser } = useAuthStore();

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainerPrimary: { paddingBottom: Spacing.sm },
        bottomContainerSecondary: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleGetStarted = () => {
        console.log('Finished WelcomeStep - Create Account');
        setIsNewUser(true); // User is creating a new account
        onNext();
    };

    const handleLogIn = () => {
        // TODO: Navigate to login screen
        console.log('Navigate to login');
        setIsNewUser(false); // User is logging in (existing user)
        onBack();
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                
                {/* Header Content */}
                <View style={styles.headerContent}>
                    <Text style={styles.title}>
                        Welcome to Otopair
                    </Text>
                    <Text style={styles.subtitle}>
                        Your smart assistant for car health, repair tips, and maintenance reminders.
                    </Text>
                </View>

                {/* Hero Image */}
                <View style={styles.imageContainer}>
                    <Image
                        source={require('@/assets/images/onboarding/onboarding-home.png')}
                        style={styles.heroImage}
                        contentFit="cover"
                    />
                </View>

                {/* Bottom Buttons */}
                <View style={[styles.bottomContainer, dynamicStyles.bottomContainerPrimary]}>
                    <FooterButton
                        label="Create Account"
                        onPress={handleGetStarted}
                        rightIcon={<MoveRight size={FontSize.md} color={BrandColors.white} />}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant="primary"
                    />
                </View>
                <View style={[styles.bottomContainer, dynamicStyles.bottomContainerSecondary]}>
                    <FooterButton
                        label="Log In"
                        onPress={handleLogIn}
                        rightIcon={<MoveRight size={FontSize.md} color={BrandColors.white} />}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant="secondary"
                    />
                </View>
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
    headerContent: {
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing.md,
    },
    title: {
        fontSize: FontSize['4xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.white,
        marginBottom: Spacing.xs,
        lineHeight: Spacing['5xl'],
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.9,
        lineHeight: Spacing['2xl'],
        marginBottom: Spacing.sm,
    },
    imageContainer: {
        flex: 2,
        paddingHorizontal: Spacing.lg,
        marginBottom: Spacing.sm,
    },
    heroImage: {
        flex: 1,
        width: '100%',
        borderRadius: BorderRadius['2xl'],
    },
    bottomContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
    },
});

