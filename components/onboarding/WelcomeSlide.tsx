/**
 * WelcomeSlide
 *
 * PURPOSE: Display the welcome slide for the onboarding process.
 *
 * USED IN: app/(onboarding)/index.tsx
 *
 * PROPS:
 *   - N/A
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-009
 */

// components/onboarding/WelcomeSlide.tsx
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { MoveRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Text } from '@/components/shared-ui';

export function WelcomeSlide() {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();

    // Responsive marginTop: ~3% of screen height
    // Small phone (667px): ~20px | Large phone (915px): ~27px
    const responsiveMargin = height * 0.03;

    const handleGetStarted = () => {
        // Navigate to next onboarding step
        router.push('/(onboarding)/car-experience');
    };

    return (
        <View style={[styles.container, { paddingTop: insets.top + 24 }]}>
            {/* Header Content */}
            <View style={[styles.headerContent, { marginTop: responsiveMargin }]}>
                <Text size="3xl" weight="bold" color="#141C24" style={styles.title}>
                    Welcome to OtoPair
                </Text>
                <Text size="lg" color="#5A6B7A" style={[styles.subtitle, { marginBottom: responsiveMargin }]}>
                    Your smart assistant for car health, repair tips, and maintenance reminders.
                </Text>
            </View>

            {/* Hero Image - flex to fill available space */}
            <View style={styles.imageContainer}>
                <Image
                    source={require('@/assets/images/onboarding/onboarding-home.png')}
                    style={styles.heroImage}
                    contentFit="contain"
                />
            </View>

            {/* Bottom Button */}
            <View style={[styles.bottomContainer, { paddingBottom: insets.bottom + 16 }]}>
                <Button
                    variant="primary"
                    fullWidth
                    size="lg"
                    borderRadius={100}
                    paddingVertical={16}
                    onPress={handleGetStarted}
                    rightIcon={<MoveRight size={20} color="#fff" />}
                >
                    Let's Check Your Car Now
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
        marginBottom: 12,
    },
    title: {
        lineHeight: 40,
        letterSpacing: -0.5,
    },
    subtitle: {
        marginTop: 12,
        lineHeight: 24,
    },
    imageContainer: {
        flex: 1,
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    heroImage: {
        flex: 1,
        width: '100%',
        borderRadius: 24,
    },
    bottomContainer: {
        paddingHorizontal: 24,
        paddingTop: 8,
    },
});
