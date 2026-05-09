const { spawnSync } = require("child_process");

const args = {
  year: 2023,
  make: "BMW",
  model: "5 Series",
  trim: "M550i xDrive",
  displacementL: 4.4,
};

const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npx,
  ["convex", "run", "tires:scrapeWheelSize", JSON.stringify(args)],
  { stdio: "inherit", shell: false },
);
process.exit(result.status ?? 1);
