/**
 * useUserFromConvex
 *
 * Fetches the current authenticated user from Convex (via Clerk identity).
 * Use for userId in booking mutations and other Convex operations.
 *
 * USED IN: Booking flow, profile, vehicle ownership
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useUserFromConvex() {
  const user = useQuery(api.users.getMe);

  return {
    user,
    userId: user?._id as Id<"users"> | null | undefined,
    isLoading: user === undefined,
    isAuthenticated: user !== null && user !== undefined,
  };
}
