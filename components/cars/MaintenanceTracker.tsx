/**
 * MaintenanceTracker
 *
 * PURPOSE: Displays a "Maintenance Tracker" section with a vertical list of maintenance
 *          cards for a vehicle, showing status (On Time, Due Soon, Overdue, Unknown),
 *          last service information, and action buttons (Book Now / Add Info).
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (below VehicleCard on My Car page)
 *
 * PROPS:
 *   - items (MaintenanceItem[]): Array of maintenance items to render
 *   - onBookNow ((id: string) => void): Called when "Book Now" is pressed for an item [optional]
 *   - onAddInfo ((id: string) => void): Called when "Add Info" is pressed for an item [optional]
 *
 * EXAMPLE:
 *   <MaintenanceTracker
 *     items={maintenanceItems}
 *     onBookNow={(id) => router.push(`/bookings/new?serviceId=${id}`)}
 *     onAddInfo={(id) => router.push(`/cars/maintenance/${id}/edit`)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import Animated, {
  Easing as REasing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// 3. Shared UI
import { Text } from '@/components/shared-ui';
import { OilIcon, BrakesIcon, TireIcon, BatteryIcon, WarningIcon } from '@/components/cars/ServiceIcons';

// 4. Local components
import MaintenanceDetailView from '@/components/cars/MaintenanceDetailView';

// 5. Constants, hooks, types
import { Colors, FontFamily } from '@/constants/theme';
import { computeProjectedHealthScore, type HealthScoreInput } from '@/utils/healthScore';

// ============================================================================
// TYPES
// ============================================================================

export type MaintenanceStatus = 'on_time' | 'needs_attention' | 'due_soon' | 'overdue' | 'unknown';

export interface MaintenanceItem {
  id: string;
  serviceName: string;
  description: string;
  // e.g. "Mar 2025", "Aug 2025", "Unknown"
  detail: string;
  status: MaintenanceStatus;
  lastService?: string;
  urgency?: string;
  impacts?: Array<{ label: string; severity: 'high' | 'medium' | 'low' }>;
  recommendation?: string;
}

interface MaintenanceTrackerProps {
  items: MaintenanceItem[];
  vehicleCondition?: number;
  healthScoreInput?: HealthScoreInput;
  onBookNow?: (id: string) => void;
  onAddInfo?: (id: string) => void;
  onEditPressed?: () => void;
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

// Status priority for sorting (lower number = higher priority)
const STATUS_PRIORITY: Record<MaintenanceStatus, number> = {
  overdue: 0,
  due_soon: 1,
  needs_attention: 2,
  on_time: 3,
  unknown: 4,
};

const STATUS_CONFIG: Record<
  MaintenanceStatus,
  {
    label: string;
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    iconColor: string;
  }
> = {
  on_time: {
    label: 'On Time',
    badgeBg: '#DCFCE7',
    badgeText: '#15803D',
    iconBg: '#DCFCE7',
    iconColor: '#22C55E',
  },
  needs_attention: {
    label: 'Needs Attention',
    badgeBg: '#FFFDE0',
    badgeText: '#7A7200',
    iconBg: '#FFFDE0',
    iconColor: '#FFEA00',
  },
  due_soon: {
    label: 'Due Soon',
    badgeBg: '#FFFDE0',
    badgeText: '#7A7200',
    iconBg: '#FFFDE0',
    iconColor: '#FFEA00',
  },
  overdue: {
    label: 'Overdue',
    badgeBg: '#FEE2E2',
    badgeText: '#B91C1C',
    iconBg: '#FEE2E2',
    iconColor: '#DC2626',
  },
  unknown: {
    label: 'Unknown',
    badgeBg: '#E5E7EB',
    badgeText: '#4B5563',
    iconBg: '#E5E7EB',
    iconColor: '#6B7280',
  },
};

// ============================================================================
// URGENT CARD THEME CONFIG
// ============================================================================

interface UrgentTheme {
  primary: string;
  accentGradient: [string, string, string];
  buttonGradient: [string, string];
  buttonTextColor: string;
  iconBg: string;
  iconBorder: string;
  pillBg: string;
  pillBorder: string;
  remindBorder: string;
  remindBg: string;
  viewDetailsBorder: string;
}

const URGENT_THEME: Partial<Record<MaintenanceStatus, UrgentTheme>> = {
  due_soon: {
    primary: '#FFEA00',
    accentGradient: ['#FFEA00', '#FFF59E', '#FFEA00'],
    buttonGradient: ['#FFEA00', '#E6D600'],
    buttonTextColor: '#1A1A00',
    iconBg: 'rgba(255,234,0,0.08)',
    iconBorder: 'rgba(255,234,0,0.18)',
    pillBg: 'rgba(255,234,0,0.1)',
    pillBorder: 'rgba(255,234,0,0.25)',
    remindBorder: 'rgba(255,234,0,0.25)',
    remindBg: 'rgba(255,234,0,0.04)',
    viewDetailsBorder: 'rgba(255,234,0,0.3)',
  },
  overdue: {
    primary: '#EF4444',
    accentGradient: ['#EF4444', '#F87171', '#EF4444'],
    buttonGradient: ['#EF4444', '#DC2626'],
    buttonTextColor: '#FFFFFF',
    iconBg: 'rgba(239,68,68,0.08)',
    iconBorder: 'rgba(239,68,68,0.18)',
    pillBg: 'rgba(239,68,68,0.1)',
    pillBorder: 'rgba(239,68,68,0.25)',
    remindBorder: 'rgba(239,68,68,0.25)',
    remindBg: 'rgba(239,68,68,0.04)',
    viewDetailsBorder: 'rgba(239,68,68,0.3)',
  },
  needs_attention: {
    primary: '#FFEA00',
    accentGradient: ['#FFEA00', '#FFF59E', '#FFEA00'],
    buttonGradient: ['#FFEA00', '#E6D600'],
    buttonTextColor: '#1A1A00',
    iconBg: 'rgba(255,234,0,0.08)',
    iconBorder: 'rgba(255,234,0,0.18)',
    pillBg: 'rgba(255,234,0,0.1)',
    pillBorder: 'rgba(255,234,0,0.25)',
    remindBorder: 'rgba(255,234,0,0.25)',
    remindBg: 'rgba(255,234,0,0.04)',
    viewDetailsBorder: 'rgba(255,234,0,0.3)',
  },
};

function getServiceIcon(itemId: string, size: number, color: string) {
  const type = itemId.replace(/^(unknown-|user-|smartcar-)/, '');
  switch (type) {
    case 'oil': return <OilIcon size={size} color={color} />;
    case 'brakes': return <BrakesIcon size={size} color={color} />;
    case 'tires': return <TireIcon size={size} color={color} />;
    case 'battery': return <BatteryIcon size={size} color={color} />;
    default: return <WarningIcon size={size} color={color} />;
  }
}

// ============================================================================
// VEHICLE HEALTH RING COMPONENT (Apple Fitness Style)
// ============================================================================

interface VehicleHealthRingProps {
  percentage: number;
  size?: number;
}

function VehicleHealthRing({ percentage, size = 64 }: VehicleHealthRingProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  // Animation state
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // Animate the ring fill on mount
  useEffect(() => {
    setAnimatedProgress(0);
    
    const duration = 1200;
    const steps = 40;
    const stepDuration = duration / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      // Ease-out cubic animation
      const progress = 1 - Math.pow(1 - currentStep / steps, 3);
      setAnimatedProgress(progress * percentage);
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, [percentage]);
  
  const strokeDashoffset = circumference * (1 - animatedProgress / 100);
  
  // Determine ring color based on percentage
  const getRingColor = () => {
    if (percentage >= 80) return '#22C55E'; // Green
    if (percentage >= 60) return '#FFEA00'; // Yellow
    if (percentage >= 40) return '#F97316'; // Orange
    return '#EF4444'; // Red
  };
  
  const ringColor = getRingColor();
  
  return (
    <View style={ringStyles.container}>
      <Svg width={size} height={size}>
        {/* Background ring (gray track) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground ring (colored progress) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      {/* Percentage text in center */}
      <View style={[ringStyles.centerText, { width: size, height: size }]}>
        <Text weight="bold" size="md" style={{ color: ringColor }}>
          {Math.round(animatedProgress)}%
        </Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ============================================================================
