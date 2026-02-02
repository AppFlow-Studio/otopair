/**
 * users.ts - User Account Management
 *
 * DESCRIPTION:
 * Manages user accounts for the platform.
 * Users are vehicle owners seeking maintenance services.
 * Authentication is handled via Clerk (third-party auth provider).
 *
 * TABLE: users
 *   - Stores user profiles and authentication info
 *   - Linked to Clerk for auth (clerkUserId)
 *   - Tracks onboarding completion
 *   - Stores vehicle knowledge level and preferences
 *
 * KEY RELATIONSHIPS:
 *   - Has-many: bookings (via user_id)
 *   - Has-many: payments (via user_id)
 *   - Has-many: vehicle_owners (via user_id)
 *   - Has-many: reviews (via user_id)
 *   - Has-many: ai_conversations (via user_id)
 *   - Has-many: user_question_answers (via user_id)
 *   - Has-many: analytics_events (via user_id)
 *
 * USE CASES:
 *   1. User authentication and sign-up
 *   2. Profile management
 *   3. Vehicle ownership tracking
 *   4. Booking history
 *   5. Review submissions
 *
 * OWNER: User Management Team
 */

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * QUERY: list
 * Returns all users in the system.
 * Use with caution - consider access control in production.
 */
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

/**
 * QUERY: getMe
 * Get current authenticated user (by Clerk identity).
 * Returns null if not authenticated.
 */
export const getMe = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const clerkUserId = identity.subject;
    return await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();
  },
});

/**
 * QUERY: getById
 * Fetch a specific user by ID.
 *
 * ARGS:
 *   - id: User ID
 *
 * RETURNS:
 *   {
 *     _id: user id,
 *     clerkUserId: string,
 *     email: string,
 *     phone: string,
 *     first_name: string,
 *     last_name: string,
 *     username: string,
 *     profile_photo_url: string,
 *     car_knowledge_level: number (1-5),
 *     onboardingCompleted: boolean,
 *     tellUsAboutCompleted: boolean,
 *     user_intentions: string[],
 *     ... other fields
 *   }
 */
export const getById = query({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

/**
 * MUTATION: getOrCreateMe
 * Get current authenticated user or create if doesn't exist.
 * Called on app startup to initialize user account.
 *
 * VALIDATION:
 *   - Must be authenticated via Clerk
 *   - Uses identity.subject (clerkUserId) for lookup
 *
 * RETURNS:
 *   {
 *     _id: user id,
 *     clerkUserId: string,
 *     onboardingCompleted: false,
 *     createdAt: timestamp,
 *     ... other fields
 *   }
 *
 * THROWS:
 *   - "Not authenticated": If no auth identity found
 */
export const getOrCreateMe = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkUserId = identity.subject;

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (existing) {
      return existing;
    }

    const userId = await ctx.db.insert("users", {
      clerkUserId,
      onboardingCompleted: false,
      createdAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});
