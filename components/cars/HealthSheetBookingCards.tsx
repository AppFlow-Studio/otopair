/**
 * HealthSheetBookingCards
 *
 * PURPOSE: Horizontal carousel of shop booking cards keyed to a vehicle's
 *          urgent maintenance items. Picks the top 3 nearby shops, attaches
 *          their available slots and labor info, and pre-selects the matched
 *          services on tap before pushing into the booking flow.
 *
 * USED IN: components/cars/PostOptimizeBookingSheet.tsx
 *
 * PROPS:
 *   - maintenanceItems: vehicle maintenance items with status (used to filter
 *     urgent items and map them to bookable services)
 *   - onClose: called before navigating to the booking flow so the parent
 *     sheet can dismiss itself
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/shared-ui";
import {
  ShopCard,
  type ShopWithMechanics,
  type SlotWithBookingMeta,
  type SelectedSlotInfo,
  type SelectedServiceInfo,
} from "@/components/booking/sheets/ShopCard";
import { useBookingStore } from "@/stores/useBookingStore";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { scale } from "@/utils/responsive";

// Maintenance-type → booking-service-id. Maps the vehicle's urgent items
// to the service catalog entries the user will pre-select for the shops.
export const MAINTENANCE_TO_SERVICE: Record<string, string> = {
  oil: "svc_oil_change",
  brakes: "svc_brake_pads",
  tires: "svc_tire_rotation",
  fluids: "svc_fluid_change",
  battery: "svc_electrical_check",
  inspection: "svc_engine_diagnostic",
  wipers: "svc_filter_change",
};

interface HealthSheetBookingCardsProps {
  maintenanceItems: Array<{ id: string; serviceName: string; status: string }>;
  onClose: () => void;
}

export function HealthSheetBookingCards({ maintenanceItems, onClose }: HealthSheetBookingCardsProps) {
  const router = useRouter();
  const mechanics = useMechanicStore((s) => s.mechanics);
  const mechanicIds = useMechanicStore((s) => s.mechanicIds);
  const shops = useShopStore((s) => s.shops);
  const availableServices = useBookingStore((s) => s.availableServices);
  const toggleServiceSelection = useBookingStore((s) => s.toggleServiceSelection);
  const clearSelectedServices = useBookingStore((s) => s.clearSelectedServices);

  const [selectedSlot, setSelectedSlot] = useState<SelectedSlotInfo | null>(null);

  const shopGroups = useMemo((): ShopWithMechanics[] => {
    const shopMap = new Map<string, ShopWithMechanics>();
    for (const id of mechanicIds) {
      const mech = mechanics[id];
      if (!mech) continue;
      const existing = shopMap.get(mech.shopId);
      if (existing) {
        existing.mechanics.push(mech);
        if (mech.rating > existing.rating) existing.rating = mech.rating;
        if (mech.isVerified) existing.isVerified = true;
      } else {
        const shop = shops[mech.shopId];
        shopMap.set(mech.shopId, {
          shopId: mech.shopId,
          shopName: mech.shopName,
          rating: mech.rating,
          isVerified: mech.isVerified,
          distanceMi: mech.distanceMi,
          mechanics: [mech],
          laborRate: shop?.labor_rate,
        });
      }
    }
    return Array.from(shopMap.values()).slice(0, 3);
  }, [mechanicIds, mechanics, shops]);

  const urgentItems = maintenanceItems.filter(
    (item) => item.status === "overdue" || item.status === "needs_attention" || item.status === "due_soon"
  );
  const serviceIds = urgentItems
    .map((item) => MAINTENANCE_TO_SERVICE[item.id])
    .filter(Boolean);
  const selectedServices = useMemo((): SelectedServiceInfo[] => {
    if (serviceIds.length === 0) return [];
    return availableServices
      .filter((s) => serviceIds.includes(s.id))
      .map((s) => ({
        id: s.id,
        name: s.name,
        price: 0,
        default_labor_hours: s.default_labor_hours,
        default_parts_estimate: s.default_parts_estimate,
      }));
  }, [availableServices, serviceIds.join(",")]);

  const handleSelectSlot = useCallback(
    (shopId: string, mechanicId: string | null, slot: SlotWithBookingMeta) => {
      setSelectedSlot({ shopId, mechanicId, slot });
      clearSelectedServices();
      serviceIds.forEach((sid) => toggleServiceSelection(sid));
      onClose();
      router.push('/(booking-flow)/select-services');
    },
    [serviceIds, clearSelectedServices, toggleServiceSelection, onClose, router],
  );

  const handleShopDetails = useCallback(
    (shopId: string) => {
      onClose();
      router.push(`/booking/shop/${shopId}`);
    },
    [onClose, router],
  );

  const handleMoreAvailability = useCallback(
    (shopId: string, _mechanicId: string | null) => {
      onClose();
      router.push('/(booking-flow)/select-services');
    },
    [onClose, router],
  );

  if (shopGroups.length === 0) {
    return (
      <View style={{ alignItems: "center", paddingVertical: scale(20) }}>
        <Text weight="semiBold" size="md" color="#6B7280">No shops available nearby</Text>
      </View>
    );
  }

  // Shrink the whole ShopCard (fixed internal padding/fonts) by
  // transforming it down — scales both width and height in one pass
  // without forking ShopCard's layout. The outer wrapper sizes to the
  // inner's natural height so nothing gets clipped; horizontal width
  // matches the scaled visual so cards butt up cleanly.
  const NATURAL_WIDTH = scale(260);
  const CARD_SCALE = 0.82;
  const SCALED_WIDTH = NATURAL_WIDTH * CARD_SCALE;

  return (
    <ScrollView
      horizontal
      pagingEnabled={false}
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={SCALED_WIDTH + scale(12)}
      contentContainerStyle={{ paddingHorizontal: scale(4), gap: scale(12) }}
    >
      {shopGroups.map((shop) => (
        <View key={shop.shopId} style={{ width: SCALED_WIDTH }}>
          <View
            style={{
              width: NATURAL_WIDTH,
              transform: [{ scale: CARD_SCALE }],
              transformOrigin: "top left",
            }}
          >
            <ShopCard
              shop={shop}
              onSelectSlot={handleSelectSlot}
              onShopDetails={handleShopDetails}
              onMoreAvailability={handleMoreAvailability}
              selectedSlot={selectedSlot}
              selectedServices={selectedServices}
            />
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

export default HealthSheetBookingCards;
