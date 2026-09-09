/**
 * ShopPage — one swipeable page of the Choose Mechanic sheet.
 *
 * The "one decision" layout: a RECOMMENDED eyebrow over the shop's
 * earliest bookable day + time (for the selected mechanic, or the
 * shop overall when "Any"), the price + service summary beside it, a
 * collapsible mechanic picker (tap to reveal every mechanic with
 * their nearest slot — single tap to choose), and a one-line service
 * caption. The map card above carries the shop identity, so the sheet
 * itself is all about the booking.
 *
 * Each page is self-contained so its own data hooks
 * (useNextAvailability*) fire as the user swipes between shops on
 * Screen 3.
 */

import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Check, ChevronDown, ChevronUp, Info, User } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { ServiceInfoSheet } from "@/components/booking-flow/ServiceInfoSheet";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useNextAvailabilityForShop } from "@/hooks/useNextAvailabilityForShop";
import { useNextAvailabilityPerMechanicForShop } from "@/hooks/useNextAvailabilityPerMechanicForShop";
import { useShopFixedPricesForServices } from "@/hooks/useShopFixedPricesForServices";
import { buildShopPriceLabel } from "@/lib/shopPriceLabel";
import { weekdayLongFromISO } from "@/utils/timeSlotUtils";
import type { MechanicAvailabilitySlot, Service, Shop } from "@/stores/types/store.types";

/** One row of the mechanic picker: the "Any" sentinel, then each mechanic. */
interface MechanicOption {
  /** null for the "Any" sentinel; mechanic _id for real mechanics. */
  mechanicId: string | null;
  name: string;
  photoUrl: string | null;
  /** Earliest-slot caption, e.g. "Fri · 6:30 PM" or "Earliest availability". */
  slotLabel: string;
  verified?: boolean;
}

interface ShopPageProps {
  shop: Shop;
  pageWidth: number;
  /** Sum of selected services' resolved labor hours × 60. */
  totalMinutes: number;
  /** Service count for the summary line. */
  selectedCount: number;
  /** The selected service rows — for the per-shop price breakdown. */
  selectedServices: Service[];
  /** Resolved per-service labor hours (empirical → book → default). */
  laborHoursMap: Map<string, number>;
  /** Vehicle owner id — keys the per-shop fixed-price lookup. */
  vehicleOwnerId: string | undefined;
  /** Service ids that need parts but have NONE priced for this vehicle
   *  (State 2 candidates, vehicle-scoped). Each card still applies its own
   *  fixed-price check on top. */
  laborOnlyCandidateIds?: ReadonlySet<string>;
  /** Current mechanic selection for THIS page. null = Any. */
  selectedMechanicId: string | null;
  onSelectMechanic: (mechanicId: string | null) => void;
  /** Whether the mechanic picker accordion is open. Expanding adds rows,
   *  which grows the page — the parent measures that (see `onMeasureHeight`)
   *  and lets the dynamically-sized sheet follow. */
  expanded: boolean;
  onToggleExpanded: (next: boolean) => void;
  /** Reports this page's natural content height so the parent can size the
   *  (otherwise height-less) horizontal pager + dynamic sheet to fit it. */
  onMeasureHeight: (height: number) => void;
}

