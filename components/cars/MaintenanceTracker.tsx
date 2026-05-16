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
import { Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

// Native iOS 26 liquid-glass for the "Update Info" button. Falls back
// gracefully on iOS < 26 / Android / Expo Go to the BlurView + gradient
// chrome below.
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require('@callstack/liquid-glass');
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch {
  // Native module unavailable — fallback chrome will render.
}
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
import { computeProjectedHealthScore, type HealthScoreInput } from '@/utils/healthScore';
import { scale, moderateScale } from '@/utils/responsive';

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
  /** Parent has determined the page bg is dark enough that the
   *  "Maintenance Tracker" header must flip to light to stay readable. */
  isDarkBg?: boolean;
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

// ============================================================================
// CARD COLOR MAPPING
// ============================================================================

const CARD_COLORS: Partial<Record<MaintenanceStatus, { statusColor: string; iconBg: string }>> = {
  overdue: {
    statusColor: '#5299FE',
    iconBg: 'rgba(82, 153, 254, 0.07)',
  },
  needs_attention: {
    statusColor: '#5299FE',
    iconBg: 'rgba(82, 153, 254, 0.07)',
  },
  due_soon: {
    statusColor: '#5299FE',
    iconBg: 'rgba(82, 153, 254, 0.07)',
  },
};

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
    if (percentage >= 60) return '#F5C623'; // Yellow
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
    <View style={groupLabelStyles.row}>
      <Animated.View style={[groupLabelStyles.overdueDot, pulseStyle]} />
      <Text weight="bold" style={groupLabelStyles.overdueText}>OVERDUE</Text>
    </View>
  );
}

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
    <View style={groupLabelStyles.row}>
      <Animated.View style={[groupLabelStyles.needsAttentionDot, pulseStyle]} />
      <Text weight="bold" style={groupLabelStyles.needsAttentionText}>NEEDS ATTENTION</Text>
    </View>
  );
}

// ============================================================================
// URGENT CARD COMPONENT
// ============================================================================

interface UrgentCardProps {
  item: MaintenanceItem;
  entryDelay: number;
  vehicleCondition: number;
  healthScoreInput?: HealthScoreInput;
  onBookNow?: (id: string) => void;
  onAddInfo?: (id: string) => void;
  onCardPress?: (item: MaintenanceItem) => void;
}

function UrgentCard({ item, entryDelay, vehicleCondition, healthScoreInput, onBookNow, onCardPress }: UrgentCardProps) {
  const colors = CARD_COLORS[item.status] ?? { statusColor: '#5299FE', iconBg: 'rgba(82,153,254,0.07)' };

  const delta = healthScoreInput
    ? Math.round(computeProjectedHealthScore(healthScoreInput, item.id) - vehicleCondition)
    : 0;

  const cardScale = useSharedValue(1);

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
      onPress={() => onCardPress ? onCardPress(item) : onBookNow?.(item.id)}
    >
      <Animated.View style={[cardStyles.container, entryStyle]}>
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.iconContainer, { backgroundColor: colors.iconBg }]}>
            {getServiceIcon(item.id, 24, colors.statusColor)}
          </View>
          <View style={cardStyles.textColumn}>
            <Text weight="bold" style={cardStyles.title}>{item.serviceName}</Text>
            <Text style={cardStyles.subtitle}>{item.description}</Text>
          </View>
          {delta > 0 && (
            <View style={cardStyles.scoreColumn}>
              <View style={cardStyles.scoreRow}>
                <Text style={cardStyles.scoreNumber}>+{delta}</Text>
                <Text style={cardStyles.scorePercent}>%</Text>
              </View>
            </View>
          )}
        </View>
        <View style={cardStyles.buttonRow}>
          <Pressable
            style={({ pressed }) => [cardStyles.bookServiceBtn, pressed && { opacity: 0.85 }]}
            onPress={() => onBookNow?.(item.id)}
          >
            <Text weight="semiBold" style={cardStyles.bookServiceText}>Book Service</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [cardStyles.viewDetailsBtn, pressed && { opacity: 0.85 }]}
            onPress={() => onCardPress?.(item)}
          >
            <Text weight="semiBold" style={cardStyles.viewDetailsText}>View Details</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ============================================================================