// GROUP LABELS
// ============================================================================

function NeedsAttentionLabel() {
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
    ),
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(1.4, { duration: 1000 }),
            withTiming(1, { duration: 1000 }),
          ),
          -1,
        ),
      },
    ],
  }));

  return (
    <View style={groupLabelStyles.needsAttentionRow}>
      <Animated.View style={[groupLabelStyles.pulseDot, pulseStyle]} />
      <Text
        weight="bold"
        style={groupLabelStyles.needsAttentionText}
      >
        NEEDS ATTENTION
      </Text>
    </View>
  );
}

function OverdueLabel() {
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
    ),
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(1.4, { duration: 1000 }),
            withTiming(1, { duration: 1000 }),
          ),
          -1,
        ),
      },
    ],
  }));

  return (
    <View style={groupLabelStyles.overdueRow}>
      <Animated.View style={[groupLabelStyles.overdueDot, pulseStyle]} />
      <Text
        weight="bold"
        style={groupLabelStyles.overdueText}
      >
        OVERDUE
      </Text>
    </View>
  );
}

function AllGoodLabel() {
  return (
    <View style={groupLabelStyles.allGoodRow}>
      <Svg width={14} height={14} viewBox="0 0 14 14">
        <Circle cx={7} cy={7} r={7} fill="rgba(52, 199, 89, 0.15)" />
        <Path
          d="M4 7.2L6.2 9.4L10 4.6"
          stroke="#34C759"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </Svg>
      <Text
        weight="bold"
        style={groupLabelStyles.allGoodText}
      >
        ALL GOOD
      </Text>
    </View>
  );
}

