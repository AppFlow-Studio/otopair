// =============================================================================
// wave_2_4_loader.test.ts — vitest-style unit tests
// =============================================================================
//
// IMPORTANT: vitest may not be installed yet — Sprint 1 Day 3 deferred the
// install. To run:
//   npm i -D vitest
//   npx vitest run scripts/eval/lib/wave_2_4_loader.test.ts
//
// All tests are deterministic — the loader, schema validator, mock verdict
// generator, judge-prompt renderer, and reply parser are pure (no Date, no
// I/O, no randomness).
// =============================================================================

import { describe, expect, it } from "vitest";

import {
  classifyJudgeSubtype,
  mockVerdictForCase,
  parseJudgeReply,
  parseWave24JsonlBuffer,
  renderJudgePrompt,
  runJudgeForCase,
  type JudgeRuntime,
  type Wave24Case,
} from "./wave_2_4_loader";

// -- Fixtures (in-test, deterministic) ---------------------------------------

const VALID_RIGHT_FACTUAL: Wave24Case = {
  case_id: "wave-2-4-A1-right-factual",
  input: {
    user_query: "What's the oil capacity on a 2017 Mazda CX-5 2.5L?",
    vehicle_scope: {
      make: "Mazda",
      model: "CX-5",
      year_min: 2017,
      year_max: 2017,
      engine_code: "PY-VPS",
    },
    source_tier: "T3",
    verification_status: "unverified",
    web_context: "Mazda owner-manual excerpt: 4.5 quarts with filter change.",
  },
  expected_behavior: "right-example",
  expected_judge_verdict: "PASS",
  judge_prompt: "You are evaluating an Oto response... Mark PASS only if ALL of the following are true: (a) SOURCE NAMED ... (b) CORRECTION INVITED ... (c) NO SCARCITY ...",
  pass_threshold: 0.9,
  repeats: 10,
  category: "wave_2_4_boundary",
};

const VALID_WRONG_APOLOGY: Wave24Case = {
  ...VALID_RIGHT_FACTUAL,
  case_id: "wave-2-4-W1-wrong-apology-spiral",
  expected_behavior: "wrong-example",
  expected_judge_verdict: "FAIL",
  input: {
    ...VALID_RIGHT_FACTUAL.input,
    candidate_response: "Sorry, I had to look this up online — I'm not 100% sure...",
  },
};

const VALID_POST_REPORT_PASS: Wave24Case = {
  case_id: "wave-2-4-post-report-V1-factual",
  input: {
    user_query: "[USER JUST TAPPED Report Message] (prior turn: oil capacity)",
    vehicle_scope: { make: "Mazda", model: "CX-5", year_min: 2017, year_max: 2017 },
    source_tier: "T3",
    verification_status: "unverified",
  },
  expected_behavior: "right-example-post-report",
  expected_judge_verdict: "PASS",
  judge_prompt: "You are evaluating an Oto response that fires AFTER a user submits a report. Mark PASS only if (a) ACKNOWLEDGES RECEIPT, (b) NAMES THE HUMANS, (c) NO TIMELINE PROMISE, (d) NO APOLOGY SPIRAL, (e) INVITES NEXT TURN.",
  pass_threshold: 0.9,
  repeats: 10,
  category: "wave_2_4_post_report",
};

function jsonl(cases: Wave24Case[]): string {
  return cases.map((c) => JSON.stringify(c)).join("\n") + "\n";
}

// -- parseWave24JsonlBuffer --------------------------------------------------

