/**
 * shopTicketIntents — the state-aware quick-action menu for Message Shop.
 *
 * Maps a booking's phase to the support-ticket intents (single-click buttons)
 * shown in the MessageShopSheet intent picker. Driven by the SAME phase model
 * as constants/bookingActionPolicy.ts so the buttons always match what the
 * booking can actually do right now. `open_chat` is offered separately as the
 * always-available free-text fallback (see MessageShopSheet). Category strings
 * must match convex/lib/shopTicketConstants.ts.
 */

import type { BookingStatus } from '@/components/bookings/BookingCard';

export interface TicketIntent {
  /** Ticket category — must exist in convex shopTicketConstants. */
  category: string;
  /** Button label shown to the customer. */
  label: string;
  /** Optional quick chips appended to the seed message (e.g. "15 min late"). */
  chips?: { label: string; text: string }[];
}

const CONFIRMED_INTENTS: TicketIntent[] = [
  {
    category: 'running_late',
    label: "I'm running late",
    chips: [
      { label: '15 min', text: "I'm running about 15 minutes late." },
      { label: '30 min', text: "I'm running about 30 minutes late." },
      { label: '1 hour', text: "I'm running about an hour late." },
    ],
  },
  { category: 'reschedule_request', label: 'Need to reschedule' },
  { category: 'cancel_or_pickup', label: 'Question about cancelling' },
];

const AT_SHOP_INTENTS: TicketIntent[] = [
  { category: 'whats_status', label: 'Any update on my car?' },
  { category: 'add_service', label: 'Add a service' },
];

const IN_PROGRESS_INTENTS: TicketIntent[] = [
  { category: 'when_ready', label: 'When will it be ready?' },
  { category: 'approve_extra_work', label: 'About the extra work' },
  { category: 'question_about_work', label: 'Question about the work' },
];

const COMPLETED_INTENTS: TicketIntent[] = [
  { category: 'pickup_arrangement', label: 'Arrange pickup' },
  { category: 'invoice_question', label: 'Question about my invoice' },
  { category: 'post_service_issue', label: "Something's off after service" },
];

/** Quick-action intents for the booking's current phase (open_chat excluded —
 *  it's always offered by the sheet as the free-text fallback). */
export function intentsForStatus(status: BookingStatus): TicketIntent[] {
  switch (status) {
    case 'pending':
    case 'pending_shop_acceptance':
    case 'pending_customer_acceptance':
    case 'confirmed':
      return CONFIRMED_INTENTS;
    case 'vehicle_at_shop':
      return AT_SHOP_INTENTS;
    case 'in_progress':
    case 'delayed':
      return IN_PROGRESS_INTENTS;
    case 'completed':
      return COMPLETED_INTENTS;
    default:
      return [];
  }
}

export const OPEN_CHAT_CATEGORY = 'open_chat';
