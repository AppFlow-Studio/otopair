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
import { Dimensions, ScrollView, StyleSheet, View } from "react-native";
import { Clock, Info } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { TAXONOMY } from "@/constants/serviceTaxonomy";
import { getServiceCopy, type ServiceSimpleCopy } from "@/constants/serviceCopy";

interface ServiceInfoSheetProps {
  slug: string;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get("window").height;

export function ServiceInfoSheet({ slug, onClose }: ServiceInfoSheetProps) {
  const sheetRef = useRef<FloatingSheetRef>(null);
  const entry = TAXONOMY[slug];
  const copy = getServiceCopy(slug);

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
          <Text size="2xl" weight="bold" color="#0F172A" style={styles.title}>
            {entry.label}
          </Text>

          {copy ? (
            <>
              <View style={styles.quickSummary}>
                {copy.quickSummary.map((line, idx) => (
                  <Text
                    key={idx}
                    size="md"
                    weight="medium"
                    color="#1F2937"
                    style={styles.quickLine}
                  >
                    {line}
                  </Text>
                ))}
              </View>

              <SimpleSection title="What it is" body={copy.simple.whatItIs} />
              <SimpleSection title="Why it matters" body={copy.simple.whyItMatters} />
              <SimpleSection title="Signs you might need it" body={copy.simple.signs} />
            </>
          ) : (
            // Legacy fallback — single-line subtitle, used when the
            // guide doesn't cover this slug yet.
            <Text size="md" weight="regular" color="#374151" style={styles.fallbackSubtitle}>
              {entry.subtitle}
            </Text>
          )}

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Clock size={16} color="#6B7280" strokeWidth={2} />
              <Text size="sm" weight="medium" color="#6B7280">
                {entry.estTimeLabel}
              </Text>
            </View>
            <View style={styles.metaDivider} />
            <View style={styles.metaItem}>
              <Info size={16} color="#6B7280" strokeWidth={2} />
              <Text size="sm" weight="medium" color="#6B7280">
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

/** Single labeled paragraph inside the sheet — used for WHAT IT IS,
 *  WHY IT MATTERS, and SIGNS. Section title is small, uppercase, and
 *  blue-tinted to match the doc's section headers. */
function SimpleSection({ title, body }: { title: string; body: ServiceSimpleCopy[keyof ServiceSimpleCopy] }) {
  return (
    <View style={styles.section}>
      <Text weight="bold" style={styles.sectionTitle}>
        {title}
      </Text>
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
  title: {
    fontSize: 22,
    lineHeight: 28,
    marginBottom: 14,
  },
  quickSummary: {
    backgroundColor: "rgba(82, 153, 254, 0.07)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 22,
    gap: 4,
  },
  quickLine: {
    lineHeight: 22,
  },
  section: {
    marginBottom: 18,
  },
  sectionTitle: {
    fontSize: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: "#5299FE",
    marginBottom: 6,
  },
  sectionBody: {
    lineHeight: 22,
  },
  fallbackSubtitle: {
    lineHeight: 22,
    marginBottom: 18,
  },
  fallbackBody: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 22,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    marginTop: 6,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(15, 23, 42, 0.08)",
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaDivider: {
    width: 1,
    height: 14,
    backgroundColor: "rgba(15, 23, 42, 0.15)",
  },
});
