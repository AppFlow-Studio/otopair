# Wave 4 — Stable/Volatile Prompt Split

**Author:** Principal Prompt Engineer
**Status:** v1 — Sprint 2 Wave 4 deliverable. Effective on merge.
**Authority:** `docs/SPRINT_1/WAVE_1_5_PROMPT_CHANGE_PROTOCOL.md` §3 and §3.3, plus the Doc 3 §1 mandate.
**Pairs with:** Wave 1.5 Prompt-Change Protocol (the consumer of this split).

---

## 0. What this is

Sprint 1 shipped the Wave 1.5 Prompt-Change Protocol. That protocol distinguishes **stable** prompt regions (changes require 48h A/B at 25% canary, Waleed + Temur or PPE co-sign, full cache invalidation accepted) from **volatile** regions (cheaper 5%/24h cadence, 1 reviewer). The protocol shipped against a monolithic `convex/oto/system_prompt.ts` and explicitly defaulted the whole file to **stable** until the split landed.

Wave 4 lands the split.

After this change:

- `convex/oto/prompt/stable.ts` exports `STABLE_PROMPT_SECTION` + `STABLE_PROMPT_VERSION`.
- `convex/oto/prompt/volatile.ts` exports `VOLATILE_PROMPT_SECTION` + `VOLATILE_PROMPT_VERSION`.
- `convex/oto/prompt/index.ts` composes the two halves into a single `SYSTEM_PROMPT` and derives `SYSTEM_PROMPT_COMPOSITE_VERSION = "${STABLE_PROMPT_VERSION}+${VOLATILE_PROMPT_VERSION}"`.
- `convex/oto/system_prompt.ts` becomes a thin shim that re-exports `SYSTEM_PROMPT` and exports `SYSTEM_PROMPT_VERSION = SYSTEM_PROMPT_COMPOSITE_VERSION` so downstream imports (`chat.ts`, telemetry, evals) keep working.

The composed string is **byte-identical** to the pre-split `v0.9` prompt (verified at write time and by `STABLE_PROMPT_SECTION.length + VOLATILE_PROMPT_SECTION.length === pre-split body length`). This is a refactor, not a content change. No eval delta is expected on the first deploy.

---

## 1. The split — what went where

### 1.1 Boundary

The split point is the `# Examples` header. Everything ABOVE that header is in **stable.ts**; the `# Examples` block through end-of-prompt is in **volatile.ts**. The volatile half opens with the `\n# Examples\n` separator already attached, so `STABLE + VOLATILE` reproduces the original byte sequence with no glue string from `index.ts`.

```
stable.ts   → "# Who you are" ........... up to (not including) "# Examples"
volatile.ts → "\n\n# Examples\n..." .... through end of prompt
```

### 1.2 Stable region — what lives in `stable.ts`

Per Wave 1.5 §3.3:

- `# Who you are` opening identity paragraph
- `# Voice` headers and the calm > restrained > confident > direct tone hierarchy
- `## No system narration — hard rule` (the architectural rule)
- `## Adaptive shaping` (kept in stable in v1 because it is interleaved inside `# Voice`; see §4 for the v2 plan to migrate the bullets to volatile)
- `## Always` register and score-disclosure rule
- `# Conversation state` — the `<conversation_state>` envelope contract, what goes in `established_facts`, when to call `update_conversation_state`
- `# Scope — Operational vs Mechanical` — the policy line, banned/correct phrasings (these BANNED rules are HARD policy, not illustrative; they stay stable)
- `# Legal-adjacent questions` — refusal template
- `# Recommendations — the three-beat frame`
- `# Symptom routing` — the reasoning protocol, decision tree, trust gating, suggest-don't-mutate rule
- `# Diagnostic form pre-fill rules` — `diagnostic_system` enum mapping + `customer_notes` voice guidance
- `# Support intake` — the five categories + render-form contract
- `# Question caps` — tier behavior
- `# Minors — transactional refusal`
- `# Safety — overrides everything` — 988 lifeline template (cannot be tuned downstream; this is a regulatory floor)
- `# Abuse — graduated escalation` — three-level pattern
- `# Tool batching` — the parallel-emit architectural rule
- `# Knowledge base workflow` — lookup ladder, `record_vehicle_fact` mandate, web search policy
- `# Tools` — tool registry strings. Tool-name changes are tool-contract scope (a different protocol), and the registry entries themselves are stable surface area.
- `# Complexity self-assessment` — Haiku/Sonnet escalation rules
- `# Pricing` — never quote prices rule
- `# Booking flow` — 6 stages, one render per stage, terminal-render contract
- `# Service-name discipline` — exact catalog names
- `# Capability honesty` — what tools exist today
- `# Vehicle Health & Service-Due`, `# Service History`, `# General car knowledge`
- `# Response format` — markdown rules, length defaults
- `# Vehicle context` — `<vehicle>` block contract

**Cost story for stable edits:** 2 reviewers, 25%-or-100% A/B (not 5%), 48h minimum window, cache invalidation for every active user accepted as the cost of change.

### 1.3 Volatile region — what lives in `volatile.ts`

Per Wave 1.5 §3.3:

- The entire `# Examples` block (Examples 1–12, ~123 lines) — illustrative conversations, expected to be tuned against eval data.
- **Future:** Wave 2.4 web-source delivery language (per `docs/SPRINT_0/INTERACTION_WAVE_2_4_V3.md`) lands here as a new section appended to `VOLATILE_PROMPT_SECTION`, below the existing Examples block.
- **Future:** Wave 2.1 / 2.2 / 2.3 interaction-language additions when they land.
- **Future:** Edge-case calibration notes added in response to eval regressions.

