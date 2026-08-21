#!/usr/bin/env node
/**
 * dedupe-vehicles.mjs — collapse duplicate ACTIVE vehicles for one user.
 *
 * Why: before the add-vehicle submit guard existed, spamming "Confirm & Add
 * Vehicle" on the manual flow minted a fresh throwaway `MANUAL-<time>-<rand>`
 * VIN on every tap, so each press created a separate vehicle + ownership for
 * the SAME car (addOwner only dedupes on (vin, user), and every VIN differed).
 *
 * What: groups a user's ACTIVE ownerships by display nickname
 * ("<year> <make> <model>"), falling back to the VIN, keeps the best row in
 * each group (a primary → most-onboarded → oldest) and hard-deletes the rest
 * via the already-deployed `vehicles.removeOwnerById` mutation (which also
 * clears each ownership's maintenance rows). No backend deploy required.
 *
 * SAFE BY DEFAULT: dry-run unless you pass --apply.
 *
 *   # preview what would be removed
 *   node scripts/dedupe-vehicles.mjs --email you@example.com
 *   # actually remove the duplicates
 *   node scripts/dedupe-vehicles.mjs --email you@example.com --apply
 *
 * You can pass --user <userId> instead of --email, and --url <convexUrl> to
 * override the deployment (defaults to EXPO_PUBLIC_CONVEX_URL from .env).
 */
import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const api = anyApi;
const __dirname = dirname(fileURLToPath(import.meta.url));

const argVal = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const APPLY = process.argv.includes("--apply");
const email = argVal("--email");
let userId = argVal("--user");
let url = argVal("--url");

if (!url) {
  try {
    const env = readFileSync(join(__dirname, "..", ".env"), "utf8");
    url = env.match(/^EXPO_PUBLIC_CONVEX_URL=(.+)$/m)?.[1]?.trim();
  } catch {
    /* no .env — require --url */
  }
}
if (!url) {
  console.error("No Convex URL. Pass --url <url> or set EXPO_PUBLIC_CONVEX_URL in .env");
  process.exit(1);
}
if (!email && !userId) {
  console.error("Pass --email <you@example.com> or --user <userId>");
  process.exit(1);
}

// Dedup key: identical cars added via the spam bug share the same nickname.
const keyOf = (o) =>
  (o.nickname && o.nickname.trim().toLowerCase()) || String(o.vin).toUpperCase().trim();

// Which copy to KEEP: a primary beats a non-primary; a fully-onboarded row
// beats a bare one; ties break to the oldest (earliest added).
const rank = (a, b) => {
  if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
  if (!!a.onboardingComplete !== !!b.onboardingComplete) return a.onboardingComplete ? -1 : 1;
  return (a.added_at ?? a._creationTime ?? 0) - (b.added_at ?? b._creationTime ?? 0);
};

const main = async () => {
  console.log(`Convex:  ${url}`);
  console.log(`Mode:    ${APPLY ? "APPLY (will delete)" : "DRY RUN (no changes)"}\n`);
  const client = new ConvexHttpClient(url);

  if (!userId) {
    const user = await client.query(api.users.getByEmail, { email });
    if (!user) {
      console.error(`No user found with email ${email}`);
      process.exit(1);
    }
    userId = user._id;
    console.log(`User:    ${email} → ${userId}`);
  } else {
    console.log(`User:    ${userId}`);
  }

  const rows = await client.query(api.vehicles.listVehiclesByUser, { userId });
  const owns = rows.map((r) => r.ownership).filter(Boolean);
  console.log(`Active vehicles: ${owns.length}\n`);

  const groups = new Map();
  for (const o of owns) {
    const k = keyOf(o);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(o);
  }

  const toRemove = [];
  for (const [k, arr] of groups) {
    if (arr.length <= 1) continue;
    arr.sort(rank);
    const [keep, ...dups] = arr;
    console.log(
      `• "${k}": ${arr.length} copies → keep ${keep.vin}${keep.is_primary ? " (primary)" : ""}, remove ${dups.length}`,
    );
    toRemove.push(...dups);
  }

  if (toRemove.length === 0) {
    console.log("No duplicate groups found — nothing to remove.");
    return;
  }

  console.log(`\n${toRemove.length} duplicate ownership(s) targeted.`);
  if (!APPLY) {
    console.log("Dry run only. Re-run with --apply to delete them.");
    return;
  }

  let done = 0;
  for (const d of toRemove) {
    await client.mutation(api.vehicles.removeOwnerById, { vehicleOwnerId: d._id });
    done += 1;
    if (done % 10 === 0 || done === toRemove.length) {
      console.log(`  removed ${done}/${toRemove.length}`);
    }
  }
  console.log(`\nDone. Removed ${done}. Active vehicles now: ${owns.length - done}.`);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
