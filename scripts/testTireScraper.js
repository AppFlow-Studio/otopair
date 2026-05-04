/**
 * Test the SimpleTire scraper for the 2023 BMW M550i xDrive tire fitments.
 *
 * Sizes derived from wheel-size.com data. Each axle uses its own load index
 * and speed rating as the minimum filter.
 *
 * Usage: node scripts/testTireScraper.js
 */

const { spawnSync } = require("child_process");

const sizes = [
  // OEM staggered 19"
  { size: "245/40R19", minLoadIndex: 98,  minSpeedRating: "Y" },
  { size: "275/35R19", minLoadIndex: 100, minSpeedRating: "Y" },
  // Optional 20" staggered
  { size: "245/35R20", minLoadIndex: 95,  minSpeedRating: "Y" },
  { size: "275/30R20", minLoadIndex: 97,  minSpeedRating: "Y" },
];

const npx = process.platform === "win32"
  ? (process.env.APPDATA + "\\npm\\npx.cmd")
  : "npx";

for (const entry of sizes) {
  console.log(`\n${"─".repeat(60)}`);
  console.log(`Scraping: ${entry.size}  (load ≥ ${entry.minLoadIndex}, speed ≥ ${entry.minSpeedRating})`);
  console.log("─".repeat(60));

  const result = spawnSync(
    npx,
    ["convex", "run", "tires:searchBySize", JSON.stringify(entry)],
    { stdio: "inherit", shell: false },
  );

  if (result.status !== 0) {
    console.error(`Failed for ${entry.size} (exit ${result.status})`);
  }
}
