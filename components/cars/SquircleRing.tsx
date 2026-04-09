import React, { useEffect, useMemo } from "react";
import { StyleSheet } from "react-native";
import Svg, { Rect } from "react-native-svg";
import Animated, {
  useSharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  withTiming,
  Easing,
} from "react-native-reanimated";

const AnimatedRect = Animated.createAnimatedComponent(Rect);

const INSET = 2;
const STROKE_WIDTH = 3;
const DEFAULT_SIZE = 130;
const DEFAULT_RX = 28;

function computePerimeter(w: number, h: number, rx: number) {
  const innerW = w - INSET * 2;
  const innerH = h - INSET * 2;
  const r = Math.min(rx, innerW / 2, innerH / 2);
  return 2 * (innerW - 2 * r) + 2 * (innerH - 2 * r) + 2 * Math.PI * r;
}

interface SquircleRingProps {
  width?: number;
  height?: number;
  size?: number;
  rx?: number;
  progress: number;
  isDone: boolean;
}

export default function SquircleRing({
  width,
  height,
  size = DEFAULT_SIZE,
  rx = DEFAULT_RX,
  progress,
  isDone,
}: SquircleRingProps) {
  const w = width ?? size;
  const h = height ?? size;
  const rectW = w - INSET * 2;
  const rectH = h - INSET * 2;
  const perimeter = useMemo(() => computePerimeter(w, h, rx), [w, h, rx]);
  const animatedProgress = useSharedValue(progress);
  const glowAnim = useSharedValue(isDone ? 1 : 0);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, {
      duration: 600,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
    });
  }, [progress]);

  useEffect(() => {
    glowAnim.value = withTiming(isDone ? 1 : 0, { duration: 200 });
  }, [isDone]);

  const progressProps = useAnimatedProps(() => {
    const p = animatedProgress.value;
    return {
      strokeDasharray: [perimeter * p, perimeter * (1 - p)] as [number, number],
      strokeDashoffset: perimeter * 0.25,
    };
  });

  const glowStyle = useAnimatedStyle(() => ({
    shadowColor: "#5299FE",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: glowAnim.value * 0.35,
    shadowRadius: glowAnim.value * 12,
  }));

  return (
    <Animated.View
      style={[
        styles.wrapper,
        { width: w, height: h },
        glowStyle,
      ]}
    >
      <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <Rect
          x={INSET}
          y={INSET}
          width={rectW}
          height={rectH}
          rx={rx}
          fill="none"
          stroke="rgba(82,153,254,0.1)"
          strokeWidth={STROKE_WIDTH}
        />
        <AnimatedRect
          x={INSET}
          y={INSET}
          width={rectW}
          height={rectH}
          rx={rx}
          fill="none"
          stroke="#5299FE"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          animatedProps={progressProps}
        />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
  },
});
