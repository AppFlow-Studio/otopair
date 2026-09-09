import type { LucideIcon } from "lucide-react-native";

export type ToastVariant = "success" | "info" | "warning" | "error" | "trust";

export interface ToastOptions {
  title: string;
  body?: string;
  /** Override the default duration for this variant. */
  duration?: number;
  /** Makes the whole toast tappable. Fires before dismiss. */
  onPress?: () => void;
  /** Skip the auto-dismiss timer. The toast sits there until the user
   *  taps it or swipes it away. Use for high-value notifications the
   *  user is expected to act on (e.g. "your car is ready — book now"). */
  persistent?: boolean;
  /** Override the variant's default status icon with an action-specific
   *  one (e.g. `Copy` for "Message copied", `Trash2` for a delete). Falls
   *  back to the variant icon when omitted. */
  icon?: LucideIcon;
  /** Render a plain white card instead of the brand-blue gradient — no
   *  gradient, dark text, and no icon (unless one is explicitly passed).
   *  For quiet, simple notifications. */
  plain?: boolean;
}

export interface ToastQueueItem extends ToastOptions {
  id: string;
  variant: ToastVariant;
}

export interface ToastHandle {
  success: (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  info: (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  warning: (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  error: (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  trust: (title: string, body?: string, opts?: Omit<ToastOptions, "title" | "body">) => void;
  dismissAll: () => void;
}
