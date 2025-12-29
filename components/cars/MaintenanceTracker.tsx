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
import { StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

// 3. Shared UI
import { Button, Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export type MaintenanceStatus = 'on_time' | 'due_soon' | 'overdue' | 'unknown';

export interface MaintenanceItem {
  id: string;
  serviceName: string;
  description: string;
  // e.g. "Mar 2025", "Aug 2025", "Unknown"
  detail: string;
  status: MaintenanceStatus;
}

interface MaintenanceTrackerProps {
  items: MaintenanceItem[];
  onBookNow?: (id: string) => void;
  onAddInfo?: (id: string) => void;
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

// Status priority for sorting (lower number = higher priority)
const STATUS_PRIORITY: Record<MaintenanceStatus, number> = {
  overdue: 0,
  due_soon: 1,
  on_time: 2,
  unknown: 3,
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
  due_soon: {
    label: 'Due Soon',
    badgeBg: '#FDEAD7',
    badgeText: '#f89829',
    iconBg: '#FFEDD5',
    iconColor: '#FDBA74',
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
// COMPONENT
// ============================================================================

export function MaintenanceTracker({ items, onBookNow, onAddInfo }: MaintenanceTrackerProps) {
  // Sort items by status priority: overdue → due_soon → on_time → unknown
  const sortedItems = [...items].sort(
    (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]
  );

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerRow}>
        <Text weight="semiBold" size="lg" color={Colors.light.text}>
          Maintenance Tracker
        </Text>
        {/* Optional "View All" link placeholder for future */}
        {/* <Text size="sm" color={BrandColors.secondary}>View All</Text> */}
      </View>

      {/* Empty state */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text weight="medium" size="md" color="#6B7280">
            No maintenance items yet.
          </Text>
          <Text size="sm" color="#9CA3AF">
            We&apos;ll show your services here once you add them.
          </Text>
        </View>
      ) : (
        sortedItems.map((item) => {
          const config = STATUS_CONFIG[item.status];
          const isUnknown = item.status === 'unknown';

          const handlePrimaryPress = () => {
            if (isUnknown) {
              onAddInfo?.(item.id);
            } else {
              onBookNow?.(item.id);
            }
          };

          return (
            <View key={item.id} style={styles.card}>
              {/* Two-column layout: Left content + Right actions */}
              <View style={styles.cardRow}>
                {/* Left Column: Title + Detail section */}
                <View style={styles.leftColumn}>
                  {/* Title */}
                  <Text weight="semiBold" size="2xl" color={Colors.light.text}>
                    {item.serviceName}
                  </Text>

                  {/* Detail row: Status Icon + Description + Detail */}
                  <View style={styles.detailSection}>
                    {item.status !== 'unknown' && <StatusIcon key={item.id} itemId={item.id} status={item.status} />}
                    <View style={styles.detailTextContainer}>
                      <Text size="sm" color="#6B7280">
                        {item.description}
                      </Text>
                      <Text weight="medium" size="sm" color={Colors.light.text}>
                        {item.detail}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Right Column: Badge + Button stacked */}
                <View style={styles.rightColumn}>
                  <View style={[styles.badge, { backgroundColor: config.badgeBg }]}>
                    <Text weight="medium" size="xs" color={config.badgeText}>
                      {config.label}
                    </Text>
                  </View>

                  {isUnknown ? (
                    <Button
                      variant="ghost"
                      onPress={handlePrimaryPress}
                      style={styles.outlinedButton}
                    >
                      <Text weight="medium" size="xs" color={Colors.light.text}>
                        Add Info
                      </Text>
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      onPress={handlePrimaryPress}
                      style={styles.primaryButton}
                    >
                        <Text weight="medium" size="sm" color="#FFFFFF">
                        Book Now
                      </Text>
                    </Button>
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

// Small helper component for status icon (circular progress indicators with animation)
function StatusIcon({ 
  status, 
  size = 32,
  itemId,
}: { 
  status: MaintenanceStatus; 
  size?: number;
  itemId: string;
}) {
  const config = STATUS_CONFIG[status];
  const strokeWidth = 4;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Animation progress state (0 to 1)
  const [animationProgress, setAnimationProgress] = useState(0);

  // Animate when component mounts - use itemId to ensure each icon animates independently
  useEffect(() => {
    // Only animate for due_soon and on_time statuses
    if (status !== 'due_soon' && status !== 'on_time') {
      return;
    }

    // Reset animation progress
    setAnimationProgress(0);

    let intervalId: ReturnType<typeof setInterval> | null = null;

    // Small delay before starting animation (stagger based on itemId for visual effect)
    const delayMs = 200;
    const startDelay = setTimeout(() => {
      const duration = 800; // ms
      const steps = 30; // number of animation frames
      const stepDuration = duration / steps;
      let currentStep = 0;

      intervalId = setInterval(() => {
        currentStep++;
        // Ease-out animation curve
        const progress = 1 - Math.pow(1 - currentStep / steps, 3);
        setAnimationProgress(progress);

        if (currentStep >= steps) {
          if (intervalId) clearInterval(intervalId);
        }
      }, stepDuration);
    }, delayMs);

    // Cleanup function
    return () => {
      clearTimeout(startDelay);
      if (intervalId) clearInterval(intervalId);
    };
  }, [status, itemId]);

  // Overdue: solid circle with alert icon
  if (status === 'overdue') {
    return (
      <View style={[styles.statusIconContainer, { width: size, height: size }]}>
        <View
          style={[
            styles.overdueCircle,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: config.badgeBg,
            },
          ]}
        >
          <Ionicons name="alert" size={size * 0.5} color={config.badgeText} />
        </View>
      </View>
    );
  }

  // Unknown: grey empty circle
  if (status === 'unknown') {
    return (
      <View style={[styles.statusIconContainer, { width: size, height: size }]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={config.iconColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray="4 4"
          />
        </Svg>
      </View>
    );
  }

  // Due soon / on time: animated partial arc
  const targetProgress = 0.65;
  // Calculate current strokeDashoffset based on animation progress
  // Start from full circumference (empty) and animate to target
  const currentProgress = targetProgress * animationProgress;
  const strokeDashoffset = circumference * (1 - currentProgress);

  return (
    <View style={[styles.statusIconContainer, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Animated progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={config.iconColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
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
  },
  emptyState: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: BorderRadius.lg,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    gap: 4,
  },
  card: {
    backgroundColor: '#f9fafc',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    marginBottom: 8,
    ...Shadows.sm,
  },
  cardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leftColumn: {
    flex: 1,
    justifyContent: 'center',
    gap: 6,
    paddingLeft: Spacing.xs,
  },
  rightColumn: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 10,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  detailSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: Spacing.xs,
  },
  detailTextContainer: {
    flex: 1,
    gap: 2,
  },
  statusIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueCircle: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButton: {
    paddingHorizontal: 7,
    paddingVertical: 6,
    borderRadius: 8,
    minWidth: 65,
  },
  outlinedButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    minWidth: 65,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
});

export default MaintenanceTracker;


