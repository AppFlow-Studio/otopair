/**
 * Screen 3 · Choose Mechanic — booking-flow.
 *
 * Map is the full-bleed canvas. Bottom sheet hosts a horizontal-
 * paged carousel of nearby shops (closest first, "covers all
 * selected services" prioritized). As the user swipes between
 * pages, the map camera animates to the active shop and the
 * mechanic selection resets (mechanics are per-shop). Sticky
 * Continue at the bottom shows "Continue with <Any | Name>" for
 * the active shop's choice and pushes shopId + mechanicId to
 * Screen 4.
 *
 * Spec: ~/Downloads/<figma frames> Screen 3 + Ahmad's per-page
 * swipe interaction.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Pressable,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useMutation } from "convex/react";
import type { FunctionReference } from "convex/server";
// gesture-handler ScrollView so the nested mechanic-carousel swipe
// composes with the shop pager on Android (see the android-gestures
// source test).
import { ScrollView } from "react-native-gesture-handler";
import { useFocusEffect, useNavigation } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet, {
  BottomSheetFooter,
  BottomSheetView,
  useBottomSheetTimingConfigs,
  type BottomSheetFooterProps,
} from "@gorhom/bottom-sheet";
import { ArrowLeft, ArrowRight, Calendar, Crosshair, Minus, Plus } from "lucide-react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { Text } from "@/components/shared-ui";
import { useBookingFlowMap } from "@/components/booking-flow/BookingFlowMap";
import { MapBrowseShopCard } from "@/components/booking-flow/MapBrowseShopCard";
import { MapShopCard } from "@/components/booking-flow/MapShopCard";
import { RatingMarkerPill } from "@/components/booking-flow/RatingMarkerPill";
import { ShopPage } from "@/components/booking-flow/ShopPage";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
import { useMechanicStore } from "@/stores/useMechanicStore";
import { useShopStore } from "@/stores/useShopStore";
import { distanceBetween } from "@/utils/geo";
import { useNearbyBookingShops } from "@/hooks/useNearbyBookingShops";
import { useOfflineGuard } from "@/hooks/useOfflineGuard";
import { useNextAvailabilityForShop } from "@/hooks/useNextAvailabilityForShop";
import { useBookingLaborHoursMap } from "@/hooks/useBookingLaborHoursMap";
import { useBookingPartsBreakdown } from "@/hooks/useBookingPartsBreakdown";
import { useShopFixedPricesForServices } from "@/hooks/useShopFixedPricesForServices";
import { useToast } from "@/hooks/useToast";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { buildShopPriceLabel } from "@/lib/shopPriceLabel";
import { weekdayLongFromISO } from "@/utils/timeSlotUtils";

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;
// The sheet is a floating detached card inset from the screen edges, so its
// inner width (and therefore the paged shop carousel's page width) is the
// screen minus the side insets — NOT the full screen width. The external
// browse-card carousel still spans the full screen, so it keeps SCREEN_WIDTH.
const SHEET_SIDE_INSET = 12;
const SHEET_WIDTH = SCREEN_WIDTH - SHEET_SIDE_INSET * 2;
// The sheet is dynamically sized (`enableDynamicSizing`): its height tracks
// the measured content, so it stays as short as the one-decision card needs
// and grows only when the mechanic picker accordion opens. Capped below screen
// so a shop with many mechanics can't push the sheet past the top. With
// `enablePanDownToClose`, the user can still drag it OUT of view entirely — at
// which point `sheetIndex === -1` and the screen swaps to the browse-card
// carousel (ChatGPT-style "shops on a map" mode). Tap a card to reopen it.
const SHEET_MAX_HEIGHT = Math.round(SCREEN_HEIGHT * 0.88);
// Height reserved at the bottom of the sheet for the pinned footer (paddingTop
// 10 + 56 button + paddingBottom 16). The sheet content pads by this so its
// last row clears the footer, and — since the footer floats over the measured
// content — this reserve is what makes the dynamic height include it.
const SHEET_FOOTER_HEIGHT = 82;

// Slot-hold mutation — reserve the earliest slot the instant the customer taps
// the Book CTA, before the payment hop, so it can't be double-booked during
// checkout (same reservation the manual pick-datetime path performs).
type HoldSlotArgs = {
  shop_id: Id<"shops">;
  mechanic_id?: Id<"mechanics">;
  date: string;
  start_time: string;
  duration_minutes: number;
  session_id: string;
  held_by?: Id<"users">;
};
type HoldSlotResult = {
  holdId: Id<"slot_holds"> | null;
  mechanicId: Id<"mechanics"> | null;
  expiresAt: number | null;
  disabled?: boolean;
};
const holdSlotRef = api.slotHolds.holdSlot as FunctionReference<
  "mutation",
  "public",
  HoldSlotArgs,
  HoldSlotResult
>;

const DAY_ABBREV = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "Fri, June 9" — the display date payment/confirmation read off the booking
// store (mirrors pick-datetime's formatDateHeader so both entry paths match).
function formatBookingDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${DAY_ABBREV[dt.getDay()]}, ${MONTH_LONG[dt.getMonth()]} ${dt.getDate()}`;
}

export default function ChooseMechanicScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const availableServices = useBookingStore((s) => s.availableServices);
  const selectedServiceOptions = useBookingStore((s) => s.selectedServiceOptions);
  // Pre-pinned shop from the shop-detail "Book a Service" CTA. When
  // set, the carousel below filters down to JUST this shop so the
  // user lands on the shop they came in for. Cleared via
  // `clearPreSelections` (booking store) on flow reset.
  const preSelectedShopId = useBookingStore((s) => s.preSelectedShopId);
  const ownershipId = useVehicleStore((s) => s.getSelectedVehicle())?.ownershipId;

  // Booking-store writers + the slot hold, for the Book CTA's straight-to-pay
  // fast path (hold the earliest slot, seed the store, push Review & Pay — the
  // same handoff pick-datetime does, minus the calendar).
  const ensureHoldSessionId = useBookingStore((s) => s.ensureHoldSessionId);
  const setSlotHold = useBookingStore((s) => s.setSlotHold);
  const setSelectedMechanicSlot = useBookingStore((s) => s.setSelectedMechanicSlot);
  const setScheduledAppointment = useBookingStore((s) => s.setScheduledAppointment);
  const selectMechanic = useBookingStore((s) => s.selectMechanic);
  const getMechanicById = useMechanicStore((s) => s.getMechanicById);
  const holdSlot = useMutation(holdSlotRef);
  const { userId } = useUserFromConvex();
  const toast = useToast();
  // Guards against a double-tap / shows a spinner in the CTA while the hold
  // round-trips before we navigate to payment.
  const [isBookingEarliest, setIsBookingEarliest] = useState(false);

  // Engine-adjusted + director-rounded labor (empirical → book →
  // engine-tier → catalog-default) — same source as Review & Pay so the
  // estimate breakdown on each shop page matches what the customer pays.
  const { laborHoursMap } = useBookingLaborHoursMap(ownershipId, selectedServiceIds);

  // Real per-vehicle OEM parts totals (winning fitments × unit price) — the
  // same source as Review & Pay. Without this the estimate is labor-only,
  // because the catalog `default_parts_estimate` fallback is ~$0 for most
  // parts-bearing services (e.g. spark plugs).
  const { breakdown: pricedPartsByService } = useBookingPartsBreakdown(
    ownershipId,
    selectedServiceIds,
    selectedServiceOptions,
  );
  const realPartsCostMap = useMemo(() => {
    const m = new Map<string, number>();
    for (const row of pricedPartsByService) {
      if (row.winner !== null && row.partsTotal > 0) {
        m.set(String(row.serviceId), row.partsTotal);
      }
    }
    return m;
  }, [pricedPartsByService]);

  // State 2 (Labor Only) candidates: services that need parts + labor but have
  // NONE priced for this vehicle. Vehicle-scoped (same across shops); each card
  // subtracts its own fixed-price lines. `=== false` (not truthiness) degrades
  // safely — an older backend without `laborOnlyByDesign` yields undefined → no
  // candidate → no badge, until web ships the field.
  const laborOnlyCandidateIds = useMemo(() => {
    const s = new Set<string>();
    for (const row of pricedPartsByService) {
      const hasPricedParts = row.winner !== null && row.partsTotal > 0;
      if (row.laborOnlyByDesign === false && !hasPricedParts) {
        s.add(String(row.serviceId));
      }
    }
    return s;
  }, [pricedPartsByService]);

  const selectedServices = useMemo(
    () => availableServices.filter((s) => selectedServiceIds.includes(s.id)),
    [availableServices, selectedServiceIds],
  );

  // Overlay the real OEM parts total onto each service so the price band
  // (buildShopPriceLabel → deriveDisclosedRange) brackets the actual parts
  // cost rather than the ~$0 catalog default. Falls back to the default when
  // the resolver has no winner (unenriched vehicle/service).
  const selectedServicesForPricing = useMemo(
    () =>
      selectedServices.map((s) => {
        const realParts = realPartsCostMap.get(String(s.id));
        return realParts != null
          ? { ...s, default_parts_estimate: realParts }
          : s;
      }),
    [selectedServices, realPartsCostMap],
  );

  const { results: nearbyResults, isLoading: shopsLoading } = useNearbyBookingShops(5);
  // Map-screen offline rule (same wiring as select-services): entering
  // fresh while offline with no hydrated shops → CantLoadModal sends the
  // user back; if shops are already cached, the pill alone is enough.
  useOfflineGuard(shopsLoading ? undefined : nearbyResults);
  const getShopById = useShopStore((s) => s.getShopById);
  const userLocationForDistance = useBookingStore((s) => s.userLocation);

  // When the user entered via the shop-detail Book CTA, the booking
  // store has `preSelectedShopId` set — surface that shop as the
  // FIRST page of the swipe deck, but keep the rest of the nearby
  // shops available so the user can still browse alternatives.
  //
  // Two sub-cases for sourcing the pinned shop's NearbyShopResult:
  //   1. It's already in the top-5 nearby (the common case) — pull
  //      it out of nearbyResults so distance + coversAll stay
  //      accurate, then put it at index 0 with the others behind.
  //   2. It isn't in the top-5 (user searched a far-away shop) —
  //      synthesize a NearbyShopResult from useShopStore +
  //      userLocation so the pinned shop still surfaces, then
  //      append the regular nearby list behind it.
  const KM_PER_MI = 1.609344;
  const nearbyShops = useMemo(() => {
    if (!preSelectedShopId) return nearbyResults;
    const matchInNearby = nearbyResults.find((r) => r.shop.id === preSelectedShopId);
    if (matchInNearby) {
      // Move the matched shop to the front, keep the rest in order.
      const rest = nearbyResults.filter((r) => r.shop.id !== preSelectedShopId);
      return [matchInNearby, ...rest];
    }
    const shop = getShopById(preSelectedShopId);
    if (!shop) return nearbyResults;
    const km =
      userLocationForDistance && shop.latitude !== 0 && shop.longitude !== 0
        ? distanceBetween(
            { latitude: userLocationForDistance.latitude, longitude: userLocationForDistance.longitude },
            { latitude: shop.latitude, longitude: shop.longitude },
          )
        : null;
    const coversAll =
      selectedServiceIds.length === 0
        ? true
        : selectedServiceIds.every((sid) => shop.serviceIds.includes(sid));
    const synthesized = {
      shop,
      distanceMi: km != null ? km / KM_PER_MI : 0,
      coversAll,
    };
    return [synthesized, ...nearbyResults];
  }, [nearbyResults, preSelectedShopId, getShopById, userLocationForDistance, selectedServiceIds]);

  // Active page index = which shop the user is currently viewing.
  const [activeIndex, setActiveIndex] = useState(0);
  const activeShop = nearbyShops[activeIndex]?.shop ?? null;

  // Bottom-sheet snap index. Drives the chrome swap when the user
  // swipes the sheet fully closed (`sheetIndex === -1`): hide the
  // Continue CTA + the rich MapShopCard, show the
  // ChatGPT-style MapBrowseShopCard CAROUSEL instead so the map
  // is the focus while the user browses pins.
  const [sheetIndex, setSheetIndex] = useState(0);
  const isSheetHidden = sheetIndex === -1;

  // Mechanic-picker accordion state. Expanding it adds rows to the page; the
  // dynamically-sized sheet grows to fit automatically (no snap juggling).
  const [mechanicPickerExpanded, setMechanicPickerExpanded] = useState(false);

  // Measured natural height of each shop page (keyed by index). The horizontal
  // pager has no intrinsic height, so we drive its height — and, through it,
  // the dynamic sheet — from the tallest measured page. Max keeps the height
  // stable across swipes (pages are near-identical) and grows when the shared
  // accordion opens.
  const [pageHeights, setPageHeights] = useState<Record<number, number>>({});
  const pagerHeight = useMemo(() => {
    const vals = Object.values(pageHeights);
    return vals.length > 0 ? Math.max(...vals) : null;
  }, [pageHeights]);

  // Per-(shop, service, tier) flat-price overrides for the active shop.
  // When a service is offered at a fixed rate the price renders as a
  // single guaranteed `$N` instead of an estimate range.
  const { map: activeFixedMap } = useShopFixedPricesForServices(
    activeShop?.id ?? null,
    ownershipId ?? null,
    selectedServiceIds,
  );
  const activePriceLabel = useMemo(
    () =>
      activeShop
        ? buildShopPriceLabel({
            shop: activeShop,
            selectedServices: selectedServicesForPricing,
            laborHoursMap,
            fixedPriceMap: activeFixedMap,
            laborOnlyCandidateIds,
          })
        : { text: null, isFixed: false, isLaborOnly: false },
    [activeShop, selectedServicesForPricing, laborHoursMap, activeFixedMap, laborOnlyCandidateIds],
  );

  // Per-shop mechanic selection — null = Any. Reset when the active
  // shop changes; mechanics are scoped to a shop.
  const [selectedMechanicByShop, setSelectedMechanicByShop] = useState<
    Record<string, string | null>
  >({});
  const selectedMechanicId = activeShop
    ? selectedMechanicByShop[activeShop.id] ?? null
    : null;

  // When the user arrives with an empty cart (e.g. the Home map-browse
  // entry), the sheet doubles as a shop browser and the CTA becomes a
  // "pick services" affordance instead of advancing to booking. The
  // per-mechanic CTA label lives in `bookCtaLabel` (computed once the active
  // shop's earliest slot resolves, below).
  const hasServices = selectedServiceIds.length > 0;

  // Map setup. We mount a LOCAL MapView as a direct child of this
  // screen (see render below) instead of driving the shared
  // persistent map — same fix select-services peek mode uses. The
  // shared map's MapView sits behind react-navigation's native-stack
  // Card, which absorbs finger gestures at the UIViewController
  // frame boundary on iOS, so pan/zoom never reaches the shared
  // map even with the `box-none` chain in place. A local MapView
  // sidesteps that.
  //
  // `region` from the booking-flow context is still our source of
  // truth for the initial camera so the shared map and the local
  // map line up if the user ever sees both during a transition.
  const userLocation = useBookingStore((s) => s.userLocation);
  const { setInteractive, setMarkers, setShopPins, region } = useBookingFlowMap();
  const mapRef = useRef<MapView | null>(null);
  // Ref to the paged carousel ScrollView so a pin tap can scroll
  // the bottom sheet to that shop's page (the reverse direction of
  // the existing swipe → setActiveIndex flow).
  const pagerScrollRef = useRef<ScrollView | null>(null);
  // Ref to the EXTERNAL browse-card carousel (only mounted when
  // the bottom sheet is hidden). Pin tap on the map scrolls this
  // to the matching shop too, so the visible card always
  // reflects the active shop.
  const browseScrollRef = useRef<ScrollView | null>(null);
  // Ref to the BottomSheet itself so a browse-card tap can
  // re-open it (snapToIndex(0)).
  const bottomSheetRef = useRef<BottomSheet | null>(null);
  // gorhom's `animatedIndex` shared value. -1 = fully closed, 0 =
  // first snap (56%), 1 = second snap (86%). Drives the footer +
  // shop-card fade so they track the sheet's drag continuously
  // instead of popping in/out at the snap-change boundary.
  const sheetAnimatedIndex = useSharedValue(0);

  // Expand/collapse the mechanic picker. Just a state flip — the dynamic sheet
  // resizes to the new content height on its own.
  const onToggleMechanicPicker = useCallback((next: boolean) => {
    setMechanicPickerExpanded(next);
  }, []);
  const onSheetChange = useCallback((idx: number) => {
    setSheetIndex(idx);
    // Dragged fully closed → collapse the picker so it reopens compact.
    if (idx < 0) setMechanicPickerExpanded(false);
  }, []);

  // Smooth, non-bouncy timing for every sheet motion — including the dynamic
  // resize when the mechanic picker opens/closes. A spring here overshoots and
  // reads as the content "popping up under" the card; a short ease-out grows
  // the sheet in lockstep with the rows fading in (see ShopPage).
  const sheetAnimationConfigs = useBottomSheetTimingConfigs({
    duration: 280,
    easing: Easing.out(Easing.cubic),
  });
  // Browse-card strip fades in as the sheet fades out — same
  // shared value, inverted curve. Always-mounted so the
  // ScrollView holds its scroll position across open/close
  // transitions.
  const browseStripStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetAnimatedIndex.value,
      [-1, 0],
      [1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  // Floating MapShopCard fades WITH the sheet (visible when open,
  // gone when closed). Driven off the same drag value so it
  // cross-fades continuously as the user slides the sheet down/up —
  // previously it was mount-gated on `isSheetHidden`, which only
  // flips after the sheet fully settles, so the card popped out
  // abruptly at the end of the drag instead of fading.
  const mapShopCardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      sheetAnimatedIndex.value,
      [-1, 0],
      [0, 1],
      Extrapolation.CLAMP,
    ),
  }));

  // Lock the SHARED map down (no touches, no pins) so it doesn't
  // compete with the local MapView for gestures or render duplicate
  // markers. Other booking-flow screens reset this on their own
  // focus effects.
  useFocusEffect(
    useCallback(() => {
      setInteractive(false);
      setMarkers([]);
      setShopPins([]);
    }, [setInteractive, setMarkers, setShopPins]),
  );

  // Tap a rating pin on the map → swap the active shop and scroll
  // BOTH the sheet's internal carousel AND the external browse
  // carousel (the one shown when the sheet is hidden) so they
  // stay in sync regardless of which one's visible. The
  // camera-pan effect further down fires off activeIndex changes,
  // so we don't need to call mapRef directly here.
  const onPinTap = useCallback(
    (idx: number) => {
      if (idx < 0 || idx >= nearbyShops.length) return;
      setActiveIndex(idx);
      pagerScrollRef.current?.scrollTo({
        x: idx * SHEET_WIDTH,
        animated: true,
      });
      browseScrollRef.current?.scrollTo({
        x: idx * SCREEN_WIDTH,
        animated: true,
      });
    },
    [nearbyShops.length],
  );

  // External browse-carousel swipe → mirror the internal pager's
  // onPageChange. Keep the internal pager scrolled to the same
  // page (no animation — the user can't see it) so that when the
  // sheet reopens it lands on the right shop.
  const onBrowsePageChange = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
      setActiveIndex(idx);
      pagerScrollRef.current?.scrollTo({ x: idx * SHEET_WIDTH, animated: false });
    },
    [],
  );

  // Pin rendering moved onto the local MapView in the render block —
  // no need to push pins through the shared BookingFlowMap context.

  // Animate the map camera to the active shop whenever it changes.
  // Center on the shop with a fixed neighborhood-scale zoom (~1mi
  // visible) rather than trying to frame user + shop together —
  // shops can be far from the user in dev data, and an auto-fit
  // would zoom out continent-scale.
  //
  // Zoom delta is tracked in a ref so the +/- rail buttons can
  // mutate the zoom without re-triggering the shop-swipe effect.
  // The effect uses whatever the current ref value is so a user
  // who's zoomed in stays zoomed in across shops.
  const DEFAULT_DELTA = 0.035;
  const MIN_DELTA = 0.002;
  const MAX_DELTA = 1.0;
  const zoomDeltaRef = useRef(DEFAULT_DELTA);

  // Re-fires on `isSheetHidden` too so a sheet swipe-down → pan
  // back to the active shop. The user can pan the map around
  // freely with the sheet open; closing the sheet recenters on
  // the shop they're committed to so the browse-card carousel
  // matches what the map is showing.
  useEffect(() => {
    if (!activeShop || !mapRef.current) return;
    if (activeShop.latitude === 0 && activeShop.longitude === 0) return;
    mapRef.current.animateToRegion(
      {
        latitude: activeShop.latitude,
        longitude: activeShop.longitude,
        latitudeDelta: zoomDeltaRef.current,
        longitudeDelta: zoomDeltaRef.current,
      },
      450,
    );
  }, [activeShop, isSheetHidden]);

  const animateZoom = useCallback(
    (factor: number) => {
      if (!mapRef.current || !activeShop) return;
      const next = Math.min(
        MAX_DELTA,
        Math.max(MIN_DELTA, zoomDeltaRef.current * factor),
      );
      zoomDeltaRef.current = next;
      mapRef.current.animateToRegion(
        {
          latitude: activeShop.latitude,
          longitude: activeShop.longitude,
          latitudeDelta: next,
          longitudeDelta: next,
        },
        220,
      );
    },
    [activeShop],
  );

  const onZoomIn = useCallback(() => animateZoom(0.5), [animateZoom]);
  const onZoomOut = useCallback(() => animateZoom(2), [animateZoom]);

  const onRecenter = useCallback(() => {
    if (!mapRef.current) return;
    // Crosshair = "where am I" — prefer the user's coords. If we
    // don't have them (permission denied / not yet resolved), fall
    // back to recentering on the active shop at default zoom.
    zoomDeltaRef.current = DEFAULT_DELTA;
    if (userLocation) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        },
        320,
      );
      return;
    }
    if (activeShop && activeShop.latitude !== 0) {
      mapRef.current.animateToRegion(
        {
          latitude: activeShop.latitude,
          longitude: activeShop.longitude,
          latitudeDelta: DEFAULT_DELTA,
          longitudeDelta: DEFAULT_DELTA,
        },
        320,
      );
    }
  }, [activeShop, userLocation]);

  // Selection summary — shared across all pages (it's about the
  // user's cart, not the per-shop view). Per-shop pricing lives in
  // buildShopPriceLabel (here for the active card, in ShopPage per page).
  const { selectedCount, totalMinutes } = useMemo(() => {
    let mins = 0;
    for (const svc of selectedServices) {
      const h = laborHoursMap.get(svc.id) ?? svc.default_labor_hours ?? 0;
      mins += Math.round(h * 60);
    }
    return { selectedCount: selectedServices.length, totalMinutes: mins };
  }, [selectedServices, laborHoursMap]);

  // Horizontal-paged scroll handler. Pages snap by the card's inner width
  // (the sheet is inset from the screen edges) so every page lines up inside
  // the card. Also pushes the same page index into the (always-mounted but
  // invisible) full-width browse carousel so it's already on the right shop
  // when the user swipes the sheet closed.
  const onPageChange = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SHEET_WIDTH);
    setActiveIndex(idx);
    browseScrollRef.current?.scrollTo({ x: idx * SCREEN_WIDTH, animated: false });
  }, []);

  // Earliest bookable slot for the active shop + current mechanic choice —
  // drives the "Book <day time>" CTA label (and the recommended slot the big
  // CTA books). "Any" (null) resolves to the shop's overall next slot. Same
  // duration the ShopPage body uses, so the CTA and the RECOMMENDED row agree.
  const { slots: activeEarliestSlots } = useNextAvailabilityForShop(
    activeShop?.id ?? null,
    selectedMechanicId,
    1,
    totalMinutes,
  );
  const activeEarliestSlot = activeEarliestSlots[0] ?? null;
  const bookCtaLabel = useMemo(() => {
    if (!hasServices) return "Select services";
    if (!activeEarliestSlot) return "See available times";
    const day = activeEarliestSlot.scheduledDate
      ? weekdayLongFromISO(activeEarliestSlot.scheduledDate)
      : activeEarliestSlot.dayOfWeek;
    return `Book ${day} ${activeEarliestSlot.time}`;
  }, [hasServices, activeEarliestSlot]);

  const activeDistanceMi = nearbyShops[activeIndex]?.distanceMi ?? 0;

  // Back normalizes to Screen 1 when we're the first route in the
  // (booking-flow) stack — i.e. the user got here via a direct
  // entry point (Most Booked card, Quick Book, etc.) rather than
  // walking 1 → 2 → 3. Length > 1 means a real in-flow back exists.
  // For the reset path we use navigation.reset (not router.replace)
  // since replace within the same Stack occasionally no-op'd.
  const onBack = () => {
    const state = navigation.getState?.();
    const stackLength = state?.routes?.length ?? 0;
    if (stackLength > 1) {
      router.back();
      return;
    }
    (navigation.reset as ((state: { index: number; routes: { name: string }[] }) => void) | undefined)?.({
      index: 0,
      routes: [{ name: "select-services" }],
    });
  };

  // Empty-cart affordance — the sheet is a shop browser, so the CTA sends the
  // user to pick services rather than advancing a booking.
  const onSelectServices = useCallback(() => {
    router.push("/(booking-flow)/select-services");
  }, [router]);

  // Calendar icon → the full "Pick a date & time" screen (manual scheduling),
  // seeded with the active shop + current mechanic choice.
  const onOpenCalendar = useCallback(() => {
    if (!activeShop) return;
    router.push({
      pathname: "/(booking-flow)/pick-datetime",
      params: {
        shopId: activeShop.id,
        mechanicId: selectedMechanicId ?? "",
      },
    });
  }, [router, activeShop, selectedMechanicId]);

  // Big CTA → book the earliest slot and go STRAIGHT to Review & Pay, skipping
  // the calendar entirely. We hold the slot + seed the booking store here (the
  // same handoff pick-datetime's Confirm does) and `router.push` payment on top
  // of THIS map screen — so Back from Review & Pay returns to the map, not the
  // calendar or home. When the user left it on "Any", auto-assign the mechanic
  // who actually owns that earliest slot. No slot resolved → fall back to the
  // manual calendar. On a hold conflict (slot just taken) → toast + calendar.
  const onBookEarliest = useCallback(async () => {
    if (!activeShop) return;
    const slot = activeEarliestSlot;
    if (!slot || !slot.scheduledDate || !slot.scheduledTime) {
      onOpenCalendar();
      return;
    }
    if (isBookingEarliest) return;

    const bookMechanicId = selectedMechanicId ?? slot.mechanicId ?? null;
    const mechanicName = bookMechanicId
      ? getMechanicById(bookMechanicId)?.name ?? null
      : null;
    const scheduledDate = slot.scheduledDate;
    const startHHMM = slot.scheduledTime;

    setIsBookingEarliest(true);
    const sessionId = ensureHoldSessionId();
    const holdDurationMinutes = totalMinutes > 0 ? totalMinutes : 60;
    try {
      const res = await holdSlot({
        shop_id: activeShop.id as Id<"shops">,
        mechanic_id: bookMechanicId ? (bookMechanicId as Id<"mechanics">) : undefined,
        date: scheduledDate,
        start_time: startHHMM,
        duration_minutes: holdDurationMinutes,
        session_id: sessionId,
        held_by: userId ?? undefined,
      });
      setSlotHold(
        res?.holdId && res.expiresAt != null
          ? { holdId: res.holdId, expiresAt: res.expiresAt }
          : null,
      );
    } catch {
      setIsBookingEarliest(false);
      toast.error("That time was just taken", "Pick another slot to continue.");
      onOpenCalendar();
      return;
    }

    setSelectedMechanicSlot({
      shopId: activeShop.id,
      shopName: activeShop.name,
      mechanicId: bookMechanicId,
      mechanicName,
      slot: {
        dayOfWeek: slot.dayOfWeek,
        day: slot.day,
        time: slot.time,
        timeSlotId: slot.timeSlotId,
        scheduledDate,
        scheduledTime: startHHMM,
        mechanicId: bookMechanicId ?? undefined,
      },
      timeSlotId: slot.timeSlotId,
      scheduledDate,
      scheduledTime: startHHMM,
    });
    setScheduledAppointment({
      date: scheduledDate,
      time: slot.time,
      displayDate: formatBookingDate(scheduledDate),
    });
    selectMechanic(bookMechanicId);

    setIsBookingEarliest(false);
    router.push({
      pathname: "/booking/mechanic/[id]/payment",
      params: { id: bookMechanicId ?? activeShop.id },
    });
  }, [
    activeShop,
    activeEarliestSlot,
    selectedMechanicId,
    isBookingEarliest,
    totalMinutes,
    userId,
    holdSlot,
    getMechanicById,
    ensureHoldSessionId,
    setSlotHold,
    setSelectedMechanicSlot,
    setScheduledAppointment,
    selectMechanic,
    toast,
    onOpenCalendar,
    router,
  ]);

  // Footer as a gorhom sticky footer — pinned to the sheet's bottom edge
  // regardless of how tall the content is, so it can never spill out below the
  // sheet. `bottomInset={0}` because the detached sheet already floats above
  // the home indicator. Empty cart → a single "Select services" pill; with
  // services → a calendar icon (manual pick) beside the big "Book <day time>"
  // CTA (earliest-slot fast path).
  const renderFooter = useCallback(
    (props: BottomSheetFooterProps) => (
      <BottomSheetFooter {...props} bottomInset={0}>
        <View style={styles.sheetFooter}>
          {!hasServices ? (
            <Pressable
              style={styles.continuePill}
              onPress={onSelectServices}
              accessibilityRole="button"
              accessibilityLabel="Select services"
            >
              <Text
                size="md"
                weight="semiBold"
                color="#FFFFFF"
                style={styles.continueLabel}
              >
                Select services
              </Text>
              <ArrowRight size={20} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          ) : (
            <View style={styles.footerRow}>
              <Pressable
                style={styles.calendarBtn}
                onPress={onOpenCalendar}
                accessibilityRole="button"
                accessibilityLabel="Pick a date & time"
              >
                <Calendar size={22} color="#1F2937" strokeWidth={2} />
              </Pressable>
              <Pressable
                style={styles.bookPill}
                onPress={() => void onBookEarliest()}
                disabled={isBookingEarliest}
                accessibilityRole="button"
                accessibilityState={{ disabled: isBookingEarliest, busy: isBookingEarliest }}
                accessibilityLabel={bookCtaLabel}
              >
                {isBookingEarliest ? (
                  <ActivityIndicator color="#FFFFFF" style={styles.continueLabel} />
                ) : (
                  <>
                    <Text
                      size="md"
                      weight="semiBold"
                      color="#FFFFFF"
                      style={styles.continueLabel}
                      numberOfLines={1}
                    >
                      {bookCtaLabel}
                    </Text>
                    <ArrowRight size={20} color="#FFFFFF" strokeWidth={2} />
                  </>
                )}
              </Pressable>
            </View>
          )}
        </View>
      </BottomSheetFooter>
    ),
    // Handlers/labels are recreated each render; the footer is cheap to
    // re-render, so we intentionally rebuild it when they change.
    [hasServices, bookCtaLabel, isBookingEarliest, onSelectServices, onOpenCalendar, onBookEarliest],
  );

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Local interactive MapView. The shared layout-level
          BookingFlowMap is locked behind us (its touches were being
          eaten by react-navigation's native-stack Card before they
          could fall through — same UIViewController quirk that
          forced the local-MapView fix on select-services peek
          mode). Mounting the map as a direct child of the screen
          gives it touches naturally. */}
      {region ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={PROVIDER_DEFAULT}
          // Open the map on the active shop, not the user. The
          // ChatGPT-style browsing flow puts the shop at the
          // center of attention — anchoring on the user just
          // means the user has to manually swipe to find the
          // shop they're considering. Falls back to the user
          // region only when the active shop hasn't hydrated
          // yet (cold start); the camera-pan effect catches up
          // once nearbyShops loads.
          initialRegion={
            activeShop &&
            activeShop.latitude !== 0 &&
            activeShop.longitude !== 0
              ? {
                  latitude: activeShop.latitude,
                  longitude: activeShop.longitude,
                  latitudeDelta: DEFAULT_DELTA,
                  longitudeDelta: DEFAULT_DELTA,
                }
              : region
          }
          showsUserLocation
          scrollEnabled
          zoomEnabled
          pitchEnabled={false}
          rotateEnabled
        >
          {nearbyShops
            .filter((r) => r.shop.latitude !== 0 && r.shop.longitude !== 0)
            .map((r, idx) => (
              <Marker
                key={r.shop.id}
                coordinate={{
                  latitude: r.shop.latitude,
                  longitude: r.shop.longitude,
                }}
                anchor={{ x: 0.5, y: 0.5 }}
                tracksViewChanges={idx === activeIndex}
                onPress={() => onPinTap(idx)}
              >
                <RatingMarkerPill
                  rating={r.shop.rating}
                  shopName={r.shop.name}
                  isSelected={idx === activeIndex}
                />
              </Marker>
            ))}
        </MapView>
      ) : null}

      {/* Top floating chrome — back + vehicle puck float directly on the
          map (no pill, no title) so the sheet gets maximum vertical room. */}
      <View
        style={[styles.topStack, { paddingTop: insets.top + 8 }]}
        pointerEvents="box-none"
      >
        <View style={styles.headerRow}>
          <Pressable
            style={styles.iconBtn}
            onPress={onBack}
            hitSlop={8}
            accessibilityLabel="Back"
          >
            <ArrowLeft size={20} color="#1F2937" strokeWidth={2} />
          </Pressable>
          <VehiclePuck />
        </View>
      </View>

      {/* Floating shop card. Two layouts by sheet state:
          - Sheet open (56% / 86%) → the rich MapShopCard with
            estimated price, anchored at top 26%.
          - Sheet hidden → a horizontal pager of minimal
            MapBrowseShopCards (image + name + rating + open
            status), ChatGPT-style. Swiping the pager changes
            the active shop; tapping a card brings the sheet
            back. */}
      {activeShop ? (
        <Animated.View
          style={[styles.shopCardWrap, mapShopCardStyle]}
          // Only interactive while the sheet is open; once it fades out
          // (sheet closed → browse mode), let taps fall through to the
          // browse carousel / map beneath.
          pointerEvents={isSheetHidden ? "none" : "box-none"}
        >
          <MapShopCard
            shopId={activeShop.id}
            shopName={activeShop.name}
            imageUrl={activeShop.imageUrl}
            rating={activeShop.rating}
            distanceMi={activeDistanceMi}
            priceRange={activePriceLabel.text}
            isFixed={activePriceLabel.isFixed}
            isLaborOnly={activePriceLabel.isLaborOnly}
          />
        </Animated.View>
      ) : null}
      {/* Browse-card carousel. Always mounted so the ScrollView
          keeps its position across open/close transitions, but
          opacity is driven by the sheet's animatedIndex so it
          fades in continuously as the sheet fades out. Only
          captures touches when the sheet has fully closed
          (otherwise an invisible carousel could swallow taps
          meant for the sheet's content). */}
      <Animated.View
        style={[styles.browseStrip, browseStripStyle]}
        pointerEvents={isSheetHidden ? "box-none" : "none"}
      >
        <ScrollView
          ref={browseScrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onBrowsePageChange}
          decelerationRate="fast"
          contentOffset={{ x: activeIndex * SCREEN_WIDTH, y: 0 }}
        >
          {nearbyShops.map((r) => (
            <View key={r.shop.id} style={styles.browseCardSlot}>
              <MapBrowseShopCard
                shopId={r.shop.id}
                shopName={r.shop.name}
                imageUrl={r.shop.imageUrl}
                rating={r.shop.rating}
                category="Auto repair shop"
                isOpen={r.shop.hasAvailableSlots}
                onPress={() => bottomSheetRef.current?.snapToIndex(0)}
              />
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* Floating right rail — visual only for Phase 3 */}
      <View style={[styles.rightRail, { top: insets.top + 190 }]} pointerEvents="box-none">
        <Pressable
          style={styles.railBtn}
          onPress={onZoomIn}
          accessibilityLabel="Zoom in"
        >
          <Plus size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <Pressable
          style={styles.railBtn}
          onPress={onZoomOut}
          accessibilityLabel="Zoom out"
        >
          <Minus size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <Pressable
          style={styles.railBtn}
          onPress={onRecenter}
          accessibilityLabel="Recenter"
        >
          <Crosshair size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Bottom sheet — floating detached card, NO backdrop. It sits over
          the map as a plain floating sheet (the map above stays bright and
          interactive) rather than a dimmed modal overlay. Inset from the
          screen edges, lifted above the home indicator, all four corners
          rounded. Dynamically sized: the sheet hugs the horizontal-paged
          ShopPage content (as short as the one-decision card needs), growing
          when the mechanic picker opens, with the footer pinned as a sticky
          overlay (see `renderFooter`). Swipe down → sheet closes entirely
          (`sheetIndex === -1`) and the browse-card carousel takes over. */}
      <BottomSheet
        ref={bottomSheetRef}
        index={0}
        onChange={onSheetChange}
        animatedIndex={sheetAnimatedIndex}
        enablePanDownToClose
        enableDynamicSizing
        maxDynamicContentSize={SHEET_MAX_HEIGHT}
        animationConfigs={sheetAnimationConfigs}
        detached
        // TEMP: 0 pins the card flush to the bottom edge to confirm the
        // mechanism; raise to the final resting gap (e.g. 8) to tuck it just
        // above the home indicator.
        bottomInset={8}
        style={styles.sheetFloat}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandleIndicator}
        footerComponent={renderFooter}
      >
        <BottomSheetView
          style={[styles.sheetContent, { paddingBottom: SHEET_FOOTER_HEIGHT }]}
        >
          {nearbyShops.length === 0 ? (
            <View style={styles.empty}>
              <Text size="md" weight="medium" color="#9CA3AF" center>
                {shopsLoading ? "Finding shops near you…" : "No shops available."}
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={pagerScrollRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={onPageChange}
              decelerationRate="fast"
              // The pager has no intrinsic height — pin it to the tallest
              // measured page (fallback while the first measure lands) so the
              // dynamic sheet can size to it. `flex-start` keeps each page at
              // its natural height so `onMeasureHeight` reports true content.
              style={{ height: pagerHeight ?? 260 }}
              contentContainerStyle={styles.pagerContent}
            >
              {nearbyShops.map((r, idx) => (
                <ShopPage
                  key={r.shop.id}
                  shop={r.shop}
                  pageWidth={SHEET_WIDTH}
                  totalMinutes={totalMinutes}
                  selectedCount={selectedCount}
                  selectedServices={selectedServicesForPricing}
                  laborHoursMap={laborHoursMap}
                  vehicleOwnerId={ownershipId}
                  laborOnlyCandidateIds={laborOnlyCandidateIds}
                  selectedMechanicId={
                    selectedMechanicByShop[r.shop.id] ?? null
                  }
                  onSelectMechanic={(mId) =>
                    setSelectedMechanicByShop((prev) => ({
                      ...prev,
                      [r.shop.id]: mId,
                    }))
                  }
                  expanded={mechanicPickerExpanded}
                  onToggleExpanded={onToggleMechanicPicker}
                  onMeasureHeight={(h) =>
                    setPageHeights((prev) =>
                      prev[idx] === h ? prev : { ...prev, [idx]: h },
                    )
                  }
                />
              ))}
            </ScrollView>
          )}

          {/* Page indicator dots */}
          {nearbyShops.length > 1 ? (
            <View style={styles.dots}>
              {nearbyShops.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.dot,
                    idx === activeIndex ? styles.dotActive : null,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  topStack: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 10,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  shopCardWrap: {
    position: "absolute",
    top: "26%",
    left: 16,
    right: 16,
    alignItems: "center",
  },
  browseStrip: {
    position: "absolute",
    // No sheet underneath in this mode — float the card carousel
    // just above the home-indicator area so it doesn't crowd the
    // bottom edge of the device.
    bottom: 40,
    left: 0,
    right: 0,
  },
  browseCardSlot: {
    width: SCREEN_WIDTH,
    paddingHorizontal: 16,
  },
  rightRail: {
    position: "absolute",
    right: 14,
    gap: 8,
  },
  railBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    // All four corners rounded — the sheet floats (detached) above the
    // bottom edge, so its bottom curves are visible too. Matches the shared
    // FloatingSheet CORNER_RADIUS (46) so sheets across the app feel uniform.
    borderRadius: 46,
  },
  sheetFloat: {
    // Side inset so the card doesn't touch the screen edges. The bottom
    // inset comes from the BottomSheet's bottomInset prop.
    marginHorizontal: SHEET_SIDE_INSET,
    // Clip to the animated sheet bounds so, as the sheet grows to fit the
    // opening accordion, the not-yet-covered rows are revealed cleanly from
    // the top edge instead of briefly floating over the map below it.
    // 46 matches the shared FloatingSheet CORNER_RADIUS for a uniform look.
    borderRadius: 46,
    overflow: "hidden",
  },
  sheetHandleIndicator: {
    backgroundColor: "rgba(15, 23, 42, 0.2)",
    width: 44,
  },
  sheetContent: {
    // No flex:1 — the sheet is dynamically sized, so this View must wrap its
    // content height (the measured pager + dots + footer reserve) for gorhom
    // to size the sheet to it.
    paddingTop: 0,
  },
  pagerContent: {
    // Keep each page at its natural height (don't stretch to the tallest) so
    // every page's onLayout reports true content height for the pager sizing.
    alignItems: "flex-start",
  },
  sheetFooter: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 16,
  },
  continuePill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: "#5299FE",
  },
  continueLabel: {
    flex: 1,
    textAlign: "center",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  calendarBtn: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(15, 23, 42, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  bookPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingVertical: 16,
    paddingHorizontal: 22,
    borderRadius: 999,
    backgroundColor: "#5299FE",
  },
  empty: {
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(15, 23, 42, 0.18)",
  },
  dotActive: {
    backgroundColor: "#0F172A",
    width: 18,
  },
});

