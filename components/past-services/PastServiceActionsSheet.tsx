/**
 * PastServiceActionsSheet
 *
 * Bottom-sheet menu reached from the "•••" button on the Past Service
 * detail hero card. Three options, ranked by likely intent:
 *   1. Report an issue → opens <DisputeSheet />
 *   2. View shop info  → router push to the shop detail route
 *   3. Delete          → confirmation alert, then dismiss
 *
 * Visual style matches the Shop "Your order" action sheet: title + X
 * close on the same row, vertical list of icon+label rows, delete row
 * in red. Uses FloatingSheet for the chrome + dim backdrop.
 */

import React, { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AlertCircle, Store, Trash2, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";

const INK = "#0F172A";
const MUTED = "#6B7280";
const DANGER = "#EF4444";

export interface PastServiceActionsSheetRef {
  open: () => void;
  close: () => void;
}

interface PastServiceActionsSheetProps {
  onReportIssue: () => void;
  onViewShopInfo: () => void;
  onDelete: () => void;
}

const SNAP_HEIGHT = 360;

export const PastServiceActionsSheet = forwardRef<
  PastServiceActionsSheetRef,
  PastServiceActionsSheetProps
>(function PastServiceActionsSheet(
  { onReportIssue, onViewShopInfo, onDelete },
  ref,
) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [mounted, setMounted] = React.useState(false);

  useImperativeHandle(ref, () => ({
    open: () => setMounted(true),
    close: () => sheetRef.current?.close(),
  }));

  useEffect(() => {
    if (mounted) sheetRef.current?.open();
  }, [mounted]);

  if (!mounted) return null;

  const dispatch = (cb: () => void) => {
    sheetRef.current?.close();
    // Defer the action callback until the close anim is mostly done
    // so the next sheet / navigation doesn't race the current one.
    setTimeout(cb, 220);
  };

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[SNAP_HEIGHT]}
      showBackdrop
      backdropMode="dim"
      onClose={() => setMounted(false)}
    >
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text weight="bold" size="lg" color={INK}>
            Your service
          </Text>
          <Pressable
            style={styles.closeBtn}
            hitSlop={8}
            onPress={() => sheetRef.current?.close()}
            accessibilityLabel="Close"
          >
            <X size={16} color={INK} strokeWidth={2.4} />
          </Pressable>
        </View>

        <View style={styles.list}>
          <ActionRow
            icon={<AlertCircle size={20} color={INK} strokeWidth={1.8} />}
            label="Report an issue"
            onPress={() => dispatch(onReportIssue)}
          />
          <ActionRow
            icon={<Store size={20} color={INK} strokeWidth={1.8} />}
            label="View shop info"
            onPress={() => dispatch(onViewShopInfo)}
          />
          <ActionRow
            icon={<Trash2 size={20} color={DANGER} strokeWidth={1.8} />}
            label="Delete"
            labelColor={DANGER}
            onPress={() => dispatch(onDelete)}
          />
        </View>
      </View>
    </FloatingSheet>
  );
});

interface ActionRowProps {
  icon: React.ReactNode;
  label: string;
  labelColor?: string;
  onPress: () => void;
}

function ActionRow({ icon, label, labelColor = INK, onPress }: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={styles.rowIcon}>{icon}</View>
      <Text weight="semiBold" size="md" color={labelColor} style={styles.rowLabel}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  list: {
    gap: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 4,
    gap: 16,
    borderRadius: 14,
  },
  rowPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.05)",
  },
  rowIcon: {
    width: 28,
    alignItems: "center",
  },
  rowLabel: {
    flex: 1,
  },
  // Silence "MUTED unused" warning when iterating — kept for future
  // optional subtitle rows.
  _muted: { color: MUTED },
});
