const { withMainActivity } = require("@expo/config-plugins");

// Match ONLY the `invokeDefaultOnBackPressed` KDoc + method. The `(?!override fun)`
// tempered token stops the leading `/**` from greedily starting at an earlier
// method's doc comment — without it the match spans from `getMainComponentName`'s
// comment through `invokeDefaultOnBackPressed`, and the replacement then DELETES
// `getMainComponentName()` and `createReactActivityDelegate()`. Losing the Expo
// `ReactActivityDelegateWrapper` unwires expo-dev-client so the app never loads
// JS from Metro -> blank white screen (and breaks release/EAS renders too).
const BACK_HANDLER_PATTERN =
  /  \/\*\*(?:(?!override fun)[\s\S])*?override fun invokeDefaultOnBackPressed\(\) \{[\s\S]*?\n  \}/;

const BACK_HANDLER_REPLACEMENT = `  /**
    * Keep the root task alive when Android back is used from app roots.
    * Repeatedly finishing and relaunching this Activity can briefly mount
    * multiple React roots in debugOptimized builds before passive cleanup runs.
    */
  override fun invokeDefaultOnBackPressed() {
      if (!moveTaskToBack(false)) {
          // For non-root activities, use the default implementation to finish them.
          super.invokeDefaultOnBackPressed()
      }
  }`;

module.exports = function withRootBackTaskBehavior(config) {
  return withMainActivity(config, (modConfig) => {
    const contents = modConfig.modResults.contents;

    if (!contents.includes("override fun invokeDefaultOnBackPressed()")) {
      throw new Error("MainActivity.kt is missing invokeDefaultOnBackPressed()");
    }

    if (!BACK_HANDLER_PATTERN.test(contents)) {
      throw new Error("Unable to patch MainActivity.kt root back behavior");
    }

    modConfig.modResults.contents = contents.replace(
      BACK_HANDLER_PATTERN,
      BACK_HANDLER_REPLACEMENT,
    );

    return modConfig;
  });
};
