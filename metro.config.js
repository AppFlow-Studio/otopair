// Metro config — routes `@/convex/*` imports to the real otopair-web/convex
// folder. The repo has otopair/convex as a symlink to ../otopair-web/convex,
// but Metro's resolver doesn't follow that symlink reliably, so we resolve
// `@/convex/*` ourselves and leave the rest of the `@/*` alias alone.

const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const projectRoot = __dirname;
const webConvexRoot = path.resolve(projectRoot, "../otopair-web/convex");

const config = getDefaultConfig(projectRoot);

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

module.exports = config;
