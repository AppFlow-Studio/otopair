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
          // Identical message already visible (e.g. tapping through roles
          // fires "Role saved" repeatedly) → refresh the current toast
          // instead of queueing a duplicate that lingers behind it. Swapping
          // in the new id resets the Toast's dismiss timer (keyed on item.id)
          // without a visible re-entry animation (translateY/opacity are
          // already at rest, so the reset springs are no-ops).
          if (
            prev.variant === variant &&
            prev.title === options.title &&
            prev.body === options.body
          ) {
            return item;
          }
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

  // Host height depends on route: tabbed screens clip the host at
  // the tab bar's top edge so the toast literally emerges from
  // BEHIND the tab bar (anything the animation puts below the clip
  // line disappears — visually reads as "the tab bar produced this").
  // Non-tabbed screens don't need the clip; host spans the screen.
  //
  // `Layout.tabBarHeight = 30` in the design tokens is a legacy
  // Android-first value that undercounts iOS 26 NativeTabs by a lot
  // — a rest position calculated off it lands the toast mid-tab-bar
  // instead of above it. NATIVE_TAB_BAR_HEIGHT is what NativeTabs
  // actually paints (translucent material chrome, no home indicator).
  const NATIVE_TAB_BAR_HEIGHT = 56;
  const tabBarTopFromScreenBottom = insets.bottom + NATIVE_TAB_BAR_HEIGHT;
  const hostStyle = isTabbedRoute
    ? [styles.host, { bottom: tabBarTopFromScreenBottom }]
    : styles.host;
  // Toast's own bottom offset within the host. On tabbed screens the
  // host's bottom edge sits at the tab bar top, so 12pt above that is
  // just an inline 12. On non-tabbed screens we still need to clear
  // the home indicator via safe-area insets.
  const toastBottomOffset = isTabbedRoute ? 12 : insets.bottom + 12;

  return (
    <ToastContext.Provider value={ctx}>
      {children}
      <View style={hostStyle} pointerEvents="box-none">
        {current ? (
          <Toast
            item={current}
            bottomOffset={toastBottomOffset}
            onRequestDismiss={handleDismissed}
          />
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Clip anything the toast animation puts below this host's
    // bottom edge. On tabbed screens the bottom is inset upward to
    // the tab bar top so mid-flight positions inside the tab-bar
    // zone are hidden — the toast reads as emerging from behind it.
    overflow: "hidden",
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
