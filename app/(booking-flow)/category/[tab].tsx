/**
 * Screen 2 · Category detail — booking-flow.
 *
 * Sheet over a locked full-bleed map. Same drag behavior (4 snap
 * points) as Screen 1. The `[tab]` route param picks one of the v5
 * tabs; the screen renders the applicable services in that tab as a
 * multi-select list with the same v5 wiring: slug-based handoff for
 * tire / rotor / diagnostic, the coverage filter (bookable / needs-
 * specs / blocked-by-enrichment), inline PackageQuestionsSheet for
 * needs-specs taps, and applicability hiding (e.g. timing belt is
 * dropped on chain engines).
 *
 * Spec: ~/Downloads/<figma frames> Screen 2.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";
import {
  ArrowLeft,
  Calendar,
  ClipboardCheck,
  CircleDot,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

import { categoryTitleTransition } from "@/components/booking-flow/CategoryListRow";
import { FlyToCartGhost } from "@/components/booking-flow/FlyToCartGhost";
import { useFocusEffect, useLocalSearchParams, useNavigation } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";

import { Text } from "@/components/shared-ui";
import { useBookingFlowMap } from "@/components/booking-flow/BookingFlowMap";
import { PinnedShopChip } from "@/components/booking-flow/PinnedShopChip";
import { ServiceInfoSheet } from "@/components/booking-flow/ServiceInfoSheet";
import { SelectedServicesFab } from "@/components/booking-flow/SelectedServicesFab";
import {
  SelectedServicesSheet,
  type SelectedServicesSheetRef,
} from "@/components/booking-flow/SelectedServicesSheet";
import { ServiceMultiSelectRow } from "@/components/booking-flow/ServiceMultiSelectRow";
import { StickyContinueBar } from "@/components/booking-flow/StickyContinueBar";
import { routeToNextBookingStep } from "@/lib/bookingFlowNext";
import { VehiclePuck } from "@/components/booking-flow/VehiclePuck";
import { PackageQuestionsSheet } from "@/components/cars/PackageQuestionsSheet";
import { DiagnosticOptionsSheet } from "@/components/booking/sheets/DiagnosticOptionsSheet";
import { SingleServiceOptionsSheet } from "@/components/booking/sheets/SingleServiceOptionsSheet";
import {
  SLUG_DIAGNOSTIC_SCAN,
  SLUG_ROTOR_REPLACEMENT,
  SLUG_TIRE_REPLACEMENT,
  TABS,
  TAXONOMY,
  type TaxonomyTab,
} from "@/constants/serviceTaxonomy";
import { useBookableServices } from "@/hooks/useBookableServices";
import { useBookingLaborHoursMap } from "@/hooks/useBookingLaborHoursMap";
import { useServiceVehicleSpecsForEngine } from "@/hooks/useServiceVehicleSpecsForEngine";
import { useVehicleReadiness } from "@/hooks/useVehicleReadiness";
import { formatDurationForCar } from "@/lib/formatDuration";
import { isApplicable } from "@/lib/serviceApplicability";
import type { Service } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useShopStore } from "@/stores/useShopStore";

// Fixed-height frosted sheet — content scrolls inside, sheet itself
// doesn't move. Mirrors Screen 1 (select-services.tsx). Previously a
// free-drag Pan gesture resized the sheet on vertical swipe, but
// users found the whole-sheet movement distracting next to a normal
// scrollable list.
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const SHEET_H = SCREEN_HEIGHT * 0.92;

// FAB layout constants — kept in sync with SelectedServicesFab.tsx
// (56×56) and the fabHost positioning below (`right: 16`,
// `bottom: insets.bottom + 96`). Duplicated as numbers so the fly-to-
// cart target is deterministic even on the FIRST tap, when the FAB
// component is still returning null and hasn't attached its ref yet.
const FAB_SIZE = 56;
const FAB_RIGHT_INSET = 16;
const FAB_BOTTOM_ABOVE_INSETS = 96;

// Same icon mapping as CategoryListRow so the shared-element
// morph between Screen 1's row and Screen 2's header lands on a
// matching glyph.
const TAB_ICONS: Record<TaxonomyTab, LucideIcon> = {
  routine_upkeep: Wrench,
  tires_brakes: CircleDot,
  major_service: Calendar,
  inspections: ClipboardCheck,
};

const VALID_TABS = new Set<TaxonomyTab>([
  "routine_upkeep",
  "tires_brakes",
  "major_service",
  "inspections",
]);

export default function CategoryDetailScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab: string; focus?: string }>();
  const reviewSheetRef = useRef<SelectedServicesSheetRef>(null);
  // When the user deep-links to a specific service (home "More Services"
  // grid → `?focus=<slug>`), scroll that row into view and briefly glow it.
  const focusSlug = params.focus;
  const scrollRef = useRef<ScrollView>(null);
  // Inner content wrapper — used as the ancestor for row.measureLayout
  // (New Arch requires a host-component ref, not a findNodeHandle number).
  const scrollContentRef = useRef<View>(null);
  const [highlightedSlug, setHighlightedSlug] = useState<string | null>(null);
  const didFocusScrollRef = useRef(false);
  /** Separate from the scroll ref: selection must happen exactly once even
   *  though the scroll retries, and must not re-fire if the user then
   *  deselects the row by hand. */
  const didFocusSelectRef = useRef(false);

  const tabKey = useMemo<TaxonomyTab | null>(() => {
    if (!params.tab) return null;
    return VALID_TABS.has(params.tab as TaxonomyTab) ? (params.tab as TaxonomyTab) : null;
  }, [params.tab]);

  // Bounce invalid params back to Screen 1.
  useEffect(() => {
    if (tabKey === null) {
      router.replace("/(booking-flow)/select-services");
    }
  }, [tabKey, router]);

  // Booking-store reads
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);
  const toggleServiceSelection = useBookingStore((s) => s.toggleServiceSelection);
  const availableServices = useBookingStore((s) => s.availableServices);
  const selectedDiagnosticSystem = useBookingStore((s) => s.selectedDiagnosticSystem);
  const customerNotes = useBookingStore((s) => s.customerNotes);
  // When the user entered via a shop-detail Book CTA, the store
  // holds the picked shop. Two things change:
  //   1. Continue skips Choose Mechanic and routes straight to
  //      pick-datetime at that shop (see `routeToNextBookingStep`).
  //   2. The service list below is filtered to what the shop offers
  //      so the user can't pick something unbookable here.
  const preSelectedShopId = useBookingStore((s) => s.preSelectedShopId);
  const getShopById = useShopStore((s) => s.getShopById);
  const shopServiceIdSet = useMemo(() => {
    if (!preSelectedShopId) return null;
    const shop = getShopById(preSelectedShopId);
    if (!shop) return null;
    return new Set(shop.serviceIds);
  }, [preSelectedShopId, getShopById]);

  // Service-option sheets — opened on tap for services that need a choice
  // before they enter the cart (brake pads → Front/Rear/Both, battery →
  // AGM/EFB, diagnostic scan → area + notes). Mirrors the legacy
  // ServiceBottomSheet handoff.
  const [optionsServiceId, setOptionsServiceId] = useState<string | null>(null);
  const [showDiagnosticSheet, setShowDiagnosticSheet] = useState(false);
  const [diagnosticServiceId, setDiagnosticServiceId] = useState<string | null>(null);

  // Vehicle context
  const selectedVehicle = useVehicleStore((s) => s.getSelectedVehicle());
  const engineId = selectedVehicle?.engineId;
  const ownershipId = selectedVehicle?.ownershipId;

  // Per-engine labor hours for every service in the catalog (we
  // need it before deciding which rows render — applicability is
  // gated by both year and the engine spec).
  const allServiceIds = useMemo(
    () => availableServices.map((s) => s.id),
    [availableServices],
  );
  const engineSpecs = useServiceVehicleSpecsForEngine(engineId, allServiceIds);

  // Engine-adjusted + director-rounded labor (empirical → book → engine-tier
  // → catalog-default cascade) — the same source the mechanic picker, Review
  // & Pay, and persisted estimate read, so the "About X" row chip matches
  // downstream instead of showing the raw catalog default.
  const { laborHoursMap } = useBookingLaborHoursMap(ownershipId, allServiceIds);

  // v5 coverage filter
  const readiness = useVehicleReadiness(ownershipId);
  const {
    applicableIds,
    bookableIds,
    needsSpecsIds,
    isLoading: isBookableLoading,
  } = useBookableServices(ownershipId);

  // Shared persistent map (lives in the layout) — locked backdrop,
  // same as Screen 1. Re-assert locked mode + recenter on focus.
  const { setInteractive, setMarkers, mapRef, region } = useBookingFlowMap();
  useFocusEffect(
    useCallback(() => {
      setInteractive(false);
      setMarkers([]);
      if (region) mapRef.current?.animateToRegion(region, 300);
    }, [setInteractive, setMarkers, mapRef, region]),
  );

  const [specsCheckServiceId, setSpecsCheckServiceId] = useState<string | null>(null);
  const [infoSheetSlug, setInfoSheetSlug] = useState<string | null>(null);

  // Fly-to-cart overlay state. `rowRefs` holds a handle per row so we
  // can measureInWindow when the user taps; `fabRef` is the endpoint.
  // Each spawned ghost lives in `flying` until its animation reports
  // done, then the parent retires it and bumps `pulseKey` so the FAB
  // pops.
  interface FlyingGhost {
    key: string;
    slug: string;
    label: string;
    from: { x: number; y: number; w: number; h: number };
    to: { x: number; y: number };
    /** Runs when the ghost lands on the FAB. This is where the store
     *  toggle happens so the cart count only ticks up after the
     *  animation completes. */
    onCommit?: () => void;
  }
  const rowRefs = useRef<Map<string, View | null>>(new Map());
  const flightCounter = useRef(0);
  const [flying, setFlying] = useState<FlyingGhost[]>([]);
  const [pulseKey, setPulseKey] = useState(0);

  // FAB target center in window coords, computed from the fixed layout
  // constants. Deterministic — works on the very first tap when the
  // FAB is still returning null (count === 0) and hasn't attached its
  // ref yet, which was killing the animation on the initial add.
  const fabCenter = useMemo(
    () => ({
      x: SCREEN_WIDTH - FAB_RIGHT_INSET - FAB_SIZE / 2,
      y:
        SCREEN_HEIGHT -
        insets.bottom -
        FAB_BOTTOM_ABOVE_INSETS -
        FAB_SIZE / 2,
    }),
    [insets.bottom],
  );

  const flyToCart = useCallback(
    (serviceId: string, slug: string, label: string, onCommit?: () => void) => {
      const rowNode = rowRefs.current.get(serviceId);
      // No row → skip the animation and commit immediately so the
      // cart still updates (belt-and-suspenders for the caller).
      if (!rowNode) {
        onCommit?.();
        return;
      }
      rowNode.measureInWindow((rx, ry, rw, rh) => {
        const key = `fly-${flightCounter.current++}`;
        setFlying((prev) => [
          ...prev,
          {
            key,
            slug,
            label,
            from: { x: rx, y: ry, w: rw, h: rh },
            to: fabCenter,
            onCommit,
          },
        ]);
      });
    },
    [fabCenter],
  );

  // Fly-to-cart from a service that was added via an options / diagnostic
  // / spec sheet. The sheet blocks the row while it's open, so we defer
  // the ghost spawn until the sheet has finished dismissing — otherwise
  // the animation plays behind the sheet and the user misses it.
  // Delay tuned to the standard iOS modal slide-down (~300ms) plus a
  // small safety margin. The store toggle is deferred until the ghost
  // lands so the cart count doesn't jump ahead of the animation.
  const flyToCartAfterSheet = useCallback(
    (serviceId: string, onCommit?: () => void) => {
      const svc = availableServices.find((s) => s.id === serviceId);
      if (!svc?.slug) {
        onCommit?.();
        return;
      }
      const entry = TAXONOMY[svc.slug];
      if (!entry) {
        onCommit?.();
        return;
      }
      setTimeout(
        () => flyToCart(svc.id, svc.slug!, entry.label, onCommit),
        380,
      );
    },
    [availableServices, flyToCart],
  );

  const tab = useMemo(() => TABS.find((t) => t.key === tabKey), [tabKey]);

  // Pre-coverage-gate list: everything in this tab that's slugged,
  // has a taxonomy entry, passes applicability, and (if the user
  // came from a shop-detail Book CTA) is offered by that shop.
  const baseList = useMemo(() => {
    if (!tabKey) return [] as Service[];
    let list = availableServices
      .filter((service) => {
        if (service.tab !== tabKey) return false;
        if (!service.slug) return false;
        const entry = TAXONOMY[service.slug];
        if (!entry) return false;
        const spec = engineSpecs[service.id] ?? null;
        return isApplicable(entry, selectedVehicle ?? null, spec);
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    // Shop-pinned flow: hide services the picked shop doesn't cover
    // so the user can't pick something they won't be able to book.
    // Guard on serviceIds.length > 0 — an empty array usually means
    // the shop's catalog hasn't been hydrated yet, NOT that it
    // offers nothing. Filtering on an empty set would hide
    // everything and brick the screen.
    if (shopServiceIdSet && shopServiceIdSet.size > 0) {
      list = list.filter((s) => shopServiceIdSet.has(s.id));
    }
    return list;
  }, [tabKey, availableServices, selectedVehicle, engineSpecs, shopServiceIdSet]);

  // Bookable list — what renders in the main list. Intersects the
  // base with `applicableIds` from the coverage query (which already
  // excludes missing_data). Without a vehicle → no gate, show the
  // whole base.
  const filteredServices = useMemo(() => {
    if (!ownershipId) return baseList;
    if (isBookableLoading) return [];
    return baseList.filter((s) => applicableIds.has(s.id));
  }, [baseList, ownershipId, isBookableLoading, applicableIds]);

  // Deep-link focus: when the user tapped a specific service on the home
  // "More Services" grid, scroll that row into view and glow it once the
  // list has rendered. Retries briefly because the list depends on async
  // store hydration + coverage gating, so the row may not exist on mount.
  useEffect(() => {
    if (!focusSlug || didFocusScrollRef.current) return;
    const target = filteredServices.find((s) => s.slug === focusSlug);
    if (!target) return;

    // Arriving from a home card means the user already picked this service —
    // land with it ticked rather than making them tap it again. Guarded so a
    // deliberate deselect isn't undone by the scroll retries below, and
    // checked first because toggleServiceSelection would otherwise turn an
    // already-selected row back off.
    // Read through getState() rather than the subscribed value: we want the
    // selection as it is on arrival, and depending on the reactive array would
    // re-run this whole effect (scroll retries and all) on every tick of the
    // checkbox.
    if (!didFocusSelectRef.current) {
      didFocusSelectRef.current = true;
      const store = useBookingStore.getState();
      if (!store.selectedServiceIds.includes(target.id)) {
        store.toggleServiceSelection(target.id);
      }
    }

    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let clearHighlight: ReturnType<typeof setTimeout> | null = null;

    const tryScroll = () => {
      attempts += 1;
      const node = rowRefs.current.get(target.id);
      const ancestor = scrollContentRef.current;
      if (node && ancestor) {
        node.measureLayout(
          ancestor,
          (_x, y) => {
            didFocusScrollRef.current = true;
            scrollRef.current?.scrollTo({ y: Math.max(0, y - 90), animated: true });
            setHighlightedSlug(focusSlug);
            clearHighlight = setTimeout(() => setHighlightedSlug(null), 2000);
          },
          () => {
            if (attempts < 12) timer = setTimeout(tryScroll, 150);
          },
        );
      } else if (attempts < 12) {
        timer = setTimeout(tryScroll, 150);
      }
    };
    timer = setTimeout(tryScroll, 200);

    return () => {
      if (timer) clearTimeout(timer);
      if (clearHighlight) clearTimeout(clearHighlight);
    };
  }, [focusSlug, filteredServices]);

  // Tap handler — slug routing matches the v5 grid + Screen 1 entries
  const handleServicePress = useCallback(
    (service: Service) => {
      if (!service.slug) return;

      if (service.slug === SLUG_TIRE_REPLACEMENT) {
        router.push("/(tire-booking)");
        return;
      }
      if (service.slug === SLUG_ROTOR_REPLACEMENT) {
        router.push("/(rotor-booking)");
        return;
      }

      const isSelected = selectedServiceIds.includes(service.id);

      // Diagnostic scan: a second tap on the selected row removes it;
      // first tap opens the area + notes picker before it enters the cart.
      if (service.slug === SLUG_DIAGNOSTIC_SCAN) {
        if (isSelected) {
          toggleServiceSelection(service.id);
          return;
        }
        setDiagnosticServiceId(service.id);
        setShowDiagnosticSheet(true);
        return;
      }

      // Coverage filter — needs-specs row opens the inline questions first
      // (a package answer is a prerequisite for picking options below).
      if (!isSelected && needsSpecsIds.has(service.id)) {
        setSpecsCheckServiceId(service.id);
        return;
      }

      // has_options services (brake pads, tire rotation, battery, …) open
      // the per-service option picker on first tap; a second tap removes.
      if (service.has_options === true) {
        if (isSelected) {
          toggleServiceSelection(service.id);
          return;
        }
        setOptionsServiceId(service.id);
        return;
      }

      // Direct-add path. If already selected, this is a remove — flip
      // the store immediately, no animation. If adding, defer the
      // store toggle until the ghost lands on the FAB so the cart
      // count ticks up in sync with the visual, not ahead of it.
      if (isSelected) {
        toggleServiceSelection(service.id);
        return;
      }
      const entry = TAXONOMY[service.slug];
      if (entry) {
        flyToCart(service.id, service.slug, entry.label, () =>
          toggleServiceSelection(service.id),
        );
      } else {
        // No taxonomy entry (shouldn't happen post-hydration) — fall
        // back to an instant toggle so the row still adds to the cart.
        toggleServiceSelection(service.id);
      }
    },
    [router, selectedServiceIds, needsSpecsIds, toggleServiceSelection, flyToCart],
  );

  // The questions list the inline PackageQuestionsSheet should ask
  // — only the ones affecting the slug the user tapped.
  const specsCheckQuestions = useMemo(() => {
    if (!specsCheckServiceId) return [];
    const service = availableServices.find((s) => s.id === specsCheckServiceId);
    const slug = service?.slug;
    if (!slug) return [];
    return readiness.pendingPackages.filter((pkg) =>
      pkg.services_affected.includes(slug),
    );
  }, [specsCheckServiceId, availableServices, readiness.pendingPackages]);

  const vehicleLabel = useMemo(() => {
    if (!selectedVehicle) return "";
    return [selectedVehicle.year, selectedVehicle.make, selectedVehicle.model]
      .filter(Boolean)
      .join(" ")
      .trim();
  }, [selectedVehicle]);

  // Back behavior: if the user entered the booking flow on this
  // screen directly (e.g. Quick Book pushed straight to Choose
  // Mechanic, or a category card on home pushed straight here),
  // the (booking-flow) stack has us as its only route. In that
  // case "back" should land on Screen 1, NOT pop out of the flow
  // entirely to wherever they came from.
  //
  // We detect this by looking at the booking-flow stack's
  // routes — length > 1 means there's a real in-flow back; length
  // 1 means we're the first in the flow. For that case we use
  // `navigation.reset` (not router.replace) — replace within the
  // same Stack occasionally no-op'd, where reset deterministically
  // rebuilds the stack to a single select-services route.
  const onBack = () => {
    const state = navigation.getState?.();
    const stackLength = state?.routes?.length ?? 0;
    if (stackLength > 1) {
      router.back();
      return;
    }
    // Cast: navigation.reset's route-name type is inferred from the
    // parent navigator's route map and lands as `never` for the
    // top-level useNavigation() here. The string is correct at
    // runtime; cast to silence the generic constraint.
    (navigation.reset as ((state: { index: number; routes: { name: string }[] }) => void) | undefined)?.({
      index: 0,
      routes: [{ name: "select-services" }],
    });
  };

  return (
    <View style={styles.root} pointerEvents="box-none">
      {/* Map is the shared persistent backdrop rendered by the layout. */}

      <View style={[styles.sheet, { height: SHEET_H }]}>
          {/* Real frosted-glass sheet — iOS BlurView blurs the
              map underneath; Android falls back to a thick
              translucent white. Same pattern as Screen 1. */}
          {Platform.OS === "ios" ? (
            <BlurView intensity={60} tint="light" style={StyleSheet.absoluteFill} />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, styles.sheetAndroidFallback]}
              pointerEvents="none"
            />
          )}
          {/* Handle removed — Screen 2's sheet is fixed height, not
              swipeable. Handle stays on Screen 1 (select-services)
              where the user CAN swipe the sheet down to reveal the
              map behind it. */}

          <ScrollView
            ref={scrollRef}
            contentContainerStyle={{
              paddingBottom: insets.bottom + 120,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View ref={scrollContentRef} collapsable={false}>
            <View style={styles.topRow}>
              <Pressable
                style={styles.iconBtn}
                onPress={onBack}
                hitSlop={8}
                accessibilityLabel="Back"
              >
                <ArrowLeft size={20} color="#1F2937" strokeWidth={2} />
              </Pressable>
              <View style={{ flex: 1 }} />
              <VehiclePuck interactive />
            </View>

            {tab && tabKey ? (
              <View style={styles.header}>
                <View style={styles.headerTitleRow}>
                  <Animated.View
                    style={styles.headerIconTile}
                    sharedTransitionTag={`cat-icon-${tabKey}`}
                    sharedTransitionStyle={categoryTitleTransition}
                  >
                    {(() => {
                      const Icon = TAB_ICONS[tabKey];
                      return <Icon size={22} color="#4B5563" strokeWidth={2} />;
                    })()}
                  </Animated.View>
                  <Animated.Text
                    sharedTransitionTag={`cat-title-${tabKey}`}
                    sharedTransitionStyle={categoryTitleTransition}
                    style={styles.titleTarget}
                  >
                    {tab.label}
                  </Animated.Text>
                </View>
                <Text size="md" weight="regular" color="#6B7280" style={styles.subtitle}>
                  {tab.subtitle} · {filteredServices.length} service
                  {filteredServices.length === 1 ? "" : "s"}
                </Text>
              </View>
            ) : null}

            {/* Same shop-pin indicator the user saw on Screen 1.
                Tapping the X clears the pin in-place — the service
                list above this row re-renders without the shop
                filter and the Continue button below goes back to
                the regular Choose Mechanic surface. */}
            <PinnedShopChip />

            <View style={styles.list}>
              {filteredServices.map((svc) => {
                const slug = svc.slug;
                if (!slug) return null;
                const entry = TAXONOMY[slug];
                if (!entry) return null;

                const isSelected = selectedServiceIds.includes(svc.id);
                const state: "bookable" | "needs_specs" | "blocked" = ownershipId
                  ? bookableIds.has(svc.id)
                    ? "bookable"
                    : needsSpecsIds.has(svc.id)
                      ? "needs_specs"
                      : "blocked"
                  : "bookable";

                const hours =
                  laborHoursMap.get(svc.id) ??
                  engineSpecs[svc.id]?.labor_hours ??
                  svc.default_labor_hours;
                const carDuration = formatDurationForCar(hours);
                const durationText = carDuration
                  ? `About ${carDuration}`
                  : (entry.estTimeLabel ?? "");

                return (
                  <ServiceMultiSelectRow
                    key={svc.id}
                    slug={slug}
                    entry={entry}
                    durationText={durationText}
                    isSelected={isSelected}
                    state={state}
                    highlight={highlightedSlug === slug}
                    onPress={() => handleServicePress(svc)}
                    onInfoPress={() => setInfoSheetSlug(slug)}
                    viewRef={(node: View | null) => {
                      rowRefs.current.set(svc.id, node);
                    }}
                  />
                );
              })}

              {filteredServices.length === 0 ? (
                <View style={styles.empty}>
                  <Text size="md" weight="medium" color="#9CA3AF" center>
                    No services available for this tab right now.
                  </Text>
                </View>
              ) : null}
            </View>
            </View>
          </ScrollView>
      </View>

      {/* Sticky Continue bar (over the sheet) */}
      <StickyContinueBar
        count={selectedServiceIds.length}
        onPress={() => routeToNextBookingStep(router, preSelectedShopId)}
      />

      {/* Cart review FAB — sits above the Continue pill at the
          bottom-right. Only renders when at least one service is
          selected (the FAB component returns null when count is 0).
          Tap → opens the SelectedServicesSheet with every selected
          service across all tabs, each with an X to remove. */}
      <View
        pointerEvents="box-none"
        style={[
          styles.fabHost,
          {
            bottom: insets.bottom + 96,
          },
        ]}
      >
        <SelectedServicesFab
          count={selectedServiceIds.length}
          onPress={() => reviewSheetRef.current?.open()}
          pulseKey={pulseKey}
        />
      </View>

      {/* Fly-to-cart overlay. Sits above the sheet contents but below
          the FAB so a landing ghost tucks under the button as it
          shrinks. `pointerEvents="none"` — never blocks taps. */}
      <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
        {flying.map((g) => (
          <FlyToCartGhost
            key={g.key}
            slug={g.slug}
            label={g.label}
            from={g.from}
            to={g.to}
            onDone={() => {
              // Commit the store change (adds the service to the cart)
              // ONLY now that the ghost has landed, so the FAB count
              // and the row's check flip in sync with the animation
              // completing — not the moment of tap.
              g.onCommit?.();
              setFlying((prev) => prev.filter((x) => x.key !== g.key));
              setPulseKey((k) => k + 1);
            }}
          />
        ))}
      </View>

      <SelectedServicesSheet ref={reviewSheetRef} />

      {/* Inline package-questions sheet (needs-specs taps) */}
      {ownershipId && specsCheckServiceId ? (
        <PackageQuestionsSheet
          visible={true}
          vehicleOwnerId={ownershipId}
          questions={specsCheckQuestions}
          vehicleLabel={vehicleLabel}
          onClose={() => setSpecsCheckServiceId(null)}
          onSubmitted={() => {
            // After answering, route through the normal press handler so
            // any has_options / handoff / toggle logic still applies.
            const id = specsCheckServiceId;
            if (!id) return;
            const svc = availableServices.find((s) => s.id === id);
            if (svc) handleServicePress(svc);
          }}
        />
      ) : null}

      {/* ⓘ explainer sheet */}
      {infoSheetSlug ? (
        <ServiceInfoSheet
          slug={infoSheetSlug}
          onClose={() => setInfoSheetSlug(null)}
        />
      ) : null}

      {/* Per-service option picker (has_options services) — resolves the
          choice (Front/Rear/Both, AGM/EFB, …) before the service is added,
          stashing it on the booking store for the price + persistence tail. */}
      <SingleServiceOptionsSheet
        visible={optionsServiceId != null}
        serviceId={optionsServiceId}
        serviceName={
          availableServices.find((s) => s.id === optionsServiceId)?.name ?? "Service"
        }
        onClose={() => setOptionsServiceId(null)}
        onConfirm={(option) => {
          const id = optionsServiceId;
          if (!id) return;
          const store = useBookingStore.getState();
          const wasSelected = store.selectedServiceIds.includes(id);
          store.setSelectedServiceOption(id, {
            optionId: option._id,
            labor_hours: option.labor_hours,
            parts_cost_avg: (option.parts_cost_low + option.parts_cost_high) / 2,
            state_fee: option.state_fee,
            option_label: option.option_label,
            option_type: option.option_type,
          });
          if (!wasSelected) {
            // Defer the toggle to the ghost's landing so the cart count
            // ticks up in sync with the visual, not on sheet dismiss.
            flyToCartAfterSheet(id, () => store.toggleServiceSelection(id));
          }
          setOptionsServiceId(null);
        }}
      />

      {/* Diagnostic Scan picker — resolves the area + notes, then adds the
          service so totals + downstream stages have the data ready. */}
      <DiagnosticOptionsSheet
        visible={showDiagnosticSheet}
        initialSystem={selectedDiagnosticSystem}
        initialNotes={customerNotes}
        onClose={() => setShowDiagnosticSheet(false)}
        onConfirm={(system, notes) => {
          const store = useBookingStore.getState();
          store.setSelectedDiagnosticSystem(system);
          store.setCustomerNotes(notes);
          if (
            diagnosticServiceId &&
            !store.selectedServiceIds.includes(diagnosticServiceId)
          ) {
            const id = diagnosticServiceId;
            flyToCartAfterSheet(id, () => store.toggleServiceSelection(id));
          }
          setShowDiagnosticSheet(false);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "transparent",
  },
  fabHost: {
    position: "absolute",
    right: 16,
    // `bottom` is set inline from insets so the FAB clears the
    // Continue pill on all phone shapes. `pointerEvents: 'box-none'`
    // on the host so the empty space around the FAB doesn't block
    // taps on the sheet content underneath.
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    overflow: "hidden",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  sheetAndroidFallback: {
    backgroundColor: "rgba(255, 255, 255, 0.85)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 0,
    paddingBottom: 12,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 18,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  headerIconTile: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleTarget: {
    fontFamily: "Urbanist-Bold",
    fontSize: 28,
    lineHeight: 34,
    color: "#0F172A",
    flexShrink: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  list: {
    marginBottom: 16,
  },
  empty: {
    paddingVertical: 40,
  },
});
