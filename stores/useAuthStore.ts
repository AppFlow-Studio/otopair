/**
 * useAuthStore
 *
 * PURPOSE:
 * Tracks authentication/session-adjacent UI state that must survive navigation
 * transitions (especially onboarding -> main-tabs).
 *
 * USED IN:
 * Home screen, ActionCardsCarousel, and onboarding/authentication flows.
 *
 * STATE:
 *   - isNewUser (boolean):
 *       Whether the user just created an account (true) or logged in (false).
 *   - isAuthenticated (boolean):
 *       Whether the user is currently authenticated.
 *   - shouldShowReactivationSheet (boolean):
 *       One-time UI flag used after account reactivation. LoginStep sets this to
 *       true after successfully reactivating a pending-deletion account, and Home
 *       consumes then resets it after presenting the reactivation bottom sheet.
 *
 * EXAMPLE:
 *   const { isNewUser, setIsNewUser, shouldShowReactivationSheet, setShouldShowReactivationSheet } = useAuthStore();
 *   setIsNewUser(false); // Existing user login
 *   setShouldShowReactivationSheet(true); // Trigger one-time Home notification sheet
 *
 * OWNER: Ahmad Hamoudeh
 */

import { create } from 'zustand';

interface AuthState {
  // ═══════════════ STATE ═══════════════
  /** Whether the user just created an account (true) or logged in (false) */
  isNewUser: boolean;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Whether home should show reactivation notification sheet */
  shouldShowReactivationSheet: boolean;

  // ═══════════════ ACTIONS ═══════════════
  /** Set whether user is new (created account) or existing (logged in) */
  setIsNewUser: (isNew: boolean) => void;
  /** Set authentication status */
  setIsAuthenticated: (authenticated: boolean) => void;
  /** Toggle reactivation notification sheet on Home */
  setShouldShowReactivationSheet: (show: boolean) => void;
  /** Reset auth state (e.g., on logout) */
  reset: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  isNewUser: false,
  isAuthenticated: false,
  shouldShowReactivationSheet: false,

  // ═══════════════ ACTIONS ═══════════════
  setIsNewUser: (isNew: boolean) => set({ isNewUser: isNew }),
  setIsAuthenticated: (authenticated: boolean) =>
    set({ isAuthenticated: authenticated }),
  setShouldShowReactivationSheet: (show: boolean) =>
    set({ shouldShowReactivationSheet: show }),
  reset: () =>
    set({
      isNewUser: false,
      isAuthenticated: false,
      shouldShowReactivationSheet: false,
    }),
}));

