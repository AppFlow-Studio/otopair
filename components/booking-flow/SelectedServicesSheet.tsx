/**
 * SelectedServicesSheet — Screen 2's cart review surface.
 *
 * Opens from the bottom-right FAB. Lists every currently-selected
 * service across all category tabs, in selection order, with an X
 * on each row to remove it. Removing the last service auto-closes
 * the sheet (the FAB also disappears since it's count-gated).
 *
 * Rows show ONLY the service label per Ahmad's UX call — no
 * subtitle, no price (pricing isn't resolved until a shop is
 * picked downstream). Icon comes from the shared `serviceIcons`
 * helper so it stays in sync with the row cards on Screen 2.
 *
 * Defensive: silently skips selected ids whose service / slug /
 * TAXONOMY entry can't be resolved (e.g. catalog reseed left a
 * stale id in the cart).
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Dimensions,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import {
  FloatingSheet,
  type FloatingSheetRef,
} from "@/components/shared-ui/FloatingSheet";
import { getServiceIcon } from "@/components/booking-flow/serviceIcons";
import { TAXONOMY } from "@/constants/serviceTaxonomy";
import { useBookingStore } from "@/stores/useBookingStore";

const INK = "#0F172A";
const MUTED = "#6B7280";
const DANGER = "#EF4444";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Dynamic sizing — the sheet hugs the row count instead of taking up
// a fixed slab. Floor is 1-service tall (~260pt) so a single row
// doesn't look orphaned; cap matches BookingDetails' mid-detent
// (~640pt) so a giant cart still floats below the status bar with
// the scroll view soaking up the overflow.
const HEADER_BLOCK = 96; // title row + paddings + handle clearance
const ROW_HEIGHT = 70; // row body + gap
const FLOOR = 260;
const CEILING = Math.min(SCREEN_HEIGHT * 0.76, 640);

function computeSheetHeight(rowCount: number): number {
  const target = HEADER_BLOCK + Math.max(rowCount, 1) * ROW_HEIGHT;
  return Math.max(FLOOR, Math.min(CEILING, target));
}

export interface SelectedServicesSheetRef {
  open: () => void;
  close: () => void;
}

export const SelectedServicesSheet = forwardRef<SelectedServicesSheetRef>(
  function SelectedServicesSheet(_props, ref) {
    const sheetRef = useRef<FloatingSheetRef>(null);
    const [mounted, setMounted] = useState(false);

    const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
    const availableServices = useBookingStore((s) => s.availableServices);
    const toggleServiceSelection = useBookingStore(
      (s) => s.toggleServiceSelection,
    );

    useImperativeHandle(ref, () => ({
      open: () => setMounted(true),
      close: () => sheetRef.current?.close(),
    }));

    useEffect(() => {
      if (mounted) sheetRef.current?.open();
    }, [mounted]);

    // Auto-close once the cart empties out from inside the sheet.
    // The sheet stays mounted just long enough to finish its
    // close animation; FloatingSheet's onClose fires after that
    // and unmounts via setMounted(false).
    useEffect(() => {
      if (!mounted) return;
      if (selectedServiceIds.length === 0) {
        sheetRef.current?.close();
      }
    }, [mounted, selectedServiceIds.length]);

    // Resolve the selected ids into renderable rows. Skip any id
    // that can't be matched (defensive against stale ids after a
    // catalog reseed). Preserve selection order.
    const rows = useMemo(() => {
      const out: { id: string; slug: string; label: string }[] = [];
      for (const id of selectedServiceIds) {
        const svc = availableServices.find((s) => s.id === id);
        const slug = svc?.slug;
        if (!slug) continue;
        const entry = TAXONOMY[slug];
        if (!entry) continue;
        out.push({ id, slug, label: entry.label });
      }
      return out;
    }, [selectedServiceIds, availableServices]);

    const handleRemove = useCallback(
      (id: string) => {
        toggleServiceSelection(id);
      },
      [toggleServiceSelection],
    );

    // Snap-height tracks the row count — FloatingSheet animates
    // between snap heights when `snapHeights` changes, so removing
    // a row also smoothly shrinks the sheet down.
    const sheetHeight = useMemo(
      () => computeSheetHeight(rows.length),
      [rows.length],
    );

    if (!mounted) return null;

    return (
      <FloatingSheet
        ref={sheetRef}
        snapHeights={[sheetHeight]}
        showBackdrop
        backdropMode="dim"
        onClose={() => setMounted(false)}
      >
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text weight="bold" size="lg" color={INK}>
              Selected services
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

          {rows.length === 0 ? (
            // Brief empty state while the auto-close anim is running.
            // Once the close fires, FloatingSheet unmounts via onClose.
            <View style={styles.empty}>
              <Text size="sm" color={MUTED} center>
                No services selected.
              </Text>
            </View>
          ) : (
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
            >
              {rows.map((row) => {
                const Icon = getServiceIcon(row.slug);
                return (
                  <View key={row.id} style={styles.row}>
                    <View style={styles.iconTile}>
                      <Icon size={22} color="#4B5563" strokeWidth={2} />
                    </View>
                    <Text
                      weight="semiBold"
                      size="md"
                      color={INK}
                      style={styles.label}
                      numberOfLines={2}
                    >
                      {row.label}
                    </Text>
                    <Pressable
                      style={({ pressed }) => [
                        styles.removeBtn,
                        pressed && styles.removeBtnPressed,
                      ]}
                      hitSlop={6}
                      onPress={() => handleRemove(row.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${row.label}`}
                    >
                      <X size={16} color={DANGER} strokeWidth={2.4} />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </FloatingSheet>
    );
  },
);

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 22,
    paddingTop: 4,
    paddingBottom: 16,
    flex: 1,
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
    paddingBottom: 12,
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.7)",
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    flex: 1,
    minWidth: 0,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnPressed: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
});
