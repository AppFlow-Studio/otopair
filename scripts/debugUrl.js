const { spawnSync } = require("child_process");
const npx = "npx.cmd";

const urls = [
  "https://www.tirerack.com/tires/TireSearchResults.jsp?width=245&ratio=40&diameter=19&action=fetchBySize",
  "https://www.simpletire.com/tires/passenger/245-40r19",
  "https://www.simpletire.com/tires/size/245/40/19",
];

for (const url of urls) {
  console.log(`\n──── ${url}`);
  const r = spawnSync(npx, ["convex", "run", "tires:debugFetchUrl", JSON.stringify({ url })], { encoding: "utf8", shell: false, cwd: require("path").join(__dirname, "..") });
  console.log("stdout:", r.stdout);
  if (r.stderr) console.log("stderr:", r.stderr.slice(0, 300));
  console.log("exit:", r.status);
}