// ============================================================================
// URGENT CARD COMPONENT
// ============================================================================

interface UrgentCardProps {
  item: MaintenanceItem;
  entryDelay: number;
  onBookNow?: (id: string) => void;
  onAddInfo?: (id: string) => void;
  onCardPress?: (item: MaintenanceItem) => void;
}

function UrgentCard({ item, entryDelay, onBookNow, onAddInfo, onCardPress }: UrgentCardProps) {
  const theme = URGENT_THEME[item.status]!;
  const statusLabel = STATUS_CONFIG[item.status].label;

  // Press scale animation
  const cardScale = useSharedValue(1);

  // Entry animation
  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(18);
  useEffect(() => {
    entryOpacity.value = withDelay(
      entryDelay,
      withTiming(1, { duration: 550, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
    entryTranslateY.value = withDelay(
      entryDelay,
      withTiming(0, { duration: 550, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
  }, []);
  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [{ translateY: entryTranslateY.value }, { scale: cardScale.value }],
  }));

  // Pulsing pill glow
  const pillGlowStyle = useAnimatedStyle(() => ({
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 8,
    shadowOpacity: withRepeat(
      withSequence(
        withTiming(0.15, { duration: 1500 }),
        withTiming(0, { duration: 1500 }),
      ),
      -1,
    ),
  }));

  const handlePress = () => {
    if (onCardPress) {
      onCardPress(item);
    } else {
      onBookNow?.(item.id);
    }
  };

  return (
    <Pressable
      onPressIn={() => { cardScale.value = withSpring(0.98, { damping: 20, stiffness: 300 }); }}
      onPressOut={() => { cardScale.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          ucStyles.container,
          entryStyle,
        ]}
      >
        {/* Glassy layers — tuned for the cars page's lighter background */}
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.25)']}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          locations={[0, 0.2, 0.5]}
          style={ucStyles.glossyHighlight}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
          locations={[0, 0.15, 0.4]}
          style={ucStyles.glossyShine}
        />

        {/* Card content (above glass layers) */}
        <View style={ucStyles.cardContent} pointerEvents="box-none">
        {/* Top section: icon + title centered */}
        <View style={ucStyles.topSection}>
          <View
            style={[
              ucStyles.iconBox,
              { backgroundColor: theme.iconBg, borderColor: theme.iconBorder },
            ]}
          >
            {getServiceIcon(item.id, 28, '#000000')}
          </View>
          <Text
            weight="bold"
            style={[ucStyles.serviceName, { fontFamily: FontFamily.serifBold }]}
          >
            {item.serviceName}
          </Text>
        </View>

        {/* Description */}
        <Text weight="medium" style={ucStyles.detailText}>
          {item.description}
        </Text>

        {/* Action buttons */}
        <View style={ucStyles.buttonRow}>
          <Pressable
            style={({ pressed }) => [ucStyles.bookBtn, { shadowColor: theme.primary }, pressed && { opacity: 0.9 }]}
            onPress={() => onBookNow?.(item.id)}
          >
            <LinearGradient
              colors={theme.buttonGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={ucStyles.bookBtnInner}
            >
              <Text weight="semiBold" style={[ucStyles.bookBtnText, { color: theme.buttonTextColor, fontFamily: FontFamily.serifBold }]}>
                Book Service
              </Text>
            </LinearGradient>
          </Pressable>
          <Pressable
            style={({ pressed }) => [ucStyles.viewDetailsBtn, pressed && { opacity: 0.8 }]}
            onPress={() => onCardPress?.(item)}
          >
            <Text weight="semiBold" style={ucStyles.viewDetailsBtnText}>
              View Details
            </Text>
          </Pressable>
        </View>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ============================================================================
// HEALTHY CARD COMPONENT
// ============================================================================

interface HealthyTheme {
  primary: string;
  iconBg: string;
  iconBorder: string;
  remindBorder: string;
  dotColor: string;
}

const HEALTHY_THEME: Record<'on_time' | 'unknown', HealthyTheme> = {
  on_time: {
    primary: '#34C759',
    iconBg: 'rgba(52,199,89,0.06)',
    iconBorder: 'rgba(52,199,89,0.15)',
    remindBorder: 'rgba(52,199,89,0.18)',
    dotColor: '#34C759',
  },
  unknown: {
    primary: '#6B7280',
    iconBg: 'rgba(107,114,128,0.06)',
    iconBorder: 'rgba(107,114,128,0.15)',
    remindBorder: 'rgba(107,114,128,0.18)',
    dotColor: '#6B7280',
  },
};

interface HealthyCardProps {
  item: MaintenanceItem;
  entryDelay: number;
  onBookNow?: (id: string) => void;
  onAddInfo?: (id: string) => void;
}

function HealthyCard({ item, entryDelay, onBookNow, onAddInfo }: HealthyCardProps) {
  const themeKey = item.status === 'unknown' ? 'unknown' : 'on_time';
  const theme = HEALTHY_THEME[themeKey];

  // Press scale
  const cardScale = useSharedValue(1);

  // Entry animation
  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(18);
  useEffect(() => {
    entryOpacity.value = withDelay(
      entryDelay,
      withTiming(1, { duration: 550, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
    entryTranslateY.value = withDelay(
      entryDelay,
      withTiming(0, { duration: 550, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
  }, []);
  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [{ translateY: entryTranslateY.value }, { scale: cardScale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => { cardScale.value = withSpring(0.98, { damping: 20, stiffness: 300 }); }}
      onPressOut={() => { cardScale.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
      onPress={() => {
        if (item.status === 'unknown') onAddInfo?.(item.id);
        else onBookNow?.(item.id);
      }}
    >
      <Animated.View style={[hcStyles.container, entryStyle]}>
        {/* Glassy layers — tuned for the cars page's lighter background */}
        <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.25)']}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0.18)', 'rgba(255,255,255,0)']}
          locations={[0, 0.2, 0.5]}
          style={hcStyles.glossyHighlight}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0)', 'rgba(255,255,255,0)']}
          locations={[0, 0.15, 0.4]}
          style={hcStyles.glossyShine}
        />

        {/* Main horizontal row */}
        <View style={[hcStyles.row, { zIndex: 1 }]}>
          {/* Icon area */}
          <View style={hcStyles.iconWrap}>
            <View style={[hcStyles.iconBox, { backgroundColor: theme.iconBg, borderColor: theme.iconBorder }]}>
              {getServiceIcon(item.id, 22, theme.primary)}
            </View>
            <View style={[hcStyles.statusDot, { backgroundColor: theme.dotColor, shadowColor: theme.dotColor }]} />
          </View>

          {/* Content */}
          <View style={hcStyles.content}>
            <Text weight="semiBold" style={[hcStyles.serviceName, { fontFamily: FontFamily.serifSemiBold }]}>
              {item.serviceName}
            </Text>
            <Text weight="medium" style={hcStyles.remainingText}>
              {item.description}
            </Text>
          </View>

          {/* Remind / Add Info button */}
          <Pressable
            style={({ pressed }) => [
              hcStyles.remindBtn,
              { borderColor: theme.remindBorder },
              pressed && { opacity: 0.7 },
            ]}
            onPress={(e) => {
              e.stopPropagation?.();
              if (item.status === 'unknown') onAddInfo?.(item.id);
              else Alert.alert('Reminder Set!');
            }}
          >
            <Text weight="semiBold" style={[hcStyles.remindBtnText, { color: theme.primary }]}>
              {item.status === 'unknown' ? 'Add Info' : 'Remind'}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MaintenanceTracker({ items, vehicleCondition, healthScoreInput, onBookNow, onAddInfo, onEditPressed }: MaintenanceTrackerProps) {
  const [selectedItem, setSelectedItem] = useState<MaintenanceItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  const handleCardPress = (item: MaintenanceItem) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  const handleModalClosed = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };

  const overdueItems = items
    .filter(i => i.status === 'overdue')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

  const urgentItems = items
    .filter(i => i.status === 'due_soon' || i.status === 'needs_attention')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

  const healthyItems = items
    .filter(i => i.status === 'on_time' || i.status === 'unknown')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

  const overdueBaseDelay = 0;
  const urgentBaseDelay = overdueItems.length * 80 + 150;
  const healthyBaseDelay = (overdueItems.length + urgentItems.length) * 80 + 300;

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text weight="bold" color="#0F172A" style={{ fontSize: 22, fontFamily: FontFamily.serifBold }}>
          Maintenance Tracker
        </Text>
        {onEditPressed && (
          <Pressable onPress={onEditPressed} style={({ pressed }) => [styles.editHeaderButton, pressed && { opacity: 0.7 }]}>
            <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.25)']}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.15)', 'rgba(255,255,255,0)']}
              locations={[0, 0.35, 0.7]}
              style={styles.editButtonGloss}
            />
            <Ionicons name="create-outline" size={15} color="#5299FE" style={{ zIndex: 1 }} />
            <Text weight="bold" style={styles.editHeaderButtonText}>Update Info</Text>
          </Pressable>
        )}
      </View>

      {/* Empty state */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text weight="medium" size="md" color="#829BAD">
            No maintenance items yet.
          </Text>
          <Text size="sm" color="#829BAD" style={{ opacity: 0.7 }}>
            We&apos;ll show your services here once you add them.
          </Text>
        </View>
      ) : (
        <>
          {/* Group 1: Overdue */}
          {overdueItems.length > 0 && (
            <>
              <OverdueLabel />
              <View style={styles.urgentGroup}>
                {overdueItems.map((item, index) => (
                  <UrgentCard
                    key={item.id}
                    item={item}
                    entryDelay={overdueBaseDelay + index * 80}
                    onBookNow={onBookNow}
                    onAddInfo={onAddInfo}
                    onCardPress={handleCardPress}
                  />
                ))}
              </View>
            </>
          )}

          {/* Group 2: Needs Attention */}
          {urgentItems.length > 0 && (
            <>
              <NeedsAttentionLabel />
              <View style={styles.urgentGroup}>
                {urgentItems.map((item, index) => (
                  <UrgentCard
                    key={item.id}
                    item={item}
                    entryDelay={urgentBaseDelay + index * 80}
                    onBookNow={onBookNow}
                    onAddInfo={onAddInfo}
                    onCardPress={handleCardPress}
                  />
                ))}
              </View>
            </>
          )}

        </>
      )}

      {/* Detail modal for urgent cards */}
      {selectedItem && (
        <MaintenanceDetailView
          item={selectedItem}
          visible={modalVisible}
          currentHealthScore={vehicleCondition ?? 0}
          projectedHealthScore={
            healthScoreInput
              ? computeProjectedHealthScore(healthScoreInput, selectedItem.id)
              : (vehicleCondition ?? 0) + 8
          }
          onClose={handleModalClosed}
          onBookService={() => {
            handleModalClosed();
            onBookNow?.(selectedItem.id);
          }}
        />
      )}
    </View>
  );
}


// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.65)',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  urgentGroup: {
    paddingHorizontal: 20,
    gap: 12,
  },
  healthyGroup: {
    paddingHorizontal: 20,
    gap: 10,
  },
  editHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 15,
    paddingVertical: 7,
    paddingHorizontal: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  editButtonGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    borderRadius: 14,
  },
  editHeaderButtonText: {
    color: '#5299FE',
    fontSize: 13,
    zIndex: 1,
  },
});

const ucStyles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 22,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  glossyHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  glossyShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
  },
  cardContent: {
    padding: 20,
    position: 'relative',
    zIndex: 1,
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  serviceName: {
    fontSize: 18,
    color: '#0F172A',
  },
  pill: {
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  pillText: {
    fontSize: 10.5,
    letterSpacing: 0.03 * 10.5,
    textTransform: 'uppercase',
  },
  detailText: {
    fontSize: 14,
    color: '#5A7A94',
    lineHeight: 19,
    marginTop: 8,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  bookBtn: {
    flex: 1,
    borderRadius: 24,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 4,
  },
  bookBtnInner: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  bookBtnText: {
    fontSize: 15,
    color: '#FFFFFF',
  },
  viewDetailsBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  viewDetailsBtnText: {
    fontSize: 14,
    color: '#829BAD',
  },
  remindBtn: {
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remindBtnText: {
    fontSize: 13.5,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
  },
  tapHintText: {
    fontSize: 11,
    color: '#A3B5C4',
  },
});

const groupLabelStyles = StyleSheet.create({
  needsAttentionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFEA00',
  },
  needsAttentionText: {
    fontSize: 14,
    color: '#B8A300',
    letterSpacing: 1.12,
    textTransform: 'uppercase',
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 20,
    marginTop: 4,
    marginBottom: 8,
  },
  overdueDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  overdueText: {
    fontSize: 14,
    color: '#EF4444',
    letterSpacing: 1.12,
    textTransform: 'uppercase',
  },
  allGoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 20,
    marginTop: 16,
    marginBottom: 8,
  },
  allGoodText: {
    fontSize: 14,
    color: '#34C759',
    letterSpacing: 1.12,
    textTransform: 'uppercase',
  },
});

const hcStyles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderRadius: 16,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  glossyHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  glossyShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  iconWrap: {
    position: 'relative',
    marginRight: 12,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#fff',
    shadowOpacity: 0.4,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  content: {
    flex: 1,
  },
  serviceName: {
    fontSize: 15,
    color: '#0F172A',
  },
  remainingText: {
    fontSize: 12.5,
    color: '#5A7A94',
    marginTop: 1,
  },
  remindBtn: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1.5,
    marginLeft: 6,
  },
  remindBtnText: {
    fontSize: 11.5,
  },
});

export default MaintenanceTracker;