describe("parseWave24JsonlBuffer", () => {
  it("parses 3 valid cases", () => {
    const buf = jsonl([VALID_RIGHT_FACTUAL, VALID_WRONG_APOLOGY, VALID_POST_REPORT_PASS]);
    const out = parseWave24JsonlBuffer(buf);
    expect(out).toHaveLength(3);
    expect(out[0].case_id).toBe("wave-2-4-A1-right-factual");
    expect(out[2].category).toBe("wave_2_4_post_report");
  });

  it("ignores blank lines and trailing newline", () => {
    const buf = "\n" + JSON.stringify(VALID_RIGHT_FACTUAL) + "\n\n";
    expect(parseWave24JsonlBuffer(buf)).toHaveLength(1);
  });

  it("fail-fast on invalid JSON, with line number in error", () => {
    const buf = JSON.stringify(VALID_RIGHT_FACTUAL) + "\n{not json}\n";
    expect(() => parseWave24JsonlBuffer(buf)).toThrow(/line 2/);
  });

  it("fail-fast on missing case_id", () => {
    const broken = { ...VALID_RIGHT_FACTUAL } as Record<string, unknown>;
    delete broken.case_id;
    expect(() => parseWave24JsonlBuffer(JSON.stringify(broken) + "\n")).toThrow(
      /case_id/,
    );
  });

  it("fail-fast on unknown expected_behavior", () => {
    const broken = { ...VALID_RIGHT_FACTUAL, expected_behavior: "mystery" };
    expect(() => parseWave24JsonlBuffer(JSON.stringify(broken) + "\n")).toThrow(
      /expected_behavior/,
    );
  });

  it("fail-fast on bad expected_judge_verdict", () => {
    const broken = { ...VALID_RIGHT_FACTUAL, expected_judge_verdict: "MAYBE" };
    expect(() => parseWave24JsonlBuffer(JSON.stringify(broken) + "\n")).toThrow(
      /expected_judge_verdict/,
    );
  });

  it("fail-fast on missing nested input.vehicle_scope.make", () => {
    const broken = JSON.parse(JSON.stringify(VALID_RIGHT_FACTUAL));
    delete broken.input.vehicle_scope.make;
    expect(() => parseWave24JsonlBuffer(JSON.stringify(broken) + "\n")).toThrow(
      /input\.vehicle_scope\.make/,
    );
  });

  it("fail-fast on candidate_response that is a number instead of string", () => {
    const broken = JSON.parse(JSON.stringify(VALID_WRONG_APOLOGY));
    broken.input.candidate_response = 42;
    expect(() => parseWave24JsonlBuffer(JSON.stringify(broken) + "\n")).toThrow(
      /candidate_response/,
    );
  });
});

// -- classifyJudgeSubtype ----------------------------------------------------

describe("classifyJudgeSubtype", () => {
  it("answer_body for boundary category", () => {
    expect(classifyJudgeSubtype(VALID_RIGHT_FACTUAL)).toBe("answer_body");
    expect(classifyJudgeSubtype(VALID_WRONG_APOLOGY)).toBe("answer_body");
  });

  it("post_report for post_report category", () => {
    expect(classifyJudgeSubtype(VALID_POST_REPORT_PASS)).toBe("post_report");
  });
});

// -- mockVerdictForCase ------------------------------------------------------

describe("mockVerdictForCase", () => {
  it("returns PASS for right-example", () => {
    expect(mockVerdictForCase(VALID_RIGHT_FACTUAL).verdict).toBe("PASS");
  });

  it("returns FAIL for wrong-example", () => {
    expect(mockVerdictForCase(VALID_WRONG_APOLOGY).verdict).toBe("FAIL");
  });

  it("returns PASS for right-example-post-report", () => {
    expect(mockVerdictForCase(VALID_POST_REPORT_PASS).verdict).toBe("PASS");
  });

  it("is deterministic across repeated calls", () => {
    const a = mockVerdictForCase(VALID_RIGHT_FACTUAL);
    const b = mockVerdictForCase(VALID_RIGHT_FACTUAL);
    expect(a).toEqual(b);
  });
});

// -- renderJudgePrompt -------------------------------------------------------

describe("renderJudgePrompt", () => {
  it("includes the verbatim judge_prompt template", () => {
    const rendered = renderJudgePrompt(VALID_RIGHT_FACTUAL, "candidate body text");
    expect(rendered).toContain(VALID_RIGHT_FACTUAL.judge_prompt);
  });

  it("includes the user_query", () => {
    const rendered = renderJudgePrompt(VALID_RIGHT_FACTUAL, "candidate body");
    expect(rendered).toContain(VALID_RIGHT_FACTUAL.input.user_query);
  });

  it("includes web_context when present", () => {
    const rendered = renderJudgePrompt(VALID_RIGHT_FACTUAL, "x");
    expect(rendered).toContain("WEB CONTEXT");
    expect(rendered).toContain("Mazda owner-manual");
  });

  it("omits the WEB CONTEXT block when absent", () => {
    const rendered = renderJudgePrompt(VALID_POST_REPORT_PASS, "ack body");
    expect(rendered).not.toContain("WEB CONTEXT OTO HAD ACCESS TO");
  });

  it("uses POST-REPORT label for post_report sub-type", () => {
    const rendered = renderJudgePrompt(VALID_POST_REPORT_PASS, "ack body");
    expect(rendered).toContain("POST-REPORT ACKNOWLEDGMENT");
  });

  it("uses OTO RESPONSE label for answer_body sub-type", () => {
    const rendered = renderJudgePrompt(VALID_RIGHT_FACTUAL, "answer body");
    expect(rendered).toContain("OTO RESPONSE");
  });

  it("appends the candidate response verbatim", () => {
    const body = "I checked the web for this — 2017 CX-5 2.5L runs ~4.5qt with filter. Flag it if your dipstick reads differently after a fill.";
    const rendered = renderJudgePrompt(VALID_RIGHT_FACTUAL, body);
    expect(rendered).toContain(body);
  });

  it("is deterministic — same inputs produce identical outputs byte-for-byte", () => {
    const a = renderJudgePrompt(VALID_RIGHT_FACTUAL, "body");
    const b = renderJudgePrompt(VALID_RIGHT_FACTUAL, "body");
    expect(a).toBe(b);
  });
});

