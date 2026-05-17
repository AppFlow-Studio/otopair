// Benchmark probe: BMW M550i xDrive 2020 against the same 17-topic set
// used for the VW Jetta 1.4T R-Line 2020 baseline.
// Comparison point — establishes how the cascade behaves across configs
// at different enrichment fill levels.

interface CascadeResp {
  status: "success" | "error";
  value?: {
    attempted_tiers: string[];
    facts: Array<{
      topic: string;
      fact_text: string;
      match_kind: string;
      verification_status: string;
    }>;
    tier: string | null;
  };
  errorMessage?: string;
}

const TOPICS: Array<{ topic: string; axis: string; q: string }> = [
  { topic: "oil_capacity", axis: "engine", q: "How much oil does my BMW M550i take?" },
  { topic: "oil_viscosity", axis: "engine", q: "What oil viscosity should I use?" },
  { topic: "oil_spec", axis: "engine", q: "What oil spec does it require?" },
  { topic: "coolant_type", axis: "engine", q: "What coolant does it use?" },
  { topic: "coolant_capacity", axis: "engine", q: "How much coolant?" },
  { topic: "spark_plug_count", axis: "engine", q: "How many spark plugs?" },
  { topic: "engine_displacement", axis: "engine", q: "Engine displacement?" },
  { topic: "engine_cylinders", axis: "engine", q: "How many cylinders?" },
  { topic: "engine_aspiration", axis: "engine", q: "Naturally aspirated or turbo?" },
  { topic: "fuel_type", axis: "engine", q: "What fuel type?" },
  { topic: "timing_type", axis: "engine", q: "Timing chain or belt?" },
  { topic: "transmission_type", axis: "trim", q: "Manual or automatic?" },
  { topic: "transmission_fluid_type", axis: "trim", q: "Transmission fluid type?" },
  { topic: "brake_fluid_type", axis: "vehicle", q: "Brake fluid type?" },
  { topic: "brake_fluid_capacity_oz", axis: "vehicle", q: "Brake fluid capacity?" },
  { topic: "ps_fluid_type", axis: "vehicle", q: "Power steering fluid type?" },
  { topic: "ps_fluid_capacity_oz", axis: "vehicle", q: "Power steering fluid capacity?" },
];

const URL = "https://mellow-cat-431.convex.cloud";
const KEY = process.env.OTO_EVAL_CONVEX_KEY!;
const CONFIG_BMW = "wh7dy372eamrjc13z43r5j3y6986kabe"; // 2020 BMW 5 Series M550i xDrive (G30, N63B44T3) — complete fill

async function probeOne(t: { topic: string; axis: string; q: string }): Promise<{
  topic: string;
  axis: string;
  tier: string | null;
  facts_count: number;
  first_fact: string;
}> {
  const body = {
    path: "oto/evalHarness:runFullCascade",
    args: {
      question_text: t.q,
      topic: t.topic,
      topic_axis: t.axis,
      vehicle_config_id: CONFIG_BMW,
      no_web_search: true,
    },
    format: "json",
  };
  const res = await fetch(`${URL}/api/action`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Convex ${KEY}`,
    },
    body: JSON.stringify(body),
  });
  const j = (await res.json()) as CascadeResp;
  if (j.status === "error" || !j.value) {
    return {
      topic: t.topic,
      axis: t.axis,
      tier: "ERR",
      facts_count: 0,
      first_fact: j.errorMessage ?? "?",
    };
  }
  return {
    topic: t.topic,
    axis: t.axis,
    tier: j.value.tier,
    facts_count: j.value.facts.length,
    first_fact: j.value.facts[0]?.fact_text ?? "",
  };
}

(async () => {
  console.log("Target: BMW M550i xDrive 2020 (config wh7dy372eamrjc13z43r5j3y6986kabe...)");
  console.log("");
  const results = await Promise.all(TOPICS.map(probeOne));
  console.log("topic                          axis     tier      n  fact");
  console.log("-".repeat(100));
  for (const r of results) {
    const topic = r.topic.padEnd(30);
    const axis = r.axis.padEnd(8);
    const tier = (r.tier ?? "null").padEnd(9);
    const fact = r.first_fact.length > 50 ? r.first_fact.slice(0, 50) + "..." : r.first_fact;
    console.log(`${topic} ${axis} ${tier} ${r.facts_count}  ${fact}`);
  }
  const hits = results.filter((r) => r.tier && r.tier !== "ERR" && r.tier !== "null");
  console.log("");
  console.log(`HITS: ${hits.length}/${results.length} topics returned a tier`);
})();
