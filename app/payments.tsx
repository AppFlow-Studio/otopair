/**
 * payments
 *
 * PURPOSE: Displays the payment methods screen.
 *
 * USED IN: app/_layout.tsx
 *
 * PROPS: None
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React from 'react';
import { ActivityRewardsScreen } from '@/components/payments/ActivityRewardsScreen';

export const options = {
    headerShown: false,
};

export default function ActivityAndRewardsScreen() {
    return <ActivityRewardsScreen />;
}

