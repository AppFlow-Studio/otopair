const { withMainActivity } = require("@expo/config-plugins");

const BACK_HANDLER_PATTERN =
  /  \/\*\*[\s\S]*?override fun invokeDefaultOnBackPressed\(\) \{[\s\S]*?\n  \}/;

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
