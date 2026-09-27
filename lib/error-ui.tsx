/**
 * Global error handling: errorBus + ErrorModalHost.
 * Errors are logged (to Convex via console interceptor) and shown in a modal.
 */

import React, { Component, type ReactNode } from "react";
import { useRouter } from "expo-router";
import { ErrorOccurredModal } from "@/components/shared-ui";

export type ErrState = { error?: unknown; visible: boolean };

const listeners: Array<() => void> = [];

export const errorBus: {
  state: ErrState;
  set: (s: Partial<ErrState>) => void;
} = {
  state: { visible: false },
  set(s) {
    Object.assign(this.state, s);
    listeners.forEach((l) => l());
  },
};

export function ErrorModalHost() {
  const router = useRouter();
  const [state, setState] = React.useState<ErrState>(() => ({ ...errorBus.state }));

  React.useEffect(() => {
    const sync = () => setState({ ...errorBus.state });
    listeners.push(sync);
    return () => {
      const i = listeners.indexOf(sync);
      if (i >= 0) listeners.splice(i, 1);
    };
  }, []);

  const message =
    state.error instanceof Error
      ? state.error.message
      : state.error != null
        ? String(state.error)
        : "Something went wrong. Please try again.";

  const handleClose = () => errorBus.set({ visible: false, error: undefined });
  const handleGoHome = () => {
    errorBus.set({ visible: false, error: undefined });
    router.replace("/");
  };

  return (
    <ErrorOccurredModal
      visible={state.visible}
      title="Something went wrong"
      message={message}
      onClose={handleClose}
      onRetry={handleGoHome}
      inline
    />
  );
}

interface Props {
  children: ReactNode;
}

interface State {
  err: unknown;
}

/** Restart the JS app when expo-updates is linked (EAS builds); resolves false
 *  where it isn't (local dev builds), so the caller can fall back to a re-mount.
 *  Required lazily: expo-updates throws at import time when its native module
 *  is absent, which is why nothing imports it at module scope. */
async function reloadApp(): Promise<boolean> {
  try {
    const Updates = require("expo-updates") as { reloadAsync?: () => Promise<void> };
    if (typeof Updates.reloadAsync !== "function") return false;
    await Updates.reloadAsync();
    return true;
  } catch {
    return false;
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { err: null };

  static getDerivedStateFromError(err: unknown): Partial<State> {
    return { err };
  }

  componentDidCatch(err: unknown) {
    // Logged (and forwarded to Convex by the console interceptor). The
    // fallback below explains it; errorBus is left alone so the global
    // modal doesn't stack a second dialog on top once the tree comes back.
    console.error(err);
  }

  // Re-mount the children. A render error that came from transient state
  // (a hook count that changed under a component, a value that has since
  // loaded) clears on the next mount, which is what "Dismiss" gets you.
  private reset = () => {
    errorBus.set({ visible: false, error: undefined });
    this.setState({ err: null });
  };

  private reload = () => {
    void reloadApp().then((reloaded) => {
      if (!reloaded) this.reset();
    });
  };

  render() {
    if (this.state.err) {
      // Never an empty screen. Rendering null here used to blank the entire
      // app — and unmount the error modal host with it — so a caught render
      // error looked like a crash with no way back but force-quitting.
      const message =
        this.state.err instanceof Error && this.state.err.message
          ? this.state.err.message
          : "Something went wrong. Try again, or reload the app.";
      return (
        <ErrorOccurredModal
          visible
          title="Something went wrong"
          message={message}
          onClose={this.reset}
          onRetry={this.reload}
        />
      );
    }

    return this.props.children;
  }
}
