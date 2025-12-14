/**
 * WelcomeStep
 *
 * PURPOSE: Welcome step for OnboardingFlow - first screen in the onboarding process.
 *
 * OWNER: Daniel Chelala
 */

import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
    BorderRadius,
} from '@/components/shared-ui';
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
import { OnboardingProgress } from '../OnboardingProgress';
import { OnboardingFooterButton } from '../OnboardingFooterButton';

interface WelcomeStepProps {
    onNext: () => void;
    onBack: () => void;
}

export function WelcomeStep({ onNext, onBack }: WelcomeStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleGetStarted = () => {
        onNext();
    };

    const handleLogIn = () => {
        // TODO: Navigate to login screen
        console.log('Navigate to login');
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                <OnboardingProgress total={4} filled={0} leftElement={null} />
                
                {/* Header Content */}
                <View style={styles.headerContent}>
                    <Text style={styles.title}>
                        Welcome to OtoPair
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
                <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                    <OnboardingFooterButton
                        label="Create Account"
                        onPress={handleGetStarted}
                        rightIcon={<MoveRight size={FontSize.md} color={BrandColors.white} />}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant="primary"
                    />
                </View>
                <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                    <OnboardingFooterButton
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
        lineHeight: 48,
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.9,
        lineHeight: 24,
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

