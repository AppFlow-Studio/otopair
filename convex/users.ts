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
 *   - Has-many: onboarding_questions_answers (via user_id)
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
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (!user) return null;

    // If the user has a storage ID, generate a temporary URL for it
    let profile_photo_url = user.profile_photo_url;
    if (user.profile_photo_storage_id) {
      const url = await ctx.storage.getUrl(user.profile_photo_storage_id);
      if (url) profile_photo_url = url;
    }

    return {
      ...user,
      profile_photo_url,
    };
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
 *     profile_photo_url: string,
 *     onboardingCompleted: boolean,
 *     tellUsAboutCompleted: boolean,
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
 * Called on app startup and after login to initialize/sync user account.
 *
 * Pulls profile data from the Clerk identity token so the Convex
 * record stays in sync with Clerk (email, name, picture, verification).
 *
 * VALIDATION:
 *   - Must be authenticated via Clerk
 *   - Uses identity.subject (clerkUserId) for lookup
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
    console.log("clerkUserId", clerkUserId);
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (existing) {
      // Sync key fields from Clerk on every login so Convex stays current
      const updates: Record<string, any> = {};
      if (identity.email && existing.email !== identity.email) {
        updates.email = identity.email;
      }
      if (identity.emailVerified !== undefined && existing.emailConfirmed !== identity.emailVerified) {
        updates.emailConfirmed = identity.emailVerified;
      }
      if (identity.givenName && !existing.first_name) {
        updates.first_name = identity.givenName;
      }
      if (identity.familyName && !existing.last_name) {
        updates.last_name = identity.familyName;
      }
      if (identity.pictureUrl && !existing.profile_photo_url && !existing.profile_photo_storage_id) {
        updates.profile_photo_url = identity.pictureUrl;
      }

      if (Object.keys(updates).length > 0) {
        await ctx.db.patch(existing._id, updates);
        return await ctx.db.get(existing._id);
      }
      return existing;
    }

    // New user — seed with everything Clerk provides
    const userId = await ctx.db.insert("users", {
      clerkUserId,
      email: identity.email || undefined,
      emailConfirmed: identity.emailVerified || undefined,
      first_name: identity.givenName || undefined,
      last_name: identity.familyName || undefined,
      profile_photo_url: identity.pictureUrl || undefined,
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
    auth_provider: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerified: v.optional(v.boolean()),
    email: v.optional(v.string()),
    emailConfirmed: v.optional(v.boolean()),
    first_name: v.optional(v.string()),
    last_name: v.optional(v.string()),
    profile_photo_url: v.optional(v.union(v.string(), v.null())),
    profile_photo_storage_id: v.optional(v.union(v.string(), v.null())),
    tellUsAboutCompleted: v.optional(v.boolean()),
    language: v.optional(v.string()),
    units: v.optional(v.string()),
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
    if (args.auth_provider !== undefined) updates.auth_provider = args.auth_provider;
    if (args.phone !== undefined) updates.phone = args.phone;
    if (args.phoneVerified !== undefined) updates.phoneVerified = args.phoneVerified;
    if (args.email !== undefined) updates.email = args.email;
    if (args.emailConfirmed !== undefined) updates.emailConfirmed = args.emailConfirmed;
    if (args.first_name !== undefined) updates.first_name = args.first_name;
    if (args.last_name !== undefined) updates.last_name = args.last_name;
    if (args.profile_photo_url !== undefined) updates.profile_photo_url = args.profile_photo_url;
    if (args.profile_photo_storage_id !== undefined) updates.profile_photo_storage_id = args.profile_photo_storage_id;
    if (args.tellUsAboutCompleted !== undefined) updates.tellUsAboutCompleted = args.tellUsAboutCompleted;
    if (args.language !== undefined) updates.language = args.language;
    if (args.units !== undefined) updates.units = args.units;

    if (Object.keys(updates).length === 0) {
      return user;
    }

    updates.lastUpdated = Date.now();
    return await ctx.db.patch(user._id, updates);
  },
});

/**
 * MUTATION: generateUploadUrl
 * Generates a short-lived URL for uploading files to Convex storage.
 */
export const generateUploadUrl = mutation(async (ctx) => {
  return await ctx.storage.generateUploadUrl();
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

    await ctx.db.patch(user._id, { onboardingCompleted: true, lastUpdated: Date.now() });
    return await ctx.db.get(user._id);
  },
});
