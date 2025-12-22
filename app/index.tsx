/**
 * index
 *
 * PURPOSE: Redirects to the onboarding flow.
 *
 * USED IN: app/_layout.tsx
 *
 * PROPS: None
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import { Redirect } from "expo-router";

export default function Index() {
    return <Redirect href="/(onboarding)" />;
}