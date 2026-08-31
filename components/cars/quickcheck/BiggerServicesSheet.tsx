/**
 * Bigger Services — the list half of the tile (Quick Check Spec v2 §6).
 *
 * Deliberately a LIST, not a form. Each row opens the same one-question sheet
 * every other tile uses; the driver answers one thing at a time and comes back
 * here. Putting five inline controls on one screen is the fifteen-row form the
 * pool constant exists to prevent, and it makes "skip this one" ambiguous.
 *
 * Nothing here is required. A driver can close the sheet having answered none,
 * one, or all of them, and the tile counts as done either way — these are the
 * services we are least entitled to expect an answer about.
 */
import React, { useEffect, useRef } from "react";
import { Dimensions, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { Check, ChevronRight } from "lucide-react-native";

import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { Text } from "@/components/shared-ui";
import { Spacing } from "@/constants/theme";
import { moderateScale, scale } from "@/utils/responsive";
import type { BiggerServiceCandidate } from "@/utils/quickCheckBiggerServices";

const BLUE = "#5299FE";
const BLUE_BG = "#EEF4FF";
const BORDER = "#E5E7EB";
const TEXT_PRIMARY = "#111827";
const TEXT_SECONDARY = "#6B7280";
const TEXT_MUTED = "#9CA3AF";

const SHEET_MIN = 300;
const SHEET_MAX = Math.round(Dimensions.get("window").height * 0.82);
const SHEET_CHROME = 34;

function formatMiles(n: number): string {
  return n.toLocaleString("en-US");
}

export function BiggerServicesSheet({
  candidates,
  visible,
  onClose,
  onPick,
  onDone,
}: {
  candidates: BiggerServiceCandidate[];
  visible: boolean;
  onClose: () => void;
  /** Opens the one-question sheet for this service. */
  onPick: (candidate: BiggerServiceCandidate) => void;
  /** "Done for now" — marks the tile complete without requiring answers. */
  onDone: () => void;
}) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [contentHeight, setContentHeight] = React.useState(SHEET_MIN);

  useEffect(() => {
    if (!visible) return;
    sheetRef.current?.open();
  }, [visible]);

  if (candidates.length === 0) return null;

  const answered = candidates.filter((c) => c.answered).length;

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[Math.min(SHEET_MAX, Math.max(SHEET_MIN, contentHeight + SHEET_CHROME))]}
      showBackdrop
      liftWithKeyboard
      floatBottomInset={12}
      // Rendered inline, not in a native Modal. This sheet opens from inside
      // the stepper, which is ITSELF presented in a Modal, and a
      // modal-over-modal on iOS came up visible but completely inert — no row,
      // no button, not even the backdrop responded to a touch. There is no tab
      // bar behind the stepper for the Modal to sit above, which is the only
      // thing it buys.
      renderInModal={false}
      onClose={onClose}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={(_w, h) => setContentHeight(h)}
      >
        <Text weight="bold" size="xl" color={TEXT_PRIMARY}>
          A few bigger services
        </Text>
        <Text size="sm" color={TEXT_SECONDARY} style={styles.subtitle}>
          {/* States the estimate honestly. We are inferring from the odometer
              because nobody has told us otherwise — which is the reason to
              ask, and the reason none of it is required. */}
          Going by your mileage, these may be coming up. Answer any you know.
        </Text>

        {candidates.map((c) => (
          <Pressable
            key={c.slug}
            onPress={() => onPick(c)}
            style={({ pressed }) => [
              styles.row,
              c.answered && styles.rowAnswered,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowText}>
              <Text weight="semiBold" size="md" color={TEXT_PRIMARY}>
                {c.label}
              </Text>
              <Text size="xs" color={TEXT_MUTED} style={styles.rowMeta}>
                {c.answered
                  ? "Answered"
                  : c.intervalMiles
                    ? `Typically every ${formatMiles(c.intervalMiles)} mi`
                    // Some services are timed, not driven — Class B brake
                    // fluid is 24 months and no mileage at all.
                    : c.intervalMonths
                      ? `Typically every ${c.intervalMonths} months`
                      : "Worth checking"}
              </Text>
            </View>
            {c.answered ? (
              <View style={styles.tick}>
                <Check size={scale(13)} color="#FFFFFF" strokeWidth={3} />
              </View>
            ) : (
              <ChevronRight size={scale(18)} color={TEXT_MUTED} />
            )}
          </Pressable>
        ))}

        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.done, pressed && styles.pressed]}
        >
          <Text weight="bold" size="md" color="#FFFFFF">
            {answered > 0 ? "Done" : "Skip for now"}
          </Text>
        </Pressable>
      </ScrollView>
    </FloatingSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.lg,
    paddingTop: scale(4),
    paddingBottom: scale(24),
  },
  subtitle: { marginTop: scale(4), marginBottom: scale(14) },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: scale(16),
    paddingVertical: scale(14),
    borderRadius: moderateScale(16),
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: "#FFFFFF",
    marginTop: scale(8),
  },
  rowAnswered: { borderColor: BLUE, backgroundColor: BLUE_BG },
  rowText: { flex: 1, paddingRight: scale(12) },
  rowMeta: { marginTop: scale(2) },
  tick: {
    width: scale(22),
    height: scale(22),
    borderRadius: moderateScale(11),
    backgroundColor: BLUE,
    alignItems: "center",
    justifyContent: "center",
  },
  done: {
    marginTop: scale(18),
    paddingVertical: scale(15),
    borderRadius: moderateScale(999),
    alignItems: "center",
    backgroundColor: BLUE,
  },
  pressed: { opacity: 0.7 },
});
