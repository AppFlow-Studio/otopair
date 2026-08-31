/**
 * ServiceInfoSheet — opens on ⓘ tap from a service row.
 *
 * Layout (top to bottom):
 *  1. Title — entry.label
 *  2. 3-line "quick summary" — the collapsed teaser from the
 *     Otopair Service Guide (Three Levels of Detail). Big, easy.
 *  3. "What it is" / "Why it matters" / "Signs you might need it"
 *     — the SIMPLE tier from the same guide, customer-voice only.
 *  4. Meta row — est time + applicability ("Shows for: …").
 *
 * Slugs that aren't in `SERVICE_COPY` (currently only
 * `pre_purchase_inspection` — the guide doesn't cover it) gracefully
 * fall back to the legacy single-line subtitle render so we never
 * regress the experience for an unmapped service.
 *
 * Uses the shared FloatingSheet primitive. The content scrolls inside
 * the sheet because the full WHAT/WHY/SIGNS triplet is long for
 * services like Oil Change and Spark Plugs.
 */

import React, { useEffect, useRef } from "react";
import { Dimensions, Platform, ScrollView, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { Clock, Info, Sparkles } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { getServiceIcon } from "@/components/booking-flow/serviceIcons";
import { TABS, TAXONOMY } from "@/constants/serviceTaxonomy";
import {
  getServiceCopy,
  pickServiceCopyTier,
  type ServiceTierCopy,
} from "@/constants/serviceCopy";
import { useServiceCopyTier } from "@/hooks/useServiceCopyTier";
import { BrandColors, CardShadow } from "@/constants/theme";

interface ServiceInfoSheetProps {
  slug: string;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

export function ServiceInfoSheet({ slug, onClose }: ServiceInfoSheetProps) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const entry = TAXONOMY[slug];
  const copy = getServiceCopy(slug);
  // Pick the tier from the onboarding ExperienceStep answer. The hook
  // resolves to "simple" when the user hasn't answered, matching Oto
  // AI's friendly baseline. Same level for both surfaces so the
  // InfoSheet and chat speak in the same voice.
  const tier = useServiceCopyTier();
  const tieredCopy: ServiceTierCopy | null = copy ? pickServiceCopyTier(copy, tier) : null;

  useEffect(() => {
    sheetRef.current?.open();
  }, []);

  // Tall enough to fit the longest WHAT/WHY/SIGNS triplet
  // comfortably (Oil Change runs ~470pt on a notch iPhone); ScrollView
  // handles anything beyond that. Falls back to the previous 420 /
  // 45% sizing on legacy un-mapped slugs since there's nothing extra
  // to show.
  const snapHeight = copy
    ? Math.min(680, SCREEN_HEIGHT * 0.78)
    : Math.min(420, SCREEN_HEIGHT * 0.45);

  return (
    <FloatingSheet
      ref={sheetRef}
      snapHeights={[snapHeight]}
      showBackdrop
      backdropMode="dim"
      onClose={onClose}
    >
      {entry ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header — service icon tile + title + tab eyebrow.
              Same icon tile pattern Screen 2 rows use so the sheet
              reads as an expanded version of the row you tapped
              from. */}
          <ServiceHeader slug={slug} label={entry.label} tab={entry.tab} />

          {copy && tieredCopy ? (
            <>
              <QuickLookCard lines={copy.quickSummary} />

              <SimpleSection title="What it is" body={tieredCopy.whatItIs} />
              <SimpleSection title="Why it matters" body={tieredCopy.whyItMatters} />
              <SimpleSection title="Signs you might need it" body={tieredCopy.signs} />
            </>
          ) : (
            // Legacy fallback — single-line subtitle, used when the
            // guide doesn't cover this slug yet.
            <Text size="md" weight="regular" color="#374151" style={styles.fallbackSubtitle}>
              {entry.subtitle}
            </Text>
          )}

          {/* Chip-style meta footer instead of the old inline hairline
              row. Each meta gets its own soft-tinted pill so they
              read as first-class info, not marginalia. */}
          <View style={styles.metaRow}>
            <View style={styles.metaChip}>
              <Clock size={14} color="#4B5563" strokeWidth={2} />
              <Text size="sm" weight="semiBold" color="#1F2937">
                {entry.estTimeLabel}
              </Text>
            </View>
            <View style={styles.metaChip}>
              <Info size={14} color="#4B5563" strokeWidth={2} />
              <Text
                size="sm"
                weight="semiBold"
                color="#1F2937"
                numberOfLines={1}
                style={styles.metaChipText}
              >
                Shows for: {entry.showsForLabel}
              </Text>
            </View>
          </View>
        </ScrollView>
      ) : (
        <View style={styles.fallbackBody}>
          <Text size="md" weight="regular" color="#6B7280">
            No info available.
          </Text>
        </View>
      )}
    </FloatingSheet>
  );
}

