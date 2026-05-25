# OtoPair — Notification System: Route Gaps

PLAN.md §B.7 referenced 8 `onPress` destinations for toast-tap actions. Phase 2's Step 0 triaged each. 6 routes are non-trivial new UI work and have been **deferred** out of the June 1 MVP; the corresponding toast strings were downgraded to non-tappable, dashboard-tone variants per Trust-Engineering Reviewer sign-off.

This file is the post-launch punch list.

## Deferred routes

| Route | Effort estimate | Toast strings affected | Downgraded string in shipped code |
|---|---|---|---|
| `/booking/{id}/payment-method` (standalone per-booking card swap) | 2–3 days (new screen, Stripe ephemeral key flow, list-existing-cards picker, optimistic UI) | payment `failed`/`declined` | "Payment didn't go through. Update your card from booking details." |
| `/booking/{id}/payment-detail` (dispute timeline + chargeback evidence) | 3–5 days | payment `dispute_opened` | "We received a dispute on this charge." |
| `/booking/{id}/dispute` (no-show contestation flow) | 3–5 days | booking `no_show` | "Marked as no-show. Open booking to dispute or reschedule." |
| `/booking/{id}/quote-review` (line-item delta diff + approve/decline) | 4–6 days | booking `quote_revised` | "Quote revised — review the change before approving." (non-tappable; full review still happens on booking-details) |
| `/booking/{id}/invoice` (dedicated invoice PDF / receipt screen) | 2–3 days | booking `completed` | "Service complete." (info already surfaces on booking-details) |
| `/booking/{id}/parts-detail` (line-item parts breakdown w/ supplier source + price history) | 4–5 days | booking `parts_under_low` (Trust), `parts_over_high` (Warning) | warning: "Parts ran ${diff} over the high estimate." (non-tappable); trust unchanged |

## Built (trivial deep links)

| Route | Resolution |
|---|---|
| `/discover?service=X&original_booking=Y` | Routes to `/(main-tabs)/home` (the discovery tab per REFERENCES.md). Query-param-driven prefilter is post-launch enhancement. |
| `/discover?service=X` | Same as above. |

## Post-launch sprint sequencing recommendation

Order by user-visible impact:
1. `/booking/{id}/invoice` — completed jobs are the most-frequently-revisited surface; invoice currently buried inside booking-details
2. `/booking/{id}/payment-method` — payment failure recovery is highest-friction moment in the funnel
3. `/booking/{id}/parts-detail` — feeds the Trust-Moment narrative (parts came in under estimate); inbox row exists per §B.9
4. `/booking/{id}/quote-review` — quote revisions are infrequent but high-trust-stakes
5. `/booking/{id}/dispute` — no-shows are rare; today's Alert.alert reschedule flow holds
6. `/booking/{id}/payment-detail` — disputes are very rare; carrier-handled today
