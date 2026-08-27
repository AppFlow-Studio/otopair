/**
 * QuickReadGateSheet
 *
 * Forced-flow prompt shown when a user taps "Add to Cart" on the Select
 * Services sheet for a vehicle that has never completed a quick-read.
 * Mirrors the "Let's score your {vehicle}" card from the Cars tab
 * (`app/(main-tabs)/cars/index.tsx`). Neither surface shows a number before
 * the quick-read: there are no service records yet, so there is nothing to
 * score.
 *
 * The sheet is mandatory: there is no Skip button. Dismissing via the
 * backdrop / swipe cancels the add-to-cart attempt and leaves the user
 * on the Select Services sheet with their selections intact.
 */

import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, CheckCircle2 } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/shared-ui";
import { scale, moderateScale } from "@/utils/responsive";

const CHECKS = [
  "Brake health assessment",
  "Tire life estimation",
  "Oil service status",
  "Battery condition check",
  "Warning light detection",
];

interface QuickReadGateSheetProps {
  visible: boolean;
  /** Label like "Honda Cr-v" used in the headline and CTA. */
  vehicleLabel: string;
  /** When true, the only way out is the CTA — backdrop taps and the
   *  hardware back button no-op. Used by the booking gate where the
   *  quick-read is mandatory. */
  mandatory?: boolean;
  onDismiss: () => void;
  onStartQuickRead: () => void;
}

export function QuickReadGateSheet({
  visible,
  vehicleLabel,
  mandatory = false,
  onDismiss,
  onStartQuickRead,
}: QuickReadGateSheetProps) {
  const insets = useSafeAreaInsets();
  const safeLabel = vehicleLabel.trim().length > 0 ? vehicleLabel : "vehicle";
  const handleBackdropPress = mandatory ? () => {} : onDismiss;
  const handleHardwareBack = mandatory ? () => {} : onDismiss;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleHardwareBack}
    >
      <TouchableWithoutFeedback onPress={handleBackdropPress}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View
              style={[
                styles.card,
                { paddingBottom: 24 + insets.bottom },
              ]}
            >
              {/* Gauge */}
              <View style={styles.gaugeWrap}>
                <View style={styles.gaugeOuter}>
                  <View style={styles.gaugeInner}>
                    {/* The gauge used to print a hardcoded 83 — a literal
                        default, the same for every vehicle and unconnected to
                        any data. Nothing is known about this car's service
                        history at this point, so nothing is claimed. */}
                    <Text weight="bold" size="3xl" color="#9CA3AF">
                      · · ·
                    </Text>
                    <Text
                      weight="medium"
                      size="sm"
                      color="#9CA3AF"
                      style={styles.gaugeLabel}
                    >
                      Not scored yet
                    </Text>
                  </View>
                </View>
              </View>

              {/* Headline */}
              <Text
                weight="bold"
                size="xl"
                color="#1F2937"
                style={styles.headline}
              >
                Let&apos;s score your {safeLabel}
              </Text>
              <Text
                weight="medium"
                size="sm"
                color="#6B7280"
                style={styles.subheadline}
              >
                We don&apos;t have your service history yet. Five quick checks and you&apos;ll have a real health score.
              </Text>

              {/* Bullet list */}
              <View style={styles.bullets}>
                {CHECKS.map((label) => (
                  <View key={label} style={styles.bulletRow}>
                    <CheckCircle2 size={18} color="#5299FE" />
                    <Text
                      weight="medium"
                      size="sm"
                      color="#374151"
                      style={styles.bulletText}
                    >
                      {label}
                    </Text>
                  </View>
                ))}
              </View>

              {/* CTA */}
              <Pressable
                onPress={onStartQuickRead}
                style={({ pressed }) => [
                  styles.cta,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <LinearGradient
                  colors={["#7BB8FF", "#5299FE", "#3B7FEB"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaGradient}
                >
                  <View style={styles.ctaTextWrap}>
                    <Text
                      weight="semiBold"
                      size="xs"
                      color="rgba(255,255,255,0.92)"
                      style={styles.ctaEyebrow}
                    >
                      Get a quick read on
                    </Text>
                    <Text
                      weight="bold"
                      size="md"
                      color="#FFFFFF"
                      numberOfLines={1}
                      adjustsFontSizeToFit
                      minimumFontScale={0.75}
                      style={styles.ctaTitle}
                    >
                      Your {safeLabel}
                    </Text>
                  </View>
                  <View style={styles.ctaArrowWrap}>
                    <ArrowRight size={scale(18)} color="#FFFFFF" />
                  </View>
                </LinearGradient>
              </Pressable>
              <Text
                weight="medium"
                size="xs"
                color="#9CA3AF"
                style={styles.footnote}
              >
                Takes about 30 seconds
              </Text>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#F3F4F6",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: "center",
  },
  gaugeWrap: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  gaugeOuter: {
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 6,
    borderColor: "rgba(82,153,254,0.35)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  gaugeInner: {
    alignItems: "center",
    justifyContent: "center",
  },
  gaugeLabel: {
    marginTop: 2,
  },
  headline: {
    marginTop: 20,
    textAlign: "center",
  },
  subheadline: {
    marginTop: 8,
    textAlign: "center",
  },
  bullets: {
    alignSelf: "stretch",
    marginTop: 18,
    gap: 10,
    paddingHorizontal: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  bulletText: {
    marginLeft: 10,
  },
  cta: {
    alignSelf: "stretch",
    marginTop: 22,
    borderRadius: moderateScale(24),
    overflow: "hidden",
  },
  ctaGradient: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    minHeight: scale(54),
    paddingLeft: scale(18),
    paddingRight: scale(52),
    paddingVertical: scale(10),
  },
  ctaTextWrap: {
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 1,
  },
  ctaEyebrow: {
    lineHeight: moderateScale(14),
  },
  ctaTitle: {
    textAlign: "center",
    lineHeight: moderateScale(20),
    marginTop: scale(1),
  },
  ctaArrowWrap: {
    position: "absolute",
    right: scale(18),
    top: 0,
    bottom: 0,
    width: scale(20),
    alignItems: "center",
    justifyContent: "center",
  },
  footnote: {
    marginTop: 10,
  },
});

export default QuickReadGateSheet;
