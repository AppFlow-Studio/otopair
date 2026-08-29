export type QuoteUnavailableReason =
  | "expired"
  | "cancelled"
  | "modified"
  | "unavailable";

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
    actionLabel: "Back to quotes",
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
