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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { ArrowRight, Clock, Trash2, X } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import {
  FloatingSheet,
  type FloatingSheetRef,
} from "@/components/shared-ui/FloatingSheet";
import { getServiceIcon } from "@/components/booking-flow/serviceIcons";
import { TAXONOMY } from "@/constants/serviceTaxonomy";
import { CardShadow } from "@/constants/theme";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useToast } from "@/hooks/useToast";
import { routeToNextBookingStep } from "@/lib/bookingFlowNext";
import { useBookingStore } from "@/stores/useBookingStore";
import { hasConsistentBasketVehicle } from "@/utils/bookingVehicle";

const INK = "#0F172A";
const MUTED = "#6B7280";
const DANGER = "#EF4444";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

// Dynamic sizing — the sheet hugs the row count instead of taking up
// a fixed slab. Floor is 1-service tall (~260pt) so a single row
// doesn't look orphaned; cap matches BookingDetails' mid-detent
// (~640pt) so a giant cart still floats below the status bar with
// the scroll view soaking up the overflow.
const HEADER_BLOCK = 108; // title row + subtitle + paddings + handle clearance
const ROW_HEIGHT = 110; // Screen 2 row aesthetic: label + subtitle + meta
const FOOTER_BLOCK = 88; // sticky Checkout button + its top margin
const FLOOR = 320;
const CEILING = Math.min(SCREEN_HEIGHT * 0.76, 680);

