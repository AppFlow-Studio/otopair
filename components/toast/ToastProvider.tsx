import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AppState, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSegments } from "expo-router";

import { haptics } from "@/lib/haptics";
import { Layout } from "@/constants/theme";

import { Toast } from "./Toast";
import { MAX_QUEUE_SIZE } from "./tokens";
import type {
  ToastHandle,
  ToastOptions,
  ToastQueueItem,
  ToastVariant,
} from "./types";

const HAPTIC_FOR_VARIANT: Record<ToastVariant, () => void> = {
  success: haptics.success,
  info: () => {},
  warning: haptics.warning,
  error: haptics.error,
  trust: haptics.success,
};

interface InternalContext {
  show: (variant: ToastVariant, options: ToastOptions) => void;
  dismissAll: () => void;
}

const ToastContext = createContext<InternalContext | null>(null);

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `toast-${Date.now().toString(36)}-${idCounter}`;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  // Drive the toast's bottom offset off the active route group. Tab-bar
  // screens need the toast lifted above the tab bar; tab-bar-less
  // screens (booking flow, modal-style booking screens, onboarding)
  // were inheriting that same tabBarHeight lift and floating ~80pt off
  // the bottom edge — Ahmad caught this on the booking screens and
  // asked for them to come up lower. We now sit just above the home
  // indicator on those routes.
  const segments = useSegments();
  const isTabbedRoute = segments[0] === "(main-tabs)";
  const [current, setCurrent] = useState<ToastQueueItem | null>(null);
  const queueRef = useRef<ToastQueueItem[]>([]);
  const appStateRef = useRef(AppState.currentState);
  // Tracks the queue-advance timer scheduled from handleDismissed so that
  // unmount can clear it. Fix from Phase 2.5 STRESS-REPORT §1.2.
  const advanceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      // If app backgrounds mid-toast, drop visible toast and clear queue.
      // PLAN §B.8: toast suppressed on background, not redelivered on foreground.
      if (next !== "active") {
        queueRef.current = [];
        setCurrent(null);
      }
      appStateRef.current = next;
    });
    return () => {
      sub.remove();
      if (advanceTimerRef.current) {
        clearTimeout(advanceTimerRef.current);
        advanceTimerRef.current = null;
      }
    };
  }, []);

  const advance = useCallback(() => {
    setCurrent((prev) => {
      if (prev) return prev; // a toast is already showing
      const next = queueRef.current.shift();
      if (!next) return null;
      HAPTIC_FOR_VARIANT[next.variant]();
      return next;
    });
  }, []);

  const show = useCallback(
    (variant: ToastVariant, options: ToastOptions) => {
      if (appStateRef.current !== "active") return;
      const item: ToastQueueItem = { ...options, id: nextId(), variant };

      // Error preempts any non-error currently visible
      setCurrent((prev) => {
        if (variant === "error" && prev && prev.variant !== "error") {
          // bump current to the front of the queue
          queueRef.current.unshift(prev);
          while (queueRef.current.length > MAX_QUEUE_SIZE) {
            queueRef.current.shift();
          }
          HAPTIC_FOR_VARIANT[item.variant]();
          return item;
        }
        if (prev) {
          queueRef.current.push(item);
          while (queueRef.current.length > MAX_QUEUE_SIZE) {
            queueRef.current.shift();
          }
          return prev;
        }
        HAPTIC_FOR_VARIANT[item.variant]();
        return item;
      });
    },
    [],
  );

  const dismissAll = useCallback(() => {
    queueRef.current = [];
    setCurrent(null);
  }, []);

  const handleDismissed = useCallback(
    (id: string) => {
      setCurrent((prev) => (prev?.id === id ? null : prev));
      // schedule next on next tick — tracked in a ref so unmount can clear
      if (advanceTimerRef.current) clearTimeout(advanceTimerRef.current);
      advanceTimerRef.current = setTimeout(() => {
        advanceTimerRef.current = null;
        advance();
      }, 50);
    },
    [advance],
  );

  const ctx = useMemo<InternalContext>(() => ({ show, dismissAll }), [show, dismissAll]);

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <View style={styles.host} pointerEvents="box-none">
        {current ? (
          <Toast
            item={current}
            // Bottom-anchored (Airbnb-style). On tabbed screens we lift
            // above the tab bar (tabBarHeight + 28pt breathing room).
            // On tab-bar-less screens (booking flow, mechanic confirm,
            // approve estimate, modals, onboarding) we sit just above
            // the home indicator with a small 12pt lift — keeps the
            // toast close to the bottom edge where the user expects
            // confirmation feedback instead of floating mid-screen.
            bottomOffset={
              isTabbedRoute
                ? insets.bottom + Layout.tabBarHeight + 28
                : insets.bottom + 12
            }
            onRequestDismiss={handleDismissed}
          />
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
  },
});

export function useToastInternal(): InternalContext {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

export function buildHandle(ctx: InternalContext): ToastHandle {
  const fire = (variant: ToastVariant) =>
    (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) =>
      ctx.show(variant, { title, body, ...opts });
  return {
    success: fire("success"),
    info: fire("info"),
    warning: fire("warning"),
    error: fire("error"),
    trust: fire("trust"),
    dismissAll: ctx.dismissAll,
  };
}
