import React from "react";
import { View } from "react-native";
import Svg, {
  Defs,
  LinearGradient,
  Stop,
  Circle,
  Path,
} from "react-native-svg";
import { BrandColors } from "@/constants/theme";

export function GradientPlusCircle({
  size = 34,
  strokeWidth = 3,
}: {
  size?: number;
  strokeWidth?: number;
}) {
  const r = (size - strokeWidth) / 2;
  const c = size / 2;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <LinearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset={0} stopColor="#4a19bcff" />
          <Stop offset={0.40} stopColor="#423561ff" />
          <Stop offset={0.75} stopColor="#787ea7ff" />
        </LinearGradient>
      </Defs>

      {/* Gradient ring */}
      <Circle
        cx={c}
        cy={c}
        r={r}
        stroke="url(#ringGrad)"
        strokeWidth={strokeWidth}
        fill="none"
        transform={`rotate(${-50} ${c} ${c})`}
        strokeLinecap="round"
        strokeDasharray={`${2 * Math.PI * r * 0.95} ${2 * Math.PI * r}`}
      />

      {/* Plus (solid gray) */}
      <Path
        d={`
          M ${c} ${c - 6}
          V ${c + 6}
          M ${c - 6} ${c}
          H ${c + 6}
        `}
        stroke="#6B7280"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}
