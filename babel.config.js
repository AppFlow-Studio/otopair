// Without this file Expo applies babel-preset-expo on its own
// (@expo/metro-config loadBabelConfig). This keeps that preset unchanged and
// adds one step for Android release bundles only.
module.exports = function (api) {
  // api.caller also keys Babel's cache on these values.
  const platform = api.caller((caller) => caller && caller.platform);
  const isDev = api.caller((caller) => caller && caller.isDev);

  const plugins = [];
  if (platform === "android" && isDev === false) {
    // Drop console.log/info/debug from Android release bundles. Each call was
    // stringified and sent to Convex client_logs by lib/consoleToConvex.ts,
    // although that hook and convex/client_logs.ts are documented as capturing
    // error/warn only. error and warn are kept.
    plugins.push(["transform-remove-console", { exclude: ["error", "warn"] }]);
  }

  return {
    presets: ["babel-preset-expo"],
    plugins,
  };
};
