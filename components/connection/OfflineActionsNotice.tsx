/**
 * OfflineActionsNotice
 *
 * PURPOSE: Renders IN PLACE of write-action buttons (Cancel / Reschedule /
 *          Message Mechanic) while the app is offline. Cached info stays
 *          visible and read-only affordances keep working; editing actions
 *          are replaced by this small caption instead of sitting
 *          dimmed-but-present. Same inline-note idiom as Oto's
 *          "Oto needs a connection to reply" (ai-chat composer).
 *
 * USED IN: components/bookings/BookingCard.tsx,
 *          components/bookings/BookingDetailsSheet.tsx
 */

import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { WifiOff } from "lucide-react-native";

import { Text } from "@/components/shared-ui";

interface OfflineActionsNoticeProps {
  /** Override copy when the default doesn't fit the surface. */
  label?: string;
  /** Layout overrides (margins) to sit where the replaced buttons were. */
  style?: StyleProp<ViewStyle>;
}

export function OfflineActionsNotice({
  label = "Showing your last synced info",
  style,
}: OfflineActionsNoticeProps) {
  return (
    <View
      style={[styles.note, style]}
      accessible
      accessibilityLabel={`${label}. Actions are unavailable while offline.`}
    >
      <WifiOff size={14} color="#6B7280" />
      <Text size="xs" weight="regular" color="#6B7280" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
});

export default OfflineActionsNotice;
