/**
 * LegalDocument
 *
 * PURPOSE: Renders a full legal document (Terms of Use / Privacy Policy) as a
 *          clean, scrollable read — title, effective date, intro, then numbered
 *          sections with paragraphs and bullet lists. Content comes from the
 *          structured data in constants/legal/* (generated from the source docs).
 *
 * USED IN: app/settings/terms-and-conditions.tsx, app/settings/privacy-policy.tsx
 */

import React from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { BlurHeaderOverlay, BrandColors, Text } from "@/components/shared-ui";
import { getSheetContentPadding, Spacing } from "@/constants/theme";

export interface LegalBlock {
  type: "p" | "ul";
  text?: string;
  items?: string[];
}

export interface LegalSection {
  heading: string;
  blocks: LegalBlock[];
}

export interface LegalDocumentData {
  title: string;
  effectiveDate: string;
  intro: LegalBlock[];
  sections: LegalSection[];
}

function Block({ block }: { block: LegalBlock }) {
  if (block.type === "ul") {
    return (
      <View style={styles.ul}>
        {(block.items ?? []).map((item, i) => (
          <View key={i} style={styles.li}>
            <Text style={styles.bullet}>•</Text>
            <Text style={styles.body}>{item}</Text>
          </View>
        ))}
      </View>
    );
  }
  return <Text style={styles.body}>{block.text}</Text>;
}

interface LegalDocumentProps {
  data: LegalDocumentData;
  /** Short title for the sticky blur header. */
  headerTitle: string;
}

export function LegalDocument({ data, headerTitle }: LegalDocumentProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 64,
            paddingBottom: getSheetContentPadding(false, insets.bottom),
          },
        ]}
      >
        <Text style={styles.docTitle} weight="bold">
          {data.title}
        </Text>
        {data.effectiveDate ? (
          <Text style={styles.effective} size="sm" color="#6B7280">
            Effective Date: {data.effectiveDate}
          </Text>
        ) : null}

        {data.intro.map((block, i) => (
          <Block key={`intro-${i}`} block={block} />
        ))}

        {data.sections.map((section, i) => (
          <View key={i} style={styles.section}>
            <Text style={styles.heading} weight="bold">
              {section.heading}
            </Text>
            {section.blocks.map((block, j) => (
              <Block key={j} block={block} />
            ))}
          </View>
        ))}
      </ScrollView>

      <BlurHeaderOverlay title={headerTitle} onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  container: {
    paddingHorizontal: Spacing.xl,
  },
  docTitle: {
    fontSize: 22,
    lineHeight: 28,
    color: BrandColors.primary,
    marginBottom: 4,
  },
  effective: {
    marginBottom: Spacing.lg,
  },
  section: {
    marginTop: Spacing.lg,
  },
  heading: {
    fontSize: 16,
    lineHeight: 22,
    color: BrandColors.primary,
    marginBottom: Spacing.sm,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: "#374151",
    marginBottom: Spacing.sm,
  },
  ul: {
    marginBottom: Spacing.xs,
  },
  li: {
    flexDirection: "row",
    marginBottom: Spacing.sm,
    paddingRight: Spacing.sm,
  },
  bullet: {
    fontSize: 14,
    lineHeight: 21,
    color: "#6B7280",
    marginRight: Spacing.sm,
  },
});

export default LegalDocument;
