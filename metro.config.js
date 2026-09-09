// Metro config — `@/convex/*` resolution.
//
// DEFAULT: resolve against this repo's own `convex/`. Mobile is canonical for
//   convex code, so the app must run against the source, not a copy of it.
//
//   This used to redirect to `../otopair-web/convex` whenever that sibling repo
//   existed, which inverted the canon: a module added correctly here (e.g.
//   `convex/lib/vinIdentity.ts`, imported by app/(main-tabs)/cars) failed to
//   bundle because the web checkout hadn't received it. The app was building
//   against whatever state that unrelated clone happened to be in.
//
// OPT-IN: set OTOPAIR_CONVEX_FROM_WEB=1 to restore the old behaviour when you
//   are actively editing convex inside otopair-web and want it to hot-reload
//   here without a sync round-trip.
//
// NOTE: `npm run sync:convex` (sync-convex-from-web.sh) and the pre-push drift
//   guard still assume web → mobile. Both point the wrong way for a
//   mobile-canonical repo and need revisiting.

const path = require("path");
const fs = require("fs");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const webConvexRoot = path.resolve(projectRoot, "../otopair-web/convex");
const useExternalConvex =
  process.env.OTOPAIR_CONVEX_FROM_WEB === "1" && fs.existsSync(webConvexRoot);

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
