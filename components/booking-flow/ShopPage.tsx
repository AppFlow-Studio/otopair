/**
 * ShopPage — one swipeable page of the Choose Mechanic sheet.
 *
 * Renders the per-shop content stack: shop name + "View shop
 * details" link + rating chip · estimated price / time summary
 * card · "CHOOSE YOUR MECHANIC" eyebrow + horizontal mechanic
 * carousel.
 *
 * Each page is self-contained so its own data hooks
 * (useNextAvailability*) fire as the user swipes between shops on
 * Screen 3.
 */

import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { Star, Wrench } from "lucide-react-native";

import { EstimatePill, Text } from "@/components/shared-ui";
import {
  MechanicCarousel,
  type MechanicCarouselItem,
} from "@/components/booking-flow/MechanicCarousel";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useNextAvailabilityForShop } from "@/hooks/useNextAvailabilityForShop";
import { useNextAvailabilityPerMechanicForShop } from "@/hooks/useNextAvailabilityPerMechanicForShop";
import { useShopFixedPricesForServices } from "@/hooks/useShopFixedPricesForServices";
import { buildShopPriceLabel } from "@/lib/shopPriceLabel";
import type { Service, Shop } from "@/stores/types/store.types";

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
  onMechanicCarouselInteractionChange: (isInteracting: boolean) => void;
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
  onMechanicCarouselInteractionChange,
}: ShopPageProps) {
  const router = useRouter();

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
  const { slots: shopSlots } = useNextAvailabilityForShop(shop.id, null, 1);

  // Per-mechanic earliest slots → carousel labels.
  const { slotsByMechanicId } = useNextAvailabilityPerMechanicForShop(shop.id);
  const allMechanicsMap = useMechanicStore((s) => s.mechanics);

  const carouselItems = useMemo<MechanicCarouselItem[]>(() => {
    const items: MechanicCarouselItem[] = [
      {
        mechanicId: null,
        name: "Any",
        photoUrl: null,
        slotLabel: shopSlots.length > 0 ? "Earliest" : "Availability TBD",
      },
    ];
    for (const mechId of Object.keys(slotsByMechanicId)) {
      const mech = allMechanicsMap[mechId];
      if (!mech) continue;
      const earliest = slotsByMechanicId[mechId]?.[0];
      const slotLabel = earliest
        ? `${earliest.dayOfWeek} ${earliest.time}`
        : "TBD";
      items.push({
        mechanicId: mechId,
        name: mech.name,
        photoUrl: mech.photoUrl,
        slotLabel,
        verified: mech.isVerified,
      });
    }
    return items;
  }, [slotsByMechanicId, allMechanicsMap, shopSlots.length]);

  const openShopDetail = useCallback(
    () =>
      router.push({
        pathname: "/booking/shop/[id]",
        params: { id: shop.id },
      }),
    [router, shop.id],
  );

  return (
    // Plain View (not a ScrollView): the page is fixed-height and fits the
    // sheet, so no internal vertical scroll should compete with gorhom's
    // pan — a downward swipe here drags the whole sheet down to reveal the
    // map underneath.
    <View style={[styles.page, styles.pageContent, { width: pageWidth }]}>
      <View style={styles.shopHeader}>
        <View style={styles.shopHeaderText}>
          <Text size="xl" weight="bold" color="#0F172A" numberOfLines={1}>
            {shop.name}
          </Text>
          <Pressable onPress={openShopDetail}>
            <Text size="sm" weight="semiBold" color="#2563EB" style={styles.detailLink}>
              View shop details
            </Text>
          </Pressable>
        </View>
        {shop.rating != null ? (
          <View style={styles.ratingChip}>
            <Star size={13} color="#F59E0B" fill="#F59E0B" strokeWidth={2} />
            <Text size="sm" weight="semiBold" color="#0F172A">
              {shop.rating.toFixed(1)}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Wrench size={18} color="#4B5563" strokeWidth={2} />
        </View>
        <View style={styles.summaryBody}>
          <Text size="md" weight="bold" color="#0F172A">
            {selectedCount} service{selectedCount === 1 ? "" : "s"} ·{" "}
            {formatTotalMinutes(totalMinutes)}
          </Text>
          {priceLabel.text ? (
            <View style={styles.priceRow}>
              <Text size="sm" weight="regular" color="#6B7280">
                {priceLabel.isLaborOnly
                  ? "Labor "
                  : priceLabel.isFixed
                    ? "Fixed price "
                    : "Estimated "}
                <Text weight="bold" color="#0F172A">
                  {priceLabel.text}
                </Text>
              </Text>
              {priceLabel.isLaborOnly && <EstimatePill size="sm" label="Labor only" />}
            </View>
          ) : null}
          {/* State 2 supporting line (doc, layer 2). */}
          {priceLabel.isLaborOnly && (
            <Text size="xs" weight="regular" color="#8E959F" style={styles.laborOnlySupport}>
              Parts not yet included — your shop will price them, and you&#39;ll
              approve the complete quote before any work begins.
            </Text>
          )}
        </View>
      </View>

      <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
        CHOOSE YOUR MECHANIC
      </Text>
      <MechanicCarousel
        items={carouselItems}
        selectedMechanicId={selectedMechanicId}
        onSelect={onSelectMechanic}
        onInteractionChange={onMechanicCarouselInteractionChange}
      />
    </View>
  );
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
  page: {
    flex: 1,
  },
  pageContent: {
    paddingTop: 8,
    paddingBottom: 16,
  },
  shopHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  shopHeaderText: {
    flex: 1,
    gap: 4,
  },
  detailLink: {
    marginTop: 2,
  },
  ratingChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 18,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  summaryBody: {
    flex: 1,
    gap: 2,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  laborOnlySupport: {
    marginTop: 2,
    lineHeight: 16,
  },
  eyebrow: {
    letterSpacing: 0.7,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
});
