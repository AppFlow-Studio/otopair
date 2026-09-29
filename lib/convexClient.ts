import { ConvexReactClient } from "convex/react";

let client: ConvexReactClient | null = null;

/**
 * The app's one Convex client. `app/_layout.tsx` hands it to the provider;
 * plain modules that aren't components (e.g. utils/vehicleImage.ts) call
 * Convex through it without a hook, sharing the provider's auth.
 *
 * Built on first use rather than at import, so those modules stay importable
 * where there's no deployment URL (the vitest suite).
 */
export function getConvexClient(): ConvexReactClient {
  client ??= new ConvexReactClient(process.env.EXPO_PUBLIC_CONVEX_URL!, {
    unsavedChangesWarning: false,
  });
  return client;
}
