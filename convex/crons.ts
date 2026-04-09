import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.daily(
  "mark-estimated-health-scores",
  { hourUTC: 6, minuteUTC: 0 },
  internal.checkin.markEstimatedHealthScores
);

export default crons;
