/**
 * Shared UI Components Library
 * 
 * A foundational component library for consistent UI across the app.
 * All components use Urbanist font by default.
 * 
 * @example
 * ```tsx
 * import { Button, Text, Container, Input } from '@/components/shared-ui';
 * 
 * <Container padding="lg">
 *   <Text weight="bold" size="xl">Welcome</Text>
 *   <Input label="Email" placeholder="Enter your email" />
 *   <Button variant="primary">Sign In</Button>
 * </Container>
 * ```
 */

// Progress Bar Component
export {
    ProgressBar
} from './ProgressBar';

// Footer Button Component
export {
    FooterButton
} from './FooterButton';

// Back Button Component
export {
    BackButton
} from './BackButton';

// Animated Gradient Background Component
export {
    AnimatedGradientBackground
} from './AnimatedGradientBackground';

// Scroll Driven Gradient Background Component
export {
    ScrollDrivenGradientBackground,
    type ScrollDrivenGradientBackgroundProps
} from './ScrollDrivenGradientBackground';

// Button Components
export {
    Button,
    GhostButton,
    IconButton,
    PrimaryButton,
    SecondaryButton,
    type ButtonProps
} from './Button';

// Text Components
export {
    Body, H1,
    H2,
    H3,
    H4, Label,
    LinkText, Small, Text, XSmall, type TextProps
} from './Text';

// Container Components
export {
    Card, Container, Divider, HSpacer, Row, ScreenContainer, Spacer, type ContainerProps
} from './Container';

// Input Components
export {
    Input,
    PasswordInput,
    SearchInput,
    type InputProps
} from './Input';

// Fade In Stagger Animation Component
export {
    FadeInStagger,
    FadeInItem,
    FADE_IN_STAGGER_CONFIG
} from './FadeInStagger';

// Scroll Fade In Animation Component
export {
    ScrollFadeIn,
    SCROLL_FADE_IN_CONFIG
} from './ScrollFadeIn';

// Re-export theme constants for convenience
export {
    BorderRadius, BrandColors, ButtonStyles, Colors, FontFamily,
    FontSize, Shadows, Spacing
} from '@/constants/theme';

