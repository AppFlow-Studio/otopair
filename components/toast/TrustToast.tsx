import { StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";

import { TRUST_GRADIENT } from "./tokens";

interface Props {
  scheme: "light" | "dark";
  borderColor: string;
}

/**
 * Liquid-Glass background layer for Trust-Moment toasts.
 * Stacked beneath the toast content; the parent Toast container handles
 * border + shadow. Justification per PLAN §B.3: the trust event deserves
 * a "premium" visual that reads as protective, not transactional.
 */
export function TrustToastBackground({ scheme, borderColor }: Props) {
  const [start, end] = TRUST_GRADIENT[scheme];
  return (
    <View style={[StyleSheet.absoluteFill, styles.wrap, { borderColor }]} pointerEvents="none">
      <BlurView
        intensity={20}
        tint={scheme === "dark" ? "dark" : "light"}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[start, end]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 16,
    overflow: "hidden",
  },
});
