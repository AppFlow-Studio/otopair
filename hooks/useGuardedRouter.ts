/**
 * useGuardedRouter
 *
 * Drop-in replacement for expo-router's useRouter(). Wraps the three
 * stack-growing methods (push, navigate, replace) with a module-level
 * cooldown so a double-tap cannot push the same screen twice. Every other
 * method (back, setParams, dismiss*, reload, canGoBack, canDismiss,
 * prefetch) passes through unchanged.
 *
 * Returns the exact expo-router `Router` type, so existing call sites
 * (`const router = useRouter()`) type-check unchanged after the import swap.
 */

import { useRouter as useExpoRouter, type Router } from "expo-router";
import { useMemo } from "react";

import { shouldAllowNavigation } from "@/lib/navigationLock";

export function useGuardedRouter(): Router {
  const router = useExpoRouter();

  return useMemo<Router>(
    () => ({
      ...router,
      push: ((href: Parameters<Router["push"]>[0]) => {
        if (!shouldAllowNavigation()) return;
        return router.push(href);
      }) as Router["push"],
      navigate: ((href: Parameters<Router["navigate"]>[0]) => {
        if (!shouldAllowNavigation()) return;
        return router.navigate(href);
      }) as Router["navigate"],
      replace: ((href: Parameters<Router["replace"]>[0]) => {
        if (!shouldAllowNavigation()) return;
        return router.replace(href);
      }) as Router["replace"],
    }),
    [router],
  );
}
