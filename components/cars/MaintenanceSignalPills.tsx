/**
 * MaintenanceSignalPills — per-row axis chips for MaintenanceTracker
 * (proposal Behavior #1). The `triggeredBy` axis gets a stronger
 * fill so the user can trace which signal actually fired the tier.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import { Clock, Gauge, Wrench } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import type { MaintenanceTriggerAxis } from "@/components/cars/MaintenanceTracker";

export interface MaintenanceSignals {
  time?: string;
  mileage?: string;
  interval?: string;
}

interface Props {
  signals?: MaintenanceSignals;
  triggeredBy?: MaintenanceTriggerAxis;
}

export function MaintenanceSignalPills({ signals, triggeredBy }: Props) {
  if (!signals) return null;
  const timeFired = triggeredBy === "time" || triggeredBy === "both";
  const mileageFired =
    triggeredBy === "mileage" ||
    triggeredBy === "both" ||
    triggeredBy === "inference";

  return (
    <View style={styles.row}>
      {signals.time ? (
        <Pill
          icon={<Clock size={11} color={timeFired ? "#FFFFFF" : "#1D4ED8"} strokeWidth={2} />}
          bg={timeFired ? "#2563EB" : "#EFF6FF"}
          fg={timeFired ? "#FFFFFF" : "#1D4ED8"}
          label={signals.time}
        />
      ) : null}
      {signals.mileage ? (
        <Pill
          icon={<Gauge size={11} color={mileageFired ? "#FFFFFF" : "#B45309"} strokeWidth={2} />}
          bg={mileageFired ? "#B45309" : "#FFFBEB"}
          fg={mileageFired ? "#FFFFFF" : "#B45309"}
          label={signals.mileage}
        />
      ) : null}
      {signals.interval ? (
        <Pill
          icon={<Wrench size={11} color="#475569" strokeWidth={2} />}
          bg="#F1F5F9"
          fg="#475569"
          label={signals.interval}
        />
      ) : null}
    </View>
  );
}

function Pill({
  icon,
  bg,
  fg,
  label,
}: {
  icon: React.ReactNode;
  bg: string;
  fg: string;
  label: string;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon}
      <Text size="xs" weight="semiBold" color={fg} numberOfLines={1} style={styles.pillText}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  pillText: {
    fontSize: 11,
  },
});
