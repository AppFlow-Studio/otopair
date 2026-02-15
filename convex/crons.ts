import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run account cleanup every day at 2:00 AM
crons.daily(
  "cleanup-expired-accounts",
  { hourUTC: 2, minuteUTC: 0 },
  internal.cleanup.cleanupExpiredAccounts
);

export default crons;
