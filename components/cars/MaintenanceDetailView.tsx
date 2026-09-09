import React, { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  Easing as REasing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Text } from '@/components/shared-ui';
import { OilIcon, BrakesIcon, TireIcon, BatteryIcon, WarningIcon } from '@/components/cars/ServiceIcons';
import { MaintenanceSignalPills } from '@/components/cars/MaintenanceSignalPills';
import type { MaintenanceItem } from '@/components/cars/MaintenanceTracker';
import { explainMaintenanceItem } from '@/utils/maintenanceExplanation';
import { scale, verticalScale, moderateScale } from '@/utils/responsive';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ============================================================================
// TYPES
// ============================================================================

interface MaintenanceDetailViewProps {
  item: MaintenanceItem;
  visible: boolean;
  currentHealthScore: number;
  projectedHealthScore: number;
  /** Vehicle model (e.g. "Mustang") used in plain-English copy. Falls
   *  back to "Your car" when absent. */
  vehicleLabel?: string;
  onClose: () => void;
  onBookService: () => void;
  /** When true, the vehicle is still enriching — the Book Service CTA is
   *  disabled until parts data exists. */
  bookingDisabled?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const BLUE_GRADIENT: readonly [string, string, ...string[]] = [
  '#1A3A5C', '#204B78', '#2E6AAE', '#5299FE', '#6DACFE',
  '#8ABFFE', '#A6D0FE', '#C2E0FE', '#D9ECFE', '#E8F3FE',
  '#F2F8FF', '#F9FCFF', '#FFFFFF',
];

const GRADIENT_LOCATIONS: readonly [number, number, ...number[]] = [
  0, 0.12, 0.24, 0.36, 0.46, 0.55, 0.63, 0.71, 0.78, 0.84, 0.90, 0.95, 1,
];

const STATUS_CONFIG = {
  overdue: {
    color: '#5299FE',
    softColor: '#8ABFFE',
    pillColor: '#C0392B',
    ringColor: '#C0392B',
    label: 'OVERDUE',
    headerGradient: BLUE_GRADIENT,
    buttonGradient: ['#6DACFE', '#5299FE', '#3A7FE0'] as [string, string, string],
  },
  due_soon: {
    color: '#5299FE',
    softColor: '#8ABFFE',
    pillColor: '#F5C623',
    ringColor: '#F5C623',
    label: 'NEEDS ATTENTION',
    headerGradient: BLUE_GRADIENT,
    buttonGradient: ['#6DACFE', '#5299FE', '#3A7FE0'] as [string, string, string],
  },
  needs_attention: {
    color: '#5299FE',
    softColor: '#8ABFFE',
    pillColor: '#F5C623',
    ringColor: '#F5C623',
    label: 'NEEDS ATTENTION',
    headerGradient: BLUE_GRADIENT,
    buttonGradient: ['#6DACFE', '#5299FE', '#3A7FE0'] as [string, string, string],
  },
};


const RING_SIZE = scale(105);
const RING_STROKE = scale(7);
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const RING_CENTER = RING_SIZE / 2;

const BEZIER = REasing.bezier(0.16, 1, 0.3, 1);

// ============================================================================
// HELPERS
// ============================================================================

function getServiceIcon(itemId: string, size: number, color: string) {
  const type = itemId.replace(/^(unknown-|user-)/, '');
  switch (type) {
    case 'oil': return <OilIcon size={size} color={color} />;
    case 'brakes': return <BrakesIcon size={size} color={color} />;
    case 'tires': return <TireIcon size={size} color={color} />;
    case 'battery': return <BatteryIcon size={size} color={color} />;
    default: return <WarningIcon size={size} color={color} />;
  }
}

// ============================================================================
// HEALTH RING
// ============================================================================

function HealthRing({
  score,
  strokeColor,
  label,
  sublabel,
}: {
  score: number;
  strokeColor: string;
  label: string;
  sublabel: string;
}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    setProgress(0);
    const duration = 1400;
    const steps = 60;
    const stepDuration = duration / steps;
    let step = 0;
    const interval = setInterval(() => {
      step++;
      const t = step / steps;
      const ease = 1 - Math.pow(1 - t, 3);
      setProgress(ease * score);
      if (step >= steps) clearInterval(interval);
    }, stepDuration);
    return () => clearInterval(interval);
  }, [score]);

  const dashOffset = RING_CIRCUMFERENCE * (1 - progress / 100);

  return (
    <View style={ringStyles.wrapper}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          stroke="rgba(0,0,0,0.05)"
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_CENTER}
          cy={RING_CENTER}
          r={RING_RADIUS}
          stroke={strokeColor}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${RING_CENTER}, ${RING_CENTER}`}
        />
      </Svg>
      <View style={ringStyles.centerWrap}>
        <Text weight="extraBold" style={ringStyles.scoreNum}>
          {Math.round(progress)}
        </Text>
      </View>
      <Text weight="bold" style={ringStyles.label}>{label}</Text>
      <Text weight="medium" style={ringStyles.sublabel}>{sublabel}</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  wrapper: { alignItems: 'center' },
  centerWrap: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreNum: { fontSize: moderateScale(30), color: '#16293B', lineHeight: moderateScale(34) },
  label: { fontSize: moderateScale(12), color: '#16293B', marginTop: scale(10) },
  sublabel: { fontSize: moderateScale(10), color: '#B0BEC5', marginTop: 1 },
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MaintenanceDetailView({
  item,
  visible,
  currentHealthScore,
  projectedHealthScore,
  vehicleLabel,
  onClose,
  onBookService,
  bookingDisabled = false,
}: MaintenanceDetailViewProps) {
  const [showModal, setShowModal] = useState(false);
  const isAnimatingOut = useRef(false);

  const config = STATUS_CONFIG[item.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.due_soon;
  const delta = projectedHealthScore - currentHealthScore;
  const explanation = explainMaintenanceItem(item, vehicleLabel);

  // Shared animation values
  const overlayOpacity = useSharedValue(0);
  const contentTranslateY = useSharedValue(30);
  const badgeScale = useSharedValue(0);
  const ringsOpacity = useSharedValue(0);
  const ringsTranslateY = useSharedValue(24);
  const deltaScale = useSharedValue(0.8);
  const deltaOpacity = useSharedValue(0);
  const descOpacity = useSharedValue(0);
  const descTranslateY = useSharedValue(14);
  const signalsOpacity = useSharedValue(0);
  const signalsTranslateY = useSharedValue(14);
  const btnOpacity = useSharedValue(0);
  const btnTranslateY = useSharedValue(14);
  const btnPressScale = useSharedValue(1);

  const resetAnimations = () => {
    overlayOpacity.value = 0;
    contentTranslateY.value = 30;
    badgeScale.value = 0;
    ringsOpacity.value = 0;
    ringsTranslateY.value = 24;
    deltaScale.value = 0.8;
    deltaOpacity.value = 0;
    descOpacity.value = 0;
    descTranslateY.value = 14;
    signalsOpacity.value = 0;
    signalsTranslateY.value = 14;
    btnOpacity.value = 0;
    btnTranslateY.value = 14;
  };

  const runEntryAnimations = () => {
    overlayOpacity.value = withTiming(1, { duration: 300 });
    contentTranslateY.value = withTiming(0, { duration: 500, easing: BEZIER });
    badgeScale.value = withDelay(150, withSpring(1, { damping: 20, stiffness: 200 }));
    ringsOpacity.value = withDelay(250, withTiming(1, { duration: 700, easing: BEZIER }));
    ringsTranslateY.value = withDelay(250, withTiming(0, { duration: 700, easing: BEZIER }));
    deltaOpacity.value = withDelay(400, withTiming(1, { duration: 600, easing: BEZIER }));
    deltaScale.value = withDelay(400, withTiming(1, { duration: 600, easing: BEZIER }));
    // Signals appear just before the description so the pills anchor
    // the mileage numbers the prose is about to cite.
    signalsOpacity.value = withDelay(400, withTiming(1, { duration: 600, easing: BEZIER }));
    signalsTranslateY.value = withDelay(400, withTiming(0, { duration: 600, easing: BEZIER }));
    descOpacity.value = withDelay(500, withTiming(1, { duration: 600, easing: BEZIER }));
    descTranslateY.value = withDelay(500, withTiming(0, { duration: 600, easing: BEZIER }));
    btnOpacity.value = withDelay(600, withTiming(1, { duration: 600, easing: BEZIER }));
    btnTranslateY.value = withDelay(600, withTiming(0, { duration: 600, easing: BEZIER }));
  };

  useEffect(() => {
    if (visible) {
      isAnimatingOut.current = false;
      resetAnimations();
      setShowModal(true);
      requestAnimationFrame(() => runEntryAnimations());
    } else if (showModal && !isAnimatingOut.current) {
      animateOut();
    }
  }, [visible]);

  const animateOut = () => {
    if (isAnimatingOut.current) return;
    isAnimatingOut.current = true;
    overlayOpacity.value = withTiming(0, { duration: 200 });
    contentTranslateY.value = withTiming(30, { duration: 250 }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  };

  const finishClose = () => {
    setShowModal(false);
    isAnimatingOut.current = false;
    onClose();
  };

  const handleClose = () => {
    animateOut();
  };

  // Animated styles
  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const contentSlideStyle = useAnimatedStyle(() => ({
    flex: 1,
    transform: [{ translateY: contentTranslateY.value }],
    opacity: overlayOpacity.value,
  }));
  const badgeAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: badgeScale.value }],
  }));
  const ringsAnimStyle = useAnimatedStyle(() => ({
    opacity: ringsOpacity.value,
    transform: [{ translateY: ringsTranslateY.value }],
  }));
  const deltaAnimStyle = useAnimatedStyle(() => ({
    opacity: deltaOpacity.value,
    transform: [{ scale: deltaScale.value }],
  }));
  const descAnimStyle = useAnimatedStyle(() => ({
    opacity: descOpacity.value,
    transform: [{ translateY: descTranslateY.value }],
  }));
  const signalsAnimStyle = useAnimatedStyle(() => ({
    opacity: signalsOpacity.value,
    transform: [{ translateY: signalsTranslateY.value }],
  }));
  const btnAnimStyle = useAnimatedStyle(() => ({
    opacity: btnOpacity.value,
    transform: [{ translateY: btnTranslateY.value }, { scale: btnPressScale.value }],
  }));

  if (!showModal) return null;

  return (
    <Modal
      visible={showModal}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
        <View style={[StyleSheet.absoluteFill, { backgroundColor: '#FFFFFF' }]}>
          {/* Gradient Header — sits on top of white background, bleeds seamlessly */}
          <LinearGradient
            colors={config.headerGradient}
            locations={GRADIENT_LOCATIONS}
            style={styles.headerGradient}
          >
          </LinearGradient>
        </View>

        {/* Scrollable content overlay */}
        <Animated.View style={contentSlideStyle}>
          {/* Close button — above scroll content */}
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={styles.closeBtnWrap}
          >
            <View style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </View>
          </Pressable>

          <ScrollView
            style={StyleSheet.absoluteFill}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            bounces={false}
          >
            {/* Header text content */}
            <View style={styles.headerContent}>
              <Text weight="semiBold" style={styles.eyebrow}>SERVICE DETAIL</Text>
              <Text weight="extraBold" style={styles.title}>
                {item.serviceName}
              </Text>
              <View style={[styles.statusPill, { backgroundColor: config.pillColor }]}>
                <Text weight="bold" style={styles.statusPillText}>{config.label}</Text>
              </View>
            </View>

            {/* Floating badge */}
            <View style={styles.badgeOuter}>
              <Animated.View style={[styles.badgeContainer, badgeAnimStyle]}>
                {/* Glossy glass border ring */}
                <LinearGradient
                  colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.3)']}
                  locations={[0, 0.5, 1]}
                  style={styles.badgeGlassRing}
                />
                <View style={styles.badgeRing}>
                  <LinearGradient
                    colors={[config.color, config.softColor]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.badgeInner}
                  >
                    {getServiceIcon(item.id, 28, '#FFFFFF')}
                  </LinearGradient>
                </View>
              </Animated.View>
            </View>

            {/* White content */}
            <View style={styles.contentArea}>
              {/* Dual health rings */}
              <Animated.View style={[styles.ringsRow, ringsAnimStyle]}>
                <HealthRing
                  score={currentHealthScore}
                  strokeColor={config.ringColor}
                  label="Current"
                  sublabel="Health score"
                />
                {/* Arrow between rings */}
                <View style={styles.arrowWrap}>
                  <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M5 12h14M13 6l6 6-6 6"
                      stroke="#D0D8E0"
                      strokeWidth={1.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                </View>
                <HealthRing
                  score={projectedHealthScore}
                  strokeColor="#34C759"
                  label="Projected"
                  sublabel="After service"
                />
              </Animated.View>

              {/* Delta badge */}
              {delta > 0 && (
                <Animated.View style={[styles.deltaBadge, deltaAnimStyle]}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M12 19V5M5 12l7-7 7 7"
                      stroke="#34C759"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </Svg>
                  <Text weight="bold" style={styles.deltaText}>+{delta} points</Text>
                </Animated.View>
              )}

              {/* Divider */}
              <View style={styles.divider} />

              {/* Signal pills sit above the prose so the mileage
                  numbers anchor the explanation. Meta line ("Last
                  serviced…") intentionally dropped per PM — the
                  urgency badge at the top already conveys the tier. */}
              {item.signals && (item.signals.time || item.signals.mileage || item.signals.interval) ? (
                <Animated.View style={[styles.signalsWrap, signalsAnimStyle]}>
                  <MaintenanceSignalPills
                    signals={item.signals}
                    triggeredBy={item.triggeredBy}
                  />
                </Animated.View>
              ) : null}

              {/* Description — plain-English fact + consequence
                  from utils/maintenanceExplanation.ts. */}
              <Animated.View style={descAnimStyle}>
                <Text style={styles.description}>
                  {explanation.fact}
                </Text>
                <Text style={[styles.description, styles.descriptionConsequence]}>
                  {explanation.consequence}
                </Text>
              </Animated.View>

            </View>
          </ScrollView>

          {/* Book Service button — fixed at bottom. Disabled while the vehicle
              is still enriching (no parts data yet to book against). */}
          <Animated.View style={[styles.bookBtnFixed, btnAnimStyle]}>
            <Pressable
              onPressIn={() => { if (!bookingDisabled) btnPressScale.value = withSpring(0.97, { damping: 20, stiffness: 300 }); }}
              onPressOut={() => { if (!bookingDisabled) btnPressScale.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
              onPress={onBookService}
              disabled={bookingDisabled}
            >
              <View style={[styles.bookBtnShadow, !bookingDisabled && { shadowColor: config.color }]}>
                <LinearGradient
                  colors={bookingDisabled ? ['#E4E9EA', '#E4E9EA'] : config.buttonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.bookBtnInner}
                >
                  <Text weight="bold" style={[styles.bookBtnText, bookingDisabled && { color: '#9CA3AF' }]}>
                    {bookingDisabled ? 'Setting up your car…' : 'Book Service Now'}
                  </Text>
                </LinearGradient>
              </View>
            </Pressable>
          </Animated.View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const HEADER_HEIGHT = SCREEN_HEIGHT * 0.42;

const styles = StyleSheet.create({
  headerGradient: {
    height: HEADER_HEIGHT,
    paddingTop: verticalScale(56),
    paddingHorizontal: scale(24),
    paddingBottom: verticalScale(72),
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Close button
  closeBtnWrap: {
    position: 'absolute',
    top: verticalScale(52),
    right: scale(20),
    zIndex: 10,
  },
  closeBtn: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: moderateScale(16),
    color: 'rgba(255,255,255,0.85)',
  },

  // Header content
  headerContent: {
    paddingTop: verticalScale(64),
    paddingBottom: verticalScale(48),
    paddingHorizontal: scale(24),
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontSize: moderateScale(12),
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 0.12 * 12,
    marginBottom: scale(14),
  },
  title: {
    fontSize: moderateScale(32),
    color: '#FFFFFF',
    letterSpacing: -0.5,
    textAlign: 'center',
    lineHeight: moderateScale(32) * 1.3,
    paddingVertical: 4,
  },
  statusPill: {
    paddingVertical: 5,
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(20),
    borderWidth: 0,
    marginTop: scale(16),
  },
  statusPillText: {
    fontSize: moderateScale(11),
    color: '#FFFFFF',
    letterSpacing: 0.04 * 11,
    textTransform: 'uppercase',
  },

  // Floating badge
  badgeOuter: {
    alignItems: 'center',
    marginTop: scale(-36),
    zIndex: 5,
  },
  badgeContainer: {
    width: scale(72),
    height: scale(72),
    borderRadius: scale(36),
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  badgeGlassRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: scale(36),
  },
  badgeRing: {
    width: scale(54),
    height: scale(54),
    borderRadius: scale(27),
    overflow: 'hidden',
  },
  badgeInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Content area
  contentArea: {
    paddingTop: scale(18),
    paddingHorizontal: scale(28),
    paddingBottom: scale(28),
    alignItems: 'center',
  },

  // Dual rings
  ringsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    gap: scale(28),
  },
  arrowWrap: {
    marginTop: (RING_SIZE / 2) + 30,
  },

  // Delta badge
  deltaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingVertical: scale(6),
    paddingHorizontal: scale(14),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(52,199,89,0.08)',
    marginTop: scale(16),
    marginBottom: scale(20),
  },
  deltaText: {
    fontSize: moderateScale(15),
    color: '#34C759',
  },

  // Divider
  divider: {
    width: scale(36),
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginTop: scale(4),
    marginBottom: scale(12),
  },

  // Description
  description: {
    fontSize: moderateScale(15),
    color: '#6B8599',
    lineHeight: moderateScale(15) * 1.6,
    textAlign: 'center',
    maxWidth: scale(300),
    alignSelf: 'center',
  },
  descriptionConsequence: {
    marginTop: scale(8),
    color: '#8AA0B0',
  },

  // Signals (sit above the description prose)
  signalsWrap: {
    alignItems: 'center',
    marginBottom: scale(16),
  },

  // Book button
  bookBtnFixed: {
    position: 'absolute',
    bottom: verticalScale(40),
    left: scale(28),
    right: scale(28),
    zIndex: 10,
  },
  bookBtnShadow: {
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 28,
    elevation: 8,
  },
  bookBtnInner: {
    paddingVertical: scale(17),
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: moderateScale(16),
  },
  bookBtnText: {
    fontSize: moderateScale(17),
    color: '#FFFFFF',
    letterSpacing: -0.01 * 17,
  },
});
