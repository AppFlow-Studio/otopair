# OtoPair Docs

**Reference:** [REFERENCE.md](./REFERENCE.md) — database schema (46 tables), access layers, API surface, implementation status, and code examples. Includes **Live Tracker** (bookings.live_stage, getByUserIdWithDetails, updateLiveStage), **mechanics.photo** → cdn_assets, and **seed** (seedPastBookingsForJohnDoe, seedLiveBookingForJohnDoe).

**Checklist:** [CHECKLIST.md](./CHECKLIST.md) — what's done, half-implemented, and not implemented (backend, add vehicle, booking flow).

**Booking Integration:** [BOOKING_INTEGRATION.md](./BOOKING_INTEGRATION.md) — Convex + store integration for booking flow, search, shop details, time slots. **§4 My Bookings & Live Tracker** — useMyBookingsWithDetails, live_stage, updateLiveStage, adapter stagesFromLiveStage, seed for John Doe.

**Diagrams:** [diagrams.md](./diagrams.md) — high-level and per-part database diagrams (Mermaid).

**Merge strategy (daniel-dev):** [MERGE_DANIEL_DEV.md](./MERGE_DANIEL_DEV.md) — how to merge `daniel-dev` into `waleedcodespace` while keeping our Convex backend; file rules, step-by-step, schema adaptation for additive onboarding Convex files, and copy-paste commands.

**Auth & session:** [AUTH_SESSION.md](./AUTH_SESSION.md) — Clerk + Convex auth, session persistence (expo-secure-store), redirect-to-home when already signed in, and troubleshooting the transient “Not authenticated” Convex error.

**Plans:** [.cursor/plans](../.cursor/plans) — plan documents (e.g. MVP booking wiring, DB fact-check).
