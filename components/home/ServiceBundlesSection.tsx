/**
 * ServiceBundlesSection
 *
 * PURPOSE: Home-tab horizontal carousel of seasonal service bundles.
 *          Each card is a trust-first value pitch: clear service list,
 *          total time, and a "1 visit vs N separate trips" pill so the
 *          user reads the bundle as a convenience win, not a discount play.
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - bundles (ServiceBundle[]): optional override of the seed bundles
 *   - onViewPackage ((bundleId: string) => void): optional override of the CTA
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";

// 2. Expo & Third-party
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import Animated, { FadeInUp } from "react-native-reanimated";

// 3. Shared UI
import { Text } from "@/components/shared-ui";

// 4. Constants, hooks, stores
import {
  BorderRadius,
  BrandColors,
  FontFamily,
  Fonts,
  SemanticColors,
  Shadows,
  Spacing,
} from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
import { useVehicleStore } from "@/stores/useVehicleStore";
import { useBookableServices } from "@/hooks/useBookableServices";
import type { Service } from "@/stores/types/store.types";

// Match either hyphenated ("brake-system-inspection") or underscored
// ("brake_system_inspection") slug variants — the catalog has seen both.
const normalizeSlug = (s: string | undefined) =>
  s ? s.toLowerCase().replace(/-/g, "_") : "";

// ============================================================================
// TYPES
// ============================================================================

export type BundleTheme = "winter" | "summer" | "spring" | "fall";

export interface BundleService {
  /** What the home card displays — bundle author's friendly phrasing. */
  displayName: string;
  /** Catalog slug for the booking-cart preselection. Looked up against
   *  `availableServices` so the right service auto-ticks even when the
   *  display name differs from the catalog name (e.g. "Coolant top-up"
   *  → coolant-flush). Hyphens / underscores are normalized at match time. */
  serviceSlug: string;
}

export interface ServiceBundle {
  id: string;
  name: string;
  theme: BundleTheme;
  services: BundleService[];
  /** Approximate total time the bundle takes at the shop, in minutes. */
  durationMinutes: number;
  /** How many separate trips the user would otherwise make for these services. */
  equivalentSeparateTrips: number;
  /** Optional. If set, an additional green "Save up to $X" pill renders. */
  savingsEstimate?: number;
}

interface ServiceBundlesSectionProps {
  bundles?: ServiceBundle[];
  onViewPackage?: (bundleId: string) => void;
  onBeforeOpenBookingFlow?: () => boolean;
}


// ============================================================================
// SAMPLE DATA
// ============================================================================

