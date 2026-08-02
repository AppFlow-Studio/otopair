import { View, StyleSheet } from "react-native";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";

import type { ToastVariant } from "./types";
import type { ToastPalette } from "./tokens";

const ICON_MAP = {
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
  error: XCircle,
  trust: ShieldCheck,
} as const;

interface Props {
  variant: ToastVariant;
  palette: ToastPalette;
  /** Action-specific icon override; falls back to the variant icon. */
  icon?: LucideIcon;
}

export function ToastIcon({ variant, palette, icon }: Props) {
  const Icon = icon ?? ICON_MAP[variant];
  // `naked` = no chip background, no border — the icon sits directly
  // on the toast card. Triggered by the brand-blue override which
  // sets iconContainerBg="transparent" so the white icon reads
  // straight on the blue gradient.
  const naked =
    palette.iconContainerBg === "transparent" && !palette.iconContainerBorder;

  if (naked) {
    return (
      <View style={styles.naked}>
        <Icon size={28} color={palette.iconColor} strokeWidth={2} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: palette.iconContainerBg,
          borderWidth: palette.iconContainerBorder ? 1 : 0,
          borderColor: palette.iconContainerBorder ?? "transparent",
        },
      ]}
    >
      <Icon size={20} color={palette.iconColor} strokeWidth={2} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  naked: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
