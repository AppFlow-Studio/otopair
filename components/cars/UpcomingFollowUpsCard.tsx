/**
 * UpcomingFollowUpsCard — surfaces mechanic-set follow-ups (mileage milestone
 * and/or pre-picked date+time) for the active vehicle on the cars tab.
 *
 * Tap a card to start the booking confirm flow; price reads from the same
 * pricing source the rest of the app already uses for recommendation bookings.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { CalendarClock, Gauge, ArrowRight } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { BorderRadius, BrandColors, Shadows, Spacing } from "@/constants/theme";
import { useDriverRecommendationsFromConvex } from "@/hooks/useDriverRecommendationsFromConvex";
import { scale, moderateScale } from "@/utils/responsive";

interface UpcomingFollowUpsCardProps {
  vin: string | null | undefined;
  currentMileage: number | null | undefined;
  onConfirmBooking: (rec: {
    recommendationId: string;
    serviceId: string | null;
    shopId: string;
    selectedServiceOption: Rec["selected_service_option"];
    tireSpecs: Rec["tire_specs"];
  }) => void;
}

type Rec = {
  _id: string;
  service_id: string | null;
  service_name: string;
  shop_id: string;
  shop_name: string | null;
  target_mileage: number | null;
  scheduled_at: number | null;
  scheduled_mechanic_id: string | null;
  scheduled_mechanic_name: string | null;
  reason: string | null;
  selected_service_option: {
    option_id: string;
    option_label: string;
    option_type?: string;
  } | null;
  tire_specs: {
    size: string;
    type: string;
    tier: string;
    quantity: number;
  } | null;
};

function formatMileage(n: number) {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function formatDate(ms: number) {
  return new Date(ms).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function UpcomingFollowUpsCard({
  vin,
  currentMileage,
  onConfirmBooking,
}: UpcomingFollowUpsCardProps) {
  const { recommendations } = useDriverRecommendationsFromConvex(vin);

  const items = (recommendations as Rec[]).filter(
    (r) =>
      r.target_mileage != null ||
      r.scheduled_at != null ||
      r.selected_service_option != null ||
      r.tire_specs != null,
  );

  if (items.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Upcoming follow-ups</Text>
      <Text style={styles.subheading}>
        Set by your shop. Confirm the price and slot in-app to book.
      </Text>

      <View style={styles.list}>
        {items.map((rec) => {
          const dueByMileage =
            rec.target_mileage != null &&
            currentMileage != null &&
            currentMileage >= rec.target_mileage;

          const milesAway =
            rec.target_mileage != null && currentMileage != null
              ? Math.max(0, rec.target_mileage - currentMileage)
              : null;

          return (
            <Pressable
              key={rec._id}
              onPress={() =>
                onConfirmBooking({
                  recommendationId: rec._id,
                  serviceId: rec.service_id,
                  shopId: rec.shop_id,
                  selectedServiceOption: rec.selected_service_option,
                  tireSpecs: rec.tire_specs,
                })
              }
              style={({ pressed }) => [
                styles.row,
                pressed && { opacity: 0.85 },
                dueByMileage && styles.rowDue,
              ]}
            >
              <View style={styles.rowMain}>
                <Text style={styles.serviceName}>{rec.service_name}</Text>
                {rec.shop_name ? (
                  <Text style={styles.shopName}>{rec.shop_name}</Text>
                ) : null}
                {rec.reason ? (
                  <Text style={styles.reason} numberOfLines={2}>
                    {rec.reason}
                  </Text>
                ) : null}

                <View style={styles.metaRow}>
                  {rec.target_mileage != null ? (
                    <View style={styles.metaPill}>
                      <Gauge size={12} color={BrandColors.secondary} />
                      <Text style={styles.metaText}>
                        {dueByMileage
                          ? `Due — ${formatMileage(rec.target_mileage)} mi`
                          : milesAway != null
                            ? `In ${formatMileage(milesAway)} mi (at ${formatMileage(rec.target_mileage)})`
                            : `At ${formatMileage(rec.target_mileage)} mi`}
                      </Text>
                    </View>
                  ) : null}
                  {rec.scheduled_at != null ? (
                    <View style={styles.metaPill}>
                      <CalendarClock size={12} color={BrandColors.secondary} />
                      <Text style={styles.metaText}>
                        {formatDate(rec.scheduled_at)}
                        {rec.scheduled_mechanic_name
                          ? ` · ${rec.scheduled_mechanic_name}`
                          : ""}
                      </Text>
                    </View>
                  ) : null}
                  {rec.selected_service_option ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>
                        {rec.selected_service_option.option_label}
                      </Text>
                    </View>
                  ) : null}
                  {rec.tire_specs ? (
                    <View style={styles.metaPill}>
                      <Text style={styles.metaText}>
                        {rec.tire_specs.size} · {rec.tire_specs.type} ·{" "}
                        {rec.tire_specs.tier} · {rec.tire_specs.quantity} tires
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <ArrowRight size={18} color={BrandColors.secondary} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: "#fff",
    ...Shadows.sm,
  },
  heading: {
    fontSize: moderateScale(15),
    fontWeight: "700",
    color: BrandColors.primary,
  },
  subheading: {
    fontSize: moderateScale(12),
    color: BrandColors.secondary,
    marginTop: 2,
  },
  list: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FAFAFA",
  },
  rowDue: {
    borderColor: "#F59E0B",
    backgroundColor: "#FFFBEB",
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  serviceName: {
    fontSize: moderateScale(14),
    fontWeight: "600",
    color: BrandColors.primary,
  },
  shopName: {
    fontSize: moderateScale(12),
    color: BrandColors.secondary,
  },
  reason: {
    fontSize: moderateScale(12),
    color: "#4B5563",
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: scale(6),
    marginTop: 6,
  },
  metaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.05)",
  },
  metaText: {
    fontSize: moderateScale(11),
    color: BrandColors.secondary,
  },
});

export default UpcomingFollowUpsCard;
