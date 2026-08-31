import { useCallback } from "react";
import { useConvex } from "convex/react";
import type { FunctionReference } from "convex/server";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { QuoteLifecycleState, QuoteUnavailableReason } from "@/utils/quoteAvailability";

type QuoteRequestAvailability =
  | {
      available: true;
      status: "ready";
      expiresAt: number | null;
    }
  | {
      available: false;
      reason: QuoteUnavailableReason;
      status: QuoteLifecycleState;
      expiresAt: number | null;
    };

const getQuoteRequestAvailability = (api as unknown as {
  bookings: {
    getQuoteRequestAvailability: FunctionReference<
      "query",
      "public",
      { bookingId: Id<"bookings"> },
      QuoteRequestAvailability
    >;
  };
}).bookings.getQuoteRequestAvailability;

export function useQuoteRequestAvailability() {
  const convex = useConvex();
  return useCallback(
    (bookingId: Id<"bookings">) =>
      convex.query(getQuoteRequestAvailability, { bookingId }),
    [convex],
  );
}
