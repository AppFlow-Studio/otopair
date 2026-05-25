export type ToastVariant = "success" | "info" | "warning" | "error" | "trust";

export interface ToastOptions {
  title: string;
  body?: string;
  /** Override the default duration for this variant. */
  duration?: number;
  /** Makes the whole toast tappable. Fires before dismiss. */
  onPress?: () => void;
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