/** Service header — icon tile + title + tab eyebrow. Anchors the
 *  sheet with the same visual identity as the row the user tapped
 *  from. */
function ServiceHeader({
  slug,
  label,
  tab,
}: {
  slug: string;
  label: string;
  tab: string;
}) {
  const Icon = getServiceIcon(slug);
  const tabLabel = TABS.find((t) => t.key === tab)?.label ?? "Service";
  return (
    <View style={styles.header}>
      <View style={styles.headerIconTile}>
        <Icon size={24} color="#4B5563" strokeWidth={2} />
      </View>
      <View style={styles.headerText}>
        <Text
          size="xs"
          weight="bold"
          color="#5299FE"
          style={styles.headerEyebrow}
        >
          {tabLabel.toUpperCase()}
        </Text>
        <Text
          size={28}
          weight="extraBold"
          color={BrandColors.primary}
          style={styles.headerTitle}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

/** The 3-line summary from the Otopair Service Guide, lifted into a
 *  glassy featured card with a Sparkles eyebrow so it reads as the
 *  TL;DR rather than a plain paragraph. */
function QuickLookCard({ lines }: { lines: readonly string[] }) {
  return (
    <View style={styles.quickCard}>
      {Platform.OS === "ios" ? (
        <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.quickHeader}>
        <Sparkles size={14} color="#5299FE" strokeWidth={2.2} />
        <Text
          size="xs"
          weight="bold"
          color="#5299FE"
          style={styles.quickEyebrow}
        >
          QUICK LOOK
        </Text>
      </View>
      <View style={styles.quickBody}>
        {lines.map((line, idx) => (
          <Text
            key={idx}
            size="md"
            weight="medium"
            color="#0F172A"
            style={styles.quickLine}
          >
            {line}
          </Text>
        ))}
      </View>
    </View>
  );
}

/** Single labeled paragraph inside the sheet — used for WHAT IT IS,
 *  WHY IT MATTERS, and SIGNS. Section title carries a small colored
 *  bar accent on its left so the sections read as sibling blocks. */
function SimpleSection({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionTitleRow}>
        <View style={styles.sectionAccent} />
        <Text weight="bold" style={styles.sectionTitle}>
          {title}
        </Text>
      </View>
      <Text size="md" weight="regular" color="#374151" style={styles.sectionBody}>
        {body}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
  },

  // ── Header ───────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 20,
  },
  headerIconTile: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "rgba(82, 153, 254, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
    marginBottom: 2,
  },
  headerTitle: {
  },

  // ── Quick look card ──────────────────────────────────────
  quickCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
    backgroundColor: "rgba(82, 153, 254, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(82, 153, 254, 0.28)",
    overflow: "hidden",
    boxShadow: CardShadow.default,
  },
  quickHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  quickEyebrow: {
    fontSize: 11,
    letterSpacing: 1.2,
  },
  quickBody: {
    gap: 4,
  },
  quickLine: {
    lineHeight: 22,
  },

  // ── Sections ─────────────────────────────────────────────
  section: {
    marginBottom: 22,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionAccent: {
    width: 3,
    height: 14,
    borderRadius: 2,
    backgroundColor: "#5299FE",
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#5299FE",
  },
  sectionBody: {
    lineHeight: 22,
  },

  // ── Fallback (legacy un-mapped) ──────────────────────────
  fallbackSubtitle: {
    lineHeight: 22,
    marginBottom: 18,
  },
  fallbackBody: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 22,
  },

  // ── Meta footer ──────────────────────────────────────────
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(15, 23, 42, 0.08)",
  },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "rgba(15, 23, 42, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.06)",
  },
  metaChipText: {
    flexShrink: 1,
  },
});
