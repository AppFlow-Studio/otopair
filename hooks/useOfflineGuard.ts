import { useEffect } from "react";

import { useConnection } from "@/hooks/useConnection";
import { shouldShowCantLoad } from "@/lib/connection/offlineGuard";
import { cantLoadBus } from "@/lib/connection-ui";

/**
 * Raise the "Can't load this right now" modal when a screen's primary data was
 * never cached this session and we're offline.
 *
 * @param queryResult the useQuery(...) result for the screen's primary data.
 *   `undefined` means "not resolved yet".
 */
export function useOfflineGuard(queryResult: unknown): void {
  const conn = useConnection();
  const queryUnresolved = queryResult === undefined;

  useEffect(() => {
    if (shouldShowCantLoad({ queryUnresolved, conn })) {
      cantLoadBus.set({ visible: true });
    }
  }, [queryUnresolved, conn]);
}
