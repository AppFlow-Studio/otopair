import { internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

/**
 * INTERNAL MUTATION: getExpiredDeletions
 * Finds users whose account deletion grace period (30 days) has expired.
 */
export const getExpiredDeletions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    
    const expiredUsers = await ctx.db
      .query("users")
      .withIndex("by_isPendingDeletion", (q) => q.eq("isPendingDeletion", true))
      .filter((q) => q.lt(q.field("deletionRequestedAt"), thirtyDaysAgo))
      .collect();

    return expiredUsers.map(u => ({ id: u._id, clerkUserId: u.clerkUserId }));
  },
});

/**
 * INTERNAL MUTATION: deleteUserRecord
 * Permanently deletes a user record from Convex.
 */
export const deleteUserRecord = internalMutation({
  args: { id: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

/**
 * ACTION: cleanupExpiredAccounts
 * Orchestrates the permanent deletion of accounts that have passed the 30-day grace period.
 * This should be called by a cron job.
 */
export const cleanupExpiredAccounts = internalAction({
  args: {},
  handler: async (ctx) => {
    const expiredUsers = await ctx.runMutation(internal.cleanup.getExpiredDeletions);
    
    for (const user of expiredUsers) {
      try {
        console.log(`Permanently deleting user ${user.id} (Clerk: ${user.clerkUserId})`);
        
        // 1. Delete from Clerk via Backend API
        // NOTE: This requires CLERK_SECRET_KEY to be set in Convex environment variables.
        const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
        if (CLERK_SECRET_KEY) {
          const response = await fetch(`https://api.clerk.com/v1/users/${user.clerkUserId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${CLERK_SECRET_KEY}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (!response.ok) {
            const error = await response.json();
            console.error(`Failed to delete user from Clerk: ${JSON.stringify(error)}`);
            // We continue anyway to clean up Convex, or you might want to skip.
          }
        } else {
          console.warn("CLERK_SECRET_KEY not set in Convex environment variables. Skipping Clerk deletion.");
        }

        // 2. Delete from Convex
        await ctx.runMutation(internal.cleanup.deleteUserRecord, { id: user.id });
        
      } catch (error) {
        console.error(`Error cleaning up user ${user.id}:`, error);
      }
    }
  },
});
