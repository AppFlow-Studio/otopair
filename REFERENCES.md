# OtoPair — Persistent References

<!-- Updated as decisions are made and patterns established. Load via @REFERENCES.md when routing table says to. -->

## HOT — Current State

### About
- **Owner:** Waleed (mrdogsog@gmail.com) — AppFlow Studios
- **Stage:** Active development, v9 roadmap in progress
- **Platform:** iOS + Android (Expo managed workflow)
- **Current priority:** v9 roadmap items (check Otopair_v9_Roadmap_Updated.pdf)

### Architecture Summary

| Layer | What | Key Files |
|---|---|---|
| Screens | 61+ Expo Router screens, 5-tab nav | app/(main-tabs)/ |
| Components | 200+ grouped by feature | components/ |
| State | 12 Zustand stores (UI only) | stores/ |
| Hooks | 37+ custom hooks | hooks/ |
| Backend | 56+ Convex tables, real-time | convex/schema.ts |
| Enrichment | 3-tier pipeline (Claude + FireCrawl + mechanic) | convex/vehicleEnrichment/ |
| AI Chat | Scenario engine + Claude | services/ai/ |
| Auth | Clerk → Convex sync | hooks/useEnsureConvexUser.ts |

### Active Tabs (5-tab nav)
1. **Home** — Discovery, map, mechanic/shop search
2. **AI Chat** — Diagnostics, scenario-based conversation
3. **Bookings** — Active + history, live tracking
4. **Cars** — Vehicle carousel, stats, maintenance tracker
5. **Settings** — 26+ screens (profile, security, preferences, legal)

---

## WARM — Patterns & Domain Knowledge

### Convex Patterns
- **Schema-first:** All tables defined in convex/schema.ts. Run `npx convex dev` after changes.
- **Queries vs Mutations vs Actions:** Queries = reads (reactive). Mutations = writes (transactional). Actions = external API calls (not reactive).
- **Auth in Convex:** Use `ctx.auth.getUserIdentity()` in every user-facing function.
- **Vehicle config key:** `{year}_{make}_{model}_{trim}_{engineCode}` — normalized, used for cache lookups.
- **Enrichment tiers:** Tier 1 (Claude batch + FireCrawl, $0.50-0.60/vehicle, 7-13 min) → Tier 2 (site-scoped scraping) → Tier 3 (mechanic verification, free, instant).

### Component Patterns
- **Bottom sheets:** `@gorhom/bottom-sheet` for all modal-like UIs.
- **FadeContainers:** `FadeHeaderContainer` / `FadeFooterContainer` for scroll-aware headers/footers.
- **Carousel cards:** Used for mechanics, shops, vehicles. Swipeable.
- **shared-ui imports:** `import { Button, Text, Container, Input } from '@/components/shared-ui'`

### Hook Patterns
- **`use[Feature]FromConvex`** — Wraps `useQuery()`, returns `{ data, isLoading }`.
- **`use[Feature]Persistence`** — AsyncStorage-backed local state.
- **`useEnsureConvexUser`** — Called in root layout. Syncs Clerk auth → Convex users table.

### Store Patterns
- **Zustand with immer-style updates** — `set((state) => { state.x = y })`.
- **Stores for UI state only.** Never duplicate Convex data in stores long-term.
- **`useBookingStore`** — Largest store (500+ lines). Manages full booking flow state.

### Design System
- **Primary:** `#141C24` (dark charcoal) — buttons, headers
- **Accent:** `#5299FE` (blue) — links, highlights
- **Font:** Urbanist (300-800 weights)
- **Spacing:** 4px base unit
- **Import:** `import { colors, typography, spacing } from '@/constants/theme'`

### Key Technical Notes
- **Expo Router groups:** `(main-tabs)`, `(onboarding)`, `(tell-us-about)` — parentheses = layout groups, not URL segments.
- **Convex _generated/:** Auto-generated. Never edit. Regenerated on `npx convex dev`.
- **Smartcar integration:** OBD-II data via Smartcar API. OAuth flow in hooks/useSmartCar.ts.
- **VIN decode:** NHTSA vPIC API → year, make, model, trim, engine.
- **Keyboard handling:** react-native-keyboard-controller for smooth keyboard-aware layouts.

### Decision Log

| Date | Decision | Reasoning |
|---|---|---|
| v8 | 3-tier enrichment architecture | Cost efficiency: batch API calls, cache aggressively, let mechanics verify |
| v8 | Evidence tracking on all enrichment data | Trust + audit trail. Every value traced to source URL + confidence |
| v9 | Convex as sole backend | Real-time reactivity, TypeScript end-to-end, no REST API layer needed |
| — | Zustand over Redux | Lightweight, less boilerplate, better for RN performance |
| — | Clerk for auth | Managed auth with OAuth support, easy Convex integration |

---

## COLD — Archived

### Documentation Index
- `docs/AUTH_SESSION.md` — Clerk + Convex auth flow
- `docs/BOOKING_INTEGRATION.md` — Full booking lifecycle (43KB)
- `docs/ENRICHMENT_PIPELINE_COMPLETE.md` — Pipeline spec (67KB)
- `docs/VEHICLE_PIPELINE_GUIDE.md` — VIN decode flow
- `docs/REFERENCE.md` — API reference (36KB)
- `docs/DATA_MODEL_VEHICLE_SPECS.md` — Data model details
- `docs/REWARDS.md` — Reward system design
- `docs/CACHING_PLAN.md` — Caching strategy

### External References
- [Expo Router Docs](https://docs.expo.dev/router/introduction/)
- [Convex Docs](https://docs.convex.dev/)
- [Clerk Docs](https://clerk.com/docs)
- [FireCrawl Docs](https://docs.firecrawl.dev/)
- [NHTSA vPIC API](https://vpic.nhtsa.dot.gov/api/)
