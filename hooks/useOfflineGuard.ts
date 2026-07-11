import { useEffect } from "react";

import { useConnection } from "@/hooks/useConnection";
import { shouldShowCantLoad } from "@/lib/connection/offlineGuard";
import { cantLoadBus } from "@/lib/connection-ui";

/**
 * Show the "Can't load this right now" modal while this screen's primary data
 * was never cached this session AND we're offline; hide it as soon as that
 * stops being true (query resolves or connectivity returns).
 *
 * @param queryResult the useQuery(...) result for the screen's primary data.
 *   `undefined` means "not resolved yet".
 */
export function useOfflineGuard(queryResult: unknown): void {
  const conn = useConnection();
  const queryUnresolved = queryResult === undefined;

  useEffect(() => {
    const shouldShow = shouldShowCantLoad({ queryUnresolved, conn });
    if (shouldShow !== cantLoadBus.state.visible) {
      cantLoadBus.set({ visible: shouldShow });
    }
  }, [queryUnresolved, conn]);
}
