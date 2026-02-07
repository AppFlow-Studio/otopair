/**
 * add-payment
 *
 * PURPOSE: Route for the Add New Payment screen.
 *
 * USED IN: app/_layout.tsx
 */

import React from 'react';
import { AddPaymentScreen } from '@/components/payments/AddPaymentScreen';

export const options = {
    headerShown: false,
};

export default function AddPaymentRoute() {
    return <AddPaymentScreen />;
}
