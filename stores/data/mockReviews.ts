/**
 * Mock Reviews Data
 *
 * PURPOSE: Sample review data for development and testing
 *          Will be replaced with real API data in production
 *
 * USED IN: components/booking/sheets/BookingDetailsContent.tsx
 *
 * OWNER: Waleed Mansour
 */

import type { Review } from "@/components/booking/shared";

// ============================================================================
// MOCK REVIEWS
// ============================================================================

export const mockReviews: Review[] = [
  {
    id: "1",
    userName: "Mathew L.",
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face",
    rating: 5,
    timeAgo: "2 Mins Ago",
    text: "Consequat velit qui adipisicing sunt do rependerit ad laborum tempor ullamco exercitation. Ullamco tempor adipisicing et voluptate duis sit esse aliqua",
  },
  {
    id: "2",
    userName: "Curt K.",
    avatarUrl: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop&crop=face",
    rating: 4,
    timeAgo: "2 Mins Ago",
    text: "Consequat velit qui adipisicing sunt do rependerit ad laborum tempor ullamco.",
  },
  {
    id: "3",
    userName: "Ramy J.",
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&crop=face",
    rating: 3,
    timeAgo: "2 Mins Ago",
    text: "Ullamco tempor adipisicing et voluptate duis sit esse aliqua esse ex.",
  },
];

// ============================================================================
// RATING DISTRIBUTION
// ============================================================================

/** Rating distribution percentages (for the bar chart) */
export const ratingDistribution: Record<1 | 2 | 3 | 4 | 5, number> = {
  5: 0.85,
  4: 0.65,
  3: 0.45,
  2: 0.15,
  1: 0.05,
};



