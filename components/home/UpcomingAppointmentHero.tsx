/**
 * UpcomingAppointmentHero
 *
 * PURPOSE: Prominent top-of-Home banner surfacing the user's next booked
 *          appointment — the Uber-style "hero" slot. Replaces the old
 *          appointment card that used to live inside ActionCardsCarousel.
 *          Tapping it opens the booking details sheet.
 *
 * USED IN: app/(main-tabs)/home/index.tsx (rendered only when an upcoming
 *          booking exists).
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarClock, Car } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { BrandColors } from "@/constants/theme";
import type { Booking as BookingCardBooking } from "@/components/bookings/BookingCard";

interface UpcomingAppointmentHeroProps {
  booking: BookingCardBooking;
  onPress: () => void;
  /** When true, skip the component's own gradient — the parent supplies the
   *  full-bleed background (so the hero can extend behind the header /
   *  status bar). */
  flat?: boolean;
  /** Transparent-bg car render for the booking's vehicle (from the home
   *  screen's `vehicleImageUrls[vin]`). Falls back to a Car icon when absent. */
  carImageUri?: string;
}

/** Longest joined pair we'll spell out in full. Beyond this the "&" form can't
 *  fit the title's two lines, and the banner must never show an ellipsis — so
 *  we fall back to the bounded "+N" form. */
const MAX_JOINED_TITLE = 34;

/** "Oil change & Inspection" when the pair fits, otherwise the bounded
 *  "Oil change +1"; "+N" for longer lists. */
function serviceTitle(services: string[]): string {
  const clean = services.filter(Boolean);
  if (clean.length === 0) return "Upcoming service";
  if (clean.length === 1) return clean[0];
  if (clean.length === 2) {
    const joined = `${clean[0]} & ${clean[1]}`;
    if (joined.length <= MAX_JOINED_TITLE) return joined;
  }
  return `${clean[0]} +${clean.length - 1}`;
}

export function UpcomingAppointmentHero({
  booking,
  onPress,
  flat = false,
  carImageUri,
}: UpcomingAppointmentHeroProps) {
  const title = serviceTitle(booking.services);
  const whenParts = [booking.date, booking.time].filter(Boolean);
  const when = whenParts.length ? whenParts.join(" · ") : "Time to be confirmed";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.wrap, pressed && styles.wrapPressed]}
      accessibilityRole="button"
      accessibilityLabel={`Upcoming appointment: ${title} at ${booking.shopName}, ${when}`}
    >
      <View style={styles.card}>
        {/* Navy surface — omitted in `flat` mode (parent supplies it, so it can
            run full-bleed up behind the status bar). */}
        {!flat && (
          <LinearGradient
            colors={[HERO_SURFACE, HERO_SURFACE_DEEP]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        {/* Copy column and car sit in one row, so the copy's width is set by
            the layout instead of a magic right margin that has to be kept in
            sync with the car's size. */}
        <View style={styles.body}>
          <View style={styles.copy}>
            <Text style={styles.eyebrow} weight="bold">
              UPCOMING
            </Text>

            {/* Two lines each, never one: a truncated service or shop name
                makes the banner read as broken. `serviceTitle` bounds what can
                land here so two lines is always enough. */}
            <Text style={styles.title} weight="bold" numberOfLines={2}>
              {title}
            </Text>

            <Text style={styles.shop} weight="medium" numberOfLines={2}>
              {booking.shopName}
            </Text>
          </View>

          {/* Car render — decorative, so it never takes touch or a11y focus.
              No backing shape: a LinearGradient only falls off along one axis,
              so any "glow" behind it reads as a hard-edged tile. The render is
              bright enough to hold its own against the navy. */}
          <View style={styles.carLayer} pointerEvents="none">
            {carImageUri ? (
              <Image
                source={{ uri: carImageUri }}
                style={styles.carImage}
                contentFit="contain"
                transition={200}
              />
            ) : (
              <Car size={72} color={HERO_CAR_PLACEHOLDER} strokeWidth={1.5} />
            )}
          </View>
        </View>

        {/* Bottom row: date/time. No trailing chevron — the whole banner is the
            tap target, and its `button` role carries the affordance for
            assistive tech without a disclosure arrow floating at the far edge. */}
        <View style={styles.bottomRow}>
          <CalendarClock size={16} color={HERO_TEXT_MUTED} strokeWidth={2} />
          <Text style={styles.when} weight="semiBold" numberOfLines={1}>
            {when}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// Banner palette. The banner is the app's dark brand surface — the light
// content sheet slides up over it, and the contrast between the two is what
// makes the layering read. Exported so the home screen can paint the same
// full-bleed navy behind the status bar in `flat` mode.
export const HERO_SURFACE = BrandColors.primary;
/** A touch bluer than `primary`, so the surface has some depth rather than
 *  reading as flat charcoal. No token for it — it exists only here. */
export const HERO_SURFACE_DEEP = "#1B2B44";
const HERO_ACCENT = BrandColors.secondary;
const HERO_TEXT_STRONG = "#FFFFFF";
const HERO_TEXT_BODY = "rgba(255,255,255,0.86)";
const HERO_TEXT_MUTED = "rgba(255,255,255,0.62)";
const HERO_CAR_PLACEHOLDER = "rgba(255,255,255,0.16)";
const CAR_WIDTH = 142;

/** How far the Home content sheet is allowed to overlap this banner's lower
 *  edge. The banner reserves at least this much bottom padding, so the sheet
 *  covers only dead space and never the date/time row. Exported so the sheet's
 *  negative margin and this padding can't drift apart. */
export const HERO_SHEET_OVERLAP = 26;
/** Clearance between the date/time row and the sheet's rounded top edge. */
const HERO_SEAM_CLEARANCE = 12;

const styles = StyleSheet.create({
  wrap: {
    // Full-bleed — no radius/shadow. The content sheet's rounded top slides
    // up over this on scroll, so it reads as a background, not a card.
  },
  wrapPressed: {
    opacity: 0.92,
  },
  card: {
    paddingHorizontal: 20,
    paddingTop: 4,
    // The overlap is covered by the sheet; the clearance is what stays visible
    // between the date/time row and the sheet's rounded top edge.
    paddingBottom: HERO_SHEET_OVERLAP + HERO_SEAM_CLEARANCE,
    overflow: "hidden",
  },
  body: {
    flexDirection: "row",
    alignItems: "center",
  },
  copy: {
    flex: 1,
    // Keep the copy clear of the car render without a magic right margin.
    paddingRight: 12,
  },
  carLayer: {
    width: CAR_WIDTH,
    alignItems: "center",
    justifyContent: "center",
    // Nudge past the card's padding so the car reads as bleeding off the edge.
    marginRight: -8,
  },
  carImage: {
    width: CAR_WIDTH,
    height: 90,
  },
  eyebrow: {
    color: HERO_ACCENT,
    fontSize: 11,
    letterSpacing: 1.4,
    marginBottom: 12,
  },
  title: {
    color: HERO_TEXT_STRONG,
    fontSize: 21,
    lineHeight: 26,
  },
  shop: {
    color: HERO_TEXT_MUTED,
    fontSize: 14,
    marginTop: 3,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 14,
  },
  when: {
    color: HERO_TEXT_BODY,
    fontSize: 14,
  },
});