// HEALTHY ITEMS SECTION (expandable)
// ============================================================================

function HealthySection({ items, isDarkBg = false }: { items: MaintenanceItem[]; isDarkBg?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const chevronRotation = useSharedValue(0);

  if (items.length === 0) return null;

  const toggle = () => {
    setExpanded(prev => !prev);
    chevronRotation.value = withTiming(expanded ? 0 : 1, { duration: 200 });
  };

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }],
  }));

  return (
    <View>
      <Pressable onPress={toggle} style={({ pressed }) => pressed && { opacity: 0.7 }}>
        <View style={summaryStyles.headerRow}>
          <View style={summaryStyles.dot} />
          <Text
            weight="semiBold"
            style={[
              summaryStyles.headerText,
              isDarkBg && summaryStyles.headerTextOnDark,
            ]}
          >
            {items.length} {items.length === 1 ? 'item' : 'items'} healthy
          </Text>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
          </Animated.View>
        </View>
      </Pressable>

      {expanded && (
        <View style={summaryStyles.card}>
          {items.map((item, index) => (
            <View key={item.id}>
              <View style={summaryStyles.itemRow}>
                <View style={summaryStyles.itemIcon}>
                  {getServiceIcon(item.id, 20, '#5299FE')}
                </View>
                <View style={summaryStyles.itemContent}>
                  <Text weight="semiBold" style={summaryStyles.itemName}>{item.serviceName}</Text>
                  <Text style={summaryStyles.itemDesc}>{item.description}</Text>
                </View>
                <Ionicons name="checkmark-circle" size={18} color="#5299FE" />
              </View>
              {index < items.length - 1 && <View style={summaryStyles.separator} />}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MaintenanceTracker({ items, vehicleCondition, healthScoreInput, onBookNow, onAddInfo, onEditPressed, isDarkBg = false }: MaintenanceTrackerProps) {
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


  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text weight="bold" color={isDarkBg ? "#FFFFFF" : "#0F172A"} style={{ fontSize: moderateScale(22) }}>
          Maintenance Tracker
        </Text>
        {onEditPressed && (
          isLiquidGlassEnabled && LiquidGlassView ? (
            // Native iOS 26 liquid glass — Pressable carries no chrome
            // so the glass effect renders pure. Matches the Oto pill on
            // the AI chat header.
            <Pressable onPress={onEditPressed} style={({ pressed }) => pressed && { opacity: 0.7 }}>
              <LiquidGlassView interactive effect="regular" style={styles.editHeaderButtonGlass}>
                <Text weight="bold" style={styles.editHeaderButtonText}>Update Info</Text>
              </LiquidGlassView>
            </Pressable>
          ) : (
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
              <Text weight="bold" style={styles.editHeaderButtonText}>Update Info</Text>
            </Pressable>
          )
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
          {/* Overdue items */}
          {overdueItems.length > 0 && (
            <>
              <OverdueLabel />
              <View style={styles.urgentGroup}>
                {overdueItems.map((item, index) => (
                  <UrgentCard
                    key={item.id}
                    item={item}
                    entryDelay={overdueBaseDelay + index * 80}
                    vehicleCondition={vehicleCondition ?? 0}
                    healthScoreInput={healthScoreInput}
                    onBookNow={onBookNow}
                    onAddInfo={onAddInfo}
                    onCardPress={handleCardPress}
                  />
                ))}
              </View>
            </>
          )}

          {/* Needs attention / due soon items */}
          {urgentItems.length > 0 && (
            <>
              <NeedsAttentionLabel />
              <View style={styles.urgentGroup}>
                {urgentItems.map((item, index) => (
                  <UrgentCard
                    key={item.id}
                    item={item}
                    entryDelay={urgentBaseDelay + index * 80}
                    vehicleCondition={vehicleCondition ?? 0}
                    healthScoreInput={healthScoreInput}
                    onBookNow={onBookNow}
                    onAddInfo={onAddInfo}
                    onCardPress={handleCardPress}
                  />
                ))}
              </View>
            </>
          )}

          {/* Healthy items (expandable) */}
          <HealthySection items={healthyItems} isDarkBg={isDarkBg} />
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
    marginTop: scale(24),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
    paddingHorizontal: scale(20),
  },
  emptyState: {
    paddingVertical: scale(24),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(255,255,255,0.65)',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  urgentGroup: {
    paddingHorizontal: scale(20),
    gap: scale(12),
  },
  editHeaderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: moderateScale(15),
    paddingVertical: scale(7),
    paddingHorizontal: scale(14),
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  // Liquid-glass variant: no background, no border, no shadow — just
  // the radius + padding for the LiquidGlassView to wrap around. iOS 26
  // does the entire chrome natively.
  editHeaderButtonGlass: {
    borderRadius: moderateScale(15),
    paddingVertical: scale(7),
    paddingHorizontal: scale(14),
  },
  editButtonGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    borderRadius: moderateScale(14),
  },
  editHeaderButtonText: {
    color: '#5299FE',
    fontSize: moderateScale(13),
    zIndex: 1,
  },
});

// ============================================================================
// CARD STYLES
// ============================================================================

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(24),
    padding: scale(20),
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
  },
  iconContainer: {
    width: scale(46),
    height: scale(46),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
  },
  title: {
    fontSize: moderateScale(16),
    color: '#2d3435',
  },
  subtitle: {
    fontSize: moderateScale(12),
    color: '#757c7d',
    marginTop: 1,
  },
  scoreColumn: {
    alignItems: 'flex-end',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    fontSize: moderateScale(20),
    fontWeight: '300',
    color: '#34C759',
  },
  scorePercent: {
    fontSize: moderateScale(13),
    fontWeight: '300',
    color: '#34C759',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: scale(8),
    marginTop: scale(16),
  },
  bookServiceBtn: {
    flex: 1,
    backgroundColor: '#5299FE',
    paddingVertical: scale(12),
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookServiceText: {
    fontSize: moderateScale(14),
    color: '#FFFFFF',
  },
  viewDetailsBtn: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(22),
    backgroundColor: '#E4E9EA',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    fontSize: moderateScale(14),
    color: '#2d3435',
  },
});

// ============================================================================
// GROUP LABEL STYLES
// ============================================================================

const groupLabelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingLeft: scale(20),
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  overdueDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#EF4444',
  },
  overdueText: {
    fontSize: moderateScale(11),
    color: '#EF4444',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  needsAttentionDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#F5C623',
  },
  needsAttentionText: {
    fontSize: moderateScale(11),
    color: '#B8A300',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
});

// ============================================================================
// HEALTHY SUMMARY STYLES
// ============================================================================

const summaryStyles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(10),
    paddingVertical: scale(14),
    paddingHorizontal: scale(24),
    marginTop: scale(8),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#34C759',
  },
  headerText: {
    flex: 1,
    fontSize: moderateScale(15),
    color: '#2d3435',
  },
  // Used by HealthySection when the page bg is dark — keeps the
  // "N items healthy" label readable on saturated/dark gradients.
  headerTextOnDark: {
    color: '#FFFFFF',
  },
  card: {
    marginHorizontal: scale(20),
    marginTop: scale(4),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    paddingVertical: scale(6),
    paddingHorizontal: scale(16),
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: scale(12),
  },
  itemIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(52, 199, 89, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: moderateScale(14),
    color: '#2d3435',
  },
  itemDesc: {
    fontSize: moderateScale(11),
    color: '#757c7d',
    marginTop: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginLeft: scale(48),
  },
});

export default MaintenanceTracker;
