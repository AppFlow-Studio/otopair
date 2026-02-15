/**
 * Sets up console.error and console.warn to forward to Convex client_logs.
 * Mount this once inside ConvexProvider (e.g. in root layout).
 */

import { useEffect, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { setupConsoleToConvex } from "@/lib/consoleToConvex";

export function useConsoleToConvex() {
  const logMutation = useMutation(api.client_logs.log);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    setupConsoleToConvex(logMutation);
  }, [logMutation]);
}
