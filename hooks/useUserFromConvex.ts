/**
 * useUserFromConvex
 *
 * Fetches the current authenticated user from Convex (via Clerk identity).
 * Use for userId in booking mutations and other Convex operations.
 *
 * USED IN: Booking flow, profile, vehicle ownership
 */

import { useQuery } from "convex/react";
import { useAuth } from "@clerk/clerk-expo";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export function useUserFromConvex() {
  const { isLoaded, isSignedIn, userId: clerkUserId } = useAuth();
  const user = useQuery(api.users.getMe, isLoaded && isSignedIn ? undefined : "skip");
  const isCurrentUser =
    user != null && clerkUserId != null && user.clerkUserId === clerkUserId;
  const currentUser = isCurrentUser ? user : null;
  const isLoading =
    !isLoaded ||
    (isSignedIn === true && (user === undefined || (user != null && !isCurrentUser)));

  return {
    user: currentUser,
    userId: currentUser?._id as Id<"users"> | null | undefined,
    isLoading,
    isAuthenticated: currentUser !== null,
  };
}