const SAMPLE_BUNDLES: ServiceBundle[] = [
  {
    id: "summer-care",
    name: "Summer Care Package",
    theme: "summer",
    services: [
      { displayName: "Full AC system check", serviceSlug: "ac-service" },
      { displayName: "Coolant top-up", serviceSlug: "coolant-flush" },
      { displayName: "Tire pressure adjustment", serviceSlug: "tpms-sensor-calibration" },
      { displayName: "Battery health inspection", serviceSlug: "battery-test" },
    ],
    durationMinutes: 90,
    equivalentSeparateTrips: 4,
    savingsEstimate: 50,
  },
  {
    id: "winter-safety",
    name: "Winter Safety Package",
    theme: "winter",
    services: [
      { displayName: "Battery health inspection", serviceSlug: "battery-test" },
      { displayName: "Antifreeze check", serviceSlug: "coolant-flush" },
      { displayName: "Tire tread inspection", serviceSlug: "tire-rotation" },
      { displayName: "Brake system check", serviceSlug: "brake-system-inspection" },
    ],
    durationMinutes: 75,
    equivalentSeparateTrips: 4,
    savingsEstimate: 50,
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBundlesSection({
  bundles = SAMPLE_BUNDLES,
  onViewPackage,
  onBeforeOpenBookingFlow,
}: ServiceBundlesSectionProps) {
  const router = useRouter();
  const availableServices = useBookingStore((s) => s.availableServices);
  const replaceSelectedServicesForVehicle = useBookingStore((s) => s.replaceSelectedServicesForVehicle);
  const selectedVehicle = useVehicleStore((s) => s.getSelectedVehicle());
  const { bookableIds, isLoading: isBookableLoading } =
    useBookableServices(selectedVehicle?.ownershipId);

  const handleBookPackage = (bundle: ServiceBundle) => {
    if (onBeforeOpenBookingFlow?.() === false) {
      return;
    }
    if (onViewPackage) {
      onViewPackage(bundle.id);
      return;
    }
    // Look up each bundle service by its explicit catalog slug. The
    // bundle author specifies the slug at authoring time, so this is
    // 100% reliable when the catalog has the service. Slugs that don't
    // resolve are silently skipped (catalog data issue, not code).
    const store = useBookingStore.getState();
    const matched: Service[] = [];
    const seen = new Set<string>();
    for (const bs of bundle.services) {
      const wanted = normalizeSlug(bs.serviceSlug);
      const m = availableServices.find((s) => normalizeSlug(s.slug) === wanted);
      if (m && !seen.has(m.id)) {
        matched.push(m);
        seen.add(m.id);
      }
    }
    replaceSelectedServicesForVehicle(matched, {
      ownershipId: selectedVehicle?.ownershipId,
      bookableIds: selectedVehicle?.ownershipId && isBookableLoading ? null : bookableIds,
    });
    // Land on the first matched service's category; the auto-scroll
    // effect in ServiceSelectionContent will snap to the first selected
    // row so the user sees the populated cart immediately.
    store.setInitialServiceCategory(matched[0]?.category ?? "basic_maintenance");
    router.push("/(booking-flow)/select-services");
  };

  return (
    <View style={styles.container}>
      <Text size="md" color="#000000" style={styles.sectionHeader}>
        Service Bundles
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + Spacing.md}
        snapToAlignment="start"
        style={styles.scrollView}
      >
        {bundles.map((bundle) => (
          <BundleCard
            key={bundle.id}
            bundle={bundle}
            onBookPackage={handleBookPackage}
          />
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// BUNDLE CARD (per-item)
// ============================================================================

function BundleCard({
  bundle,
  onBookPackage,
}: {
  bundle: ServiceBundle;
  onBookPackage: (bundle: ServiceBundle) => void;
}) {
  return (
    <View style={styles.card}>
      {/* Package name — break the last word ("Package") onto its
          own line so the headline reads as a two-line stack
          (e.g. "Summer Care" / "Package"). */}
      <Text style={styles.title}>
        {(() => {
          const parts = bundle.name.split(' ');
          if (parts.length < 2) return bundle.name;
          const last = parts[parts.length - 1];
          const rest = parts.slice(0, -1).join(' ');
          return `${rest}\n${last}`;
        })()}
      </Text>

      {/* Spec sheet — enumerated services with hairline separators. */}
      <View style={styles.specSheet}>
        {bundle.services.map((service, index) => (
          <Animated.View
            key={service.serviceSlug}
            entering={FadeInUp.duration(220).delay(80 + index * 60)}
            style={styles.specRow}
          >
            <Text style={styles.specNumber}>
              {String(index + 1).padStart(2, "0")}
            </Text>
            <Text style={styles.specName}>{service.displayName}</Text>
          </Animated.View>
        ))}
      </View>

      {/* Two-column stat row — Estimated Time / Estimated Savings. */}
      <View style={styles.statRow}>
        <View style={styles.statLeft}>
          <Text style={styles.statLabel}>Estimated time</Text>
          <Text style={styles.statValueTime}>~{bundle.durationMinutes} min</Text>
        </View>
        <View style={styles.statRight}>
          <Text style={styles.statLabel}>Estimated savings</Text>
          <Text style={styles.statValueSavings}>
            ~${bundle.savingsEstimate ?? 0}
          </Text>
        </View>
      </View>

      {/* CTA — full pill, brand blue, sentence case. */}
      <View style={styles.ctaWrap}>
        <Pressable
          onPress={() => onBookPackage(bundle)}
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
        >
          <Text style={styles.ctaText}>Book package</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const CARD_WIDTH = 320;

// Spacing scale used throughout this card:
//   xs (4)  — number-to-label gap in the hero stat
//   sm (8)  — (reserved; previously kicker → title)
//   md (12) — number ↔ name in the spec sheet
//   lg (16) — title → hero stat
//   xl (20) — card padding, hero stat → spec sheet, spec sheet → CTA
const styles = StyleSheet.create({
  container: {
    marginTop: Spacing["2xl"],
  },
  sectionHeader: {
    marginBottom: Spacing.lg,
    fontStyle: "italic",
  },
  scrollView: {
    marginHorizontal: -Spacing.lg,
  },
  scrollContent: {
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,
    // Vertical breathing room so each card's drop shadow renders *inside*
    // the ScrollView bounds. Without it, the horizontal ScrollView clips
    // the shadow at its frame edge, cutting it into a hard bottom line.
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },

  // ── Card surface — warm off-white, hairline edge, medium lift ────────
  card: {
    width: CARD_WIDTH,
    backgroundColor: BrandColors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
    // ...Shadows.md,
  },

  // ── Bundle title — Urbanist Bold to match the rest of the app ────────
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 30,
    color: "#0F172A",
    marginBottom: Spacing.lg,
  },

  // ── Two-column stat row (Estimated Time / Estimated Savings) ────────
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.xl,
  },
  statLeft: {
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  statRight: {
    alignItems: "flex-end",
    gap: Spacing.xs,
  },
  statLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: SemanticColors.textMuted,
  },
  statValueTime: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 26,
    color: "#0F172A",
    fontVariant: ["tabular-nums"],
  },
  statValueSavings: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    lineHeight: 26,
    color: BrandColors.secondary,
    fontVariant: ["tabular-nums"],
  },

  // ── Spec sheet ───────────────────────────────────────────────────────
  specSheet: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.12)",
    marginBottom: Spacing.lg,
  },
  specRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.12)",
  },
  specNumber: {
    fontFamily: Fonts.mono,
    fontVariant: ["tabular-nums"],
    fontSize: 11,
    letterSpacing: 0.6,
    width: 22,
    color: BrandColors.secondary,
  },
  specName: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    lineHeight: 18,
    color: "#0F172A",
  },

  // ── CTA — full pill, brand blue, soft brand-blue lift ────────────────
  // Wrap owns the shadow so Pressable's clip doesn't swallow it.
  ctaWrap: {
    borderRadius: BorderRadius.full,
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  cta: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: BrandColors.white,
    letterSpacing: 0.2,
  },
});

export default ServiceBundlesSection;
