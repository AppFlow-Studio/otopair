/**
 * FAQ Content Constants
 *
 * PURPOSE: Centralized FAQ content data shared across FAQ screens.
 *
 * USED IN:
 *   - app/(main-tabs)/settings/faq.tsx
 *   - app/(main-tabs)/settings/faq-category.tsx
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

export type CategoryKey = 'getting-started' | 'bookings' | 'vehicles' | 'payments' | 'loyalty' | 'pass' | 'general';

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  actionLabel?: string;
}

export interface FAQCategory {
  title: string;
  description: string;
  items: FAQItem[];
}

export const CATEGORY_CONTENT: Record<CategoryKey, FAQCategory> = {
  'getting-started': {
    title: 'Getting started',
    description: 'Learn the basics of setting up your account and booking your first service.',
    items: [
      { id: 'gs-1', question: 'How do I create an account?', answer: 'Tap Sign Up and follow the prompts to set up your profile and vehicle details.' },
      { id: 'gs-2', question: 'How do I add my first vehicle?', answer: 'From Settings, go to My Vehicles and tap Add Vehicle to enter your car information.' },
      { id: 'gs-3', question: 'How do I book my first service?', answer: 'Choose a service, select a time, and confirm your booking to get started.' },
    ],
  },
  bookings: {
    title: 'Bookings & services',
    description: 'Everything you need to know about scheduling and managing services.',
    items: [
      { id: 'bk-1', question: 'How do I book a mobile service?', answer: 'Pick a service, choose your address and time window, then confirm your booking.' },
      { id: 'bk-2', question: 'Can I reschedule a booking?', answer: 'Yes. Open the booking in your history and select Reschedule to pick a new time.' },
      { id: 'bk-3', question: 'What services are available?', answer: 'Otopair offers maintenance and repair services based on your vehicle and location.' },
    ],
  },
  vehicles: {
    title: 'Vehicles',
    description: 'Manage your vehicles and mileage tracking.',
    items: [
      { id: 'vh-1', question: 'How do I add multiple vehicles?', answer: 'Go to My Vehicles and tap Add Vehicle for each additional car.' },
      { id: 'vh-2', question: 'Can I remove a vehicle?', answer: 'Yes. Open a vehicle and choose Remove Vehicle at the bottom of the screen.' },
      { id: 'vh-3', question: 'How do I update mileage?', answer: 'Open the vehicle details and edit the mileage field.' },
    ],
  },
  payments: {
    title: 'Payments & billing',
    description: 'Learn how billing works and how to manage payment methods.',
    items: [
      { id: 'pm-1', question: 'Which payment methods are supported?', answer: 'We accept major credit and debit cards. More methods will be added soon.' },
      { id: 'pm-2', question: 'How do I update my card?', answer: 'Go to Payment Methods and add or remove cards from your wallet.' },
      { id: 'pm-3', question: 'Where can I find my receipts?', answer: 'Receipts are available under Transactions & Receipts in Settings.' },
    ],
  },
  loyalty: {
    title: 'Loyalty & rewards',
    description: 'Learn how to earn and redeem Points within the Otopair ecosystem.',
    items: [
      {
        id: 'lr-1',
        question: 'How do I earn Points?',
        answer:
          'You earn Points for every dollar spent on repairs and by referring friends. Points are automatically added to your wallet after service completion.',
        actionLabel: 'Go to Referrals',
      },
      {
        id: 'lr-2',
        question: 'When do Points expire?',
        answer:
          'Points expire 12 months after they are earned if there is no account activity. Any new earning or redemption activity extends the expiration of all points by another 12 months.',
      },
      {
        id: 'lr-3',
        question: 'Can I transfer Points?',
        answer:
          "Currently, Points are non-transferable and can only be used by the account holder. You can use your points to pay for a service booked for a family member's vehicle registered under your account.",
      },
    ],
  },
  pass: {
    title: 'Otopair Pass',
    description: 'Details about Otopair Pass benefits and billing.',
    items: [
      { id: 'op-1', question: 'What is Otopair Pass?', answer: 'Otopair Pass gives you exclusive discounts, priority booking, and added service perks.' },
      { id: 'op-2', question: 'How do I subscribe?', answer: 'Go to Settings > Otopair Pass to view plans and subscribe.' },
      { id: 'op-3', question: 'Can I cancel anytime?', answer: 'Yes. You can cancel from the Otopair Pass screen and keep access until the end of the billing period.' },
    ],
  },
  general: {
    title: 'General',
    description: 'General questions about availability and coverage.',
    items: [
      { id: 'gn-1', question: 'Where is Otopair available?', answer: 'Otopair is expanding city by city. Check the app for your current coverage area.' },
      { id: 'gn-2', question: 'How do I contact support?', answer: 'Use the Submit a ticket button below or visit the Help Center in Settings.' },
      { id: 'gn-3', question: 'Is my data secure?', answer: 'We use secure encryption and follow industry best practices to protect your data.' },
    ],
  },
};
