import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const saveAnswer = mutation({
  args: {
    questionId: v.id("onboarding_questions"),
    answerId: v.optional(v.id("onboarding_question_answers")),
    answerIds: v.optional(v.array(v.id("onboarding_question_answers"))),
    freeTextAnswer: v.optional(v.string()),
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

    // Check for existing answer (upsert)
    const existing = await ctx.db
      .query("user_question_answers")
      .withIndex("by_user_and_question", (q) =>
        q.eq("user_id", user._id).eq("question_id", args.questionId)
      )
      .unique();

    const data = {
      user_id: user._id,
      question_id: args.questionId,
      answer_id: args.answerId,
      answer_ids: args.answerIds,
      free_text_answer: args.freeTextAnswer,
      answered_at: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, data);
      return existing._id;
    }

    return await ctx.db.insert("user_question_answers", data);
  },
});

export const getMyAnswers = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const clerkUserId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (!user) {
      return [];
    }

    return await ctx.db
      .query("user_question_answers")
      .withIndex("by_user_id", (q) => q.eq("user_id", user._id))
      .collect();
  },
});

export const getMyAnswerForQuestion = query({
  args: { questionId: v.id("onboarding_questions") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const clerkUserId = identity.subject;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkUserId", (q) => q.eq("clerkUserId", clerkUserId))
      .unique();

    if (!user) {
      return null;
    }

    return await ctx.db
      .query("user_question_answers")
      .withIndex("by_user_and_question", (q) =>
        q.eq("user_id", user._id).eq("question_id", args.questionId)
      )
      .unique();
  },
});
