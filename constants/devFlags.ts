/**
 * devFlags — switches that exist only to make something easier to look at
 * while building it.
 *
 * Every flag here is ANDed with `__DEV__`, so none of them can survive into a
 * release build even if one is left switched on. That matters because the
 * lead owns the TestFlight builds — a flag that could leak into one would be
 * a flag someone else has to discover.
 *
 * Flip a flag to `false` to turn it off; delete it once the thing it was for
 * is finished.
 *
 * ALL OF THESE SHIP OFF. They are ANDed with `__DEV__` so they cannot reach a
 * release build at all, but QA runs dev builds too — a flag left on here is a
 * flag a tester will hit and report as a bug. If you switch one on while
 * working, switch it back before handing the build over.
 */

/**
 * Replay the new-user tutorial on every launch, regardless of whether this
 * account has already seen it.
 *
 * Normally the overlay is gated on `users.tutorialSeenAt`, which is stamped
 * the first time the tour is completed or skipped — correct for real users,
 * useless for looking at the thing repeatedly. With this on, the stamp is
 * ignored AND not written, so an account used for testing does not end up
 * marked as having seen a tour it is about to be shown again.
 *
 * Dismissing still closes it for the rest of the session; it comes back on
 * the next reload.
 */
export const FORCE_TUTORIAL_EVERY_LAUNCH = __DEV__ && false;

/**
 * Replay the in-app spotlight tour (components/coach) on every launch.
 *
 * The real gate is an AsyncStorage stamp written when the tour finishes or
 * is skipped. With this on the stamp is ignored AND not written, for the
 * same reason as the flag above: an account used for testing should not end
 * up marked as having seen a tour it is about to be shown again.
 */
export const FORCE_COACH_MARKS_EVERY_LAUNCH = __DEV__ && false;

/**
 * Always open on Home, ignoring the route a reload restored.
 *
 * Expo Router keeps the current URL across a dev reload, so reloading while
 * three screens deep into the booking flow drops you back in three screens
 * deep — with whatever half-state that screen expects already gone. A cold
 * start in production always lands on Home, so this is dev catching up with
 * how the app actually behaves for a driver, not a behaviour change.
 */
export const START_AT_HOME_ON_RELOAD = __DEV__ && false;

/**
 * Start the spotlight tour on a given step instead of the first one.
 *
 * Each step points at a different element on a different tab, and the only
 * way to check an anchor is to look at it. Without this, checking step 4
 * means tapping through three others every reload.
 *
 * 0 is the real behaviour. Leave it there.
 */
export const COACH_START_STEP = __DEV__ ? 0 : 0;

/**
 * Show the walk-in claim flow's "new vs existing customer" chooser.
 *
 * Built so both branches could be demoed from one link without signing in and
 * out between takes. It is not a real screen: a tester who taps through it is
 * choosing a branch the app would otherwise pick from their auth state, and
 * whatever they report about that flow is then about a state they selected.
 */
export const WALKIN_DEMO_CHOOSER = __DEV__ && false;
