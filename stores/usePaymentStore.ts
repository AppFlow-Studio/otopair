/**
 * usePaymentStore
 *
 * PURPOSE: Manages user's saved payment methods for booking payments
 *
 * TABLES: PaymentMethods (future integration with Stripe/payment provider)
 *
 * RELATIONSHIPS:
 *   - PaymentMethod belongs to User
 *
 * OWNER: Waleed Mansour
 */

import { create } from "zustand";
import type { PaymentMethod } from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

interface PaymentState {
  // ═══════════════ STATE ═══════════════
  /** All saved payment methods */
  paymentMethods: PaymentMethod[];
  /** Currently selected payment method ID for checkout */
  selectedPaymentMethodId: string | null;
  /** Loading state for payment operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // ═══════════════ ACTIONS ═══════════════
  /** Add a new payment method */
  addPaymentMethod: (paymentMethod: PaymentMethod) => void;
  /** Remove a payment method by ID */
  removePaymentMethod: (paymentMethodId: string) => void;
  /** Set a payment method as default */
  setDefaultPaymentMethod: (paymentMethodId: string) => void;
  /** Select a payment method for current checkout */
  selectPaymentMethod: (paymentMethodId: string | null) => void;
  /** Set loading state */
  setLoading: (loading: boolean) => void;
  /** Set error state */
  setError: (error: string | null) => void;
  /** Clear all payment methods (e.g., on logout) */
  clearPaymentMethods: () => void;

  // ═══════════════ GETTERS ═══════════════
  /** Get the default payment method */
  getDefaultPaymentMethod: () => PaymentMethod | null;
  /** Get the currently selected payment method */
  getSelectedPaymentMethod: () => PaymentMethod | null;
  /** Check if user has any payment methods */
  hasPaymentMethods: () => boolean;
}

// ─────────────────────────────────────────────────────────────
// STORE IMPLEMENTATION
// ─────────────────────────────────────────────────────────────

export const usePaymentStore = create<PaymentState>()((set, get) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  paymentMethods: [],
  selectedPaymentMethodId: null,
  isLoading: false,
  error: null,

  // ═══════════════ ACTIONS ═══════════════
  addPaymentMethod: (paymentMethod) =>
    set((state) => {
      // If this is the first payment method or is marked as default, set it as default
      const isFirstMethod = state.paymentMethods.length === 0;
      const updatedPaymentMethod = {
        ...paymentMethod,
        isDefault: isFirstMethod || paymentMethod.isDefault,
      };

      // If new method is default, unset other defaults
      const updatedMethods = paymentMethod.isDefault
        ? state.paymentMethods.map((pm) => ({ ...pm, isDefault: false }))
        : state.paymentMethods;

      return {
        paymentMethods: [...updatedMethods, updatedPaymentMethod],
        // Auto-select if it's the first one
        selectedPaymentMethodId: isFirstMethod ? paymentMethod.id : state.selectedPaymentMethodId,
      };
    }),

  removePaymentMethod: (paymentMethodId) =>
    set((state) => {
      const filteredMethods = state.paymentMethods.filter((pm) => pm.id !== paymentMethodId);

      // If we removed the default, set the first remaining as default
      const hasDefault = filteredMethods.some((pm) => pm.isDefault);
      if (!hasDefault && filteredMethods.length > 0) {
        filteredMethods[0].isDefault = true;
      }

      return {
        paymentMethods: filteredMethods,
        // Clear selection if we removed the selected method
        selectedPaymentMethodId:
          state.selectedPaymentMethodId === paymentMethodId
            ? filteredMethods[0]?.id ?? null
            : state.selectedPaymentMethodId,
      };
    }),

  setDefaultPaymentMethod: (paymentMethodId) =>
    set((state) => ({
      paymentMethods: state.paymentMethods.map((pm) => ({
        ...pm,
        isDefault: pm.id === paymentMethodId,
      })),
    })),

  selectPaymentMethod: (paymentMethodId) =>
    set({
      selectedPaymentMethodId: paymentMethodId,
    }),

  setLoading: (loading) =>
    set({
      isLoading: loading,
    }),

  setError: (error) =>
    set({
      error,
    }),

  clearPaymentMethods: () =>
    set({
      paymentMethods: [],
      selectedPaymentMethodId: null,
      error: null,
    }),

  // ═══════════════ GETTERS ═══════════════
  getDefaultPaymentMethod: () => {
    const { paymentMethods } = get();
    return paymentMethods.find((pm) => pm.isDefault) ?? null;
  },

  getSelectedPaymentMethod: () => {
    const { paymentMethods, selectedPaymentMethodId } = get();
    if (!selectedPaymentMethodId) {
      // Fallback to default
      return paymentMethods.find((pm) => pm.isDefault) ?? null;
    }
    return paymentMethods.find((pm) => pm.id === selectedPaymentMethodId) ?? null;
  },

  hasPaymentMethods: () => {
    const { paymentMethods } = get();
    return paymentMethods.length > 0;
  },
}));





