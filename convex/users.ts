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

/**
 * MUTATION: updateProfile
 * Update the current user's profile (used by onboarding persistence).
 * Only updates fields that are provided; must be authenticated.
 *
 * THROWS:
 *   - "Not authenticated": If no auth identity found
 *   - "User not found": If no Convex user record for this Clerk user
 */
export const updateProfile = mutation({
  args: {
    phone: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    email: v.optional(v.string()),
    emailConfirmed: v.optional(v.boolean()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    profile_photo_url: v.optional(v.string()),
    user_intentions: v.optional(v.array(v.string())),
    tellUsAboutCompleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkUserId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.phoneVerified !== undefined) updates.phoneVerified = args.phoneVerified;
    if (args.email !== undefined) updates.email = args.email;
    if (args.emailConfirmed !== undefined) updates.emailConfirmed = args.emailConfirmed;
    if (args.first_name !== undefined) updates.first_name = args.first_name;
    if (args.last_name !== undefined) updates.last_name = args.last_name;
    if (args.profile_photo_url !== undefined) updates.profile_photo_url = args.profile_photo_url;
    if (args.user_intentions !== undefined) updates.user_intentions = args.user_intentions;
    if (args.tellUsAboutCompleted !== undefined) updates.tellUsAboutCompleted = args.tellUsAboutCompleted;

    if (Object.keys(updates).length === 0) {
      return user;
    }

    await ctx.db.patch(user._id, updates);
    return await ctx.db.get(user._id);
  },
});

/**
 * MUTATION: completeOnboarding
 * Set onboardingCompleted to true for the current user.
 * Called when the user finishes the onboarding flow (Daniel's onboarding integration).
 *
 * THROWS:
 *   - "Not authenticated": If no auth identity found
 *   - "User not found": If no Convex user record for this Clerk user
 */
export const completeOnboarding = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const clerkUserId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(user._id, { onboardingCompleted: true });
    return await ctx.db.get(user._id);
  },
});
