const { withDangerousMod, AndroidConfig } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

// Disable expo-updates in DEBUG builds so expo-dev-client loads JS from the
// Metro dev server instead of UpdatesController trying (and failing) to launch a
// non-existent embedded/OTA bundle -> blank white screen on `expo run:android`.
//
// This override lives in the debug-variant manifest
// (android/app/src/debug/AndroidManifest.xml), which `withAndroidManifest` does
// NOT touch — that plugin only edits src/main. Nothing in app.json or the Expo
// plugins produces a debug-only `ENABLED=false`, so before this plugin the
// override was a hand-edit that `expo prebuild --clean` silently regenerated
// away (the android/ folder is git-ignored CNG output, so git couldn't recover
// it either). Encoding it as a config plugin makes it survive every prebuild.
//
// Release builds are unaffected: this only writes the debug source set, and the
// main manifest keeps `expo.modules.updates.ENABLED=true`. The `tools:replace`
// is what lets the debug value win the manifest merge over main's `true`.

const { readAndroidManifestAsync, writeAndroidManifestAsync } =
  AndroidConfig.Manifest;

const META_NAME = "expo.modules.updates.ENABLED";
const TOOLS_NS = "http://schemas.android.com/tools";

// Fallback used only if the template hasn't produced a debug manifest yet.
const EMPTY_DEBUG_MANIFEST = `<manifest xmlns:android="http://schemas.android.com/apk/res/android" xmlns:tools="${TOOLS_NS}">
    <application />
</manifest>
`;

async function patchDebugManifest(manifestPath) {
  if (!fs.existsSync(manifestPath)) {
    fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
    fs.writeFileSync(manifestPath, EMPTY_DEBUG_MANIFEST);
  }

  const androidManifest = await readAndroidManifestAsync(manifestPath);
  const manifest = androidManifest.manifest;

  // `tools:replace` requires the tools namespace on the root <manifest>.
  manifest.$ = manifest.$ || {};
  if (!manifest.$["xmlns:tools"]) {
    manifest.$["xmlns:tools"] = TOOLS_NS;
  }

  manifest.application = manifest.application || [{ $: {} }];
  const application = manifest.application[0];
  application["meta-data"] = application["meta-data"] || [];

  const attrs = {
    "android:name": META_NAME,
    "android:value": "false",
    "tools:replace": "android:value",
  };

  const existing = application["meta-data"].find(
    (item) => item?.$?.["android:name"] === META_NAME,
  );
  if (existing) {
    existing.$ = { ...existing.$, ...attrs };
  } else {
    application["meta-data"].push({ $: attrs });
  }

  await writeAndroidManifestAsync(manifestPath, androidManifest);
}

module.exports = function withDebugUpdatesDisabled(config) {
  return withDangerousMod(config, [
    "android",
    async (cfg) => {
      const manifestPath = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "debug",
        "AndroidManifest.xml",
      );
      await patchDebugManifest(manifestPath);
      return cfg;
    },
  ]);
};
