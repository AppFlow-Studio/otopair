/**
 * usePaymentStore
 *
 * Local UI-state mirror of the user's saved Stripe card list + which one is
 * selected for the active booking. Stripe is the source of truth — the list
 * is hydrated from `usePaymentMethodsFromConvex` (via
 * `StripePaymentMethodsSync` in the root layout); writes here are display-
 * only and don't reach Stripe.
 *
 * Mutating Stripe (save / detach / set default) goes through the
 * `api.payments_stripe.*` actions, not this store.
 */

import { create } from "zustand";
import type { PaymentMethod, Transaction } from "./types/store.types";

// ─────────────────────────────────────────────────────────────
// STORE STATE INTERFACE
// ─────────────────────────────────────────────────────────────

/** Transient handle to a one-time wallet PM (Apple Pay / Google Pay) that
 *  the user just authorized for the current booking. Lives only between
 *  the wallet sheet acknowledgment on `/payment` and the
 *  `createPaymentIntentForBooking` call on `/confirming`; cleared after
 *  consumption so the next booking starts clean. NOT persisted, NOT part
 *  of the saved-cards list. */
export type SelectedWalletPm = {
  id: string;
  type: "apple_pay" | "google_pay";
};

interface PaymentState {
  // ═══════════════ STATE ═══════════════
  /** All saved payment methods */
  paymentMethods: PaymentMethod[];
  /** All transactions / recent activity */
  transactions: Transaction[];
  /** Currently selected payment method ID for checkout */
  selectedPaymentMethodId: string | null;
  /** Which method the customer picked to authorize with. `null` means "the
   *  selected saved card"; a wallet value means the single Authorize button
   *  should launch that platform's wallet sheet instead of the card path.
   *  Set by the payment-method picker, read by the Authorize CTA. This is a
   *  pre-mint *intent* — distinct from `selectedWalletPm`, which is the
   *  post-mint one-time PM handed to `/confirming`. */
  walletIntent: "apple_pay" | "google_pay" | null;
  /** Wallet PM minted by Apple Pay / Google Pay for the in-flight booking.
   *  See SelectedWalletPm — single-use, cleared by `/confirming`. */
  selectedWalletPm: SelectedWalletPm | null;
  /** Loading state for payment operations */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;

  // ═══════════════ ACTIONS ═══════════════
  /** Add a new payment method */
  addPaymentMethod: (paymentMethod: PaymentMethod) => void;
  /** Update an existing payment method */
  updatePaymentMethod: (paymentMethodId: string, updates: Partial<PaymentMethod>) => void;
  /** Remove a payment method by ID */
  removePaymentMethod: (paymentMethodId: string) => void;
  /** Set a payment method as default */
  setDefaultPaymentMethod: (paymentMethodId: string) => void;
  /** Select a payment method for current checkout */
  selectPaymentMethod: (paymentMethodId: string | null) => void;
  /** Set which method the Authorize button should use. Pass a wallet type to
   *  route Authorize through the platform wallet sheet, or `null` to fall
   *  back to the selected saved card. */
  setWalletIntent: (walletIntent: "apple_pay" | "google_pay" | null) => void;
  /** Stash a freshly-minted wallet PM (Apple Pay / Google Pay) for the
   *  active booking. Pass `null` to clear after `/confirming` consumes it
   *  or when the user cancels the wallet sheet. */
  setSelectedWalletPm: (wallet: SelectedWalletPm | null) => void;
  /** Replace the saved-methods list with the canonical Stripe list */
  hydratePaymentMethods: (paymentMethods: PaymentMethod[]) => void;
  /** Bumps a counter that `StripePaymentMethodsSync` watches; use after
   *  adding or removing a card so the list re-pulls from Stripe. */
  bumpPaymentMethodsRefresh: () => void;
  /** Counter read by the sync component to trigger a Stripe re-fetch. */
  paymentMethodsRefreshKey: number;
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
  // paymentMethods is hydrated by StripePaymentMethodsSync at app startup.
  paymentMethods: [],
  transactions: [],
  selectedPaymentMethodId: null,
  walletIntent: null,
  selectedWalletPm: null,
  paymentMethodsRefreshKey: 0,
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

  updatePaymentMethod: (paymentMethodId, updates) =>
    set((state) => ({
      paymentMethods: state.paymentMethods.map((pm) =>
        pm.id === paymentMethodId ? { ...pm, ...updates } : pm
      ),
    })),

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

  setWalletIntent: (walletIntent) =>
    set({
      walletIntent,
    }),

  setSelectedWalletPm: (wallet) =>
    set({
      selectedWalletPm: wallet,
    }),

  bumpPaymentMethodsRefresh: () =>
    set((state) => ({ paymentMethodsRefreshKey: state.paymentMethodsRefreshKey + 1 })),

  hydratePaymentMethods: (paymentMethods) =>
    set((state) => {
      // Preserve current selection if it still exists, otherwise fall back
      // to default → first → null.
      const existingSelection = state.selectedPaymentMethodId;
      const stillThere = paymentMethods.some((pm) => pm.id === existingSelection);
      const nextSelected = stillThere
        ? existingSelection
        : (paymentMethods.find((pm) => pm.isDefault)?.id ?? paymentMethods[0]?.id ?? null);
      return {
        paymentMethods,
        selectedPaymentMethodId: nextSelected,
      };
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
      walletIntent: null,
      selectedWalletPm: null,
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





