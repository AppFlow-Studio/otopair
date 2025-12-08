/**
 * OnboardingFooterButton
 *
 * PURPOSE: Reusable full-width CTA button used at the bottom of onboarding screens.
 *
 * USED IN: Onboarding slides (e.g., Welcome, CarExperience, OilChange, Brakes, Inspection)
 *
 * PROPS:
 *   - label (string): Text to display inside the button.
 *   - onPress (() => void): Handler when the button is pressed.
 *   - disabled (boolean): Disable state.
 *   - rightIcon (ReactNode): Optional right icon.
 *
 * EXAMPLE:
 *   <OnboardingFooterButton
 *     label="Next"
 *     onPress={handleNext}
 *     disabled={!canProceed}
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-010
 */

import { ReactNode } from 'react';
import { Button, BorderRadius, Spacing } from '@/components/shared-ui';

interface OnboardingFooterButtonProps {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    rightIcon?: ReactNode;
    size?: 'sm' | 'md' | 'lg';
    paddingVertical?: number;
}

export function OnboardingFooterButton({
    label,
    onPress,
    disabled = false,
    rightIcon,
    size = 'lg',
    paddingVertical,
}: OnboardingFooterButtonProps) {
    return (
        <Button
            fullWidth
            size={size}
            borderRadius={BorderRadius.full}
            paddingVertical={paddingVertical ?? Spacing.lg}
            onPress={onPress}
            disabled={disabled}
            rightIcon={rightIcon}
        >
            {label}
        </Button>
    );
}


