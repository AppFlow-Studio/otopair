/**
 * FooterButton
 *
 * PURPOSE: Reusable full-width CTA button used at the bottom of flow screens.
 *
 * USED IN: Various flow steps (Onboarding, TellUsAbout, etc.).
 *
 * PROPS:
 *   - label (string): Text to display inside the button.
 *   - onPress (() => void): Handler when the button is pressed.
 *   - disabled (boolean): Disable state [optional]
 *   - rightIcon (ReactNode): Optional right icon [optional]
 *   - size ('sm' | 'md' | 'lg'): Button size [optional, default: 'lg']
 *   - paddingVertical (number): Custom vertical padding [optional]
 *   - variant ('primary' | 'secondary' | 'ghost'): Button variant [optional, default: 'primary']
 *   - backgroundColor (string): Custom background color [optional]
 *   - textColor (string): Custom text color [optional]
 *   - fullWidth (boolean): Whether the button should take full width [optional, default: true]
 *   - style (ViewStyle): Custom style for the button container [optional]
 *
 * EXAMPLE:
 *   <FooterButton
 *     label="Next"
 *     onPress={handleNext}
 *     disabled={!canProceed}
 *     variant="secondary"
 *     size="md"
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import { ReactNode } from 'react';
import { Button } from './Button';
import { BorderRadius, Spacing } from '@/constants/theme';

interface FooterButtonProps {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    leftIcon?: ReactNode;
    rightIcon?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    paddingVertical?: number;
    variant?: 'primary' | 'secondary'| 'ghost';
    backgroundColor?: string;
    textColor?: string;
    fullWidth?: boolean;
    style?: any;
}

export function FooterButton({
    label,
    onPress,
    disabled = false,
    leftIcon,
    rightIcon,
    size = 'lg',
    paddingVertical,
    variant = 'primary',
    backgroundColor,
    textColor,
    fullWidth = true,
    style,
}: FooterButtonProps) {
    return (
        <Button
            fullWidth={fullWidth}
            size={size}
            borderRadius={BorderRadius.full}
            paddingVertical={paddingVertical ?? Spacing.lg}
            onPress={onPress}
            disabled={disabled}
            leftIcon={leftIcon}
            rightIcon={rightIcon}
            variant={variant}
            backgroundColor={backgroundColor}
            textColor={textColor}
            style={style}
        >
            {label}
        </Button>
    );
}

