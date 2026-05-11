/**
 * CarCarousel
 *
 * PURPOSE: Displays a 3D circular carousel of vehicle cards that rotate like
 *          a spinning platform. Drag to rotate or tap thumbnails to select.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (My Cars screen)
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Image,
  ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Calendar, Check, ChevronLeft, ChevronRight, Info, Plus, X, XCircle } from 'lucide-react-native';
import Svg, { Circle, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { Easing } from 'react-native';
import ReAnimated, {
  Extrapolate,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  runOnJS,
  SharedValue,
  Easing as REasing,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { BrandColors, Colors, Spacing } from '@/constants/theme';
import { router } from 'expo-router';

// 5. Responsive utilities
import { scale, verticalScale, moderateScale, isTablet } from '@/utils/responsive';

// 6. Native iOS 26 liquid glass (optional)
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require('@callstack/liquid-glass');
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch {
  // Not available — fall back to plain style
}

// ============================================================================
// TYPES
// ============================================================================

export interface Vehicle {
  id: string;
  year: number;
  make: string;
  model: string;
  vin?: string;
  mileage: number;
  nextServiceDate?: string;
  isDefault: boolean;
  imageSource?: ImageSourcePropType;
  logoSource?: ImageSourcePropType;
  condition?: number;
  nextUnlock?: string;
  gradientColors?: string[];
  connectionStatus?: string; // "unconnected" | "connected" | "error"
  /** Body style from `vehicles.metadata.body_style` — drives the
   *  per-car ground-line tire offset (trucks/SUVs sit higher in the
   *  frame than sedans/coupes). */
  bodyStyle?: string;
}

interface CarCarouselProps {
  vehicles: Vehicle[];
  onEditMileage?: (vehicleId: string) => void;
  onToggleDefault?: (vehicleId: string, isDefault: boolean) => void;
  onActiveIndexChange?: (index: number) => void;
  isFocused?: boolean;
  /** Real maintenance items for computing health score */
  maintenanceItems?: import("@/components/cars/MaintenanceTracker").MaintenanceItem[];
  /** Current odometer reading in miles */
  currentMileage?: number | null;
  /** Whether to show the health ring (hidden until onboarding is complete for non-connected vehicles) */
  showHealthRing?: boolean;
  /** Pre-computed unified health score (0–100) from utils/healthScore.ts */
  healthScore?: number;
  /** True when showing the pipeline estimate (pre-onboarding done, CarInfoStepper not done) */
  isEstimatedScore?: boolean;
  /** Called when the user taps to resume the Quick Read from the estimated modal */
  onResumeCheckin?: () => void;
  /** Parent has determined the active vehicle's gradient top is dark
   *  enough that the hero text must flip to light to stay readable. */
  isDarkBg?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAR_CARD_WIDTH = Math.min(scale(320), 420);
const CAR_CARD_HEIGHT = scale(240);
const RADIUS = SCREEN_WIDTH * 0.5;

// Fallback image used only when no dynamic imageSource is available
const FALLBACK_VEHICLE_IMAGE = require('@/assets/images/lexus.png');

// ============================================================================
// RING CONFIGURATION & TYPES
// ============================================================================

interface RingConfig {
  percentage: number;
  strokeWidth: number;
  radius: number;
  gradientId: string;
  colors: string[];
  trackOpacity: number;
  maxPercentage: number;
  showGlow: boolean;
  name: string;
  description: string;
}

// Service items that need attention
interface ServiceItem {
  name: string;
  dueInfo: string;
  status: 'overdue' | 'due_soon';
  scoreImpact: number; // Points gained if completed
  actionDescription: string; // Why this affects the score
}

// Metric configuration for breakdown rows
interface MetricConfig {
  name: string;
  subtitle: string;
  color: string;
  percentage: number; // Used for progress bar and overall calculation
  displayValue: string; // What to show instead of percentage (e.g., "5/10" or "45,000 mi")
  scoreImpact: number; // How much this metric is affecting overall score
}

// ============================================================================
// VEHICLE HEALTH MODAL COMPONENT
// ============================================================================

interface VehicleHealthModalProps {
  visible: boolean;
  onClose: () => void;
  vehicleName: string;
  healthPercentage: number;
  maintenancePercentage: number;
  servicePercentage: number;
  maintenanceItems?: import("@/components/cars/MaintenanceTracker").MaintenanceItem[];
  currentMileage?: number;
  isEstimated?: boolean;
  onResumeCheckin?: () => void;
}

const VehicleHealthModal = ({
  visible,
  onClose,
  vehicleName,
  healthPercentage,
  maintenancePercentage,
  servicePercentage,
  maintenanceItems: realItems,
  currentMileage: realMileage,
  isEstimated,
  onResumeCheckin,
}: VehicleHealthModalProps) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const ringScaleAnim = useRef(new Animated.Value(1)).current;
  const ringGlowAnim = useRef(new Animated.Value(0)).current;
  const ringPulseAnim = useRef(new Animated.Value(1)).current;
  
  // Animated ring values for staggered animation
  const [animatedHealth, setAnimatedHealth] = useState(0);
  const [animatedMaintenance, setAnimatedMaintenance] = useState(0);
  const [animatedService, setAnimatedService] = useState(0);
  
  // Progress bar animations
  const [progressHealth, setProgressHealth] = useState(0);
  const [progressMaintenance, setProgressMaintenance] = useState(0);
  const [progressService, setProgressService] = useState(0);

  // Info modal state
  const [showInfoModal, setShowInfoModal] = useState(false);

