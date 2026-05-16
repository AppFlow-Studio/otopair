import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// crons.daily(
//   "mark-estimated-health-scores",
//   { hourUTC: 6, minuteUTC: 0 },
//   internal.checkin.markEstimatedHealthScores
// );

// Run account cleanup every day at 7:00 AM
crons.daily(
  "cleanup-expired-accounts",
  { hourUTC: 7, minuteUTC: 0 },
  internal.cleanup.cleanupExpiredAccounts,
);

// ─── Marketplace VIN Discovery Pipeline ─────────────────────────

// Scrape CarGurus for VINs — runs twice daily (8 AM and 6 PM UTC).
// Gated by env var ENRICHMENT_PAUSED — set to "true" in Convex env to pause without redeploying.
crons.daily(
  "marketplace-scrape-cargurus-morning",
  { hourUTC: 8, minuteUTC: 0 },
  internal.vehicleEnrichment.marketplaceScraper.runScheduledScrape,
  { source: "cargurus" }
);

crons.daily(
  "marketplace-scrape-cargurus-evening",
  { hourUTC: 18, minuteUTC: 0 },
  internal.vehicleEnrichment.marketplaceScraper.runScheduledScrape,
  { source: "carscom" }
);

// Process VIN queue every 10 minutes — pick up pending VINs and trigger enrichment.
// Gated by env var ENRICHMENT_PAUSED — set to "true" in Convex env to pause without redeploying.
crons.interval(
  "process-vin-queue",
  { minutes: 10 },
  internal.vehicleEnrichment.marketplaceScraper.processVinQueue,
);

crons.interval(
  "revert-expired-booking-reschedules",
  { minutes: 15 },
  internal.bookings.revertExpiredReschedules,
);

// ─── vehicle_facts Reconciliation (Sprint 1 Day 3) ──────────────
// Layer 4 of the §5 four-layer defense for the v3 mutability concession on
// vehicle_facts. Reads vehicle_facts + vehicle_facts_audit + fact_reports,
// writes a single reconciliation_runs row per invocation. Never writes to
// vehicle_facts or vehicle_facts_audit (CI grep rules 1 + 3 enforce this).
//
// Authority: MEMORY_SCHEMA_V3_CONSOLIDATED §8 + docs/SPRINT_1/RECONCILIATION_RUNBOOK.md.
// The driver internally decides per-run which checks to fire (replay/orphan/
// telemetry every run; counter every ~4th run for hourly cadence).
crons.interval(
  "vehicle_facts_reconciliation",
  { minutes: 15 },
  internal.oto.migrations.vehicleFactsReconciliation.runReconciliation,
  {},
);

export default crons;
