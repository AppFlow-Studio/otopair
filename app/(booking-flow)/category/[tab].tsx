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

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Dimensions, Pressable, StyleSheet, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  ArrowLeft,
  Calendar,
  ClipboardCheck,
  CircleDot,
  Wrench,
  type LucideIcon,
} from "lucide-react-native";

import { categoryTitleTransition } from "@/components/booking-flow/CategoryListRow";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Location from "expo-location";
import MapView, { PROVIDER_DEFAULT, type Region } from "react-native-maps";

import { Text } from "@/components/shared-ui";
import {
  GlassSheetBackground,
  GlassSheetHandle,
} from "@/components/booking-flow/GlassSheet";
import { ServiceInfoSheet } from "@/components/booking-flow/ServiceInfoSheet";
import { ServiceMultiSelectRow } from "@/components/booking-flow/ServiceMultiSelectRow";
import { StickyContinueBar } from "@/components/booking-flow/StickyContinueBar";
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

const FALLBACK_REGION: Region = {
  latitude: 41.1959,
  longitude: -73.4365,
  latitudeDelta: 0.08,
  longitudeDelta: 0.08,
};

// Match Screen 1's custom drag sheet (release-where-you-let-go,
// no snap-back). MIN_H is the tiny peek the user can shove the
// sheet down to; MAX_H is full-screen; INITIAL_H is the open
// peek-of-map look the screen mounts up into.
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MIN_H = SCREEN_HEIGHT * 0.23;
const MAX_H = SCREEN_HEIGHT * 1.0;
const INITIAL_H = SCREEN_HEIGHT * 0.92;

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
  const params = useLocalSearchParams<{ tab: string }>();

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
  const { applicableIds, bookableIds, needsSpecsIds, isLoading: isBookableLoading } =
    useBookableServices(ownershipId);

  // Map backdrop — same pattern as Screen 1
  const [region, setRegion] = useState<Region | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (cancelled) return;
        if (status !== "granted") {
          setRegion(FALLBACK_REGION);
          return;
        }
        const loc = await Location.getCurrentPositionAsync({});
        if (cancelled) return;
        setRegion({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        });
      } catch {
        if (!cancelled) setRegion(FALLBACK_REGION);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Custom slide-up sheet — same behavior as Screen 1. Mounts at
  // 0, rises smoothly to INITIAL_H so the screen reads as "sheet
  // slides up over the map". Pan on the chrome (handle + topRow
  // + header) drags the sheet; the service list scrolls normally.
  const sheetHeight = useSharedValue(0);
  const startHeight = useSharedValue(0);

  useEffect(() => {
    sheetHeight.value = withTiming(INITIAL_H, {
      duration: 600,
      easing: Easing.out(Easing.cubic),
    });
  }, [sheetHeight]);

  const dragGesture = useMemo(
    () =>
      Gesture.Pan()
        // Defer activation a touch so taps on the X button + vehicle
        // puck (sitting inside the drag chrome) don't get swallowed
        // by the pan handler.
        .activeOffsetY([-8, 8])
        .onBegin(() => {
          startHeight.value = sheetHeight.value;
        })
        .onUpdate((e) => {
          const next = startHeight.value - e.translationY;
          sheetHeight.value = Math.max(MIN_H, Math.min(MAX_H, next));
        }),
    [sheetHeight, startHeight],
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    height: sheetHeight.value,
  }));

  const [specsCheckServiceId, setSpecsCheckServiceId] = useState<string | null>(null);
  const [infoSheetSlug, setInfoSheetSlug] = useState<string | null>(null);

  const tab = useMemo(() => TABS.find((t) => t.key === tabKey), [tabKey]);

  // Filter + sort services in this tab. Mirrors v5 grid logic:
  // tab match → slug present → taxonomy entry exists → applicable
  // (year + engine flag) → intersect with applicableIds from the
  // coverage filter (which already drops missing_data).
  const filteredServices = useMemo(() => {
    if (!tabKey) return [];
    const list = availableServices
      .filter((service) => {
        if (service.tab !== tabKey) return false;
        if (!service.slug) return false;
        const entry = TAXONOMY[service.slug];
        if (!entry) return false;
        const spec = engineSpecs[service.id] ?? null;
        return isApplicable(entry, selectedVehicle ?? null, spec);
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    if (!ownershipId) return list;
    if (isBookableLoading) return [];
    return list.filter((s) => applicableIds.has(s.id));
  }, [
    tabKey,
    availableServices,
    selectedVehicle,
    engineSpecs,
    ownershipId,
    isBookableLoading,
    applicableIds,
  ]);

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

      toggleServiceSelection(service.id);
    },
    [router, selectedServiceIds, needsSpecsIds, toggleServiceSelection],
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

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(booking-flow)/select-services");
  };

  return (
    <View style={styles.root}>
      {/* Full-bleed map under the sheet */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {region ? (
          <MapView
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            region={region}
            showsUserLocation
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
            pointerEvents="none"
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.mapFallback]} />
        )}
      </View>

      <GestureDetector gesture={dragGesture}>
        <Animated.View style={[styles.sheet, sheetAnimatedStyle]}>
          <GlassSheetBackground style={StyleSheet.absoluteFill} />
          <GlassSheetHandle />

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
            <VehiclePuck />
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
                  onPress={() => handleServicePress(svc)}
                  onInfoPress={() => setInfoSheetSlug(slug)}
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
        </Animated.View>
      </GestureDetector>

      {/* Sticky Continue bar (over the sheet) */}
      <StickyContinueBar
        count={selectedServiceIds.length}
        onPress={() => router.push("/(booking-flow)/choose-mechanic")}
      />

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
          store.setSelectedServiceOption(id, {
            optionId: option._id,
            labor_hours: option.labor_hours,
            parts_cost_avg: (option.parts_cost_low + option.parts_cost_high) / 2,
            state_fee: option.state_fee,
            option_label: option.option_label,
            option_type: option.option_type,
          });
          if (!store.selectedServiceIds.includes(id)) {
            store.toggleServiceSelection(id);
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
            store.toggleServiceSelection(diagnosticServiceId);
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
    backgroundColor: "#0F172A",
  },
  mapFallback: {
    backgroundColor: "#C8D7DE",
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
