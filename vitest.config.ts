import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

export default defineConfig({
  // Mirror the app's `@/*` → project-root alias so tests can import client
  // modules (utils/, lib/, hooks/) the same way production code does. Type-only
  // `@/` imports (e.g. React Native component types) are erased before
  // resolution, so pulling a pure util does not drag native modules into the
  // edge-runtime test environment.
  resolve: {
    alias: {
      "@": path.dirname(fileURLToPath(import.meta.url)),
    },
  },
  test: {
    environment: "edge-runtime",
    server: { deps: { inline: ["convex-test"] } },
    include: ["tests/**/*.test.ts"],
  },
});
