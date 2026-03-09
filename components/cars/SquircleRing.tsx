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
const RX = 28;
const STROKE_WIDTH = 3;
const DEFAULT_SIZE = 130;

function computePerimeter(size: number) {
  const rectSize = size - INSET * 2;
  const straight = rectSize - 2 * RX;
  return 4 * straight + 2 * Math.PI * RX;
}

interface SquircleRingProps {
  size?: number;
  progress: number;
  isDone: boolean;
}

export default function SquircleRing({ size = DEFAULT_SIZE, progress, isDone }: SquircleRingProps) {
  const rectSize = size - INSET * 2;
  const perimeter = useMemo(() => computePerimeter(size), [size]);
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
        { width: size, height: size },
        glowStyle,
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Rect
          x={INSET}
          y={INSET}
          width={rectSize}
          height={rectSize}
          rx={RX}
          fill="none"
          stroke="rgba(82,153,254,0.1)"
          strokeWidth={STROKE_WIDTH}
        />
        <AnimatedRect
          x={INSET}
          y={INSET}
          width={rectSize}
          height={rectSize}
          rx={RX}
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
