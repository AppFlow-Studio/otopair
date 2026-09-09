# Auth & Session Handling

**Last updated:** February 2026

Clerk + Convex auth, session persistence, and redirect behavior for signed-in users.

---

## Session persistence

- **Provider:** [app/\_layout.tsx](../app/_layout.tsx) wraps the app in `<ClerkProvider tokenCache={tokenCache}>`.
- **Token cache:** `tokenCache` from `@clerk/clerk-expo/token-cache` uses **expo-secure-store** (keychain/Keystore) so auth tokens are stored securely and **survive app restart**.
- **Entry routing:** [app/index.tsx](../app/index.tsx) is auth-aware: if `isLoaded` and `isSignedIn`, it redirects to home (or onboarding if not completed); otherwise to `/(onboarding)`.

**Dev note:** Metro/Expo fast refresh can sometimes clear in-memory state before Clerk re-reads from SecureStore. If the session appears lost on hot reload, do a **full app restart** (close and reopen). On device or production build, persistence works across restarts.

---

## Logout (clear token)

- **Where:** Settings → top-left 3-dots menu → **Logout** → confirm.
- **Behavior:** [app/(main-tabs)/settings/index.tsx](<../app/(main-tabs)/settings/index.tsx>) `handleConfirmLogout` calls **Clerk `signOut()`** so the session and token are cleared (including from the token cache / expo-secure-store). Then it resets `useAuthStore` and `useOnboardingStore` and navigates to `/(onboarding)`.

---

## Redirect when already signed in

There is no dedicated “welcome back” screen. If a user is **already signed in** and lands on any login step, they are redirected **straight to home** and never see the login form.

| Step                               | File                                                                                    | Behavior                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Login (OAuth + Email)              | [LoginStep.tsx](../components/onboarding/steps/LoginStep.tsx)                           | `useEffect`: if `isLoaded && isSignedIn` → `router.replace('/(main-tabs)/home')` |
| Email/password login               | [EmailPasswordLoginStep.tsx](../components/onboarding/steps/EmailPasswordLoginStep.tsx) | Same redirect when already signed in                                             |
| Welcome (create vs log in)         | [WelcomeStep.tsx](../components/onboarding/steps/WelcomeStep.tsx)                       | Same redirect when already signed in                                             |
| Login methods (Email/Google/Apple) | [LoginMethodsStep.tsx](../components/onboarding/steps/LoginMethodsStep.tsx)             | Same redirect when already signed in                                             |

So in normal flow: **signed in → go directly to home**; login screens are only shown when not signed in.

---

## Convex user sync

- **EnsureConvexUserRecord** in [app/\_layout.tsx](../app/_layout.tsx) runs when `isSignedIn && userId` and calls `users.getOrCreateMe` so the Convex `users` row exists for the Clerk user.
- Retries with backoff if Convex returns "Not authenticated" (JWT propagation delay). The hook waits for a Convex JWT and performs one short retry if Convex still rejects.
- **SyncAuthStoreWithClerk** in [app/\_layout.tsx](../app/_layout.tsx) mirrors Clerk session state into `useAuthStore.isAuthenticated` so UI depending on the local store stays accurate.
- All login/signup steps now call `useEnsureConvexUser` (token-aware) instead of invoking `users.getOrCreateMe` directly.

---

## Troubleshooting: "Not authenticated" during login

- A single "Not authenticated" immediately followed by `Ensured Convex user via RootLayout` is expected when the JWT is still propagating; no action needed.
- If the message repeats, verify `CLERK_JWT_ISSUER_DOMAIN` matches the Clerk JWT template and that you are signed in. Restarting the app refreshes tokens.

---

## Related

- **Auth store:** [stores/useAuthStore.ts](../stores/useAuthStore.ts) — `isNewUser`, `isAuthenticated`, `reset` for onboarding/UI.
- **Clerk + Convex:** [convex/auth.config.ts](../convex/auth.config.ts) — Convex auth config for Clerk.
