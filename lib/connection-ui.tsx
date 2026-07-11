/**
 * cantLoadBus + CantLoadModalHost. Mirrors lib/error-ui.tsx: a module-level
 * listener list + a bus object + a host that subscribes and renders the modal.
 */
import React from "react";
import { useRouter } from "expo-router";

import { nudgeReconnect } from "@/hooks/useConnection";
import { CantLoadModal } from "@/components/connection/CantLoadModal";

export type CantLoadState = { visible: boolean };

const listeners: Array<() => void> = [];

export const cantLoadBus: {
  state: CantLoadState;
  set: (s: Partial<CantLoadState>) => void;
} = {
  state: { visible: false },
  set(s) {
    Object.assign(this.state, s);
    listeners.forEach((l) => l());
  },
};

export function CantLoadModalHost() {
  const router = useRouter();
  const [state, setState] = React.useState<CantLoadState>(() => ({ ...cantLoadBus.state }));

  React.useEffect(() => {
    const sync = () => setState({ ...cantLoadBus.state });
    listeners.push(sync);
    return () => {
      const i = listeners.indexOf(sync);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);

  const handleDismiss = () => {
    cantLoadBus.set({ visible: false });
    if (router.canGoBack()) router.back();
  };

  const handleRetry = () => {
    nudgeReconnect();
    cantLoadBus.set({ visible: false });
  };

  return <CantLoadModal visible={state.visible} onRetry={handleRetry} onDismiss={handleDismiss} />;
}
