export type QuoteUnavailableReason =
  | "expired"
  | "cancelled"
  | "modified"
  | "unavailable";

export type QuoteLifecycleState = "pending" | "ready" | "expired" | "cancelled";
export type QuoteTileState = "pending" | "ready" | "expired" | "hidden";

const EXPIRED_QUOTE_VISIBLE_MS = 24 * 60 * 60_000;

export function getQuoteTileState(
  state: QuoteLifecycleState,
  expiresAt: number | null,
  now = Date.now(),
): QuoteTileState {
  if (state === "cancelled") return "hidden";
  if (state === "pending") return "pending";
  if (expiresAt == null) return state;
  if (now >= expiresAt + EXPIRED_QUOTE_VISIBLE_MS) return "hidden";
  return now >= expiresAt ? "expired" : "ready";
}

export function getQuoteUnavailableCopy(reason: QuoteUnavailableReason) {
  const message =
    reason === "expired"
      ? "If you'd like another quote, please create a new quote request."
      : reason === "cancelled" || reason === "unavailable"
        ? "Please select another quote or create a new quote request."
        : "Please select a new quote to continue.";
  return {
    title: "This quote is no longer available",
    message,
    actionLabel: "Continue",
  };
}

export function readQuoteUnavailableReason(error: unknown): QuoteUnavailableReason | null {
  const data = (error as { data?: { code?: unknown; reason?: unknown } } | null)?.data;
  if (data?.code !== "QUOTE_UNAVAILABLE") return null;
  return data.reason === "expired" ||
    data.reason === "cancelled" ||
    data.reason === "modified" ||
    data.reason === "unavailable"
    ? data.reason
    : "unavailable";
}
