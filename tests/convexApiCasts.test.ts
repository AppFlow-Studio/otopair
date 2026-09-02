/**
 * `(api as any).module.fn` must still name a real Convex function.
 *
 * The cast exists to work around generated types that lag a backend deploy,
 * but it disables the only check that a function name is real. When the name
 * is wrong, nothing fails at build time: convex/react throws "Could not find
 * public function" out of useQuery during render, and because the root error
 * boundary's only action (BackHandler.exitApp) is a no-op on iOS, the app goes
 * white and stays white through navigation.
 *
 * That is exactly how approve-estimate froze — it called
 * customJobs.listMidJobAdditionsForCustomer, a name that never existed on any
 * deployment, instead of customJobs.listAddedServicesForCustomer.
 *
 * This walks every remaining cast and checks the function is exported from
 * convex/<module>.ts, so the next stale name fails here instead of on a
 * customer's phone at the moment they are asked to approve extra spend.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRS = ["app", "components", "hooks", "lib", "stores"];
const CAST = /\(\s*api\s+as\s+any\s*\)\s*\.\s*(\w+)\s*\.\s*(\w+)/g;

function walk(dir: string, acc: string[] = []): string[] {
  if (!existsSync(dir)) return acc;
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if ([".ts", ".tsx"].includes(extname(entry))) acc.push(full);
  }
  return acc;
}

type Ref = { file: string; module: string; fn: string };

const refs: Ref[] = [];
for (const dir of SOURCE_DIRS) {
  for (const file of walk(join(ROOT, dir))) {
    const source = readFileSync(file, "utf8");
    for (const m of source.matchAll(CAST)) {
      refs.push({ file: file.slice(ROOT.length + 1), module: m[1], fn: m[2] });
    }
  }
}

/** Convex exposes `export const name = query(...)` / mutation / action. */
function exportsFunction(moduleSource: string, fn: string): boolean {
  return new RegExp(`^export\\s+const\\s+${fn}\\s*=`, "m").test(moduleSource);
}

describe("(api as any) Convex references", () => {
  it("every cast resolves to a real exported Convex function", () => {
    const broken = refs.filter(({ module, fn }) => {
      const path = join(ROOT, "convex", `${module}.ts`);
      if (!existsSync(path)) return true;
      return !exportsFunction(readFileSync(path, "utf8"), fn);
    });
    expect(
      broken.map((r) => `${r.file} → ${r.module}.${r.fn}`),
      "these names are not exported from convex/<module>.ts; useQuery will throw at render",
    ).toEqual([]);
  });

  it("the approve-estimate additions query is typed, not cast", () => {
    // This one call site is what froze the app. Keep it on the typed api so a
    // rename is a compile error rather than a white screen.
    const raw = readFileSync(
      join(ROOT, "app/booking/approve-estimate/[id].tsx"),
      "utf8",
    );
    // Strip comments — the fix documents the old broken name on purpose.
    const screen = raw
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(screen).toContain("api.customJobs.listAddedServicesForCustomer");
    expect(screen).not.toContain("listMidJobAdditionsForCustomer");
    expect(/\(\s*api\s+as\s+any\s*\)/.test(screen)).toBe(false);
  });

  it("finds the casts it is meant to police", () => {
    // Guards the scanner itself: if the regex or the walk silently stops
    // matching, the first assertion passes vacuously forever.
    expect(refs.length).toBeGreaterThan(0);
  });
});
