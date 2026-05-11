/**
 * SettingsHomeScreen
 *
 * PURPOSE: Settings tab entry point. The render tree lives in
 *          `components/settings/SettingsContent.tsx` so the same JSX
 *          can also be hosted by the SettingsOverlay (the
 *          shared-element animation that lifts Settings on top of
 *          Home).
 *
 * USED IN: app/(main-tabs)/_layout.tsx (as a tab screen)
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from "react";
import { SettingsContent } from "@/components/settings/SettingsContent";

export default function SettingsHomeScreen() {
  return <SettingsContent />;
}
