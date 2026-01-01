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
import { PaymentsScreen } from '@/components/payments/PaymentsScreen';

export const options = {
    headerShown: false,
};

export default function PaymentMethodsScreen() {
    return <PaymentsScreen />;
}

