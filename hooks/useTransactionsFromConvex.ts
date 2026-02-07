/**
 * useTransactionsFromConvex
 *
 * Fetches transactions for the current user from Convex.
 * Optional filter by type (charge | credit | refund).
 *
 * USED IN: app/(main-tabs)/settings/transactions.tsx
 */

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

export type TransactionTypeFilter = "charge" | "credit" | "refund";

export function useTransactionsFromConvex(
  userId: Id<"users"> | null | undefined,
  transactionType?: TransactionTypeFilter
) {
  const transactions = useQuery(
    api.transactions.listForUser,
    userId != null
      ? { userId, transactionType: transactionType ?? undefined, limit: 100 }
      : "skip"
  );

  return {
    transactions: transactions ?? [],
    isLoading: userId != null && transactions === undefined,
  };
}