  // Selected services state
  const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set());

  // Toggle service selection
  const toggleServiceSelection = (index: number) => {
    setSelectedServices(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Calculate overall score (average of all three)
  const overallScore = Math.round((healthPercentage + maintenancePercentage + servicePercentage) / 3);

  // Build service items from real maintenance data
  const serviceItems: ServiceItem[] = useMemo(() => {
    if (!realItems) return [];
    const items: ServiceItem[] = [];
    for (const item of realItems) {
      if (item.status === "overdue" || item.status === "due_soon" || item.status === "needs_attention") {
        const statusLabel = item.status === "overdue" ? "Overdue" : item.status === "due_soon" ? "Due soon" : "Needs attention";
        const impact = item.status === "overdue" ? 5 : 3;
        items.push({
          name: item.serviceName,
          dueInfo: item.description || statusLabel,
          status: item.status === "needs_attention" ? "due_soon" : item.status,
          scoreImpact: impact,
          actionDescription: `+${impact}% to Overall Condition`,
        });
      }
    }
    return items;
  }, [realItems]);

  // Use the unified health score passed from parent
  const calculatedCondition = healthPercentage;

  // Sub-scores for display breakdown
  const knownItems = (realItems ?? []).filter((i) => i.status !== "unknown");
  const onTimeItems = knownItems.filter((i) => i.status === "on_time");
  const maintenanceCompleted = onTimeItems.length;
  const maintenanceTotal = Math.max(knownItems.length, 1);
  const maintenanceScore = maintenancePercentage;

  const vehicleMileage = realMileage ?? 0;
  const usageScore = servicePercentage;

  // Format mileage for display
  const formatMileage = (miles: number) => {
    if (miles >= 1000) {
      return `${(miles / 1000).toFixed(0)}k mi`;
    }
    return `${miles} mi`;
  };

  // Metric configurations with clear names and explanations
  const metrics: MetricConfig[] = [
    {
      name: 'Overall Vehicle Condition',
      subtitle: 'Based on your maintenance and Usage',
      color: '#30D158',
      percentage: calculatedCondition,
      displayValue: `${calculatedCondition}%`,
      scoreImpact: 0, // No separate impact since it's derived from the below
    },
    {
      name: 'Maintenance',
      subtitle: 'More services completed = higher score',
      color: maintenanceScore >= 75 ? '#30D158' : maintenanceScore >= 60 ? '#FFEA00' : '#FF3B5C',
      percentage: maintenanceScore,
      displayValue: `${maintenanceCompleted}/${maintenanceTotal}`,
      // Weighted impact: (75 - score) × 0.7 weight
      scoreImpact: maintenanceScore >= 75 ? 0 : -Math.round((75 - maintenanceScore) * 0.7),
    },
    {
      name: 'Usage & Wear',
      subtitle: 'Lower mileage = higher score',
      color: usageScore >= 75 ? '#30D158' : usageScore >= 60 ? '#FFEA00' : '#FF3B5C',
      percentage: usageScore,
      displayValue: formatMileage(vehicleMileage),
      // Weighted impact: (75 - score) × 0.3 weight
      scoreImpact: usageScore >= 75 ? 0 : -Math.round((75 - usageScore) * 0.3),
    },
  ];

  const needsAttention = serviceItems.length > 0;

  useEffect(() => {
    if (visible) {
      // Reset slide position before animating
      slideAnim.setValue(SCREEN_HEIGHT);
      fadeAnim.setValue(0);
      
      // Reset animations
      setAnimatedHealth(0);
      setAnimatedMaintenance(0);
      setAnimatedService(0);
      setProgressHealth(0);
      setProgressMaintenance(0);
      setProgressService(0);
      ringScaleAnim.setValue(1);
      ringGlowAnim.setValue(0);
      ringPulseAnim.setValue(1);

      // Open modal + glow + pulse all at once
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 25,
          stiffness: 120,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(ringGlowAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]).start();

      Animated.loop(
        Animated.sequence([
          Animated.timing(ringPulseAnim, { toValue: 1.08, duration: 1500, useNativeDriver: true }),
          Animated.timing(ringPulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
        ]),
      ).start();

      // Staggered ring animations
      const animateRing = (
        setter: (val: number) => void,
        target: number,
        delay: number
      ) => {
        setTimeout(() => {
          const duration = 1000;
          const steps = 60;
          const stepDuration = duration / steps;
          let currentStep = 0;

          const interval = setInterval(() => {
            currentStep++;
            const progress = 1 - Math.pow(1 - currentStep / steps, 3);
            setter(progress * target);
            if (currentStep >= steps) clearInterval(interval);
          }, stepDuration);
        }, delay);
      };

      animateRing(setAnimatedService, calculatedCondition, 0);
      animateRing(setProgressService, calculatedCondition, 0);
      animateRing(setAnimatedHealth, maintenanceScore, 200);
      animateRing(setProgressHealth, maintenanceScore, 200);
      animateRing(setAnimatedMaintenance, usageScore, 400);
      animateRing(setProgressMaintenance, usageScore, 400);
    } else {
      // Close modal animation
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: SCREEN_HEIGHT,
          damping: 20,
          stiffness: 300,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, calculatedCondition, maintenanceScore, usageScore]);

  // Single large ring configuration
  const modalRingSize = scale(180);
  const ringStrokeWidth = scale(12);
  const ringRadius = (modalRingSize / 2) - (ringStrokeWidth / 2) - scale(8);
  const circumference = 2 * Math.PI * ringRadius;
  const center = modalRingSize / 2;
  
  // Use calculated condition as the overall health score (animated value)
  const overallPercentage = animatedService;
  const strokeDashoffset = circumference * (1 - overallPercentage / 100);
  
  // Determine ring color based on calculated condition
  const getRingColor = () => {
    if (calculatedCondition >= 75) return '#30D158'; // Green
    if (calculatedCondition >= 60) return '#FFEA00'; // Yellow
    return '#FF3B5C'; // Red
  };
  
  const ringColor = getRingColor();

  const renderRings = () => (
    <View style={modalStyles.ringsContainer}>
      <Animated.View style={[modalStyles.ringGlow, {
        backgroundColor: ringColor,
        opacity: Animated.multiply(ringGlowAnim, new Animated.Value(0.12)),
        transform: [{ scale: ringPulseAnim }],
      }]} />
      <Animated.View style={[modalStyles.ringGlowInner, {
        backgroundColor: ringColor,
        opacity: Animated.multiply(ringGlowAnim, new Animated.Value(0.06)),
        transform: [{ scale: ringPulseAnim }],
      }]} />
      <Animated.View style={{ transform: [{ scale: ringScaleAnim }] }}>
        <Svg width={modalRingSize} height={modalRingSize}>
          <Defs>
            <SvgLinearGradient id="mainRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor={ringColor} />
              <Stop offset="50%" stopColor={ringColor} stopOpacity={0.9} />
              <Stop offset="100%" stopColor={ringColor} stopOpacity={0.8} />
            </SvgLinearGradient>
          </Defs>

          <Circle cx={center} cy={center} r={ringRadius} stroke={ringColor} strokeWidth={ringStrokeWidth} fill="none" opacity={0.15} />
          <Circle cx={center} cy={center} r={ringRadius} stroke="url(#mainRingGradient)" strokeWidth={ringStrokeWidth} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${center}, ${center}`} />
          <Circle cx={center} cy={center} r={ringRadius} stroke={ringColor} strokeWidth={ringStrokeWidth + 4} fill="none" strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" rotation={-90} origin={`${center}, ${center}`} opacity={0.2} />
        </Svg>
      </Animated.View>
      
      <View style={modalStyles.ringCenterContent}>
        <Text style={modalStyles.percentageText}>{Math.round(overallPercentage)}</Text>
        <Text style={modalStyles.ringSubLabel}>out of 100</Text>
      </View>
    </View>
  );

  const renderBreakdownRow = (
    color: string,
    name: string,
    subtitle: string,
    percentage: number,
    animatedPercentage: number,
    displayValue: string,
    scoreImpact: number
  ) => (
    <View style={modalStyles.breakdownRow}>
      <View style={modalStyles.breakdownLeft}>
        <View style={[modalStyles.colorDot, { backgroundColor: color }]} />
        <View style={modalStyles.breakdownTextContainer}>
          <View style={modalStyles.breakdownHeader}>
            <Text style={modalStyles.breakdownName}>{name}</Text>
            <Text style={modalStyles.breakdownPercentage}>{displayValue}</Text>
          </View>
          <Text style={modalStyles.breakdownSubtitle}>{subtitle}</Text>
          <View style={modalStyles.progressBarRow}>
            <View style={modalStyles.progressBarContainer}>
              <View 
                style={[
                  modalStyles.progressBar, 
                  { 
                    backgroundColor: color,
                    width: `${animatedPercentage}%`,
                  }
                ]} 
              />
            </View>
            {scoreImpact !== 0 && (
              <View style={[
                modalStyles.scoreImpactBadge,
                { backgroundColor: 'rgba(255, 59, 92, 0.15)' }
              ]}>
                <Text style={[
                  modalStyles.scoreImpactText,
                  { color: '#FF3B5C' }
                ]}>
                  {scoreImpact}%
                </Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      {/* Dark overlay - fades in */}
      <Animated.View style={[modalStyles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={modalStyles.overlayPressable} onPress={onClose} />
      </Animated.View>
        
      {/* Bottom sheet content - slides up */}
      <Animated.View style={[modalStyles.bottomSheet, { transform: [{ translateY: slideAnim }] }]}>
          {/* Drag handle */}
          <View style={modalStyles.dragHandleContainer}>
            <View style={modalStyles.dragHandle} />
          </View>

          {/* Header */}
          <View style={modalStyles.header}>
            <View style={modalStyles.headerTitleContainer}>
              <Text style={modalStyles.headerTitle}>Vehicle Health</Text>
              <Text style={modalStyles.headerSubtitle}>{vehicleName} • Premium Package</Text>
            </View>
            <Pressable style={modalStyles.closeButton} onPress={onClose}>
              <X size={scale(18)} color="#666" />
            </Pressable>
          </View>

          <View style={modalStyles.headerSeparator} />

          {isEstimated ? (
            /* ── Simplified estimated view ── */
            <View style={modalStyles.scrollContent}>
              {renderRings()}

              <Text style={modalStyles.estimatedLabel}>Estimated Score</Text>
              <Text style={modalStyles.estimatedSubtitle}>
                Based on your vehicle's age, mileage, and driving habits.
              </Text>

              <Pressable
                style={({ pressed }) => [modalStyles.resumeCheckinButton, pressed && { opacity: 0.85 }]}
                onPress={() => { onClose(); setTimeout(() => onResumeCheckin?.(), 350); }}
              >
                <Text style={modalStyles.resumeCheckinText}>
                  Get my complete score
                </Text>
              </Pressable>
            </View>
          ) : (
            /* ── Full breakdown view ── */
            <>
          <ScrollView 
            style={modalStyles.scrollView}
            contentContainerStyle={modalStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {renderRings()}

            <View style={modalStyles.breakdownSection}>
              <View style={modalStyles.sectionTitleRow}>
                <Text style={modalStyles.sectionTitle}>WHAT AFFECTS YOUR SCORE</Text>
                <Pressable 
                  onPress={() => setShowInfoModal(true)}
                  hitSlop={scale(10)}
                  style={modalStyles.infoButton}
                >
                  <Info size={scale(16)} color="#888" />
                </Pressable>
              </View>
              
              {renderBreakdownRow(
                metrics[0].color,
                metrics[0].name,
                metrics[0].subtitle,
                metrics[0].percentage,
                progressService,
                metrics[0].displayValue,
                metrics[0].scoreImpact
              )}
              {renderBreakdownRow(
                metrics[1].color,
                metrics[1].name,
                metrics[1].subtitle,
                metrics[1].percentage,
                progressHealth,
                metrics[1].displayValue,
                metrics[1].scoreImpact
              )}
              {renderBreakdownRow(
                metrics[2].color,
                metrics[2].name,
                metrics[2].subtitle,
                metrics[2].percentage,
                progressMaintenance,
                metrics[2].displayValue,
                metrics[2].scoreImpact
              )}
            </View>

            {needsAttention && (
              <View style={modalStyles.attentionCardOuter}>
                <BlurView intensity={20} tint="light" style={modalStyles.attentionBlur}>
                  <LinearGradient
                    colors={['rgba(82, 153, 254, 0.12)', 'rgba(82, 153, 254, 0.06)']}
                    style={StyleSheet.absoluteFill}
                  />
                  <LinearGradient
                    colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0)']}
                    locations={[0, 0.5]}
                    style={modalStyles.attentionGloss}
                  />
                </BlurView>
                <View style={modalStyles.attentionContent}>
                  <View style={modalStyles.attentionHeader}>
                    <Text style={[modalStyles.attentionTitle, { color: '#5299FE' }]}>How to Improve Your Score</Text>
                  </View>
                  
                  {serviceItems.map((item, index) => {
                    const isSelected = selectedServices.has(index);
                    return (
                      <Pressable 
                        key={index} 
                        style={[
                          modalStyles.serviceItem,
                          isSelected && modalStyles.serviceItemSelected
                        ]}
                        onPress={() => toggleServiceSelection(index)}
                      >
                        <View style={[
                          modalStyles.checkbox,
                          isSelected && modalStyles.checkboxSelected
                        ]}>
                          {isSelected && <Check size={scale(14)} color="#fff" strokeWidth={3} />}
                        </View>
                        
                        <View style={modalStyles.serviceItemLeft}>
                          <View style={modalStyles.serviceNameRow}>
                            <Text style={modalStyles.serviceName}>{item.name}</Text>
                            <View 
                              style={[
                                modalStyles.statusBadge,
                                item.status === 'overdue' ? modalStyles.overdueBadge : modalStyles.dueSoonBadge
                              ]}
                            >
                              <Text 
                                style={[
                                  modalStyles.statusText,
                                  item.status === 'overdue' ? modalStyles.overdueText : modalStyles.dueSoonText
                                ]}
                              >
                                {item.status === 'overdue' ? 'OVERDUE' : 'DUE SOON'}
                              </Text>
                            </View>
                          </View>
                          <Text style={modalStyles.serviceDue}>{item.dueInfo}</Text>
                          <Text style={modalStyles.actionDescription}>{item.actionDescription}</Text>
                        </View>
                        <View style={modalStyles.scoreImpactBadgeLarge}>
                          <Text style={modalStyles.scoreImpactTextLarge}>+{item.scoreImpact}%</Text>
                        </View>
                      </Pressable>
                    );
                  })}
                  
                  <View style={modalStyles.totalImprovementRow}>
                    <Text style={modalStyles.totalImprovementLabel}>Complete all to gain</Text>
                    <Text style={modalStyles.totalImprovementValue}>
                      +{serviceItems.reduce((sum, item) => sum + item.scoreImpact, 0)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={{ height: scale(20) }} />
          </ScrollView>
          
          <View style={modalStyles.scheduleButtonContainer}>
            <Pressable style={modalStyles.scheduleButton}>
              <BlurView intensity={80} tint="dark" style={modalStyles.scheduleButtonBlur}>
                <LinearGradient
                  colors={selectedServices.size > 0 
                    ? ['rgba(82, 153, 254, 0.95)', 'rgba(60, 120, 220, 0.98)']
                    : ['rgba(40, 40, 40, 0.9)', 'rgba(20, 20, 20, 0.95)']}
                  style={StyleSheet.absoluteFill}
                />
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.15)', 'rgba(255, 255, 255, 0)']}
                  locations={[0, 0.5]}
                  style={modalStyles.scheduleButtonGloss}
                />
              </BlurView>
              <View style={modalStyles.scheduleButtonContent}>
                <Text style={modalStyles.scheduleButtonText}>
                  {selectedServices.size === 0 
                    ? 'Schedule Service' 
                    : selectedServices.size === 1 
                      ? '1 service selected'
                      : `${selectedServices.size} services selected`}
                </Text>
                <Calendar size={scale(20)} color="#fff" />
              </View>
            </Pressable>
          </View>
            </>
          )}
        </Animated.View>

        {/* Info Modal - Explains the formula */}
        <Modal
          visible={showInfoModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowInfoModal(false)}
        >
          <Pressable 
            style={modalStyles.infoModalOverlay} 
            onPress={() => setShowInfoModal(false)}
          >
            <View style={modalStyles.infoModalContent}>
              <View style={modalStyles.infoModalHeader}>
                <Text style={modalStyles.infoModalTitle}>How We Calculate Your Score</Text>
                <Pressable onPress={() => setShowInfoModal(false)}>
                  <X size={scale(20)} color="#666" />
                </Pressable>
              </View>
              
              <View style={modalStyles.infoModalBody}>
                <Text style={modalStyles.infoFormulaTitle}>Formula:</Text>
                <View style={modalStyles.formulaBox}>
                  <Text style={modalStyles.formulaText}>
                    Overall = (Maintenance × 70%) + (Usage × 30%)
                  </Text>
                </View>
                
                <View style={modalStyles.infoSection}>
                  <Text style={modalStyles.infoLabel}>Maintenance (70% weight)</Text>
                  <Text style={modalStyles.infoDescription}>
                    Based on services completed out of total scheduled. Example: 7/10 = 70%
                  </Text>
                </View>
                
                <View style={modalStyles.infoSection}>
                  <Text style={modalStyles.infoLabel}>Usage & Wear (30% weight)</Text>
                  <Text style={modalStyles.infoDescription}>
                    Based on mileage:{'\n'}
                    • 0-30k mi = 100%{'\n'}
                    • 30k-60k mi = 90%{'\n'}
                    • 60k-100k mi = 75%{'\n'}
                    • 100k-150k mi = 55%{'\n'}
                    • 150k+ mi = 35%
                  </Text>
                </View>
                
                <View style={modalStyles.infoExample}>
                  <Text style={modalStyles.infoExampleTitle}>Example:</Text>
                  <Text style={modalStyles.infoExampleText}>
                    7/10 maintenance (70%) × 0.7 = 49%{'\n'}
                    45k miles (90%) × 0.3 = 27%{'\n'}
                    <Text style={{ fontFamily: 'Urbanist-Bold', color: '#30D158' }}>
                      Total: 76%
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          </Pressable>
        </Modal>
    </Modal>
  );
};

const modalStyles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlayPressable: {
    flex: 1,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopLeftRadius: moderateScale(24),
    borderTopRightRadius: moderateScale(24),
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: scale(12),
    paddingBottom: scale(8),
  },
  dragHandle: {
    width: scale(40),
    height: scale(4),
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 2,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  scrollContent: {
    paddingHorizontal: scale(24),
    paddingBottom: scale(20),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(24),
    paddingTop: scale(20),
    paddingBottom: scale(16),
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: moderateScale(20),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: scale(2),
  },
  closeButton: {
    position: 'absolute',
    right: scale(20),
    top: scale(20),
    width: scale(32),
    height: scale(32),
    borderRadius: moderateScale(16),
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: scale(24),
  },
  ringsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginVertical: scale(20),
    position: 'relative',
    width: Math.min(scale(200), 260),
    height: Math.min(scale(200), 260),
  },
  ringGlow: {
    position: 'absolute',
    width: Math.min(scale(220), 280),
    height: Math.min(scale(220), 280),
    borderRadius: Math.min(scale(220), 280) / 2,
  },
  ringGlowInner: {
    position: 'absolute',
    width: Math.min(scale(170), 220),
    height: Math.min(scale(170), 220),
    borderRadius: Math.min(scale(170), 220) / 2,
  },
  ringCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: moderateScale(42),
    fontFamily: 'Urbanist-Bold',
    color: '#1F2937',
    lineHeight: moderateScale(46),
  },
  ringSubLabel: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-SemiBold',
    color: '#9CA3AF',
    marginTop: scale(-2),
  },
  breakdownSection: {
    marginTop: scale(16),
  },
  sectionTitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-SemiBold',
    color: '#888',
    letterSpacing: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(16),
  },
  infoButton: {
    padding: scale(4),
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  colorDot: {
    width: scale(12),
    height: scale(12),
    borderRadius: moderateScale(6),
    marginRight: scale(12),
    marginTop: scale(4),
  },
  breakdownTextContainer: {
    flex: 1,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(4),
  },
  breakdownName: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  breakdownSubtitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-Regular',
    color: '#888',
    marginBottom: scale(8),
    lineHeight: moderateScale(16),
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
  },
  progressBarContainer: {
    height: scale(6),
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    borderRadius: 3,
    overflow: 'hidden',
    flex: 1,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  breakdownPercentage: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  scoreImpactBadge: {
    paddingHorizontal: scale(8),
    paddingVertical: scale(4),
    borderRadius: moderateScale(6),
  },
  scoreImpactText: {
    fontSize: moderateScale(11),
    fontFamily: 'Urbanist-Bold',
  },
  attentionCardOuter: {
    marginTop: scale(24),
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: 'rgba(255, 59, 92, 0.15)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  attentionBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  attentionGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '40%',
  },
  attentionContent: {
    padding: scale(16),
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  attentionTitle: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-SemiBold',
    color: '#FF3B5C',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    gap: scale(12),
  },
  serviceItemSelected: {
    backgroundColor: 'rgba(82, 153, 254, 0.08)',
    marginHorizontal: scale(-16),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(12),
    borderTopWidth: 0,
    marginTop: scale(4),
  },
  checkbox: {
    width: scale(24),
    height: scale(24),
    borderRadius: moderateScale(6),
    borderWidth: 2,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkboxSelected: {
    backgroundColor: '#5299FE',
    borderColor: '#5299FE',
  },
  serviceItemLeft: {
    flex: 1,
  },
  serviceName: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-Medium',
    color: '#1a1a1a',
  },
  serviceDue: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: scale(2),
  },
  statusBadge: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: moderateScale(8),
  },
  overdueBadge: {
    backgroundColor: 'rgba(255, 59, 92, 0.12)',
  },
  dueSoonBadge: {
    backgroundColor: 'rgba(255, 214, 10, 0.2)',
  },
  statusText: {
    fontSize: moderateScale(10),
    fontFamily: 'Urbanist-Bold',
    letterSpacing: 0.5,
  },
  overdueText: {
    color: '#FF3B5C',
  },
  dueSoonText: {
    color: '#B8860B',
  },
  serviceNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    marginBottom: scale(2),
  },
  actionDescription: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-Regular',
    color: '#5299FE',
    marginTop: scale(4),
  },
  scoreImpactBadgeLarge: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    paddingHorizontal: scale(12),
    paddingVertical: scale(8),
    borderRadius: moderateScale(10),
    alignItems: 'center',
    minWidth: scale(50),
  },
  scoreImpactTextLarge: {
    fontSize: moderateScale(18),
    fontFamily: 'Urbanist-Bold',
    color: '#30D158',
  },
  scoreImpactLabel: {
    fontSize: moderateScale(10),
    fontFamily: 'Urbanist-Medium',
    color: '#30D158',
  },
  totalImprovementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: scale(16),
    paddingTop: scale(12),
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  totalImprovementLabel: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  totalImprovementValue: {
    fontSize: moderateScale(16),
    fontFamily: 'Urbanist-Bold',
    color: '#30D158',
  },
  scheduleButtonContainer: {
    paddingHorizontal: scale(24),
    paddingBottom: scale(20),
    paddingTop: scale(8),
    backgroundColor: '#fff',
  },
  estimatedLabel: {
    fontSize: moderateScale(13),
    fontFamily: 'Urbanist-SemiBold',
    color: '#9CA3AF',
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginTop: scale(-4),
  },
  estimatedSubtitle: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-Regular',
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: moderateScale(20),
    marginTop: scale(8),
    paddingHorizontal: scale(8),
  },
  resumeCheckinButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    backgroundColor: '#5299FE',
    borderRadius: moderateScale(25),
    paddingVertical: scale(16),
    paddingHorizontal: scale(24),
    marginTop: scale(24),
    width: '100%',
  },
  resumeCheckinText: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-SemiBold',
    color: '#FFFFFF',
    textAlign: 'center',
    flex: 1,
  },
  scheduleButton: {
    borderRadius: moderateScale(25),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  scheduleButtonBlur: {
    ...StyleSheet.absoluteFillObject,
  },
  scheduleButtonGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
  },
  scheduleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(10),
    paddingVertical: scale(16),
  },
  scheduleButtonText: {
    fontSize: moderateScale(16),
    fontFamily: 'Urbanist-SemiBold',
    color: '#fff',
  },
  // Info Modal Styles
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: scale(24),
  },
  infoModalContent: {
    backgroundColor: '#fff',
    borderRadius: moderateScale(20),
    width: '100%',
    maxWidth: scale(340),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  infoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: scale(20),
    paddingBottom: scale(16),
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  infoModalTitle: {
    fontSize: moderateScale(18),
    fontFamily: 'Urbanist-Bold',
    color: '#1a1a1a',
  },
  infoModalBody: {
    padding: scale(20),
  },
  infoFormulaTitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-SemiBold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: scale(8),
  },
  formulaBox: {
    backgroundColor: 'rgba(82, 153, 254, 0.1)',
    borderRadius: moderateScale(12),
    padding: scale(16),
    marginBottom: scale(20),
  },
  formulaText: {
    fontSize: moderateScale(15),
    fontFamily: 'Urbanist-Bold',
    color: '#5299FE',
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: scale(16),
  },
  infoLabel: {
    fontSize: moderateScale(14),
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
    marginBottom: scale(4),
  },
  infoDescription: {
    fontSize: moderateScale(13),
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: moderateScale(20),
  },
  infoExample: {
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    borderRadius: moderateScale(12),
    padding: scale(16),
    marginTop: scale(8),
  },
  infoExampleTitle: {
    fontSize: moderateScale(12),
    fontFamily: 'Urbanist-SemiBold',
    color: '#30D158',
    marginBottom: scale(8),
  },
  infoExampleText: {
    fontSize: moderateScale(13),
    fontFamily: 'Urbanist-Medium',
    color: '#1a1a1a',
    lineHeight: moderateScale(22),
  },
});

// ============================================================================
// APPLE ACTIVITY RINGS COMPONENT
// ============================================================================

interface ActivityRingsProps {
  healthPercentage: number;
  maintenancePercentage?: number;
  servicePercentage?: number;
  size?: number;
  onPress?: () => void;
}

const ActivityRings = ({ 
  healthPercentage, 
  size = scale(72),
  onPress,
}: ActivityRingsProps) => {
  const [animatedHealth, setAnimatedHealth] = useState(0);

  useEffect(() => {
    const duration = 1500;
    const steps = 60;
    const stepDuration = duration / steps;
    let currentStep = 0;

    const interval = setInterval(() => {
      currentStep++;
      const progress = 1 - Math.pow(1 - currentStep / steps, 3);
      setAnimatedHealth(progress * healthPercentage);

      if (currentStep >= steps) clearInterval(interval);
    }, stepDuration);

    return () => clearInterval(interval);
  }, [healthPercentage]);

  const strokeWidth = scale(8);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animatedHealth / 100);
  const center = size / 2;

  // Color based on health percentage
  const getColor = () => {
    if (healthPercentage >= 75) return '#30D158'; // Green
    if (healthPercentage >= 60) return '#FFEA00'; // Yellow
    return '#FF3B30'; // Red
  };
  const ringColor = getColor();

  const content = (
    <View style={{ position: 'relative' }}>
      <Svg width={size} height={size}>
        <Defs>
          <SvgLinearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={ringColor} />
            <Stop offset="50%" stopColor={ringColor} stopOpacity={0.9} />
            <Stop offset="100%" stopColor={ringColor} stopOpacity={0.8} />
          </SvgLinearGradient>
        </Defs>

        {/* Background track */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          opacity={0.15}
        />
        {/* Progress ring */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="url(#ringGradient)"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
        {/* Glow effect */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth + 4}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
          opacity={0.2}
        />
      </Svg>
      {/* Centered percentage */}
      <View style={activityRingStyles.centerContainer}>
        <Text style={[activityRingStyles.percentageText, { color: '#1F2937' }]}>
          {Math.round(animatedHealth)}%
        </Text>
      </View>
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{content}</Pressable>;
  }

  return content;
};

const activityRingStyles = StyleSheet.create({
  centerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: moderateScale(16),
    fontFamily: 'Urbanist-Bold',
  },
});

// ============================================================================
// 3D CAROUSEL ITEM COMPONENT
// ============================================================================

interface CarouselItemProps {
  item: Vehicle;
  index: number;
  rotation: SharedValue<number>;
  totalItems: number;
}

const CircularCarouselItem = memo(({ item, index, rotation, totalItems }: CarouselItemProps) => {
  const [hasImageError, setHasImageError] = useState(false);
  const imageSource = hasImageError ? FALLBACK_VEHICLE_IMAGE : (item.imageSource || FALLBACK_VEHICLE_IMAGE);

  const animatedStyle = useAnimatedStyle(() => {
    const anglePerItem = (2 * Math.PI) / totalItems;
    const baseAngle = index * anglePerItem;
    // `rotation` is set as `-activeIndex * anglePerItem` elsewhere in this file
    // (see the useEffect re-center and rotateToIndex). For the active item's
    // `currentAngle` to land at 0 (front), we need `baseAngle + rotation`, not
    // minus. With 2 items the two forms are equivalent mod 2π, which is why
    // the original `-` worked in testing; at 3+ items, the wrong item was
    // rendered at the front — see the fallback-Lexus-as-hero regression.
    const currentAngle = baseAngle + rotation.value;

    // Calculate position on a wider arc (not full circle)
    const x = Math.sin(currentAngle) * RADIUS * 1.2;
    const z = Math.cos(currentAngle) * RADIUS - RADIUS;

    // Scale based on Z position - front car is full size
    const scale = interpolate(
      z,
      [-RADIUS * 2, -RADIUS, 0],
      [0.5, 0.65, 1],
      Extrapolate.CLAMP
    );

    // Opacity - hide cars further back more aggressively
    const opacity = interpolate(
      z,
      [-RADIUS * 2, -RADIUS * 1.2, -RADIUS * 0.5, 0],
      [0, 0.15, 0.4, 1],
      Extrapolate.CLAMP
    );

    return {
      transform: [
        { translateX: x },
        { scale },
      ],
      opacity,
      zIndex: Math.round(z + 1000),
    };
  });

  return (
    <ReAnimated.View style={[styles.carouselCard, animatedStyle]}>
      {/* Logo - Absolutely positioned behind car */}
      {item.logoSource && (
        <View style={[
          styles.logoContainer,
          item.make === 'Lamborghini' ? styles.logoContainerLambo : styles.logoContainerLexus
        ]}>
          <Image
            source={item.logoSource}
            style={[
              styles.carouselLogo,
              item.make === 'Lamborghini' ? styles.carouselLogoLambo : styles.carouselLogoLexus
            ]}
            resizeMode="contain"
          />
        </View>
      )}
      
      {/* Car Image */}
      <Image
        source={imageSource}
        style={[
          styles.carouselCarImage,
          item.make === 'Lexus' && styles.carouselCarImageLexus,
          item.make === 'Lamborghini' && styles.carouselCarImageLambo,
        ]}
        resizeMode="contain"
        onError={() => setHasImageError(true)}
      />
      
      {/* Reflection removed — car images have white backgrounds */}
    </ReAnimated.View>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function CarCarousel({
  vehicles,
  onEditMileage,
  onToggleDefault,
  onActiveIndexChange,
  isFocused,
  maintenanceItems,
  currentMileage,
  showHealthRing = true,
  healthScore: parentHealthScore,
  isEstimatedScore,
  onResumeCheckin,
  isDarkBg = false,
}: CarCarouselProps) {
  // Trust parent ordering to keep indices consistent across screens.
  const sortedVehicles = useMemo(() => vehicles, [vehicles]);

  const [activeIndex, setActiveIndex] = useState(0);
  const rotation = useSharedValue(0);
  const anglePerItem = sortedVehicles.length > 0 ? (2 * Math.PI) / sortedVehicles.length : 0;
  const lastUpdatedIndex = useSharedValue(0);
  const isUserAnimating = useRef(false);

  // Remember the active vehicle's id (VIN) so list reorders — adding a car,
  // removing one, or a resort — don't scramble the selection. Updated ONLY
  // when activeIndex changes (intentional dep omission below) so the next
  // re-anchor pass can look up the previously-selected id.
  const activeVehicleIdRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const current = sortedVehicles[activeIndex];
    if (current) activeVehicleIdRef.current = current.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  // When the vehicle list changes (reorder / add / remove), map the remembered
  // id back to its new index. Keeps title, hero rotation, and thumbnail
  // underline in sync.
  useEffect(() => {
    if (sortedVehicles.length === 0 || !activeVehicleIdRef.current) return;
    const newIdx = sortedVehicles.findIndex((v) => v.id === activeVehicleIdRef.current);
    if (newIdx < 0) {
      // Active vehicle was removed — fall back to first.
      setActiveIndex(0);
      onActiveIndexChange?.(0);
      return;
    }
    setActiveIndex((prev) => {
      if (newIdx !== prev) {
        onActiveIndexChange?.(newIdx);
        return newIdx;
      }
      return prev;
    });
  }, [sortedVehicles, onActiveIndexChange]);

  // Bottom sheet state
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [sheetMode, setSheetMode] = useState<'main' | 'modelYear' | 'mileage' | 'nextService'>('main');
  const [editMileage, setEditMileage] = useState('');
  const [editYear, setEditYear] = useState('');

  // Vehicle Health Modal state
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Sliding glass indicator position
  const glassTranslateX = useSharedValue(0);
  useEffect(() => {
    glassTranslateX.value = withSpring(activeIndex * (scale(48) + Spacing.sm), { damping: 18, stiffness: 200 });
  }, [activeIndex]);
  const slidingGlassStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: glassTranslateX.value }],
  }));

  // Bottom sheet animation values
  const sheetTranslateY = useRef(new Animated.Value(scale(300))).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(new Animated.Value(scale(280))).current;

  const SHEET_HEIGHTS = {
    main: scale(280),
    modelYear: scale(200),
    mileage: scale(200),
    nextService: scale(320),
  };

  const activeVehicle = sortedVehicles[activeIndex];

  // Ground-line tire offset, per body style. The car image is
  // bottom-aligned in the carousel card with `resizeMode: contain`,
  // but body styles sit differently in the frame — trucks/SUVs are
  // tall (tires higher up the image) while sedans/coupes are flat
  // (tires close to the bottom edge). These offsets are relative to
  // the bottom of the carousel hero container; bigger value = line
  // moves up.
  const groundLineBottom = useMemo(() => {
    const style = (activeVehicle?.bodyStyle ?? "").toLowerCase();
    if (/truck|pickup/.test(style)) return 110;
    if (/suv|crossover|wagon|van/.test(style)) return 95;
    if (/coupe|convertible|roadster/.test(style)) return 64;
    if (/sedan|hatchback|saloon/.test(style)) return 72;
    return 78; // unknown body — keep the previous tuned default
  }, [activeVehicle?.bodyStyle]);

  useEffect(() => {
    if (sortedVehicles.length === 0) {
      setActiveIndex(0);
      rotation.value = 0;
      lastUpdatedIndex.value = 0;
      return;
    }
    const nextIndex = Math.min(activeIndex, sortedVehicles.length - 1);
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
      onActiveIndexChange?.(nextIndex);
    }
    if (!isUserAnimating.current) {
      rotation.value = -nextIndex * anglePerItem;
    }
    lastUpdatedIndex.value = nextIndex;
  }, [sortedVehicles.length, activeIndex, anglePerItem, onActiveIndexChange, rotation, lastUpdatedIndex]);

  // Use the unified health score from the parent (computed by utils/healthScore.ts)
  const overallCondition = parentHealthScore ?? 0;

  // Sub-scores for the detail modal rings (maintenance = % of known items on_time, usage = mileage curve)
  const knownItems = (maintenanceItems ?? []).filter((i) => i.status !== "unknown");
  const onTimeItems = knownItems.filter((i) => i.status === "on_time");
  const maintenanceTotal = Math.max(knownItems.length, 1);
  const maintenanceCompleted = onTimeItems.length;
  const maintenanceScoreForRing = knownItems.length > 0
    ? Math.round((maintenanceCompleted / maintenanceTotal) * 100)
    : overallCondition; // no known items → match overall so it doesn't look broken

  const vehicleMileage = currentMileage ?? activeVehicle?.mileage ?? 0;
  const getMileageScoreForRing = (miles: number) => {
    if (miles <= 30000) return 100;
    if (miles <= 60000) return 90;
    if (miles <= 100000) return 75;
    if (miles <= 150000) return 55;
    return 35;
  };
  const usageScoreForRing = getMileageScoreForRing(vehicleMileage);

  const setAnimatingTrue = useCallback(() => { isUserAnimating.current = true; }, []);
  const finishAnimation = useCallback((newIndex: number) => {
    isUserAnimating.current = false;
    setActiveIndex(newIndex);
    onActiveIndexChange?.(newIndex);
  }, [onActiveIndexChange]);

  const SETTLE_EASING = REasing.bezier(0.16, 1, 0.3, 1);

  // Pan gesture for rotating carousel
  const lastTranslationX = useSharedValue(0);
  
  const panGesture = Gesture.Pan()
    .onStart(() => {
      lastTranslationX.value = 0;
    })
    .onUpdate((e) => {
      const delta = e.translationX - lastTranslationX.value;
      // Signs flipped alongside CircularCarouselItem's `baseAngle + rotation`
      // change so the content follows the finger naturally (drag right → the
      // left-back neighbor comes to front).
      rotation.value += delta * 0.008;
      lastTranslationX.value = e.translationX;

      const currentRotationInSteps = Math.round(rotation.value / anglePerItem);
      const currentClosestIndex = (((-currentRotationInSteps % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
      lastUpdatedIndex.value = currentClosestIndex;
    })
    .onEnd((e) => {
      const velocity = e.velocityX * 0.0005;
      const targetRotation = rotation.value + velocity;
      const nearestIndex = Math.round(targetRotation / anglePerItem);
      const snappedRotation = nearestIndex * anglePerItem;

      const normalizedIndex = (((-nearestIndex % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
      lastUpdatedIndex.value = normalizedIndex;
      runOnJS(setAnimatingTrue)();

      rotation.value = withTiming(snappedRotation, {
        duration: 350,
        easing: SETTLE_EASING,
      }, (finished) => {
        'worklet';
        if (finished) {
          runOnJS(finishAnimation)(normalizedIndex);
        }
      });
    });

  // Rotate to specific index
  const rotateToIndex = useCallback((targetIndex: number) => {
    lastUpdatedIndex.value = targetIndex;
    isUserAnimating.current = true;
    
    const currentRotationInSteps = Math.round(rotation.value / anglePerItem);
    const currentIndex = (((-currentRotationInSteps % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
    
    let indexDiff = targetIndex - currentIndex;
    
    if (indexDiff > sortedVehicles.length / 2) {
      indexDiff -= sortedVehicles.length;
    } else if (indexDiff < -sortedVehicles.length / 2) {
      indexDiff += sortedVehicles.length;
    }

    const targetRotation = rotation.value - (indexDiff * anglePerItem);
    
    rotation.value = withTiming(targetRotation, {
      duration: 400,
      easing: SETTLE_EASING,
    }, (finished) => {
      'worklet';
      if (finished) {
        runOnJS(finishAnimation)(targetIndex);
      }
    });
    
    if (showBottomSheet) {
      closeBottomSheet();
    }
  }, [anglePerItem, sortedVehicles.length, showBottomSheet, finishAnimation, SETTLE_EASING]);

  // Bottom sheet functions
  const openBottomSheet = () => {
    setShowBottomSheet(true);
    sheetTranslateY.setValue(scale(300));
    backdropOpacity.setValue(0);
    
    Animated.parallel([
      Animated.spring(sheetTranslateY, {
        toValue: 0,
        tension: 65,
        friction: 11,
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const closeBottomSheet = () => {
    Animated.parallel([
      Animated.timing(sheetTranslateY, {
        toValue: scale(300),
        duration: 250,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        useNativeDriver: false,
      }),
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setShowBottomSheet(false);
      setSheetMode('main');
      sheetHeight.setValue(SHEET_HEIGHTS.main);
    });
  };

  const detailItems = [
    { label: 'Model Year', value: String(activeVehicle?.year || ''), mode: 'modelYear' as const },
    { label: 'Mileage', value: `${Math.ceil(activeVehicle?.mileage || 0).toLocaleString()} mi`, mode: 'mileage' as const },
    { label: 'Next Service', value: activeVehicle?.nextServiceDate || 'Not Set', mode: 'nextService' as const },
  ];

  const handleDetailPress = (mode: 'modelYear' | 'mileage' | 'nextService') => {
    if (mode === 'mileage') {
      setEditMileage(String(activeVehicle?.mileage || ''));
    } else if (mode === 'modelYear') {
      setEditYear(String(activeVehicle?.year || ''));
    }
    setSheetMode(mode);
    
    Animated.spring(sheetHeight, {
      toValue: SHEET_HEIGHTS[mode],
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  };

  const handleBackToMain = () => {
    setSheetMode('main');
    
    Animated.spring(sheetHeight, {
      toValue: SHEET_HEIGHTS.main,
      useNativeDriver: false,
      tension: 65,
      friction: 11,
    }).start();
  };

  return (
    <View style={styles.container}>
      {/* 3D Circular Carousel */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.carouselContainer}>
          {sortedVehicles.map((item, index) => (
            <CircularCarouselItem
              key={item.id}
              item={item}
              index={index}
              rotation={rotation}
              totalItems={sortedVehicles.length}
            />
          ))}

          {/* Ground illusion: barely-visible hairline + a soft
              shadow that fades downward, anchored to the bottom of
              the hero zone (where the tires touch). Reads as the
              car resting on a surface instead of floating in the
              gradient. Both layers are pointer-transparent so they
              don't interrupt the carousel's pan gesture. */}
          <View
            style={[styles.groundLine, { bottom: groundLineBottom }]}
            pointerEvents="none"
          />
          <LinearGradient
            colors={["rgba(0,0,0,0.06)", "rgba(0,0,0,0)"]}
            style={[styles.groundShadow, { bottom: groundLineBottom - 38 }]}
            pointerEvents="none"
          />
        </View>
      </GestureDetector>

      {/* Active Car Info */}
      <View style={styles.activeCarInfo}>
        <Text style={[
          styles.heroCarName,
          (isDarkBg || activeVehicle?.make === 'Lamborghini') && styles.heroCarNameLight,
        ]}>{activeVehicle?.make} {activeVehicle?.model}</Text>
        <Text style={[
          styles.heroCarMeta,
          (isDarkBg || activeVehicle?.make === 'Lamborghini') && styles.heroCarMetaLight,
        ]}>
          {Math.ceil(activeVehicle?.mileage || 0).toLocaleString()} mi  |  {activeVehicle?.year}
        </Text>
        {activeVehicle?.connectionStatus === 'connected' && (
          <View style={styles.connectedBadge}>
            <Check size={scale(12)} color="#FFFFFF" strokeWidth={3} />
            <Text style={styles.connectedBadgeText}>Connected</Text>
          </View>
        )}
      </View>


      {/* Thumbnail Selector with Activity Rings */}
      <View style={styles.thumbnailRow}>
        <View style={styles.thumbnailSelector}>
          {/* Sliding glass indicator behind active thumbnail.
              Uses native LiquidGlassView on iOS 26+ for the real
              liquid-glass refraction; everywhere else (older iOS,
              Android, simulators where the native module is missing)
              falls back to a frosted BlurView pill so the indicator is
              always visible — same approach as the bottom TabBar. */}
          <ReAnimated.View
            style={[styles.slidingGlassWrapper, slidingGlassStyle]}
            pointerEvents="none"
          >
            {isLiquidGlassEnabled && LiquidGlassView ? (
              // Native iOS 26 liquid glass. `tintColor` gives the
              // pill enough body to show on uniform backgrounds —
              // without it the refraction is invisible against the
              // light card backdrop. `colorScheme="light"` matches
              // the bookings segmented-control's active pill look.
              <LiquidGlassView
                interactive
                effect="regular"
                tintColor="rgba(255,255,255,0.55)"
                colorScheme="light"
                style={styles.slidingGlassPillNative}
              />
            ) : (
              <BlurView
                intensity={60}
                tint="light"
                style={[styles.slidingGlassPillNative, styles.slidingGlassPillFallback]}
              />
            )}
          </ReAnimated.View>

          {sortedVehicles.map((vehicle, index) => {
            const imageSource = vehicle.imageSource || FALLBACK_VEHICLE_IMAGE;
            const isActive = index === activeIndex;

            return (
              <Pressable
                key={vehicle.id}
                onPress={() => rotateToIndex(index)}
                style={[
                  styles.thumbnailButton,
                  !isLiquidGlassEnabled && isActive && styles.thumbnailButtonActive,
                ]}
              >
                <Image
                  source={imageSource}
                  style={styles.thumbnailImage}
                  resizeMode="contain"
                />
              </Pressable>
            );
          })}

          <Pressable style={styles.addCarButton} onPress={() => router.push('/add-vehicle')}>
            <Plus size={scale(18)} color="#000000" />
          </Pressable>
        </View>

        {/* Activity Rings - Vehicle Condition (hidden until onboarding is complete) */}
        {showHealthRing && (
          <ActivityRings 
            healthPercentage={overallCondition}
            maintenancePercentage={maintenanceScoreForRing}
            servicePercentage={usageScoreForRing}
            size={scale(72)}
            onPress={() => setShowHealthModal(true)}
          />
        )}
      </View>

      {/* Separator */}
      <View style={[
        styles.separatorContainer,
        { width: (sortedVehicles.length * scale(48)) + ((sortedVehicles.length - 1) * Spacing.sm) }
      ]}>
        <View style={styles.separator} />
        <View 
          style={[
            styles.separatorIndicator, 
            { left: activeIndex * (scale(48) + Spacing.sm) }
          ]} 
        />
      </View>

      {/* Bottom Sheet Modal */}
      <Modal
        visible={showBottomSheet}
        transparent
        animationType="none"
        onRequestClose={closeBottomSheet}
      >
        <KeyboardAvoidingView 
          style={styles.modalContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={scale(40)}
        >
          <Animated.View 
            style={[styles.backdrop, { opacity: backdropOpacity }]}
          >
            <Pressable style={StyleSheet.absoluteFill} onPress={closeBottomSheet} />
          </Animated.View>

          <Animated.View 
            style={[
              styles.bottomSheet,
              { 
                transform: [{ translateY: sheetTranslateY }],
                height: sheetHeight,
              }
            ]}
          >
            {sheetMode !== 'main' && (
              <Pressable style={styles.backButton} onPress={handleBackToMain}>
                <ChevronLeft size={scale(24)} color="#6B7280" />
              </Pressable>
            )}

            <Pressable style={styles.closeButton} onPress={closeBottomSheet}>
              <X size={scale(24)} color="#6B7280" />
            </Pressable>

            {/* Main View */}
            {sheetMode === 'main' && (
              <View style={styles.sheetContent}>
                <Image
                  source={
                    activeVehicle?.make === 'Lamborghini'
                      ? require('@/assets/images/LamboLogo.png')
                      : require('@/assets/images/LexusLogo.png')
                  }
                  style={styles.sheetLogo}
                  resizeMode="contain"
                />

                <View style={styles.detailsGrid}>
                  {detailItems.map((detailItem) => (
                    <Pressable 
                      key={detailItem.label} 
                      style={({ pressed }) => [
                        styles.sheetDetailItem,
                        pressed && styles.detailItemPressed,
                      ]}
                      onPress={() => handleDetailPress(detailItem.mode)}
                    >
                      <Text size="xs" color="#6B7280" style={styles.detailLabel}>
                        {detailItem.label}
                      </Text>
                      <View style={styles.valueRow}>
                        <Text weight="bold" size="lg" color={Colors.light.text}>
                          {detailItem.value}
                        </Text>
                        <ChevronRight size={scale(18)} color="#9CA3AF" />
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}

            {/* Model Year Edit */}
            {sheetMode === 'modelYear' && (
              <View style={styles.sheetContent}>
                <Text weight="bold" size="xl" color={Colors.light.text} style={styles.sheetTitle}>
                  Edit Model Year
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={editYear}
                  onChangeText={setEditYear}
                  keyboardType="number-pad"
                  placeholder="Enter year"
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable 
                  style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
                  onPress={handleBackToMain}
                >
                  <Text weight="semiBold" size="md" color="#FFFFFF">Save Changes</Text>
                </Pressable>
              </View>
            )}

            {/* Mileage Edit */}
            {sheetMode === 'mileage' && (
              <View style={styles.sheetContent}>
                <Text weight="bold" size="xl" color={Colors.light.text} style={styles.sheetTitle}>
                  Update Mileage
                </Text>
                <TextInput
                  style={styles.textInput}
                  value={editMileage}
                  onChangeText={setEditMileage}
                  keyboardType="number-pad"
                  placeholder="Enter mileage"
                  placeholderTextColor="#9CA3AF"
                />
                <Pressable 
                  style={({ pressed }) => [styles.saveButton, pressed && styles.saveButtonPressed]}
                  onPress={() => {
                    if (activeVehicle && onEditMileage) {
                      onEditMileage(activeVehicle.id);
                    }
                    handleBackToMain();
                  }}
                >
                  <Text weight="semiBold" size="md" color="#FFFFFF">Save Changes</Text>
                </Pressable>
              </View>
            )}

            {/* Next Service Options */}
            {sheetMode === 'nextService' && (
              <View style={styles.sheetContent}>
                <Text weight="bold" size="xl" color={Colors.light.text} style={styles.sheetTitle}>
                  Service Options
                </Text>
                <View style={styles.serviceOptions}>
                  <Pressable 
                    style={({ pressed }) => [styles.serviceOption, pressed && styles.serviceOptionPressed]}
                    onPress={handleBackToMain}
                  >
                    <View style={[styles.serviceOptionIcon, { backgroundColor: '#EBF5FF' }]}>
                      <Calendar size={scale(20)} color={BrandColors.secondary} />
                    </View>
                    <Text weight="medium" size="md" color={Colors.light.text}>Reschedule</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.serviceOption, pressed && styles.serviceOptionPressed]}
                    onPress={handleBackToMain}
                  >
                    <View style={[styles.serviceOptionIcon, { backgroundColor: '#FEE2E2' }]}>
                      <XCircle size={scale(20)} color="#EF4444" />
                    </View>
                    <Text weight="medium" size="md" color={Colors.light.text}>Cancel</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.serviceOption, pressed && styles.serviceOptionPressed]}
                    onPress={handleBackToMain}
                  >
                    <View style={[styles.serviceOptionIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Check size={scale(20)} color="#10B981" />
                    </View>
                    <Text weight="medium" size="md" color={Colors.light.text}>Mark as Done</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Vehicle Health Modal */}
      <VehicleHealthModal
        visible={showHealthModal}
        onClose={() => setShowHealthModal(false)}
        vehicleName={activeVehicle ? `${activeVehicle.make} ${activeVehicle.model}` : 'Vehicle'}
        healthPercentage={overallCondition}
        maintenancePercentage={maintenanceScoreForRing}
        servicePercentage={usageScoreForRing}
        maintenanceItems={maintenanceItems}
        currentMileage={vehicleMileage}
        isEstimated={isEstimatedScore}
        onResumeCheckin={onResumeCheckin}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  // 3D Carousel Styles
  carouselContainer: {
    height: SCREEN_HEIGHT * 0.24,
    alignItems: 'center',
    justifyContent: 'flex-end',
    position: 'relative',
    marginTop: 0,
  },
  // Inset so it reads as a "subtle plane" rather than a hard
  // edge-to-edge horizon. Anchored to the bottom of the carousel
  // hero zone so it lands at the tire line regardless of which car
  // is active.
  // `bottom` is supplied at the JSX site so the line can follow the
  // active vehicle's body-style tire offset (truck vs sedan vs coupe).
  groundLine: {
    position: 'absolute',
    left: 24,
    right: 24,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  // Soft floor shadow that starts at the hairline and fades
  // downward from a faint dark tint into transparent. `bottom` is
  // also supplied at the JSX site, kept 38px below the line so the
  // pair stays glued together as the line moves.
  groundShadow: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 38,
  },
  carouselCard: {
    width: CAR_CARD_WIDTH,
    height: CAR_CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    bottom: 0,
    overflow: 'visible',
  },
  logoContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainerLexus: {
    top: verticalScale(-280),
  },
  logoContainerLambo: {
    top: verticalScale(-240),
  },
  carouselLogo: {
    opacity: 0.08,
  },
  carouselLogoLexus: {
    width: scale(280),
    height: scale(280),
  },
  carouselLogoLambo: {
    width: scale(240),
    height: scale(240),
  },
  carouselCarImage: {
    width: '100%',
    height: '100%',
    zIndex: 1,
    // `scale: 0.85` zooms out the car a touch so it doesn't dominate
    // the frame. `translateY` keeps the bottom (tires) at roughly the
    // same Y after the scale-down so the ground line still lands at
    // the tire base without retuning per-body-style offsets.
    transform: [{ translateY: scale(22) }, { scale: 0.85 }],
  },
  carouselCarImageLexus: {
    // No longer needed — dynamic images have consistent sizing
  },
  carouselCarImageLambo: {
    // No longer needed — dynamic images have consistent sizing
  },
  carouselReflection: {
    width: '100%',
    height: scale(180),
    transform: [{ scaleY: -1 }],
    opacity: 0.03,
    marginTop: scale(-165),
  },
  carouselReflectionLexus: {
    // No longer needed
  },
  carouselReflectionLambo: {
    width: '130%',
    height: scale(260),
    opacity: 0.04,
    marginTop: scale(-175),
    transform: [{ scaleY: -1 }, { translateY: 40 }],
  },

  // Active Car Info
  activeCarInfo: {
    alignItems: 'center',
    marginTop: scale(8),
  },
  heroCarName: {
    color: '#000000',
    fontSize: moderateScale(24),
    fontWeight: '700',
  },
  heroCarNameLight: {
    color: '#ffffff',
  },
  heroCarMeta: {
    marginTop: scale(4),
    color: '#000000',
    fontSize: moderateScale(14),
    fontWeight: '700',
  },
  heroCarMetaLight: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(4),
    marginTop: scale(6),
    backgroundColor: '#34C759',
    paddingHorizontal: scale(10),
    paddingVertical: scale(4),
    borderRadius: moderateScale(12),
    alignSelf: 'center',
  },
  connectedBadgeText: {
    color: '#FFFFFF',
    fontSize: moderateScale(11),
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Thumbnail Row
  thumbnailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  thumbnailSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    position: 'relative',
  },
  slidingGlassWrapper: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: scale(48),
    height: scale(48),
    zIndex: 0,
  },
  slidingGlassPillNative: {
    width: scale(48),
    height: scale(48),
    borderRadius: scale(24),
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  // Only applied when falling back to BlurView. The white tint and
  // border give the pill enough body to be visible without the iOS 26
  // native refraction. On the LiquidGlassView path these would smother
  // the real glass effect, so they're kept off that surface.
  slidingGlassPillFallback: {
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  thumbnailButton: {
    width: scale(48),
    height: scale(48),
    borderRadius: moderateScale(10),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailButtonActive: {},
  thumbnailImage: {
    width: scale(36),
    height: scale(36),
  },
  addCarButton: {
    width: scale(36),
    height: scale(36),
    borderRadius: scale(18),
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#000000',
  },

  // Separator
  separatorContainer: {
    position: 'absolute',
    left: Spacing.lg,
    bottom: 0,
  },
  separator: {
    height: 1.5,
    backgroundColor: '#C4C9D4',
  },
  separatorIndicator: {
    position: 'absolute',
    top: -1,
    width: scale(48),
    height: 3,
    backgroundColor: BrandColors.secondary,
    borderRadius: 1.5,
  },


  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: scale(10),
    paddingBottom: scale(24),
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(50),
    width: '100%',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.xs,
    marginBottom: scale(10),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 10,
  },
  backButton: {
    position: 'absolute',
    top: Spacing.md,
    left: Spacing.lg,
    padding: scale(8),
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    padding: scale(8),
  },
  sheetContent: {
    alignItems: 'center',
    paddingTop: scale(40),
  },
  sheetLogo: {
    width: scale(80),
    height: scale(90),
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  detailsGrid: {
    width: '100%',
    gap: Spacing.sm,
  },
  sheetDetailItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
  },
  detailItemPressed: {
    backgroundColor: '#F3F4F6',
  },
  detailLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: moderateScale(11),
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
  },
  sheetTitle: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  textInput: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: moderateScale(18),
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.lg,
  },
  saveButton: {
    width: '100%',
    backgroundColor: BrandColors.secondary,
    borderRadius: moderateScale(12),
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  serviceOptions: {
    width: '100%',
    gap: Spacing.sm,
  },
  serviceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: moderateScale(12),
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  serviceOptionPressed: {
    backgroundColor: '#F3F4F6',
  },
  serviceOptionIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CarCarousel;
