/**
 * /profile-overlay route
 *
 * Hosts the SettingsOverlay shared-element morph as a top-level
 * route. Presented as a transparentModal with no default animation
 * (the morph spring inside the component is the only motion), so
 * destinations pushed FROM inside the overlay's rows (e.g.
 * /settings/booking-history, /payments) stack on top with the
 * standard slide-from-right transition. Back gestures and back
 * buttons reveal this overlay still mounted in its same state.
 */

import { SettingsOverlay } from "@/components/settings/SettingsOverlay";

export default function ProfileOverlayRoute() {
  return <SettingsOverlay />;
}
