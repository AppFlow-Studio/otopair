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
import { useRouter } from "expo-router";
import { Car, Check, Clock, Flower2, Leaf, Snowflake, Sun } from "lucide-react-native";

// 3. Shared UI
import { Text } from "@/components/shared-ui";

// 4. Constants, hooks, stores
import { BorderRadius, BrandColors, FontFamily, Shadows, Spacing } from "@/constants/theme";
import { useBookingStore } from "@/stores/useBookingStore";
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
}

// ============================================================================
// THEME ICONS
// ============================================================================

const THEME_ICON: Record<BundleTheme, React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  summer: Sun,
  winter: Snowflake,
  spring: Flower2,
  fall: Leaf,
};

const THEME_LABEL: Record<BundleTheme, string> = {
  summer: "SUMMER",
  winter: "WINTER",
  spring: "SPRING",
  fall: "FALL",
};

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
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBundlesSection({
  bundles = SAMPLE_BUNDLES,
  onViewPackage,
}: ServiceBundlesSectionProps) {
  const router = useRouter();
  const availableServices = useBookingStore((s) => s.availableServices);

  const handleBookPackage = (bundle: ServiceBundle) => {
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
    store.clearSelectedServices();
    for (const m of matched) store.toggleServiceSelection(m.id);
    // Land on the first matched service's category; the auto-scroll
    // effect in ServiceSelectionContent will snap to the first selected
    // row so the user sees the populated cart immediately.
    store.setInitialServiceCategory(matched[0]?.category ?? "basic_maintenance");
    // `origin=home` keeps the back-arrow → Home behavior consistent.
    router.push("/booking/map?openServices=true&origin=home");
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
  const Icon = THEME_ICON[bundle.theme];
  const visitsCopy = `vs ${bundle.equivalentSeparateTrips} separate trips`;

  return (
    <View style={styles.card}>
      {/* Header — category pill + theme icon */}
      <View style={styles.header}>
        <View style={styles.categoryPill}>
          <Text style={styles.categoryPillText}>{THEME_LABEL[bundle.theme]}</Text>
        </View>
        <Icon size={20} color={BrandColors.secondary} strokeWidth={2} />
      </View>

      {/* Title + subtitle */}
      <Text style={styles.title}>{bundle.name}</Text>
      <Text style={styles.subtitle}>
        {bundle.services.length} services bundled together
      </Text>

      {/* Service checklist */}
      <View style={styles.servicesList}>
        {bundle.services.map((service) => (
          <View key={service.serviceSlug} style={styles.serviceRow}>
            <Check size={16} color="#22C55E" strokeWidth={2.5} />
            <Text style={styles.serviceText}>{service.displayName}</Text>
          </View>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Value strip — total time left, "1 visit" pill + trips caption right */}
      <View style={styles.valueRow}>
        <View style={styles.valueLeft}>
          <View style={styles.totalTimeLabelRow}>
            <Clock size={14} color="#6B7280" strokeWidth={2} />
            <Text style={styles.totalTimeLabel}>Total time</Text>
          </View>
          <Text style={styles.totalTimeValue}>~{bundle.durationMinutes} min</Text>
        </View>
        <View style={styles.valueRight}>
          <View style={styles.visitPill}>
            <Car size={14} color="#16A34A" strokeWidth={2.5} />
            <Text style={styles.visitPillText}>1 visit</Text>
          </View>
          <Text style={styles.visitCaption}>{visitsCopy}</Text>
          {bundle.savingsEstimate != null && (
            <View style={[styles.visitPill, styles.savingsPill]}>
              <Text style={styles.visitPillText}>
                Save up to ${bundle.savingsEstimate}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* CTA */}
      <Pressable
        onPress={() => onBookPackage(bundle)}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
      >
        <Text style={styles.ctaText}>Book Package</Text>
      </Pressable>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const CARD_WIDTH = 320;

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
    gap: Spacing.md,
  },

  // ── Card ─────────────────────────────────────────────────────────────
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    ...Shadows.md,
  },

  // ── Header (category pill + icon) ────────────────────────────────────
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  categoryPill: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(82,153,254,0.10)",
  },
  categoryPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 11,
    letterSpacing: 1,
    color: BrandColors.secondary,
  },

  // ── Title block ──────────────────────────────────────────────────────
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: "#0F172A",
    marginBottom: 4,
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: "#6B7280",
    marginBottom: Spacing.lg,
  },

  // ── Service checklist ────────────────────────────────────────────────
  servicesList: {
    gap: Spacing.sm + 2,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm + 2,
  },
  serviceText: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: "#1F2937",
  },

  // ── Divider ──────────────────────────────────────────────────────────
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: Spacing.lg,
  },

  // ── Value strip ──────────────────────────────────────────────────────
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.lg,
  },
  valueLeft: {
    flexDirection: "column",
    gap: 4,
  },
  totalTimeLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  totalTimeLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    color: "#6B7280",
  },
  totalTimeValue: {
    fontFamily: FontFamily.bold,
    fontSize: 19,
    color: "#0F172A",
  },
  valueRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  visitPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    backgroundColor: "rgba(34,197,94,0.10)",
  },
  savingsPill: {
    marginTop: 2,
  },
  visitPillText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: "#16A34A",
  },
  visitCaption: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: "#6B7280",
  },

  // ── CTA ──────────────────────────────────────────────────────────────
  cta: {
    backgroundColor: BrandColors.secondary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  ctaText: {
    fontFamily: FontFamily.semiBold,
    fontSize: 16,
    color: "#FFFFFF",
  },
});

export default ServiceBundlesSection;
