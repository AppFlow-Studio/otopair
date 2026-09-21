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
