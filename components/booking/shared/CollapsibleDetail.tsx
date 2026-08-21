/**
 * CollapsibleDetail
 *
 * PURPOSE: A slim expand/collapse control that tucks a block of detail
 *          (e.g. the itemized labor/parts/tax breakdown on Review & Pay)
 *          behind a "See full breakdown" toggle. Collapsed by default so the
 *          summary above it stays simple; tapping fades the children in.
 *
 * USED IN: app/booking/mechanic/[id]/payment.tsx (Review & Pay)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback, useState } from "react";
import { StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import Animated, { FadeIn } from "react-native-reanimated";
import { ChevronDown, ChevronUp } from "lucide-react-native";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// ============================================================================
// TYPES
// ============================================================================

interface CollapsibleDetailProps {
  /** The detail revealed when expanded. */
  children: React.ReactNode;
  /** Custom always-visible toggle content (rendered on the left; the chevron
   *  is appended on the right). When supplied it replaces the default
   *  "See full breakdown" link — use it to make e.g. a summary row the
   *  toggle itself. */
  header?: React.ReactNode;
  /** Toggle label while collapsed (used only when `header` is not set). */
  expandLabel?: string;
  /** Toggle label while expanded (used only when `header` is not set). */
  collapseLabel?: string;
  /** Start expanded. Defaults to collapsed so the summary reads simple. */
  defaultExpanded?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function CollapsibleDetail({
  children,
  header,
  expandLabel = "See full breakdown",
  collapseLabel = "Hide breakdown",
  defaultExpanded = false,
}: CollapsibleDetailProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggle = useCallback(() => {
    setExpanded((prev) => !prev);
  }, []);

  return (
    <View>
      <TouchableOpacity
        style={header ? styles.headerToggle : styles.toggle}
        onPress={toggle}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        {header ? (
          <View style={styles.headerContent}>{header}</View>
        ) : (
          <Text size="sm" weight="semiBold" color={BrandColors.secondary}>
            {expanded ? collapseLabel : expandLabel}
          </Text>
        )}
        {/* Fixed-width box so the icon always reserves layout space — a raw
            react-native-svg icon next to a flex:1 sibling can collapse to
            zero width and get pushed off the row. Swap the glyph rather than
            rotating it: an RN `transform` on a react-native-svg icon can
            render it off-box / invisible. */}
        <View style={styles.chevronBox}>
          {expanded ? (
            <ChevronUp size={header ? 20 : 16} color={BrandColors.secondary} />
          ) : (
            <ChevronDown size={header ? 20 : 16} color={BrandColors.secondary} />
          )}
        </View>
      </TouchableOpacity>

      {expanded ? (
        <Animated.View entering={FadeIn.duration(160)} style={styles.body}>
          {children}
        </Animated.View>
      ) : null}
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
  },
  headerToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
  },
  headerContent: {
    flex: 1,
    minWidth: 0,
  },
  chevronBox: {
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  body: {
    marginTop: Spacing.xs,
  },
});
