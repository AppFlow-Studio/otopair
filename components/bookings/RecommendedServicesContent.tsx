/**
 * RecommendedServicesContent — body of the Bookings → Recommended
 * Services view. Extracted from app/(main-tabs)/bookings/recommended.tsx
 * so the same rendering powers both the standalone screen (kept for
 * deep links / notifications) and the new "Recommended" segment in
 * the Bookings tab pill.
 */

import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { guardedRouter as router } from "@/lib/navigationLock";
import { ChevronDown, ChevronRight } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import {
  useRecHistoryFromConvex,
  type RecHistoryItem,
} from "@/hooks/useRecHistoryFromConvex";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { moderateScale, scale } from "@/utils/responsive";

type Group = "hidden" | "resolved" | "other";

function bucket(item: RecHistoryItem): Group {
  if (
    item.status === "dismissed" &&
    item.dismissed_reason === "hidden_by_driver"
  ) {
    return "hidden";
  }
  if (item.status === "completed") return "resolved";
  return "other";
}

function formatDate(ms: number | null) {
  if (!ms) return "—";
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusLabel(item: RecHistoryItem): string {
  switch (item.status) {
    case "open":
    case "acknowledged":
      return "Active";
    case "dismissed":
      if (item.dismissed_reason === "hidden_by_driver") return "Hidden";
      if (item.dismissed_reason === "fixed") return "Marked fixed";
      if (item.dismissed_reason === "not_needed") return "Not needed";
      if (item.dismissed_reason === "mistake") return "Mistake";
      if (item.dismissed_reason === "completed_externally")
        return "Done elsewhere";
      return "Dismissed";
    case "completed":
      return item.resolved_at
        ? `Resolved ${formatDate(item.resolved_at)}`
        : "Resolved";
    case "expired":
      return "Expired";
    default:
      return "";
  }
}

function Row({ item, onPress }: { item: RecHistoryItem; onPress?: () => void }) {
  const interactive = !!onPress;
  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      style={({ pressed }) => [
        styles.row,
        pressed && interactive && { opacity: 0.7 },
      ]}
    >
      <View style={styles.rowMain}>
        <Text weight="semiBold" style={styles.rowTitle}>
          {item.service_name}
        </Text>
        <Text style={styles.rowSub}>
          {item.mechanic_name ?? "Your mechanic"}
          {item.shop_name ? ` · ${item.shop_name}` : ""}
        </Text>
        <Text style={styles.rowStatus}>{statusLabel(item)}</Text>
      </View>
      {interactive ? (
        <ChevronRight size={moderateScale(18)} color="#C7C7CC" />
      ) : null}
    </Pressable>
  );
}

function Section({
  title,
  count,
  collapsible = false,
  initiallyOpen = true,
  children,
}: {
  title: string;
  count: number;
  collapsible?: boolean;
  initiallyOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  if (count === 0) return null;
  return (
    <View style={styles.section}>
      <Pressable
        onPress={collapsible ? () => setOpen((v) => !v) : undefined}
        disabled={!collapsible}
        style={styles.sectionHeader}
      >
        <Text weight="semiBold" style={styles.sectionTitle}>
          {title}
        </Text>
        <Text style={styles.sectionCount}>{count}</Text>
        {collapsible ? (
          <ChevronDown
            size={moderateScale(16)}
            color="#829BAD"
            style={{
              marginLeft: scale(6),
              transform: [{ rotate: open ? "0deg" : "-90deg" }],
            }}
          />
        ) : null}
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

interface Props {
  /** When true, ScrollView pads its bottom for the standalone screen's
   *  full-bleed layout. The in-tab embed leaves this off because the
   *  bookings tab owns its own bottom padding. */
  withScrollPadding?: boolean;
}

export function RecommendedServicesContent({ withScrollPadding = false }: Props) {
  const insets = useSafeAreaInsets();
  const vin = useVehicleStore((s) => s.getSelectedVehicle()?.vin);
  const { history, isLoading } = useRecHistoryFromConvex(vin);

  const groups = useMemo(() => {
    const g: Record<Group, RecHistoryItem[]> = {
      hidden: [],
      resolved: [],
      other: [],
    };
    for (const item of history) g[bucket(item)].push(item);
    return g;
  }, [history]);

  if (isLoading) {
    return (
      <View style={styles.centerFill}>
        <ActivityIndicator color="#5299FE" />
      </View>
    );
  }

  if (history.length === 0) {
    return (
      <View style={styles.centerFill}>
        <Text style={styles.emptyTitle}>Nothing here yet</Text>
        <Text style={styles.emptyBody}>
          Recommendations from your mechanic will show up here once they file
          one after a service.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={
        withScrollPadding
          ? { paddingBottom: insets.bottom + scale(32) }
          : undefined
      }
      showsVerticalScrollIndicator={false}
    >
      <Section
        title="Hidden"
        count={groups.hidden.length}
        collapsible
        initiallyOpen={false}
      >
        {groups.hidden.map((item) => (
          <Row
            key={item._id}
            item={item}
            onPress={() => router.push(`/recommendation/${item._id}`)}
          />
        ))}
      </Section>
      <Section title="Resolved" count={groups.resolved.length}>
        {groups.resolved.map((item) => (
          <Row
            key={item._id}
            item={item}
            onPress={
              item.completed_via_booking_id
                ? () =>
                    router.push({
                      pathname: "/settings/past-service/[bookingId]",
                      params: {
                        bookingId: item.completed_via_booking_id as string,
                      },
                    })
                : undefined
            }
          />
        ))}
      </Section>
      <Section
        title="Other"
        count={groups.other.length}
        collapsible
        initiallyOpen
      >
        {groups.other.map((item) => {
          const isActive =
            item.status === "open" || item.status === "acknowledged";
          return (
            <Row
              key={item._id}
              item={item}
              onPress={
                isActive
                  ? () => router.push(`/recommendation/${item._id}`)
                  : undefined
              }
            />
          );
        })}
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centerFill: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scale(40),
    paddingVertical: scale(48),
    gap: scale(8),
  },
  emptyTitle: {
    fontSize: moderateScale(15),
    color: "#141C24",
    fontWeight: "600" as any,
  },
  emptyBody: {
    fontSize: moderateScale(13),
    color: "#757c7d",
    textAlign: "center",
    lineHeight: moderateScale(18),
  },
  section: {
    marginTop: scale(16),
    paddingHorizontal: scale(20),
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(4),
    paddingBottom: scale(8),
  },
  sectionTitle: {
    flex: 1,
    fontSize: moderateScale(13),
    color: "#829BAD",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  sectionCount: {
    fontSize: moderateScale(13),
    color: "#829BAD",
  },
  sectionBody: {
    backgroundColor: "#FFFFFF",
    borderRadius: moderateScale(16),
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    gap: scale(10),
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },
  rowMain: {
    flex: 1,
  },
  rowTitle: {
    fontSize: moderateScale(15),
    color: "#141C24",
  },
  rowSub: {
    fontSize: moderateScale(12),
    color: "#757c7d",
    marginTop: 2,
  },
  rowStatus: {
    fontSize: moderateScale(12),
    color: "#5299FE",
    marginTop: 4,
  },
});
