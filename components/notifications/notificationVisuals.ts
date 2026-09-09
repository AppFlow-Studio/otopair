/**
 * notificationVisuals — the per-category icon + colour tone for a notification
 * row.
 *
 * The old sheet only knew three glyphs (Calendar / Clock / Bell). Product wants
 * the icon to read the *type* of the notification at a glance — a card hold, a
 * mechanic estimate, a reschedule — so this registry maps each `category` to a
 * lucide glyph and one of four semantic tones. Tones resolve to tile / icon /
 * chip colours in NOTIFICATION_TONES, all pulled from the shared SemanticColors
 * palette so nothing is hardcoded.
 *
 * Sibling to notificationShapes (acknowledge vs actionable) and
 * notificationLabels (title copy): shape decides behaviour, this decides looks.
 * Anything unlisted falls back to a neutral Bell.
 */

import type { ComponentType } from "react";
import {
  Bell,
  Calendar,
  Car,
  CircleCheck,
  Clock,
  CreditCard,
  ReceiptText,
  Sparkles,
  Wrench,
} from "lucide-react-native";
import { BrandColors, SemanticColors } from "@/constants/theme";

/** Minimal lucide icon prop surface — every glyph here takes these three. */
type IconComponent = ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

export type NotificationTone = "blue" | "amber" | "green" | "neutral";

export interface NotificationVisual {
  Icon: IconComponent;
  tone: NotificationTone;
}

export interface NotificationToneColors {
  /** Rounded-square icon tile background. */
  tile: string;
  /** Icon stroke on the tile. */
  icon: string;
  /** Shop chip background. */
  chipBg: string;
  /** Shop chip label. */
  chipText: string;
}

export const NOTIFICATION_TONES: Record<
  NotificationTone,
  NotificationToneColors
> = {
  blue: {
    tile: SemanticColors.primaryBlueLight,
    icon: SemanticColors.primaryBlue,
    chipBg: SemanticColors.primaryBlueLight,
    chipText: SemanticColors.primaryBlueDark,
  },
  amber: {
    tile: SemanticColors.warningAmberLight,
    icon: SemanticColors.warningAmber,
    chipBg: SemanticColors.warningAmberLight,
    chipText: SemanticColors.warningAmber,
  },
  green: {
    tile: SemanticColors.successGreenLight,
    icon: SemanticColors.successGreen,
    chipBg: SemanticColors.successGreenLight,
    chipText: SemanticColors.successGreen,
  },
  neutral: {
    tile: "#F1F3F5",
    icon: BrandColors.primary,
    chipBg: "#F1F3F5",
    chipText: SemanticColors.textSecondary,
  },
};

/** Exact category → glyph + tone. Prefix families handled in the resolver. */
const CATEGORY_VISUALS: Record<string, NotificationVisual> = {
  // ── Payment / card hold ──────────────────────────────────────────────────
  booking_reauth_required: { Icon: CreditCard, tone: "blue" },

  // ── Estimate decisions — needs attention ─────────────────────────────────
  booking_prejob_pending: { Icon: Wrench, tone: "amber" },
  booking_midjob_pending: { Icon: Wrench, tone: "amber" },
  booking_postjob_pending: { Icon: Wrench, tone: "amber" },
  booking_estimate_in_range: { Icon: CircleCheck, tone: "green" },
  booking_estimate_withdrawn: { Icon: Wrench, tone: "neutral" },

  // ── Scheduling ───────────────────────────────────────────────────────────
  booking_reschedule_proposed: { Icon: Calendar, tone: "blue" },
  booking_forced_delay_proposed: { Icon: Calendar, tone: "amber" },
  booking_reschedule_withdrawn: { Icon: Calendar, tone: "neutral" },
  booking_reschedule_auto_reverted: { Icon: Calendar, tone: "neutral" },
  schedule_courtesy_update: { Icon: Calendar, tone: "blue" },
  appointment_reminder: { Icon: Calendar, tone: "blue" },
  overrun_customer_resolution: { Icon: Clock, tone: "amber" },
  pickup_request_response: { Icon: Calendar, tone: "blue" },
  customer_cancel_pickup_request: { Icon: Calendar, tone: "neutral" },

  // ── Walk-in / claims ─────────────────────────────────────────────────────
  walkin_completed_claim: { Icon: ReceiptText, tone: "green" },
  walkin_booking_confirmed: { Icon: CircleCheck, tone: "green" },
  walkin_vehicle_at_shop: { Icon: Car, tone: "blue" },
  walkin_prejob_complete: { Icon: Wrench, tone: "blue" },

  // ── Vehicle / misc ───────────────────────────────────────────────────────
  vehicle_enrichment_complete: { Icon: Sparkles, tone: "blue" },
  new_booking: { Icon: CircleCheck, tone: "green" },
};

/**
 * Resolve a category's glyph + tone. Exact lookup first, then the two prefix
 * families (customer_late* → waiting clock, job_blocked_* → wrench), then a
 * neutral Bell so an unmapped category still renders sensibly.
 */
export function getNotificationVisual(category: string): NotificationVisual {
  const exact = CATEGORY_VISUALS[category];
  if (exact) return exact;
  if (category.startsWith("customer_late")) return { Icon: Clock, tone: "amber" };
  if (category.startsWith("job_blocked_")) return { Icon: Wrench, tone: "amber" };
  return { Icon: Bell, tone: "neutral" };
}
