// Smoke test for the record_semantic_fact AI tool wire-in (Wave 3 step 6).
//
// Workflow:
//   1. Fire a chat turn with a preference signal that SHOULD trigger the tool.
//   2. Inspect the trace for a tool_use entry named record_semantic_fact.
//   3. Caller is expected to inspect the user_semantic_facts table separately
//      (via `npx convex data user_semantic_facts`) for BEFORE/AFTER counts.
//
// Usage:
//   JWT="..." npx tsx scripts/eval/runs/_smoke-record-semantic-fact.ts [prompt]

const JWT = process.env.JWT;
const URL = process.env.CONVEX_URL ?? "https://flippant-mink-750.convex.cloud";
const VIN_M550i = "WBAJS7C01LBN96146";
if (!JWT) {
  console.error("ENV JWT required");
  process.exit(1);
}

async function call(
  path: string,
  args: Record<string, unknown>,
  kind: "query" | "mutation" | "action",
): Promise<unknown> {
  const res = await fetch(`${URL}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${JWT}` },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const raw = (await res.json()) as { status: string; value?: unknown; errorMessage?: string };
  if (raw.status !== "success") {
    throw new Error(`${path} failed: ${raw.errorMessage?.slice(0, 600)}`);
  }
  return raw.value;
}

async function main() {
  const prompt = process.argv[2] ??
    "I prefer text summaries over images when you tell me about my car.";
  console.log("PROMPT:", prompt);

  // Find an existing conversation for this user.
  const convos = (await call(
    "ai_conversations:getByUserId",
    {},
    "query",
  )) as Array<{ _id: string }>;
  if (!convos || convos.length === 0) {
    throw new Error("no existing conversations — seed one via harness first");
  }
  const conversationId = convos[0]._id;
  console.log("conversation:", conversationId);

  const t0 = Date.now();
  const result = (await call(
    "oto/chat:sendMessage",
    {
      conversationId,
      message: prompt,
      vehicleVin: VIN_M550i,
      debug: true,
      debug_skip_persist: false,
    },
    "action",
  )) as {
    text: string;
    error_kind?: string;
    trace?: {
      iterations: Array<{
        state_tool_uses?: Array<{ name: string; input: unknown }>;
        data_tool_uses?: Array<{ name: string; input: unknown }>;
      }>;
    };
  };
  const dt = Date.now() - t0;
  console.log("latency_ms:", dt);
  console.log("text:", (result.text ?? "").slice(0, 300));
  if (result.error_kind) {
    console.error("UNEXPECTED error_kind:", result.error_kind);
  }

  // Scan trace for a record_semantic_fact tool_use.
  const iters = result.trace?.iterations ?? [];
  let firedRecordSemantic = false;
  for (const it of iters) {
    for (const su of it.state_tool_uses ?? []) {
      if (su.name === "record_semantic_fact") {
        firedRecordSemantic = true;
        console.log("tool_use record_semantic_fact input:", JSON.stringify(su.input));
      }
    }
  }
  console.log("record_semantic_fact fired:", firedRecordSemantic);
  // Also dump all tool names seen, for diagnosis when the tool doesn't fire.
  const allStateToolNames = new Set<string>();
  for (const it of iters) {
    for (const su of it.state_tool_uses ?? []) {
      allStateToolNames.add(su.name);
    }
  }
  console.log("all state_tool_uses seen:", [...allStateToolNames]);
}

main().catch((e) => {
  console.error("smoke failed:", (e as Error).message);
  process.exit(1);
});
