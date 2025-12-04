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

// Re-export theme constants for convenience
export {
    BorderRadius, BrandColors, ButtonStyles, Colors, FontFamily,
    FontSize, Shadows, Spacing
} from '@/constants/theme';

