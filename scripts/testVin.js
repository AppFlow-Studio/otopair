const vin = process.argv[2];

if (!vin) {
  console.error("Usage: node scripts/testVin.js WBAJS7C01LBN96146");
  process.exit(1);
}

const { spawnSync } = require("child_process");

// spawnSync with shell:false passes args without PowerShell quote mangling
const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["convex", "run", "vehicleEnrichment/testSingleVin:testVin", JSON.stringify({ vin })],
  { stdio: "inherit", shell: false },
);

process.exit(result.status ?? 1);