**Cost story for volatile edits:** 1 reviewer, 5% canary, 48h (24h after three stable rollouts), cache invalidation still occurs but the lighter review process matches the lower architectural risk.

---

## 2. Pragmatic compromises in v1

A strict reading of Wave 1.5 §3.3 would put a handful of sub-blocks (the *illustrative* forbidden-phrasings lists in `# Scope`, the `## Adaptive shaping` bullets, the worked example inside `# Tool batching`, the worked example inside `# Booking flow`) in the volatile half. v1 leaves them in **stable** for two reasons:

1. **Section integrity.** Splitting a section mid-prose introduces a stable→volatile→stable interleave that makes the file hard to read and edits hard to attribute. The protocol explicitly endorses "default-to-stable in ambiguous cases" (§3.3 last paragraph) — v1 takes the safer default.
2. **Cache cost is paid either way.** Any byte change in either half invalidates the cache. The split's value is the **review and rollout cadence**, not cache savings. Putting borderline content in stable just means those edits get more eyes; that is acceptable until eval data shows the cost.

The clearest non-interleaved boundary in the current prompt is `# Examples`. v1 takes that boundary cleanly.

**v2 plan (post-Wave-2.4):** when Wave 2.4 lands new sections wholesale into the volatile half, also migrate the interleaved sub-blocks (Adaptive shaping bullets, illustrative forbidden-phrasing lists) into volatile, with the stable half holding only the architectural rule that introduces each list. That refactor is cleaner once we have one or two volatile-only sections to anchor against.

---

## 3. Future edits — where to put new content

### 3.1 Editing existing content

| If you are editing… | The file is | The cadence is |
|---|---|---|
| an architectural rule, locked register, identity, voice hierarchy | `stable.ts` | 2 reviewers, 25%-or-100%/48h |
| a HARD policy banned-phrasing rule | `stable.ts` | 2 reviewers, 25%-or-100%/48h |
| an **illustrative** forbidden-phrasing example (the lists that say "illustrative, not exhaustive") | `stable.ts` in v1; will migrate to `volatile.ts` in v2 — bias toward stable cadence for now | 2 reviewers |
| a tool description in the `# Tools` registry | `stable.ts` (and probably a separate tool-contract change in `tools.ts`) | 2 reviewers |
| an Example in the `# Examples` block | `volatile.ts` | 1 reviewer, 5%/48h |
| a worked example inside another section | edit in the section's current home (usually `stable.ts` in v1) | matches that file's cadence |
| a Wave 2.x interaction-language addition | append to `volatile.ts` | 1 reviewer, 5%/48h |

### 3.2 Adding new content

- New architectural section → `stable.ts`.
- New example or worked conversation → append to `volatile.ts` (either inside `# Examples` or as a new section below it).
- New section that documents an **iterative** behavior (something we expect to tune against eval data) → `volatile.ts`.
- New section that documents a **structural** behavior (something whose change implies a different product) → `stable.ts`.

### 3.3 Bumping versions

- Any byte change in `stable.ts` → bump `STABLE_PROMPT_VERSION` (e.g., `"v0.9-stable" → "v0.10-stable"`).
- Any byte change in `volatile.ts` → bump `VOLATILE_PROMPT_VERSION`.
- The composite version `SYSTEM_PROMPT_COMPOSITE_VERSION` derives automatically; do not edit `index.ts` for a version bump.
- `SYSTEM_PROMPT_VERSION` (re-exported from the shim) is the composite version. Downstream telemetry (`oto_telemetry.system_prompt_version`) continues to record a single string that changes when either half changes.

---

## 4. Invariants this PR establishes

1. `STABLE_PROMPT_SECTION + VOLATILE_PROMPT_SECTION === SYSTEM_PROMPT` (asserted by composition in `index.ts`).
2. At the v0.9 split boundary, this composition is byte-identical to the pre-split `v0.9` prompt body. Verified at write time via:

   ```
   stable body bytes: 86669
   volatile body bytes: 7244
   combined bytes: 93913   (==  pre-split body bytes)
   ```

3. `SYSTEM_PROMPT_VERSION` (shim re-export) === `SYSTEM_PROMPT_COMPOSITE_VERSION` === `${STABLE_PROMPT_VERSION}+${VOLATILE_PROMPT_VERSION}`.
4. All 6 CI rules in `scripts/ci/vehicle-facts-grep.sh` remain clean after the split.
5. TypeScript compiles clean (modulo pre-existing `.expo/types/router.d.ts` auto-gen artifact, unrelated to this change).

---

## 5. Open items for v2 (post-Wave-2.4)

1. Migrate `## Adaptive shaping` bullets out of `# Voice` into `volatile.ts` as a sibling section. Requires the stable half of `# Voice` to be tightened to just headers + tone hierarchy.
2. Migrate the "illustrative, not exhaustive" forbidden-phrasings lists in `# Scope`, `## No system narration`, and the BANNED lists in `# Symptom routing` into `volatile.ts`, with the stable half keeping the architectural rule that introduces each list.
3. Add a CODEOWNERS rule keyed on `convex/oto/prompt/stable.ts` so the stable-region reviewer auto-request fires without the manual `prompt-stable` label (per Wave 1.5 §2 `@otopair/prompt-stable-reviewers` group).
4. Wire `SYSTEM_PROMPT_COMPOSITE_VERSION` into the eval changelog row (`promptChangelog.ts`) so stable and volatile bump diffs are visible at a glance.

These are deliberately deferred: v1 ships the minimum viable split that unblocks Wave 1.5 to operate at its intended cadence. Everything in §5 is an optimization that benefits from one rollout cycle of real telemetry.
