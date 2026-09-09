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
import { BrandColors } from "@/constants/theme";

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

const SNAP_HEIGHT = 290;

export const PastServiceActionsSheet = forwardRef<
  PastServiceActionsSheetRef,
  PastServiceActionsSheetProps
>(function PastServiceActionsSheet(
  { onReportIssue, onViewShopInfo, onDelete },
  ref,
) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [mounted, setMounted] = React.useState(false);
  // The callback the user picked. Held in a ref so it survives the
  // close animation, then fired from `onClose` AFTER the action
  // sheet's RN Modal has fully unmounted. Two FloatingSheets stacked
  // back-to-back via a naive setTimeout race iOS's Modal manager —
  // the second .open() request gets silently dropped while the
  // first is still dismissing. Driving the chain off onClose makes
  // the next sheet open only when there's no Modal already on
  // screen.
  const pendingActionRef = useRef<(() => void) | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => setMounted(true),
    close: () => sheetRef.current?.close(),
  }));

  useEffect(() => {
    if (mounted) sheetRef.current?.open();
  }, [mounted]);

  if (!mounted) return null;

  const queueAndClose = (cb: () => void) => {
    pendingActionRef.current = cb;
    sheetRef.current?.close();
  };

  const handleClose = () => {
    setMounted(false);
    const cb = pendingActionRef.current;
    pendingActionRef.current = null;
    if (cb) {
      // One frame of breathing room after Modal unmount before we
      // present the next sheet's Modal. Empirically iOS needs this
      // gap or the second present occasionally no-ops.
      setTimeout(cb, 50);
    }
  };

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[SNAP_HEIGHT]}
      showBackdrop
      backdropMode="dim"
      onClose={handleClose}
    >
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text size={28} weight="extraBold" color={BrandColors.primary}>
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
            onPress={() => queueAndClose(onReportIssue)}
          />
          <ActionRow
            icon={<Store size={20} color={INK} strokeWidth={1.8} />}
            label="View shop info"
            onPress={() => queueAndClose(onViewShopInfo)}
          />
          <ActionRow
            icon={<Trash2 size={20} color={DANGER} strokeWidth={1.8} />}
            label="Delete"
            labelColor={DANGER}
            onPress={() => queueAndClose(onDelete)}
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
