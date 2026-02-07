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

// Progress Bar Components
export {
    ProgressBar
} from './ProgressBar';

export {
    SolidProgressBar
} from './SolidProgressBar';

// Footer Button Component
export {
    FooterButton
} from './FooterButton';

// Fade Footer Container Component
export {
    FadeFooterContainer
} from './FadeFooterContainer';

// Fade Header Container Component
export {
    FadeHeaderContainer
} from './FadeHeaderContainer';

// Back Button Component
export {
    BackButton
} from './BackButton';

// Animated Gradient Background Component
export {
    AnimatedGradientBackground
} from './AnimatedGradientBackground';

// Scroll-driven Gradient Background Wrapper
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

export {
    GlassCircleButton
} from './GlassCircleButton';

// Bottom Sheet Modal
export {
    AppBottomSheetModal
} from './AppBottomSheetModal';

// Blur Header Overlay
export {
    BlurHeaderOverlay,
    type BlurHeaderOverlayProps
} from './BlurHeaderOverlay';

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

// Feedback Modal
export {
    FeedbackModal,
    type FeedbackModalProps
} from './FeedbackModal';

// Referral helpers
export {
    buildReferralCode,
    buildReferralShareMessage,
    useReferralCode,
    type ReferralProfile
} from './ReferralUtils';

// Re-export theme constants for convenience
export {
    BorderRadius, BrandColors, ButtonStyles, Colors, FontFamily,
    FontSize, Shadows, Spacing
} from '@/constants/theme';
