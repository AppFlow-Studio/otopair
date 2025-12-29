/**
 * payment-methods
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
import { PaymentMethodsMock } from '@/components/payments/PaymentMethodsMock';

export const options = {
    headerShown: false,
};

export default function PaymentMethodsScreen() {
    return <PaymentMethodsMock />;
}


