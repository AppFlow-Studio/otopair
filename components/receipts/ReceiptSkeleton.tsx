/**
 * ReceiptSkeleton — pulse placeholder while `api.bookings.getReceipt`
 * is in flight. Mirrors the v2 Shop-style `ReceiptContent` layout so
 * the swap doesn't visually jump.
 */

import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

const PULSE = "#E5E7EB";
const HAIRLINE = "#E5E7EB";

function usePulse() {
  const opacity = useSharedValue(0.55);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);
  return useAnimatedStyle(() => ({ opacity: opacity.value }));
}

function Bar({
  width,
  height,
  style,
}: {
  width: number | string;
  height: number;
  style?: object;
}) {
  const pulse = usePulse();
  return (
    <Animated.View
      style={[styles.bar, { width: width as any, height }, style, pulse]}
    />
  );
}

export function ReceiptSkeleton() {
  return (
    <View style={styles.wrap}>
      {/* Title + share */}
      <View style={styles.titleRow}>
        <Bar width={130} height={28} />
        <Bar width={44} height={44} style={{ borderRadius: 22 }} />
      </View>

      {/* Subtitle */}
      <Bar width="60%" height={12} style={{ marginBottom: 18 }} />

      {/* Two item rows */}
      {[0, 1].map((i) => (
        <View
          key={i}
          style={[styles.itemRow, i === 0 && styles.itemRowDivider]}
        >
          <Bar width={44} height={44} style={{ borderRadius: 10 }} />
          <View style={{ flex: 1, gap: 6 }}>
            <Bar width="60%" height={14} />
            <Bar width="35%" height={10} />
          </View>
          <Bar width={56} height={14} />
        </View>
      ))}

      {/* Pricing stack */}
      <View style={styles.pricingStack}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.pricingRow}>
            <Bar width="20%" height={12} />
            <Bar width={48} height={12} />
          </View>
        ))}
      </View>

      {/* Total */}
      <View style={styles.totalRow}>
        <Bar width="18%" height={18} />
        <Bar width={88} height={20} />
      </View>

      <View style={styles.sectionDivider} />

      {/* 4 section placeholders */}
      {[0, 1, 2, 3].map((i) => (
        <View key={i} style={styles.section}>
          <Bar width="40%" height={16} style={{ marginBottom: 10 }} />
          <Bar width="70%" height={13} />
          <Bar width="55%" height={13} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 14,
  },
  itemRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  pricingStack: {
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    marginTop: 12,
    gap: 8,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    marginTop: 8,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginTop: 4,
    marginBottom: 18,
  },
  section: {
    marginBottom: 20,
  },
  bar: {
    backgroundColor: PULSE,
    borderRadius: 6,
  },
});

export default ReceiptSkeleton;
