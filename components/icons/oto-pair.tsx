/**
 * OtoPairIcon
 *
 * App-wide brand mark, rendered from the frosted-glass logo PNG
 * (`assets/images/repairconnectglasslogo.png`). Replaces an earlier
 * inline SVG so we can ship the designer's final glass treatment
 * without re-tracing it.
 *
 * USED IN:
 *   - components/navigation/TabBarButton.tsx (Home tab icon)
 *   - components/home/ProfileInitialsButton.tsx (avatar slider panel)
 *   - app/(main-tabs)/settings/about.tsx (About header)
 *   - app/(main-tabs)/home/index.tsx (header brand mark)
 */

import React from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";

const OTO_PAIR_LOGO = require("@/assets/images/otopair-ai-logo.png");

export interface OtoPairIconProps {
  /** Square render size in pt. Default keeps parity with the old SVG. */
  size?: number;
  /** Extra style overrides (margins, opacity, etc.). */
  style?: StyleProp<ImageStyle>;
}

export function OtoPairIcon({ size = 120, style }: OtoPairIconProps) {
  return (
    <Image
      source={OTO_PAIR_LOGO}
      style={[{ width: size, height: size }, style]}
      resizeMode="contain"
      accessibilityLabel="OtoPair"
    />
  );
}

export default OtoPairIcon;
