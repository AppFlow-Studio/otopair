/**
 * useShopTicketsFromConvex — reactive reads for Message Shop tickets.
 *
 * Wraps the user-side Convex queries (convex/shop_tickets.ts) in the
 * use[Feature]FromConvex pattern. Skips local-only booking ids (tire_quote_ /
 * booking_ prefixes never hit Convex). Convex subscriptions are realtime, so a
 * shop reply lands in the thread with no polling.
 */

import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { isLocalBookingId } from '@/constants/bookingActionPolicy';

export type ShopTicket = NonNullable<
  ReturnType<typeof useShopTicketsForBooking>['tickets']
>[number];

/** All of my tickets for a booking, newest-activity first. */
export function useShopTicketsForBooking(bookingId: string | undefined) {
  const skip = !bookingId || isLocalBookingId(bookingId);
  const data = useQuery(
    api.shop_tickets.listMyTicketsForBooking,
    skip ? 'skip' : { bookingId: bookingId as Id<'bookings'> },
  );
  return { tickets: data ?? [], isLoading: data === undefined };
}

/** One ticket's thread (ticket + ordered messages). */
export function useShopTicketThread(ticketId: string | undefined) {
  const data = useQuery(
    api.shop_tickets.getMyTicketThread,
    ticketId ? { ticketId: ticketId as Id<'shop_tickets'> } : 'skip',
  );
  return {
    ticket: data?.ticket ?? null,
    messages: data?.messages ?? [],
    isLoading: data === undefined,
  };
}
