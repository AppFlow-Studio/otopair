# OtoPair

React Native + Expo 54 mobile app connecting car owners with trusted auto repair professionals. AI-powered diagnostics, mechanic discovery, appointment booking, vehicle management, and a 3-tier vehicle enrichment pipeline.

**Owner:** Waleed (mrdogsog@gmail.com) — AppFlow Studios

## Workspace Map

```
otopair/
├── AGENTS.md                              ← You are here
├── REFERENCES.md                          ← Persistent findings, decisions, patterns
├── .claudeignore                          ← Keeps Codex off node_modules, assets, data
├── app/                                   ← Screens (Expo Router file-based routing)
│   ├── (main-tabs)/                       ← 5-tab navigation (home, ai-chat, bookings, cars, settings)
│   ├── (onboarding)/                      ← Pre-login onboarding flow
│   └── (tell-us-about)/                   ← Post-login vehicle setup flow
├── components/                            ← 200+ components by feature
├── convex/                                ← Backend: schema, queries, mutations, actions
│   └── vehicleEnrichment/                 ← 3-tier AI enrichment pipeline (40+ files)
├── hooks/                                 ← 37+ custom hooks (useXFromConvex pattern)
├── stores/                                ← 12 Zustand stores
├── services/                              ← AI scenario engine, API types
├── lib/                                   ← Utilities (maintenance, geo, booking adapter)
├── constants/                             ← Theme, animations, service defs, filters
├── docs/                                  ← 20+ reference docs (auth, booking, pipeline, etc.)
├── .Codex/
│   ├── skills/                            ← Task-specific skill instructions
│   ├── agents/                            ← Specialized subagents
│   └── settings.json                      ← Hooks (auto-lint, auto-type-check)
└── scripts/                               ← Dev scripts (reset, test pipeline, test VIN)
```

## Routing Table

| Task Type | Go To | Read | Skip | Skills |
|---|---|---|---|---|
| Build/fix a screen | app/, components/ | CONTEXT in relevant group, @REFERENCES.md | convex/vehicleEnrichment/, docs/ | ui-auditor |
| Build/fix a component | components/ | Component CONTEXT, @REFERENCES.md, constants/theme.ts | convex/, docs/ | ui-auditor |
| Backend: queries/mutations | convex/ | convex/CONTEXT.md, convex/schema.ts, @REFERENCES.md | components/, app/ | schema-validator |
| Enrichment pipeline work | convex/vehicleEnrichment/ | pipeline/CONTEXT.md, @REFERENCES.md, docs/ENRICHMENT_PIPELINE_COMPLETE.md | components/, app/, stores/ | pipeline-auditor |
| Add/modify a hook | hooks/ | hooks/CONTEXT.md, @REFERENCES.md | convex/vehicleEnrichment/, docs/ | — |
| State management (Zustand) | stores/ | stores/CONTEXT.md, @REFERENCES.md | convex/, docs/ | — |
| AI chat / scenario engine | services/ai/, components/ai-chat/ | @REFERENCES.md | convex/vehicleEnrichment/ | — |
| Booking flow | components/booking/, convex/bookings.ts, stores/useBookingStore.ts | @REFERENCES.md, docs/BOOKING_INTEGRATION.md | convex/vehicleEnrichment/ | — |
| Auth / onboarding | app/(onboarding)/, hooks/useEnsureConvexUser.ts | docs/AUTH_SESSION.md, @REFERENCES.md | convex/vehicleEnrichment/ | — |
| Debug / investigate | — | @REFERENCES.md | — | codebase-explorer (agent) |
| Quick question | — | AGENTS.md only | everything | — |

## Tech Stack

- **Frontend:** React Native 0.81.5, Expo 54, Expo Router (file-based), TypeScript strict
- **Backend:** Convex (real-time serverless, TypeScript)
- **Auth:** Clerk (OAuth + email) synced to Convex
- **State:** Zustand 5.x (12 stores)
- **AI:** Anthropic Codex (enrichment batches) + rule-based scenario engine (diagnostics)
- **Data:** FireCrawl (web scraping), NHTSA vPIC (VIN decode), Smartcar (OBD-II)
- **UI:** Custom design system (Urbanist font, #141C24 primary, #5299FE accent)
- **Icons:** Phosphor + Lucide + custom SVG
- **Animations:** Lottie + React Native Reanimated

## Naming Conventions

```
Screens       → app/(group)/screen-name.tsx or app/(group)/feature/index.tsx
Components    → components/feature-name/ComponentName.tsx       (PascalCase)
Hooks         → hooks/useFeatureName.ts                        (camelCase with use prefix)
Stores        → stores/useFeatureStore.ts                      (Zustand pattern)
Convex funcs  → convex/tableName.ts                            (camelCase, by table)
Constants     → constants/featureName.ts                       (camelCase)
Docs          → docs/FEATURE_NAME.md                           (SCREAMING_SNAKE)
```

## Global Rules

- **TypeScript strict.** No `any` types. Define interfaces for all props, store state, Convex args.
- **Convex schema is truth.** All table changes go through convex/schema.ts. Run `npx convex dev` to validate.
- **useXFromConvex pattern.** Data-fetching hooks wrap `useQuery()`. Name them `use[Feature]FromConvex`.
- **Zustand stores are lean.** UI state only. Convex is the source of truth for persistent data.
- **Design system first.** Import from `@/components/shared-ui` and `@/constants/theme.ts`. No hardcoded colors or fonts.
- **Evidence-based enrichment.** Every enrichment data point must have source URL + confidence score.
- **No direct API calls from components.** Use hooks or Convex actions.

## What NOT To Do

- Don't modify convex/_generated/. It's auto-generated by `npx convex dev`.
- Don't hardcode colors — use constants/theme.ts.
- Don't put business logic in components — use hooks or Convex mutations.
- Don't skip TypeScript types — no `as any` escapes.
- Don't modify the enrichment pipeline without reading docs/ENRICHMENT_PIPELINE_COMPLETE.md first.
- Don't bypass Clerk auth — all user-facing Convex functions must validate auth.

## The Four Rules
- Think before coding. State your assumptions out loud. If the request is ambiguous, ask. If a simpler approach exists, push back. Stop when you are confused, name what is unclear, do not just pick one interpretation and run.
- Simplicity first. Write the minimum code that solves the problem. No speculative abstractions. No flexibility nobody asked for. The test: would a senior engineer call this overcomplicated.
- Surgical changes. Touch only what the task requires. Do not improve neighboring code. Do not refactor what is not broken. Every changed line should trace back to the request.
- Goal-driven execution. Turn vague instructions into verifiable targets before writing a line. “Add validation” becomes “write tests for invalid inputs, then make them pass.”

<!-- 90 lines. Domain knowledge in @REFERENCES.md. Detailed docs in @docs/. -->