function computeSheetHeight(rowCount: number): number {
  const target =
    HEADER_BLOCK + Math.max(rowCount, 1) * ROW_HEIGHT + FOOTER_BLOCK;
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
    // Reads for the Checkout action — mirror category/[tab].tsx's
    // Continue handler so the cart advances the flow identically.
    const selectedServiceVehicleVins = useBookingStore(
      (s) => s.selectedServiceVehicleVins,
    );
    const selectedVehicleVin = useBookingStore((s) => s.selectedVehicleVin);
    const preSelectedShopId = useBookingStore((s) => s.preSelectedShopId);
    const router = useRouter();
    const toast = useToast();

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
    // catalog reseed). Preserve selection order. Row now carries
    // subtitle + estTimeLabel too so it matches Screen 2's
    // ServiceMultiSelectRow content, not just the label.
    type Row = {
      id: string;
      slug: string;
      label: string;
      subtitle: string;
      estTimeLabel: string;
    };
    const rows = useMemo<Row[]>(() => {
      const out: Row[] = [];
      for (const id of selectedServiceIds) {
        const svc = availableServices.find((s) => s.id === id);
        const slug = svc?.slug;
        if (!slug) continue;
        const entry = TAXONOMY[slug];
        if (!entry) continue;
        out.push({
          id,
          slug,
          label: entry.label,
          subtitle: entry.subtitle,
          estTimeLabel: entry.estTimeLabel,
        });
      }
      return out;
    }, [selectedServiceIds, availableServices]);

    const handleRemove = useCallback(
      (id: string) => {
        toggleServiceSelection(id);
      },
      [toggleServiceSelection],
    );

    // Checkout — same gate + routing as Screen 2's Continue bar
    // (category/[tab].tsx handleContinue → routeToNextBookingStep).
    // Blocks a mixed-vehicle cart with a toast; otherwise closes the
    // sheet and advances to Choose Mechanic (or straight to
    // pick-datetime when a shop was pre-pinned).
    const handleCheckout = useCallback(() => {
      if (
        !hasConsistentBasketVehicle({
          serviceIds: selectedServiceIds,
          serviceVehicleVins: selectedServiceVehicleVins,
          basketVehicleVin: selectedVehicleVin,
        })
      ) {
        toast.error(
          "Services are for different vehicles",
          "Please select services for one vehicle before continuing.",
        );
        return;
      }
      sheetRef.current?.close();
      routeToNextBookingStep(router, preSelectedShopId);
    }, [
      selectedServiceIds,
      selectedServiceVehicleVins,
      selectedVehicleVin,
      preSelectedShopId,
      router,
      toast,
    ]);

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
        backgroundElement={
          <View style={[StyleSheet.absoluteFill, styles.sheetBackground]} />
        }
        onClose={() => setMounted(false)}
      >
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <View style={styles.titleCol}>
              <Text weight="bold" size="lg" color={INK}>
                Your cart
              </Text>
              <Text
                size="sm"
                weight="medium"
                color={MUTED}
                style={styles.titleSubtitle}
              >
                {rows.length === 1
                  ? "1 service ready to book"
                  : `${rows.length} services ready to book`}
              </Text>
            </View>
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
              style={styles.scroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.list}
            >
              {rows.map((row) => {
                const Icon = getServiceIcon(row.slug);
                return (
                  <View key={row.id} style={styles.row}>
                    {Platform.OS === "ios" ? (
                      <BlurView
                        intensity={25}
                        tint="light"
                        style={StyleSheet.absoluteFill}
                      />
                    ) : null}
                    <View style={styles.iconTile}>
                      <Icon size={22} color="#4B5563" strokeWidth={2} />
                    </View>

                    <View style={styles.rowText}>
                      <Text
                        size="md"
                        weight="bold"
                        color={INK}
                        numberOfLines={2}
                        style={styles.rowTitle}
                      >
                        {row.label}
                      </Text>
                      <Text
                        size="sm"
                        weight="regular"
                        color={MUTED}
                        numberOfLines={2}
                        style={styles.rowSubtitle}
                      >
                        {row.subtitle}
                      </Text>
                      <View style={styles.metaRow}>
                        <Clock size={13} color={MUTED} strokeWidth={2} />
                        <Text size="xs" weight="medium" color={MUTED}>
                          {row.estTimeLabel}
                        </Text>
                      </View>
                    </View>

                    <Pressable
                      style={({ pressed }) => [
                        styles.removeBtn,
                        pressed && styles.removeBtnPressed,
                      ]}
                      hitSlop={8}
                      onPress={() => handleRemove(row.id)}
                      accessibilityRole="button"
                      accessibilityLabel={`Remove ${row.label}`}
                    >
                      <Trash2 size={16} color={DANGER} strokeWidth={2.2} />
                    </Pressable>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {rows.length > 0 ? (
            <Pressable
              style={({ pressed }) => [
                styles.checkoutBtn,
                pressed && styles.checkoutBtnPressed,
              ]}
              onPress={handleCheckout}
              accessibilityRole="button"
              accessibilityLabel={`Checkout, ${rows.length} service${
                rows.length === 1 ? "" : "s"
              }`}
            >
              <Text
                size="md"
                weight="semiBold"
                color="#FFFFFF"
                style={styles.checkoutLabel}
              >
                Checkout · {rows.length} service{rows.length === 1 ? "" : "s"}
              </Text>
              <ArrowRight size={20} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          ) : null}
        </View>
      </FloatingSheet>
    );
  },
);

const styles = StyleSheet.create({
  sheetBackground: {
    // Plain white per Ahmad — the glass frosted look competed
    // with the blue selected-tint of the row cards. White gives
    // the tinted rows a clean canvas to sit on.
    backgroundColor: "#FFFFFF",
  },
  body: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 16,
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  titleCol: {
    flexShrink: 1,
    minWidth: 0,
  },
  titleSubtitle: {
    marginTop: 2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  scroll: {
    // Flex so the list soaks up the space between the title and the
    // sticky Checkout footer, keeping the button pinned at the bottom.
    flex: 1,
  },
  list: {
    paddingBottom: 12,
    gap: 10,
  },
  row: {
    // Mirrors ServiceMultiSelectRow's `rowSelected` look so the
    // cart card reads as "the same thing I just tapped, lifted
    // into the review". Pale blue tint + subtle blue border,
    // BlurView backing on iOS for the glass depth, and CardShadow
    // to lift it off the sheet's frosted surface.
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: "rgba(82, 153, 254, 0.16)",
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.45)",
    overflow: "hidden",
    boxShadow: CardShadow.default,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    flexShrink: 1,
  },
  rowSubtitle: {
    marginTop: 2,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  removeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnPressed: {
    backgroundColor: "rgba(239, 68, 68, 0.22)",
  },
  empty: {
    paddingVertical: 28,
    paddingHorizontal: 16,
  },
  // Accent-blue pill mirroring StickyContinueBar so the cart's
  // primary action reads the same as Screen 2's Continue.
  checkoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 54,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: "#5299FE",
    marginTop: 12,
  },
  checkoutBtnPressed: {
    backgroundColor: "#3F84E8",
  },
  checkoutLabel: {
    flex: 1,
    textAlign: "center",
  },
});
