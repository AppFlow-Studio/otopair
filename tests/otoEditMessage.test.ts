/**
 * #272 — editing a sent Oto message replaces it and everything after it.
 *
 * The chat action cuts history at the edited message, then — once the new
 * turn succeeds — deletes the replaced tail (ai_messages.truncateFromInternal)
 * and numbers its turn past the highest one the append-only audit log holds
 * (memoryEditing.getLastAuditTurnNumber), so a shorter conversation never
 * reuses a (turn, role) the log already has.
 */
import { describe, expect, test } from "vitest";
import { internal } from "../convex/_generated/api";
import { makeT } from "./helpers";

async function seedConversation(t: ReturnType<typeof makeT>) {
  return await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      clerkUserId: "user_oto_edit",
      email: "oto-edit@example.com",
    } as any);
    const conversationId = await ctx.db.insert("ai_conversations", {
      user_id: userId,
      session_id: "session_oto_edit",
      started_at: 500,
      message_count: 4,
    } as any);
    const at = async (role: string, content: string, timestamp: number) =>
      await ctx.db.insert("ai_messages", { conversation_id: conversationId, role, content, timestamp } as any);
    await at("user", "first question", 1_000);
    await at("assistant", "first answer", 1_001);
    await at("user", "second question (the one being edited)", 2_000);
    await at("assistant", "second answer", 2_001);
    return { userId, conversationId };
  });
}

describe("Oto message editing (#272)", () => {
  test("THE BUG: the edited message and everything after it are removed", async () => {
    const t = makeT();
    const { conversationId } = await seedConversation(t);

    const removed = await t.mutation(internal.ai_messages.truncateFromInternal, {
      conversationId,
      fromTimestamp: 2_000,
    });
    expect(removed).toBe(2);

    const left = await t.run(async (ctx) => {
      const rows = await ctx.db
        .query("ai_messages")
        .withIndex("by_conversation_id", (q) => q.eq("conversation_id", conversationId))
        .collect();
      const convo = await ctx.db.get(conversationId);
      return { contents: rows.map((r) => r.content).sort(), count: convo?.message_count };
    });
    expect(left.contents).toEqual(["first answer", "first question"]);
    expect(left.count).toBe(2);
  });

  test("editing the last message leaves earlier turns alone", async () => {
    const t = makeT();
    const { conversationId } = await seedConversation(t);
    expect(
      await t.mutation(internal.ai_messages.truncateFromInternal, { conversationId, fromTimestamp: 9_999 }),
    ).toBe(0);
  });

  test("turn numbering continues past the audit log's highest turn", async () => {
    const t = makeT();
    const { conversationId } = await seedConversation(t);
    expect(
      await t.query(internal.oto.memoryEditing.getLastAuditTurnNumber, { conversationId }),
    ).toBe(-1);

    await t.run(async (ctx) => {
      for (const turn_number of [0, 2]) {
        await ctx.db.insert("conversation_audit", {
          conversation_id: conversationId,
          turn_number,
          role: "user",
          content: "q",
          timestamp: turn_number,
        } as any);
      }
    });
    expect(
      await t.query(internal.oto.memoryEditing.getLastAuditTurnNumber, { conversationId }),
    ).toBe(2);
  });
});
