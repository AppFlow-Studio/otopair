// Helper for Rule 21 (Registry-CI guard): extracts backticked tool names
// referenced in stable.ts + volatile.ts source files. Each backtick in
// these template-literal prompts is escaped as `\``, so we match the
// escaped form. Outputs newline-separated tool names sorted unique.
const fs = require('fs');
const stable = fs.readFileSync('convex/oto/prompt/stable.ts', 'utf8');
const volatile = fs.readFileSync('convex/oto/prompt/volatile.ts', 'utf8');
const combined = stable + '\n' + volatile;
const names = new Set();
const re = /\\`([a-z_][a-z_0-9]*)\\`/g;
let m;
while ((m = re.exec(combined)) !== null) names.add(m[1]);
for (const name of [...names].sort()) console.log(name);
