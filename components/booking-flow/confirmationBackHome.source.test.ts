import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(
  join(currentDir, "../../app/booking/mechanic/[id]/confirmation.tsx"),
  "utf8",
);
const handler = source.slice(
  source.indexOf("const handleBackToHome = useCallback(() => {"),
  source.indexOf("const handleDirections = useCallback"),
);

test("confirmation Back to Home always lands on Home", () => {
  assert.doesNotMatch(handler, /router\.back\(\)/);
  assert.match(handler, /router\.dismissTo\("\/\(main-tabs\)\/home"\)/);
});

test("confirmation Back to Home closes the settings overlay before landing on Home", () => {
  assert.match(source, /import \{ useSettingsOverlayStore \} from "@\/stores\/useSettingsOverlayStore";/);
  assert.match(source, /const settingsOverlayOpen = useSettingsOverlayStore\(\(s\) => s\.isOpen\);/);
  assert.match(source, /const requestCloseSettingsOverlay = useSettingsOverlayStore\(\(s\) => s\.requestClose\);/);
  assert.match(handler, /if \(settingsOverlayOpen\) \{\s*requestCloseSettingsOverlay\(finishBackToHome\);\s*return;\s*\}/s);
});
