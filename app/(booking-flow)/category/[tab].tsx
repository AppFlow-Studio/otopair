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
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapView, { PROVIDER_DEFAULT, type Region } from "react-native-maps";
import BottomSheet, { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { ArrowLeft, Search } from "lucide-react-native";

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
import {
  SLUG_DIAGNOSTIC_SCAN,
  SLUG_ROTOR_REPLACEMENT,
  SLUG_TIRE_REPLACEMENT,
  TABS,
  TAXONOMY,
  type TaxonomyTab,
} from "@/constants/serviceTaxonomy";
import { useBookableServices } from "@/hooks/useBookableServices";
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

const SNAP_POINTS = ["23%", "38%", "55%", "92%"] as const;
const INITIAL_SNAP_INDEX = 3;

const VALID_TABS = new Set<TaxonomyTab>([
  "routine_upkeep",
  "tires_brakes",
  "major_service",
  "inspections",
]);

export default function CategoryDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  // Local sheet state
  const sheetRef = useRef<BottomSheet>(null);
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

      // Diagnostic scan: opens the legacy area picker once Phase 2's
      // own picker ships. Until then we just toggle (without the area
      // recorded) so the user can still book — area picker is a
      // small Phase-2.5 follow-up.
      if (service.slug === SLUG_DIAGNOSTIC_SCAN && !isSelected) {
        toggleServiceSelection(service.id);
        return;
      }

      // Coverage filter — needs-specs row opens the inline questions.
      if (!isSelected && needsSpecsIds.has(service.id)) {
        setSpecsCheckServiceId(service.id);
        return;
      }

      // has_options services route to the per-service picker on first
      // tap. Phase-2.5 will plug in the new picker; for now we toggle.
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

      <BottomSheet
        ref={sheetRef}
        snapPoints={SNAP_POINTS as unknown as string[]}
        index={INITIAL_SNAP_INDEX}
        enablePanDownToClose={false}
        enableDynamicSizing={false}
        backgroundComponent={GlassSheetBackground}
        handleComponent={GlassSheetHandle}
      >
        <BottomSheetScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 120 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Top controls */}
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
            <Pressable
              style={styles.iconBtn}
              onPress={() => {
                /* TODO Phase-3+ search overlay */
              }}
              hitSlop={8}
              accessibilityLabel="Search services"
            >
              <Search size={20} color="#1F2937" strokeWidth={2} />
            </Pressable>
            <View style={{ width: 8 }} />
            <VehiclePuck />
          </View>

          {/* Header */}
          {tab ? (
            <View style={styles.header}>
              <Text size="3xl" weight="bold" color="#0F172A" style={styles.title}>
                {tab.label}
              </Text>
              <Text size="md" weight="regular" color="#6B7280">
                {tab.subtitle} · {filteredServices.length} service
                {filteredServices.length === 1 ? "" : "s"}
              </Text>
            </View>
          ) : null}

          {/* Service rows */}
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

              const hours = engineSpecs[svc.id]?.labor_hours ?? svc.default_labor_hours;
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
        </BottomSheetScrollView>
      </BottomSheet>

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
  scrollContent: {
    paddingTop: 4,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 16,
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
  title: {
    fontSize: 28,
    lineHeight: 34,
    marginBottom: 4,
  },
  list: {
    marginBottom: 16,
  },
  empty: {
    paddingVertical: 40,
  },
});
