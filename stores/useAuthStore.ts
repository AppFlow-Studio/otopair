/**
 * useAuthStore
 *
 * PURPOSE: Tracks user authentication state and whether user is new (created account) vs existing (logged in)
 *
 * USED IN: Home screen, ActionCardsCarousel, and authentication flows
 *
 * STATE:
 *   - isNewUser (boolean): Whether the user just created an account (true) or logged in (false)
 *   - isAuthenticated (boolean): Whether the user is logged in
 *
 * EXAMPLE:
 *   const { isNewUser, setIsNewUser } = useAuthStore();
 *   setIsNewUser(true); // When user creates account
 *   setIsNewUser(false); // When user logs in
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

  // ═══════════════ ACTIONS ═══════════════
  /** Set whether user is new (created account) or existing (logged in) */
  setIsNewUser: (isNew: boolean) => void;
  /** Set authentication status */
  setIsAuthenticated: (authenticated: boolean) => void;
  /** Reset auth state (e.g., on logout) */
  reset: () => void;
}

export const useAuthStore = create<AuthState>()((set) => ({
  // ═══════════════ INITIAL STATE ═══════════════
  isNewUser: false,
  isAuthenticated: false,

  // ═══════════════ ACTIONS ═══════════════
  setIsNewUser: (isNew: boolean) => set({ isNewUser: isNew }),
  setIsAuthenticated: (authenticated: boolean) =>
    set({ isAuthenticated: authenticated }),
  reset: () =>
    set({
      isNewUser: false,
      isAuthenticated: false,
    }),
}));

