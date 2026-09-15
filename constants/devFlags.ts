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
export const FORCE_COACH_MARKS_EVERY_LAUNCH = __DEV__ && true;
