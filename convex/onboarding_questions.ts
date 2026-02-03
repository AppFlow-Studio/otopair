import { query } from "./_generated/server";
import { v } from "convex/values";

export const listByRank = query({
  args: { rank: v.number() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("onboarding_questions")
      .withIndex("by_rank", (q) => q.eq("rank", args.rank))
      .filter((q) => q.eq(q.field("is_active"), true))
      .collect();
  },
});

export const listByStepName = query({
  args: { stepName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("onboarding_questions")
      .withIndex("by_step_name", (q) => q.eq("step_name", args.stepName))
      .filter((q) => q.eq(q.field("is_active"), true))
      .collect();
  },
});

export const getAnswersForQuestion = query({
  args: { questionId: v.id("onboarding_questions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("onboarding_question_answers")
      .withIndex("by_question_id", (q) => q.eq("question_id", args.questionId))
      .collect();
  },
});

export const listAllWithAnswers = query({
  args: {},
  handler: async (ctx) => {
    const questions = await ctx.db
      .query("onboarding_questions")
      .filter((q) => q.eq(q.field("is_active"), true))
      .collect();

    const result = [];
    for (const question of questions) {
      const answers = await ctx.db
        .query("onboarding_question_answers")
        .withIndex("by_question_id", (q) => q.eq("question_id", question._id))
        .collect();
      result.push({ ...question, answers });
    }
    return result;
  },
});
