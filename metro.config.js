// Metro config — `@/convex/*` resolution has two modes:
//
// LOCAL DEV (otopair-web sibling repo present): redirect `@/convex/*` to
//   `../otopair-web/convex` so edits there hot-reload in the app without
//   requiring an rsync round-trip. The `convex/` entry in this repo is a
//   vendored mirror of that same path, kept in sync by
//   `npm run sync:convex` and guarded by the pre-push hook in
//   `scripts/git-hooks/pre-push` (see `scripts/check-convex-drift.sh`).
//
// EAS BUILD (no sibling repo): fall through to the default `@/*` alias,
//   which resolves `@/convex/*` against `./convex/*` — the vendored
//   directory, kept current by `npm run sync:convex` and committed to
//   the build branch.

const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const webConvexRoot = path.resolve(projectRoot, "../otopair-web/convex");
const useExternalConvex = fs.existsSync(webConvexRoot);

const config = getDefaultConfig(projectRoot);

if (useExternalConvex) {
  // Watch the otopair-web convex folder so edits there trigger reloads.
  config.watchFolders = [...(config.watchFolders ?? []), webConvexRoot];

  // Files under otopair-web/convex resolve `convex/server` etc. against the
  // project's node_modules, not otopair-web's. Tell Metro where to look.
  config.resolver.nodeModulesPaths = [
    ...(config.resolver.nodeModulesPaths ?? []),
    path.resolve(projectRoot, "node_modules"),
  ];

  const originalResolveRequest = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === "@/convex" || moduleName.startsWith("@/convex/")) {
      const sub = moduleName.slice("@/convex".length);
      const target = sub.length === 0 ? webConvexRoot : path.join(webConvexRoot, sub);
      return context.resolveRequest(context, target, platform);
    }
    if (typeof originalResolveRequest === "function") {
      return originalResolveRequest(context, moduleName, platform);
    }
    return context.resolveRequest(context, moduleName, platform);
  };
}

// SVG-as-React-Component support (react-native-svg-transformer). Lets us
// `import Visa from "@/assets/images/VISA.svg"` and render it as JSX.
config.transformer = {
  ...config.transformer,
  babelTransformerPath: require.resolve("react-native-svg-transformer"),
};
config.resolver.assetExts = config.resolver.assetExts.filter(
  (ext) => ext !== "svg",
);
config.resolver.sourceExts = [...config.resolver.sourceExts, "svg"];

module.exports = config;
