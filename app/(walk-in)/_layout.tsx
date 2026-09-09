/**
 * (walk-in) layout
 *
 * PURPOSE: Stack for the walk-in first-run preview — the screens a customer
 *          created by a shop sees the first time they open the app.
 *
 * ENTRY: `otopair://claim/<token>` → `app/claim/[token]` resolves the token
 *        and replaces into this group. Nothing else routes here, so a user
 *        without a claim link never sees these screens.
 *
 * OWNER: Ahmad Hamoudeh
 */

import { Stack } from 'expo-router';

export default function WalkInLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // The flow is a single visual sequence; the default push keeps the
        // horizontal motion that matches the rest of the app.
        animation: 'slide_from_right',
      }}
    />
  );
}