export function ShopPage({
  shop,
  pageWidth,
  totalMinutes,
  selectedCount,
  selectedServices,
  laborHoursMap,
  vehicleOwnerId,
  laborOnlyCandidateIds,
  selectedMechanicId,
  onSelectMechanic,
  expanded,
  onToggleExpanded,
  onMeasureHeight,
}: ShopPageProps) {
  // Slug of the service whose ⓘ explainer sheet is open (null = closed).
  // Same ServiceInfoSheet the select-services screen opens from its rows.
  const [infoSlug, setInfoSlug] = useState<string | null>(null);

  // Per-shop price: fixed-rate overrides collapse to a guaranteed `$N`,
  // everything else shows the estimate range — same math + source as the
  // floating MapShopCard and Review & Pay (see buildShopPriceLabel).
  const { map: fixedPriceMap } = useShopFixedPricesForServices(
    shop.id,
    vehicleOwnerId ?? null,
    selectedServices.map((s) => s.id),
  );
  const priceLabel = useMemo(
    () =>
      buildShopPriceLabel({
        shop,
        selectedServices,
        laborHoursMap,
        fixedPriceMap,
        laborOnlyCandidateIds,
      }),
    [shop, selectedServices, laborHoursMap, fixedPriceMap, laborOnlyCandidateIds],
  );

  // Next slot for the shop overall (for the Any-mechanic earliest).
  const { slots: shopSlots } = useNextAvailabilityForShop(shop.id, null, 1, totalMinutes);

  // Per-mechanic earliest slots → picker rows.
  const { slotsByMechanicId } = useNextAvailabilityPerMechanicForShop(shop.id, undefined, totalMinutes);
  const allMechanicsMap = useMechanicStore((s) => s.mechanics);

  const mechanicOptions = useMemo<MechanicOption[]>(() => {
    const opts: MechanicOption[] = [
      {
        mechanicId: null,
        name: "Any mechanic",
        photoUrl: null,
        slotLabel:
          shopSlots.length > 0
            ? `Earliest · ${slotShort(shopSlots[0])}`
            : "Earliest availability",
      },
    ];
    for (const mechId of Object.keys(slotsByMechanicId)) {
      const mech = allMechanicsMap[mechId];
      if (!mech) continue;
      const earliest = slotsByMechanicId[mechId]?.[0];
      opts.push({
        mechanicId: mechId,
        name: mech.name,
        photoUrl: mech.photoUrl,
        slotLabel: earliest ? slotShort(earliest) : "No open times",
        verified: mech.isVerified,
      });
    }
    return opts;
  }, [shopSlots, slotsByMechanicId, allMechanicsMap]);

  const realMechanics = useMemo(
    () => mechanicOptions.filter((o) => o.mechanicId !== null),
    [mechanicOptions],
  );

  // The earliest bookable slot for the current mechanic choice — drives the
  // big RECOMMENDED day/time. "Any" uses the shop's next slot; a specific
  // mechanic uses their own.
  const recommendedSlot = useMemo<MechanicAvailabilitySlot | null>(() => {
    if (selectedMechanicId) return slotsByMechanicId[selectedMechanicId]?.[0] ?? null;
    return shopSlots[0] ?? null;
  }, [selectedMechanicId, slotsByMechanicId, shopSlots]);

  const selectedOption =
    mechanicOptions.find((o) => o.mechanicId === selectedMechanicId) ?? null;

  const serviceNames = useMemo(
    () => selectedServices.map((s) => s.displayLabel ?? s.name).join(", "),
    [selectedServices],
  );
  const priceTypeLabel = priceLabel.isLaborOnly
    ? "labor estimate"
    : priceLabel.isFixed
      ? "fixed price"
      : "estimated price";

  const onPressCaption = () => {
    const firstSlug = selectedServices.find((s) => s.slug)?.slug;
    if (firstSlug) setInfoSlug(firstSlug);
  };

  return (
    // Plain View (not a ScrollView): the page is content-height and the
    // dynamically-sized sheet follows it, so no internal vertical scroll
    // should compete with gorhom's pan — a downward swipe here drags the
    // whole sheet down to reveal the map underneath. `onLayout` feeds the
    // parent this page's natural height so it can size the pager + sheet.
    <View
      style={[styles.pageContent, { width: pageWidth }]}
      onLayout={(e) => onMeasureHeight(e.nativeEvent.layout.height)}
    >
      {/* RECOMMENDED — the shop's (or mechanic's) earliest slot, front and
          center, with the price + service summary beside it. */}
      <Text size="xs" weight="bold" color="#5299FE" style={styles.recEyebrow}>
        RECOMMENDED
      </Text>
      <View style={styles.recRow}>
        <View style={styles.recLeft}>
          {recommendedSlot ? (
            <>
              <Text weight="bold" color="#0F172A" style={styles.recDay}>
                {recommendedSlot.scheduledDate
                  ? weekdayLongFromISO(recommendedSlot.scheduledDate)
                  : recommendedSlot.dayOfWeek}
              </Text>
              <Text weight="bold" color="#0F172A" style={styles.recTime}>
                {recommendedSlot.time}
              </Text>
            </>
          ) : (
            <Text weight="bold" color="#0F172A" style={styles.recDay}>
              No open times
            </Text>
          )}
        </View>
        <View style={styles.recRight}>
          <Text weight="bold" color="#0F172A" style={styles.recPrice} numberOfLines={2}>
            {priceLabel.text ?? "—"}
          </Text>
          <Text size="sm" weight="medium" color="#6B7280" style={styles.recMeta}>
            {selectedCount} service{selectedCount === 1 ? "" : "s"} · {formatTotalMinutes(totalMinutes)}
          </Text>
        </View>
      </View>

      {/* Mechanic picker — collapsed to a single card by default, tap to
          reveal every mechanic + their nearest time (single-tap select). */}
      <View style={styles.pickerCard}>
        <Pressable
          style={styles.pickerHeader}
          onPress={() => onToggleExpanded(!expanded)}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={
            selectedOption && selectedOption.mechanicId
              ? `Mechanic: ${selectedOption.name}. Tap to change.`
              : `Any of ${realMechanics.length} mechanics. Tap to pick a specific one.`
          }
        >
          {selectedOption && selectedOption.mechanicId ? (
            <Avatar photoUrl={selectedOption.photoUrl} name={selectedOption.name} />
          ) : (
            <StackedAvatars mechanics={realMechanics} />
          )}
          <View style={styles.pickerHeaderBody}>
            {selectedOption && selectedOption.mechanicId ? (
              <>
                <Text size="md" weight="bold" color="#0F172A" numberOfLines={1}>
                  {selectedOption.name}
                </Text>
                <Text size="xs" weight="medium" color="#6B7280" numberOfLines={1}>
                  {selectedOption.slotLabel}
                </Text>
              </>
            ) : (
              <>
                <Text size="md" weight="bold" color="#0F172A" numberOfLines={1}>
                  Any of {realMechanics.length} mechanic{realMechanics.length === 1 ? "" : "s"}
                </Text>
                <Text size="xs" weight="medium" color="#6B7280" numberOfLines={1}>
                  Pick a specific one
                </Text>
              </>
            )}
          </View>
          {expanded ? (
            <ChevronUp size={20} color="#9CA3AF" strokeWidth={2} />
          ) : (
            <ChevronDown size={20} color="#9CA3AF" strokeWidth={2} />
          )}
        </Pressable>

        {expanded ? (
          <Animated.View
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            style={styles.pickerList}
          >
            {mechanicOptions.map((opt) => {
              const isSelected = opt.mechanicId === selectedMechanicId;
              return (
                <Pressable
                  key={opt.mechanicId ?? "any"}
                  style={styles.pickerRow}
                  onPress={() => {
                    onSelectMechanic(opt.mechanicId);
                    onToggleExpanded(false);
                  }}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${opt.name}, ${opt.slotLabel}`}
                >
                  {opt.mechanicId === null ? (
                    <View style={styles.anyAvatar}>
                      <User size={20} color="#6B7280" strokeWidth={2} />
                    </View>
                  ) : (
                    <Avatar photoUrl={opt.photoUrl} name={opt.name} verified={opt.verified} />
                  )}
                  <View style={styles.pickerRowBody}>
                    <Text size="sm" weight="semiBold" color="#0F172A" numberOfLines={1}>
                      {opt.name}
                    </Text>
                    <Text size="xs" weight="medium" color="#6B7280" numberOfLines={1}>
                      {opt.slotLabel}
                    </Text>
                  </View>
                  <View style={[styles.radio, isSelected && styles.radioSelected]}>
                    {isSelected ? <Check size={12} color="#FFFFFF" strokeWidth={3} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </Animated.View>
        ) : null}
      </View>

      {/* Service caption — the selected work + the price basis. Tapping opens
          the explainer for the first service (the ⓘ affordance). */}
      {serviceNames.length > 0 ? (
        <Pressable
          style={styles.caption}
          onPress={onPressCaption}
          accessibilityRole="button"
          accessibilityLabel={`${serviceNames}. ${priceTypeLabel}.`}
        >
          <Info size={13} color="#9CA3AF" strokeWidth={2} style={styles.captionIcon} />
          <Text size="xs" weight="regular" color="#8E959F" style={styles.captionText} numberOfLines={2}>
            {serviceNames} · {priceTypeLabel}
          </Text>
        </Pressable>
      ) : null}

      {/* ⓘ explainer sheet — same one the select-services rows open. */}
      {infoSlug ? (
        <ServiceInfoSheet slug={infoSlug} onClose={() => setInfoSlug(null)} />
      ) : null}
    </View>
  );
}

// ── Avatars ────────────────────────────────────────────────────

function Avatar({
  photoUrl,
  name,
  verified,
}: {
  photoUrl: string | null;
  name: string;
  verified?: boolean;
}) {
  return (
    <View style={styles.avatarWrap}>
      <View style={styles.avatar}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={styles.avatarImage} />
        ) : (
          <Text size="sm" weight="bold" color="#4B5563">
            {name.charAt(0).toUpperCase()}
          </Text>
        )}
      </View>
      {verified ? (
        <View style={styles.verifiedBadge}>
          <Check size={9} color="#FFFFFF" strokeWidth={3} />
        </View>
      ) : null}
    </View>
  );
}

/** Up to three overlapping avatars for the collapsed "Any" state. */
function StackedAvatars({ mechanics }: { mechanics: MechanicOption[] }) {
  const shown = mechanics.slice(0, 3);
  if (shown.length === 0) {
    return (
      <View style={styles.anyAvatar}>
        <User size={20} color="#6B7280" strokeWidth={2} />
      </View>
    );
  }
  return (
    <View style={styles.stack}>
      {shown.map((m, i) => (
        <View
          key={m.mechanicId ?? i}
          style={[styles.stackAvatar, i > 0 && styles.stackAvatarOverlap]}
        >
          {m.photoUrl ? (
            <Image source={{ uri: m.photoUrl }} style={styles.avatarImage} />
          ) : (
            <Text size="xs" weight="bold" color="#4B5563">
              {m.name.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────

/** "Fri · 6:30 PM" — compact earliest-slot label for a picker row. */
function slotShort(slot: MechanicAvailabilitySlot): string {
  return `${slot.dayOfWeek} · ${slot.time}`;
}

function formatTotalMinutes(min: number): string {
  if (min <= 0) return "Time TBD";
  if (min < 60) return `~${min} min`;
  const hrs = Math.floor(min / 60);
  const rem = min - hrs * 60;
  if (rem === 0) return `~${hrs} hr`;
  return `~${hrs} hr ${rem} min`;
}

const styles = StyleSheet.create({
  pageContent: {
    paddingTop: 6,
    paddingBottom: 8,
    paddingHorizontal: 20,
  },
  recEyebrow: {
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  recRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  recLeft: {
    flexShrink: 1,
  },
  recDay: {
    fontSize: 26,
    lineHeight: 30,
  },
  recTime: {
    fontSize: 26,
    lineHeight: 30,
  },
  recRight: {
    alignItems: "flex-end",
    flexShrink: 1,
  },
  recPrice: {
    fontSize: 22,
    lineHeight: 26,
    textAlign: "right",
  },
  recMeta: {
    marginTop: 4,
    textAlign: "right",
  },
  pickerCard: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    overflow: "hidden",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  pickerHeaderBody: {
    flex: 1,
    minWidth: 0,
  },
  pickerList: {
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.06)",
    paddingHorizontal: 14,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(15, 23, 42, 0.05)",
  },
  pickerRowBody: {
    flex: 1,
    minWidth: 0,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(15, 23, 42, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  radioSelected: {
    backgroundColor: "#5299FE",
    borderColor: "#5299FE",
  },
  caption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 12,
  },
  captionIcon: {
    marginTop: 1,
  },
  captionText: {
    flex: 1,
    lineHeight: 16,
  },
  // Avatars
  avatarWrap: {
    width: 40,
    height: 40,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#E5EBF1",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  anyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  verifiedBadge: {
    position: "absolute",
    right: -1,
    top: -1,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#F3F4F6",
  },
  stack: {
    flexDirection: "row",
    alignItems: "center",
    height: 40,
  },
  stackAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#E5EBF1",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: 2,
    borderColor: "#F3F4F6",
  },
  stackAvatarOverlap: {
    marginLeft: -14,
  },
});
