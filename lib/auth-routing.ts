const AUTH_ENTRY_STEPS = new Set([
  "welcome",
  "signup",
  "emailSignup",
  "emailVerify",
  "login",
]);

export function shouldUseInitialHomeBack(step: string, initialBackToHome: boolean): boolean {
  return initialBackToHome && !AUTH_ENTRY_STEPS.has(step);
}

export function shouldRedirectSignedOutFromMainTabs(
  isLoaded: boolean,
  isSignedIn: boolean | undefined,
): boolean {
  return isLoaded && isSignedIn !== true;
}

/**
 * Whether a Clerk sign-in error means this device already holds a session.
 *
 * Clerk rejects a new sign-in with `session_exists` ("You're already signed
 * in.") when the client already carries a session. Seen on a real, working
 * account with unfinished setup: onboarding had walked a logged-in user back
 * to the login screen. The session is good, so callers should treat this as a
 * successful login and route on — surfacing the raw message strands the user,
 * and signing them out would throw away a valid session.
 *
 * Matches the error code first; the message is a fallback for errors that
 * arrive re-wrapped as a plain Error with only the text preserved.
 */
export function isSessionExistsError(err: unknown): boolean {
  const e = err as { errors?: { code?: string }[]; message?: unknown } | null;
  if (e?.errors?.some((x) => x?.code === "session_exists")) return true;
  return typeof e?.message === "string" && e.message.toLowerCase().includes("already signed in");
}

/**
 * Whether the native splash may be dropped.
 *
 * `authLoaded` (Clerk's `isLoaded`) only flips after a network round-trip, so
 * offline it stays false forever. Gating the splash on it alone left the app
 * covered indefinitely — a frozen launch icon with no spinner, no message and
 * no timeout, while the tree underneath was alive and rendering. `ceilingReached`
 * is the wall-clock backstop that makes the gate unwedgeable by ANY startup
 * signal, present or future.
 *
 * `fontsReady` stays a hard requirement on purpose: useAppFonts resolves from
 * bundled assets and reports ready on error too, so it always settles — with or
 * without a network — and cannot itself be the thing that hangs.
 */
export function shouldHideSplash({
  fontsReady,
  authLoaded,
  ceilingReached,
}: {
  fontsReady: boolean;
  authLoaded: boolean;
  ceilingReached: boolean;
}): boolean {
  return fontsReady && (authLoaded || ceilingReached);
}

export function shouldRunStartupRedirect({
  authLoaded,
  hasNavigated,
  rootNavigationReady,
}: {
  authLoaded: boolean;
  hasNavigated: boolean;
  rootNavigationReady: boolean;
}): boolean {
  return authLoaded && !hasNavigated && rootNavigationReady;
}

export function shouldRedirectCompletedOnboardingToHome({
  isSignedIn,
  onboardingCompleted,
  essentialOnboardingCompleted,
  isAutoResume = true,
}: {
  isSignedIn: boolean;
  onboardingCompleted?: boolean;
  essentialOnboardingCompleted?: boolean;
  isAutoResume?: boolean;
}): boolean {
  if (!isSignedIn) return false;
  if (onboardingCompleted === true) return true;
  return essentialOnboardingCompleted === true && isAutoResume;
}

export function getTrustedSavedOnboardingStep<T extends string>(
  savedStep: T | null | undefined,
  incompleteSteps: T[],
): T | null {
  if (!savedStep) return null;
  return incompleteSteps.includes(savedStep) ? savedStep : null;
}