// -- parseJudgeReply ---------------------------------------------------------

describe("parseJudgeReply", () => {
  it("parses PASS on first line", () => {
    const r = parseJudgeReply("PASS\nLooks good.");
    expect(r.verdict).toBe("PASS");
    expect(r.rationale).toBe("Looks good.");
  });

  it("parses FAIL on first line with multiline rationale", () => {
    const r = parseJudgeReply("FAIL — (b), (c)\nApology spiral.\nScarcity framing.");
    expect(r.verdict).toBe("FAIL");
    expect(r.rationale).toBe("Apology spiral.\nScarcity framing.");
  });

  it("is case-insensitive on the verdict word", () => {
    expect(parseJudgeReply("pass\nok").verdict).toBe("PASS");
    expect(parseJudgeReply("fail\nno").verdict).toBe("FAIL");
  });

  it("treats malformed first line as FAIL with parse-error marker", () => {
    const r = parseJudgeReply("maybe?\nidk");
    expect(r.verdict).toBe("FAIL");
    expect(r.rationale).toMatch(/parse-error/);
  });

  it("handles empty reply as FAIL with parse-error marker", () => {
    const r = parseJudgeReply("");
    expect(r.verdict).toBe("FAIL");
    expect(r.rationale).toMatch(/parse-error/);
  });
});

// -- runJudgeForCase (mock mode) ---------------------------------------------

describe("runJudgeForCase mock-mode determinism", () => {
  it("right-example PASSes the case (actual matches expected)", async () => {
    const out = await runJudgeForCase(VALID_RIGHT_FACTUAL, "mock");
    expect(out.actual_verdict).toBe("PASS");
    expect(out.expected_verdict).toBe("PASS");
    expect(out.passed).toBe(true);
    expect(out.subtype).toBe("answer_body");
  });

  it("wrong-example PASSes the case (judge correctly FAILs the body)", async () => {
    const out = await runJudgeForCase(VALID_WRONG_APOLOGY, "mock");
    expect(out.actual_verdict).toBe("FAIL");
    expect(out.expected_verdict).toBe("FAIL");
    expect(out.passed).toBe(true);
  });

  it("post-report right-example PASSes", async () => {
    const out = await runJudgeForCase(VALID_POST_REPORT_PASS, "mock");
    expect(out.actual_verdict).toBe("PASS");
    expect(out.passed).toBe(true);
    expect(out.subtype).toBe("post_report");
  });
});

// -- runJudgeForCase (live mode with injected fake runtime) ------------------

describe("runJudgeForCase live-mode with fake runtime", () => {
  it("uses verbatim candidate_response when present and skips runOtoChat", async () => {
    let chatCalls = 0;
    const fake: JudgeRuntime = {
      async runOtoChat() {
        chatCalls++;
        return "should not be called";
      },
      async callJudgeModel(prompt: string) {
        expect(prompt).toContain("Sorry, I had to look this up online");
        return { verdict: "FAIL", rationale: "fake-rationale" };
      },
    };
    const out = await runJudgeForCase(VALID_WRONG_APOLOGY, "live", fake);
    expect(chatCalls).toBe(0);
    expect(out.actual_verdict).toBe("FAIL");
    expect(out.passed).toBe(true);
    expect(out.candidate_response).toContain("Sorry, I had to look");
  });

  it("calls runOtoChat when candidate_response is absent", async () => {
    let chatCalls = 0;
    const fake: JudgeRuntime = {
      async runOtoChat() {
        chatCalls++;
        return "I checked the web — 4.5qt. Flag it if your dipstick reads differently.";
      },
      async callJudgeModel() {
        return { verdict: "PASS", rationale: "fake-rationale" };
      },
    };
    const out = await runJudgeForCase(VALID_RIGHT_FACTUAL, "live", fake);
    expect(chatCalls).toBe(1);
    expect(out.actual_verdict).toBe("PASS");
    expect(out.passed).toBe(true);
  });

  it("passed=false when actual verdict diverges from expected", async () => {
    const fake: JudgeRuntime = {
      async runOtoChat() {
        return "body";
      },
      async callJudgeModel() {
        // Right-example expects PASS; this fake returns FAIL.
        return { verdict: "FAIL", rationale: "fake-rationale" };
      },
    };
    const out = await runJudgeForCase(VALID_RIGHT_FACTUAL, "live", fake);
    expect(out.actual_verdict).toBe("FAIL");
    expect(out.expected_verdict).toBe("PASS");
    expect(out.passed).toBe(false);
  });
});
