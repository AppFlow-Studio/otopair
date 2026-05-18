/**
 * OtoRenderTools
 *
 * PURPOSE: Small render components Oto can fire alongside the message bubble.
 * Each renders inline in the AI chat when its envelope field is set on the
 * assistant message.
 *
 * COMPONENTS:
 *   - LinkButton           — render_link_button (9 destinations)
 *   - BookingCard          — render_booking_card (single booking detail)
 *   - BookingsList         — render_bookings_list (multi-booking summary)
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (one render branch per envelope field)
 *
 * OWNER: Waleed Mansour
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { useRouter } from "expo-router";
import { useQuery } from "convex/react";
import Animated, { FadeIn } from "react-native-reanimated";
import {
  ArrowUpRight,
  Bug,
  Car,
  ChevronRight,
  CreditCard,
  FileText,
  HelpCircle,
  Settings as SettingsIcon,
  ShieldCheck,
  Star,
  User,
  Wrench,
} from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, Spacing } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { LinkButtonDestination, LinkButtonPayload } from "@/services/ai/types";

// ============================================================================
// LinkButton — render_link_button (9 destinations)
// ============================================================================

interface DestinationConfig {
  defaultLabel: string;
  Icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  // Path passed to router.push. Casts to `any` at call-site because the
  // Expo-Router union type is regenerated per-route and we don't want to
  // tightly couple to it here.
  route: string;
}

const DESTINATION_CONFIG: Record<LinkButtonDestination, DestinationConfig> = {
  terms_of_service: {
    defaultLabel: "Open Terms of Service",
    Icon: FileText,
    route: "/settings/terms-and-conditions",
  },
  privacy_policy: {
    defaultLabel: "Open Privacy Policy",
    Icon: ShieldCheck,
    route: "/settings/privacy-policy",
  },
  settings: {
    defaultLabel: "Open Settings",
    Icon: SettingsIcon,
    route: "/settings",
  },
  profile: {
    defaultLabel: "Open Profile",
    Icon: User,
    route: "/settings/edit-profile",
  },
  transaction_history: {
    defaultLabel: "View Transaction History",
    Icon: CreditCard,
    route: "/settings/transactions",
  },
  customer_support: {
    defaultLabel: "Contact Support",
    Icon: HelpCircle,
    route: "/settings/contact-us",
  },
  feedback: {
    defaultLabel: "Send Feedback",
    Icon: Star,
    route: "/settings/contact-us",
  },
  bug_report: {
    defaultLabel: "Report a Bug",
    Icon: Bug,
    route: "/settings/contact-us",
  },
  vehicle_onboarding: {
    defaultLabel: "Add a Vehicle",
    Icon: Car,
    route: "/add-vehicle",
  },
};

export function LinkButton({ payload }: { payload: LinkButtonPayload }) {
  const router = useRouter();
  const cfg = DESTINATION_CONFIG[payload.destination];
  if (!cfg) return null;
  const label = payload.label ?? cfg.defaultLabel;
  const Icon = cfg.Icon;

  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.containerPadded}>
      <Pressable
        // Cast: Expo-Router's typed-routes union is regenerated per route and
        // we don't want every destination here to fight the inferred type.
        onPress={() => router.push(cfg.route as never)}
        style={({ pressed }) => [styles.linkButton, pressed && styles.linkButtonPressed]}
      >
        <View style={styles.linkIconWrap}>
          <Icon size={16} color={BrandColors.secondary} strokeWidth={2} />
        </View>
        <Text style={styles.linkLabel} weight="semiBold">
          {label}
        </Text>
        <ArrowUpRight size={14} color={BrandColors.secondary} strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// BookingCard — render_booking_card (single booking detail)
// ============================================================================

export function BookingCard({ bookingId }: { bookingId: string }) {
  return <BookingRow bookingId={bookingId} variant="card" />;
}

// ============================================================================
// BookingsList — render_bookings_list (multi-booking summary)
// ============================================================================

export function BookingsList({ bookingIds }: { bookingIds: string[] }) {
  if (!bookingIds || bookingIds.length === 0) return null;
  return (
    <Animated.View entering={FadeIn.duration(150)} style={styles.containerPadded}>
      <View style={styles.listStack}>
        {bookingIds.map((id) => (
          <BookingRow key={id} bookingId={id} variant="row" />
        ))}
      </View>
    </Animated.View>
  );
}

// Shared single-booking renderer. `card` is a slightly bigger standalone
// surface; `row` is a compact list item.
function BookingRow({
  bookingId,
  variant,
}: {
  bookingId: string;
  variant: "card" | "row";
}) {
  const router = useRouter();
  const booking = useQuery(api.bookings.getById, { id: bookingId as Id<"bookings"> });

  // Loading / not-found states are short and minimal — the booking row is
  // contextual UI, not a hero card.
  if (booking === undefined) {
    return (
      <View style={[styles.bookingCard, variant === "card" && styles.bookingCardWide]}>
        <Text style={styles.dim} size="sm">
          Loading booking…
        </Text>
      </View>
    );
  }
  if (booking === null) {
    return (
      <View style={[styles.bookingCard, variant === "card" && styles.bookingCardWide]}>
        <Text style={styles.dim} size="sm">
          Couldn't find that booking.
        </Text>
      </View>
    );
  }

  const dateLine = booking.scheduled_date
    ? `${booking.scheduled_date}${booking.scheduled_time ? ` · ${booking.scheduled_time}` : ""}`
    : "Date pending";

  return (
    <Animated.View
      entering={variant === "card" ? FadeIn.duration(150) : undefined}
      style={variant === "card" ? styles.containerPadded : undefined}
    >
      <Pressable
        onPress={() => router.push(`/bookings` as never)}
        style={({ pressed }) => [
          styles.bookingCard,
          variant === "card" && styles.bookingCardWide,
          pressed && styles.bookingCardPressed,
        ]}
      >
        <View style={styles.bookingIconWrap}>
          <Wrench size={16} color={BrandColors.secondary} strokeWidth={2} />
        </View>
        <View style={styles.bookingInfo}>
          <Text style={styles.bookingTitle} weight="semiBold">
            {booking.status ? formatStatus(booking.status) : "Booking"}
          </Text>
          <Text style={styles.bookingMeta} size="sm">
            {dateLine}
          </Text>
        </View>
        <ChevronRight size={14} color="#A0AEC0" strokeWidth={2} />
      </Pressable>
    </Animated.View>
  );
}

function formatStatus(status: string): string {
  return status
    .split("_")
    .map((part) => (part.length ? part[0].toUpperCase() + part.slice(1) : part))
    .join(" ");
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  containerPadded: {
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  // LinkButton
  linkButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md,
    borderWidth: 1,
    borderColor: BrandColors.secondary + "33",
  },
  linkButtonPressed: {
    opacity: 0.85,
  },
  linkIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: BrandColors.secondary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  linkLabel: {
    flex: 1,
    color: BrandColors.secondary,
    fontSize: 14,
  },
  // Bookings (card + list)
  listStack: {
    gap: Spacing.xs,
  },
  bookingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: "rgba(255, 255, 255, 0.65)",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.05)",
  },
  bookingCardWide: {
    paddingVertical: Spacing.md + 2,
  },
  bookingCardPressed: {
    opacity: 0.85,
  },
  bookingIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BrandColors.secondary + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  bookingInfo: {
    flex: 1,
    gap: 2,
  },
  bookingTitle: {
    color: "#2D3748",
    fontSize: 14,
    lineHeight: 18,
  },
  bookingMeta: {
    color: "#718096",
    lineHeight: 16,
  },
  dim: {
    color: "#A0AEC0",
  },
});
