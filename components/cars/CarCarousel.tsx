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
  InteractionManager,
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
  runOnJS,
  SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { BrandColors, Colors, Spacing } from '@/constants/theme';

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
}

interface CarCarouselProps {
  vehicles: Vehicle[];
  onEditMileage?: (vehicleId: string) => void;
  onToggleDefault?: (vehicleId: string, isDefault: boolean) => void;
  onActiveIndexChange?: (index: number) => void;
  isFocused?: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CAR_CARD_WIDTH = 280;
const CAR_CARD_HEIGHT = 200;
const RADIUS = SCREEN_WIDTH * 0.5;

const DEFAULT_VEHICLE_IMAGE = require('@/assets/images/lexus.png');
const BLUE_LAMBO_IMAGE = require('@/assets/images/bluelambo.png');

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
}

const VehicleHealthModal = ({
  visible,
  onClose,
  vehicleName,
  healthPercentage,
  maintenancePercentage,
  servicePercentage,
}: VehicleHealthModalProps) => {
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  
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

  // Service items that need attention with score impacts
  // Impacts are calculated based on how they affect the overall condition:
  // - Maintenance items affect the 70% weight portion
  // - Service records items affect the 30% weight portion
  // Example: +7% to Maintenance × 0.7 weight = +5 pts to Overall Condition
  const serviceItems: ServiceItem[] = [
    { 
      name: 'Oil Change', 
      dueInfo: 'Overdue by 500 miles', 
      status: 'overdue',
      scoreImpact: 5, // +7% to Maintenance × 0.7 = +5%
      actionDescription: '+5% to Overall Condition'
    },
    { 
      name: 'Tire Rotation', 
      dueInfo: 'Due in 12 days', 
      status: 'due_soon',
      scoreImpact: 3, // +4% to Maintenance × 0.7 = +3%
      actionDescription: '+3% to Overall Condition'
    },
    { 
      name: 'Update Mileage', 
      dueInfo: 'Last updated 30 days ago', 
      status: 'due_soon',
      scoreImpact: 3, // +10% to Usage × 0.3 = +3%
      actionDescription: '+3% to Overall Condition'
    },
  ];

  // Maintenance: X out of Y services completed
  // 7/10 because 3 items need attention (1 overdue + 2 due soon)
  const maintenanceCompleted = 7;
  const maintenanceTotal = 10;
  const maintenanceScore = Math.round((maintenanceCompleted / maintenanceTotal) * 100);

  // Usage & Wear: Based on mileage (lower = better)
  // Score calculation: 100k+ miles starts reducing score significantly
  const vehicleMileage = 45000; // Sample mileage
  const getMileageScore = (miles: number) => {
    if (miles <= 30000) return 100;
    if (miles <= 60000) return 90;
    if (miles <= 100000) return 75;
    if (miles <= 150000) return 55;
    return 35;
  };
  const usageScore = getMileageScore(vehicleMileage);

  // Calculate Vehicle Condition based on the other metrics
  // Maintenance has higher weight (70%) since keeping up with services matters more
  // Usage & Wear has lower weight (30%) since mileage is less controllable
  const calculatedCondition = Math.round(
    (maintenanceScore * 0.7) + (usageScore * 0.3)
  );

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
      color: maintenanceScore >= 75 ? '#30D158' : maintenanceScore >= 60 ? '#FFD60A' : '#FF3B5C',
      percentage: maintenanceScore,
      displayValue: `${maintenanceCompleted}/${maintenanceTotal}`,
      // Weighted impact: (75 - score) × 0.7 weight
      scoreImpact: maintenanceScore >= 75 ? 0 : -Math.round((75 - maintenanceScore) * 0.7),
    },
    {
      name: 'Usage & Wear',
      subtitle: 'Lower mileage = higher score',
      color: usageScore >= 75 ? '#30D158' : usageScore >= 60 ? '#FFD60A' : '#FF3B5C',
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

      // Open modal animation
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
      ]).start();

      // Staggered ring animations: green first (0ms), yellow (200ms), red (400ms)
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
            const progress = 1 - Math.pow(1 - currentStep / steps, 3); // easeOut
            setter(progress * target);
            if (currentStep >= steps) clearInterval(interval);
          }, stepDuration);
        }, delay);
      };

      // Overall condition first, then maintenance, then usage
      // Uses the same values as the metrics: calculatedCondition, maintenanceScore, usageScore
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
  const modalRingSize = 180;
  const ringStrokeWidth = 12;
  const ringRadius = (modalRingSize / 2) - (ringStrokeWidth / 2) - 8;
  const circumference = 2 * Math.PI * ringRadius;
  const center = modalRingSize / 2;
  
  // Use calculated condition as the overall health score (animated value)
  const overallPercentage = animatedService;
  const strokeDashoffset = circumference * (1 - overallPercentage / 100);
  
  // Determine ring color based on calculated condition
  const getRingColor = () => {
    if (calculatedCondition >= 75) return '#30D158'; // Green
    if (calculatedCondition >= 60) return '#FFD60A'; // Yellow
    return '#FF3B5C'; // Red
  };
  
  const ringColor = getRingColor();

  const renderRings = () => (
    <View style={modalStyles.ringsContainer}>
      <Svg width={modalRingSize} height={modalRingSize}>
        <Defs>
          <SvgLinearGradient id="mainRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={ringColor} />
            <Stop offset="100%" stopColor={ringColor} />
          </SvgLinearGradient>
        </Defs>

        {/* Track (background ring) */}
        <Circle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke="rgba(48, 209, 88, 0.15)"
          strokeWidth={ringStrokeWidth}
          fill="none"
        />
        
        {/* Progress ring */}
        <Circle
          cx={center}
          cy={center}
          r={ringRadius}
          stroke={ringColor}
          strokeWidth={ringStrokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      
      {/* Centered percentage text */}
      <View style={modalStyles.ringCenterContent}>
        <View style={modalStyles.percentageRow}>
          <Text style={modalStyles.percentageText}>{Math.round(overallPercentage)}</Text>
          <Text style={modalStyles.percentageSymbol}>%</Text>
        </View>
        <Text style={modalStyles.optimizedText}>OPTIMIZED</Text>
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
              <X size={18} color="#666" />
            </Pressable>
          </View>

          <View style={modalStyles.headerSeparator} />

          {/* Scrollable content */}
          <ScrollView 
            style={modalStyles.scrollView}
            contentContainerStyle={modalStyles.scrollContent}
            showsVerticalScrollIndicator={false}
            bounces={true}
          >
            {/* Large rings display */}
            {renderRings()}

            {/* What Affects Your Score */}
            <View style={modalStyles.breakdownSection}>
              <View style={modalStyles.sectionTitleRow}>
                <Text style={modalStyles.sectionTitle}>WHAT AFFECTS YOUR SCORE</Text>
                <Pressable 
                  onPress={() => setShowInfoModal(true)}
                  hitSlop={10}
                  style={modalStyles.infoButton}
                >
                  <Info size={16} color="#888" />
                </Pressable>
              </View>
              
              {/* Overall Vehicle Condition - first */}
              {renderBreakdownRow(
                metrics[0].color,
                metrics[0].name,
                metrics[0].subtitle,
                metrics[0].percentage,
                progressService, // Uses the calculated condition animation
                metrics[0].displayValue,
                metrics[0].scoreImpact
              )}
              {/* Maintenance */}
              {renderBreakdownRow(
                metrics[1].color,
                metrics[1].name,
                metrics[1].subtitle,
                metrics[1].percentage,
                progressHealth,
                metrics[1].displayValue,
                metrics[1].scoreImpact
              )}
              {/* Usage & Wear */}
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

            {/* How to Improve Your Score - Glassy Style */}
            {needsAttention && (
              <View style={modalStyles.attentionCardOuter}>
                <BlurView intensity={20} tint="light" style={modalStyles.attentionBlur}>
                  <LinearGradient
                    colors={['rgba(82, 153, 254, 0.12)', 'rgba(82, 153, 254, 0.06)']}
                    style={StyleSheet.absoluteFill}
                  />
                  {/* Glossy top highlight */}
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
                        {/* Checkbox */}
                        <View style={[
                          modalStyles.checkbox,
                          isSelected && modalStyles.checkboxSelected
                        ]}>
                          {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
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
                  
                  {/* Total potential improvement */}
                  <View style={modalStyles.totalImprovementRow}>
                    <Text style={modalStyles.totalImprovementLabel}>Complete all to gain</Text>
                    <Text style={modalStyles.totalImprovementValue}>
                      +{serviceItems.reduce((sum, item) => sum + item.scoreImpact, 0)}%
                    </Text>
                  </View>
                </View>
              </View>
            )}

            {/* Bottom padding for sticky button */}
            <View style={{ height: 20 }} />
          </ScrollView>
          
          {/* Schedule Service Button - Sticky & Glassy */}
          <View style={modalStyles.scheduleButtonContainer}>
            <Pressable style={modalStyles.scheduleButton}>
              <BlurView intensity={80} tint="dark" style={modalStyles.scheduleButtonBlur}>
                <LinearGradient
                  colors={selectedServices.size > 0 
                    ? ['rgba(82, 153, 254, 0.95)', 'rgba(60, 120, 220, 0.98)']
                    : ['rgba(40, 40, 40, 0.9)', 'rgba(20, 20, 20, 0.95)']}
                  style={StyleSheet.absoluteFill}
                />
                {/* Glossy top highlight */}
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
                <Calendar size={20} color="#fff" />
              </View>
            </Pressable>
          </View>
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
                  <X size={20} color="#666" />
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: SCREEN_HEIGHT * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 20,
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 2,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.55,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  headerSubtitle: {
    fontSize: 14,
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    top: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerSeparator: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.08)',
    marginHorizontal: 24,
  },
  ringsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    position: 'relative',
  },
  ringCenterContent: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  percentageText: {
    fontSize: 48,
    fontFamily: 'Urbanist-Bold',
    color: '#1a1a1a',
    lineHeight: 52,
  },
  percentageSymbol: {
    fontSize: 24,
    fontFamily: 'Urbanist-Bold',
    color: '#1a1a1a',
    marginTop: 6,
  },
  optimizedText: {
    fontSize: 12,
    fontFamily: 'Urbanist-SemiBold',
    color: '#9CA3AF',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  breakdownSection: {
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: 'Urbanist-SemiBold',
    color: '#888',
    letterSpacing: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoButton: {
    padding: 4,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
  },
  breakdownLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 4,
  },
  breakdownTextContainer: {
    flex: 1,
  },
  breakdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  breakdownName: {
    fontSize: 15,
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  breakdownSubtitle: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
    color: '#888',
    marginBottom: 8,
    lineHeight: 16,
  },
  progressBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  progressBarContainer: {
    height: 6,
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
    fontSize: 15,
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
  },
  scoreImpactBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  scoreImpactText: {
    fontSize: 11,
    fontFamily: 'Urbanist-Bold',
  },
  attentionCardOuter: {
    marginTop: 24,
    borderRadius: 16,
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
    padding: 16,
  },
  attentionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  attentionTitle: {
    fontSize: 15,
    fontFamily: 'Urbanist-SemiBold',
    color: '#FF3B5C',
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.06)',
    gap: 12,
  },
  serviceItemSelected: {
    backgroundColor: 'rgba(82, 153, 254, 0.08)',
    marginHorizontal: -16,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderTopWidth: 0,
    marginTop: 4,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
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
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    color: '#1a1a1a',
  },
  serviceDue: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  overdueBadge: {
    backgroundColor: 'rgba(255, 59, 92, 0.12)',
  },
  dueSoonBadge: {
    backgroundColor: 'rgba(255, 214, 10, 0.2)',
  },
  statusText: {
    fontSize: 10,
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
    gap: 8,
    marginBottom: 2,
  },
  actionDescription: {
    fontSize: 12,
    fontFamily: 'Urbanist-Regular',
    color: '#5299FE',
    marginTop: 4,
  },
  scoreImpactBadgeLarge: {
    backgroundColor: 'rgba(48, 209, 88, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
    minWidth: 50,
  },
  scoreImpactTextLarge: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: '#30D158',
  },
  scoreImpactLabel: {
    fontSize: 10,
    fontFamily: 'Urbanist-Medium',
    color: '#30D158',
  },
  totalImprovementRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.08)',
  },
  totalImprovementLabel: {
    fontSize: 14,
    fontFamily: 'Urbanist-Medium',
    color: '#666',
  },
  totalImprovementValue: {
    fontSize: 16,
    fontFamily: 'Urbanist-Bold',
    color: '#30D158',
  },
  scheduleButtonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
    paddingTop: 8,
    backgroundColor: '#fff',
  },
  scheduleButton: {
    borderRadius: 25,
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
    gap: 10,
    paddingVertical: 16,
  },
  scheduleButtonText: {
    fontSize: 16,
    fontFamily: 'Urbanist-SemiBold',
    color: '#fff',
  },
  // Info Modal Styles
  infoModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoModalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: '100%',
    maxWidth: 340,
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
    padding: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.08)',
  },
  infoModalTitle: {
    fontSize: 18,
    fontFamily: 'Urbanist-Bold',
    color: '#1a1a1a',
  },
  infoModalBody: {
    padding: 20,
  },
  infoFormulaTitle: {
    fontSize: 12,
    fontFamily: 'Urbanist-SemiBold',
    color: '#888',
    letterSpacing: 1,
    marginBottom: 8,
  },
  formulaBox: {
    backgroundColor: 'rgba(82, 153, 254, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  formulaText: {
    fontSize: 15,
    fontFamily: 'Urbanist-Bold',
    color: '#5299FE',
    textAlign: 'center',
  },
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 14,
    fontFamily: 'Urbanist-SemiBold',
    color: '#1a1a1a',
    marginBottom: 4,
  },
  infoDescription: {
    fontSize: 13,
    fontFamily: 'Urbanist-Regular',
    color: '#666',
    lineHeight: 20,
  },
  infoExample: {
    backgroundColor: 'rgba(48, 209, 88, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  infoExampleTitle: {
    fontSize: 12,
    fontFamily: 'Urbanist-SemiBold',
    color: '#30D158',
    marginBottom: 8,
  },
  infoExampleText: {
    fontSize: 13,
    fontFamily: 'Urbanist-Medium',
    color: '#1a1a1a',
    lineHeight: 22,
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
  size = 72,
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

  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference * (1 - animatedHealth / 100);
  const center = size / 2;

  // Color based on health percentage
  const getColor = () => {
    if (healthPercentage >= 75) return '#30D158'; // Green
    if (healthPercentage >= 60) return '#FFD60A'; // Yellow
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
        <Text style={[activityRingStyles.percentageText, { color: ringColor }]}>
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
    fontSize: 16,
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
  const imageSource = item.imageSource || (item.make === 'Lamborghini' ? BLUE_LAMBO_IMAGE : DEFAULT_VEHICLE_IMAGE);

  const animatedStyle = useAnimatedStyle(() => {
    const anglePerItem = (2 * Math.PI) / totalItems;
    const baseAngle = index * anglePerItem;
    const currentAngle = baseAngle - rotation.value;

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
          item.make === 'Lamborghini' && styles.carouselCarImageLambo
        ]}
        resizeMode="contain"
      />
      
      {/* Simple Reflection */}
      <Image
        source={imageSource}
        style={[
          styles.carouselReflection,
          item.make === 'Lexus' && styles.carouselReflectionLexus,
          item.make === 'Lamborghini' && styles.carouselReflectionLambo
        ]}
        resizeMode="contain"
      />
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
}: CarCarouselProps) {
  // Sort vehicles so default car is first - memoized to prevent re-renders
  const sortedVehicles = useMemo(() => 
    [...vehicles].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
      return 0;
    }), [vehicles]);

  const [activeIndex, setActiveIndex] = useState(0);
  const rotation = useSharedValue(0);
  const anglePerItem = (2 * Math.PI) / sortedVehicles.length;
  const lastUpdatedIndex = useSharedValue(0);

  // Bottom sheet state
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [sheetMode, setSheetMode] = useState<'main' | 'modelYear' | 'mileage' | 'nextService'>('main');
  const [editMileage, setEditMileage] = useState('');
  const [editYear, setEditYear] = useState('');

  // Vehicle Health Modal state
  const [showHealthModal, setShowHealthModal] = useState(false);

  // Bottom sheet animation values
  const sheetTranslateY = useRef(new Animated.Value(300)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetHeight = useRef(new Animated.Value(280)).current;

  const SHEET_HEIGHTS = {
    main: 280,
    modelYear: 200,
    mileage: 200,
    nextService: 320,
  };

  const activeVehicle = sortedVehicles[activeIndex];

  // Calculate overall vehicle condition (same as in modal)
  // This should match the calculation inside VehicleHealthModal
  const maintenanceCompleted = 7;
  const maintenanceTotal = 10;
  const vehicleMileage = 45000;
  const getMileageScoreForRing = (miles: number) => {
    if (miles <= 30000) return 100;
    if (miles <= 60000) return 90;
    if (miles <= 100000) return 75;
    if (miles <= 150000) return 55;
    return 35;
  };
  const maintenanceScoreForRing = Math.round((maintenanceCompleted / maintenanceTotal) * 100);
  const usageScoreForRing = getMileageScoreForRing(vehicleMileage);
  const overallCondition = Math.round((maintenanceScoreForRing * 0.7) + (usageScoreForRing * 0.3));

  // Deferred state update - waits for ALL animations to complete before updating
  const deferredStateUpdate = useCallback((newIndex: number) => {
    // Wait for animations to complete, then update state
    InteractionManager.runAfterInteractions(() => {
      setActiveIndex(newIndex);
      onActiveIndexChange?.(newIndex);
    });
  }, [onActiveIndexChange]);

  // Pan gesture for rotating carousel
  const lastTranslationX = useSharedValue(0);
  
  const panGesture = Gesture.Pan()
    .onStart(() => {
      lastTranslationX.value = 0;
    })
    .onUpdate((e) => {
      // Only update rotation - NO state updates during drag
      const delta = e.translationX - lastTranslationX.value;
      rotation.value -= delta * 0.008; // Reversed: swipe right = car goes right
      lastTranslationX.value = e.translationX;
      
      // Track index in shared value only - no JS bridge calls
      const currentRotationInSteps = Math.round(rotation.value / anglePerItem);
      const currentClosestIndex = (((-currentRotationInSteps % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
      lastUpdatedIndex.value = currentClosestIndex;
    })
    .onEnd((e) => {
      const velocity = e.velocityX * -0.0005; // Reversed to match swipe direction
      const targetRotation = rotation.value + velocity;
      const nearestIndex = Math.round(targetRotation / anglePerItem);
      const snappedRotation = nearestIndex * anglePerItem;

      // Start spring animation FIRST - less bouncy
      rotation.value = withSpring(snappedRotation, {
        damping: 28,
        stiffness: 120,
      });

      // Then update state after animation starts
      const normalizedIndex = (((-nearestIndex % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
      lastUpdatedIndex.value = normalizedIndex;
      runOnJS(deferredStateUpdate)(normalizedIndex);
    });

  // Rotate to specific index
  const rotateToIndex = useCallback((targetIndex: number) => {
    // Update shared value immediately for gesture tracking
    lastUpdatedIndex.value = targetIndex;
    
    // Calculate and start animation FIRST
    const currentRotationInSteps = Math.round(rotation.value / anglePerItem);
    const currentIndex = (((-currentRotationInSteps % sortedVehicles.length) + sortedVehicles.length) % sortedVehicles.length);
    
    let indexDiff = targetIndex - currentIndex;
    
    if (indexDiff > sortedVehicles.length / 2) {
      indexDiff -= sortedVehicles.length;
    } else if (indexDiff < -sortedVehicles.length / 2) {
      indexDiff += sortedVehicles.length;
    }

    const targetRotation = rotation.value - (indexDiff * anglePerItem);
    
    // Start animation FIRST - smooth with minimal bounce
    rotation.value = withSpring(targetRotation, {
      damping: 28,
      stiffness: 120,
    });
    
    // Close bottom sheet immediately if needed
    if (showBottomSheet) {
      closeBottomSheet();
    }
    
    // Wait for animation to complete before updating state
    InteractionManager.runAfterInteractions(() => {
      setActiveIndex(targetIndex);
      onActiveIndexChange?.(targetIndex);
    });
  }, [anglePerItem, sortedVehicles.length, showBottomSheet, onActiveIndexChange]);

  // Bottom sheet functions
  const openBottomSheet = () => {
    setShowBottomSheet(true);
    sheetTranslateY.setValue(300);
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
        toValue: 300,
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
    { label: 'Mileage', value: `${(activeVehicle?.mileage || 0).toLocaleString()} mi`, mode: 'mileage' as const },
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
        </View>
      </GestureDetector>

      {/* Active Car Info */}
      <View style={styles.activeCarInfo}>
        <Text style={[
          styles.heroCarName,
          activeVehicle?.make === 'Lamborghini' && styles.heroCarNameLight
        ]}>{activeVehicle?.make} {activeVehicle?.model}</Text>
        <Text style={[
          styles.heroCarMeta,
          activeVehicle?.make === 'Lamborghini' && styles.heroCarMetaLight
        ]}>
          {activeVehicle?.mileage.toLocaleString()} mi  |  {activeVehicle?.year}
        </Text>
      </View>


      {/* Thumbnail Selector with Activity Rings */}
      <View style={styles.thumbnailRow}>
        <View style={styles.thumbnailSelector}>
          {sortedVehicles.map((vehicle, index) => {
            const imageSource = vehicle.imageSource || (vehicle.make === 'Lamborghini' ? BLUE_LAMBO_IMAGE : DEFAULT_VEHICLE_IMAGE);
            const isActive = index === activeIndex;
            
            return (
              <Pressable
                key={vehicle.id}
                onPress={() => rotateToIndex(index)}
                style={[
                  styles.thumbnailButton,
                  isActive && styles.thumbnailButtonActive,
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
          
          <Pressable style={styles.addCarButton}>
            <Plus size={18} color="#000000" />
          </Pressable>
        </View>

        {/* Activity Rings - Vehicle Condition */}
        <ActivityRings 
          healthPercentage={overallCondition}
          maintenancePercentage={78}
          servicePercentage={92}
          size={72}
          onPress={() => setShowHealthModal(true)}
        />
      </View>

      {/* Separator */}
      <View style={[
        styles.separatorContainer,
        { width: (sortedVehicles.length * 48) + ((sortedVehicles.length - 1) * Spacing.sm) }
      ]}>
        <View style={styles.separator} />
        <View 
          style={[
            styles.separatorIndicator, 
            { left: activeIndex * (48 + Spacing.sm) }
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
          keyboardVerticalOffset={40}
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
                <ChevronLeft size={24} color="#6B7280" />
              </Pressable>
            )}

            <Pressable style={styles.closeButton} onPress={closeBottomSheet}>
              <X size={24} color="#6B7280" />
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
                        <ChevronRight size={18} color="#9CA3AF" />
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
                      <Calendar size={20} color={BrandColors.secondary} />
                    </View>
                    <Text weight="medium" size="md" color={Colors.light.text}>Reschedule</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.serviceOption, pressed && styles.serviceOptionPressed]}
                    onPress={handleBackToMain}
                  >
                    <View style={[styles.serviceOptionIcon, { backgroundColor: '#FEE2E2' }]}>
                      <XCircle size={20} color="#EF4444" />
                    </View>
                    <Text weight="medium" size="md" color={Colors.light.text}>Cancel</Text>
                  </Pressable>

                  <Pressable 
                    style={({ pressed }) => [styles.serviceOption, pressed && styles.serviceOptionPressed]}
                    onPress={handleBackToMain}
                  >
                    <View style={[styles.serviceOptionIcon, { backgroundColor: '#D1FAE5' }]}>
                      <Check size={20} color="#10B981" />
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
        healthPercentage={activeVehicle?.condition || 85}
        maintenancePercentage={78}
        servicePercentage={92}
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
    height: SCREEN_HEIGHT * 0.38,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    marginTop: 60,
  },
  carouselCard: {
    width: CAR_CARD_WIDTH,
    height: CAR_CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
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
    top: -280,
  },
  logoContainerLambo: {
    top: -240,
  },
  carouselLogo: {
    opacity: 0.08,
  },
  carouselLogoLexus: {
    width: 280,
    height: 280,
  },
  carouselLogoLambo: {
    width: 240,
    height: 240,
  },
  carouselCarImage: {
    width: '115%',
    height: 210,
    zIndex: 1,
    marginTop: 30,
  },
  carouselCarImageLexus: {
    width: '100%',
    height: 170,
    marginTop: 30,
  },
  carouselCarImageLambo: {
    marginTop: 110,
  },
  carouselReflection: {
    width: '120%',
    height: 220,
    transform: [{ scaleY: -1 }],
    opacity: 0.03,
    marginTop: -20,
  },
  carouselReflectionLexus: {
    width: '105%',
    height: 170,
    opacity: 0.03,
    marginTop: -60,
  },
  carouselReflectionLambo: {
    width: '115%',
    height: 210,
    opacity: 0.04,
    marginTop: -50,
    transform: [{ scaleY: -1 }, { translateY: 40 }],
  },
  
  // Active Car Info
  activeCarInfo: {
    alignItems: 'center',
    marginTop: -100,
  },
  heroCarName: {
    color: '#000000',
    fontSize: 24,
    fontWeight: '700',
  },
  heroCarNameLight: {
    color: '#ffffff',
  },
  heroCarMeta: {
    marginTop: 4,
    color: '#000000',
    fontSize: 14,
    fontWeight: '700',
  },
  heroCarMetaLight: {
    color: 'rgba(255, 255, 255, 0.8)',
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
  },
  thumbnailButton: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailButtonActive: {},
  thumbnailImage: {
    width: 36,
    height: 36,
  },
  addCarButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
    width: 48,
    height: 3,
    backgroundColor: BrandColors.secondary,
    borderRadius: 1.5,
  },
  
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    width: '100%',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    paddingTop: Spacing.xs,
    marginBottom: 10,
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
    padding: 8,
  },
  closeButton: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.lg,
    padding: 8,
  },
  sheetContent: {
    alignItems: 'center',
    paddingTop: 40,
  },
  sheetLogo: {
    width: 80,
    height: 90,
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
    borderRadius: 12,
  },
  detailItemPressed: {
    backgroundColor: '#F3F4F6',
  },
  detailLabel: {
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 11,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sheetTitle: {
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  textInput: {
    width: '100%',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 18,
    fontWeight: '600',
    color: Colors.light.text,
    marginBottom: Spacing.lg,
  },
  saveButton: {
    width: '100%',
    backgroundColor: BrandColors.secondary,
    borderRadius: 12,
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
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  serviceOptionPressed: {
    backgroundColor: '#F3F4F6',
  },
  serviceOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CarCarousel;
