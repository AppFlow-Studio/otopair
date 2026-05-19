// Smoke test for the callAnthropic retry+backoff deployment.
// Verifies the success path is unchanged: a single chat turn completes
// without retry log lines (because Anthropic returns 200 immediately).
//
// Usage:
//   JWT="..." npx tsx scripts/eval/runs/_smoke-retry-deploy.ts
//
// Expected: 200, text in response, no error_kind field on the return.

const JWT = process.env.JWT;
const URL = process.env.CONVEX_URL ?? "https://flippant-mink-750.convex.cloud";
if (!JWT) {
  console.error("ENV JWT required");
  process.exit(1);
}

async function call(path: string, args: Record<string, unknown>, kind: "query" | "mutation" | "action"): Promise<unknown> {
  const res = await fetch(`${URL}/api/${kind}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${JWT}` },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const raw = (await res.json()) as { status: string; value?: unknown; errorMessage?: string };
  if (raw.status !== "success") {
    throw new Error(`${path} failed: ${raw.errorMessage?.slice(0, 400)}`);
  }
  return raw.value;
}

async function main() {
  // Find an existing conversation owned by the JWT-bearing user. Avoids
  // having to wire up session_id + user_id for a one-off smoke.
  const convos = (await call("ai_conversations:getByUserId", {}, "query")) as Array<{ _id: string }>;
  if (!convos || convos.length === 0) {
    throw new Error("no existing conversations for this user — seed one via harness first");
  }
  const conversationId = convos[0]._id;
  console.log(`conversation: ${conversationId} (most recent of ${convos.length})`);

  const t0 = Date.now();
  const result = (await call(
    "oto/chat:sendMessage",
    { conversationId, message: "hi", debug: true, debug_skip_persist: true },
    "action",
  )) as { text: string; error_kind?: string; trace?: unknown };
  const dt = Date.now() - t0;

  console.log(`latency_ms: ${dt}`);
  console.log(`text length: ${result.text?.length ?? 0}`);
  console.log(`error_kind: ${result.error_kind ?? "(unset — success path)"}`);
  if (result.error_kind) {
    console.error("UNEXPECTED error_kind set on success-path smoke. Investigate.");
    process.exit(2);
  }
  console.log("OK — success path unchanged.");
}

main().catch((e) => {
  console.error("smoke failed:", (e as Error).message);
  process.exit(1);
});
