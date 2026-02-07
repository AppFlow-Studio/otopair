/**
 * LiveTrackerCard
 *
 * PURPOSE: Displays real-time service progress with vehicle info, mechanic details, progress bar, expandable service status timeline, and action buttons
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - tracking (LiveTracking): The live tracking object containing service progress and details
 *   - onReschedule (() => void): Called when "Reschedule" button is pressed [optional]
 *   - onContactShop (() => void): Called when "Contact Shop" button is pressed [optional]
 *
 * EXAMPLE:
 *   <LiveTrackerCard
 *     tracking={liveTrackingData}
 *     onReschedule={() => router.push('/reschedule')}
 *     onContactShop={() => Linking.openURL(`tel:${shopPhone}`)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { Check, ChevronDown, Clock, Phone } from 'lucide-react-native';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withTiming, 
  Easing,
  interpolate,
} from 'react-native-reanimated';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceStage {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'current' | 'pending';
}

export interface LiveTracking {
  id: string;
  // Car info
  carModel: string;
  carYear: string;
  licensePlate: string;
  // Mechanic info
  mechanicName: string;
  shopName: string;
  mechanicImage?: string;
  shopPhone?: string;
  // Progress
  currentStage: string;
  progressPercent: number;
  stages: ServiceStage[];
  // Delay info
  delayMinutes?: number;
}

interface LiveTrackerCardProps {
  tracking: LiveTracking;
  onReschedule?: () => void;
  onContactShop?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LiveTrackerCard({ 
  tracking, 
  onReschedule,
  onContactShop,
}: LiveTrackerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const animationProgress = useSharedValue(0);

  const toggleExpanded = () => {
    const newValue = !isExpanded;
    setIsExpanded(newValue);
    animationProgress.value = withTiming(newValue ? 1 : 0, {
      duration: 450,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  };

  // Animated style for the chevron rotation
  const chevronAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { rotate: `${interpolate(animationProgress.value, [0, 1], [0, 180])}deg` },
      ],
    };
  });

  // Animated style for the content container
  const contentAnimatedStyle = useAnimatedStyle(() => {
    return {
      opacity: animationProgress.value,
      maxHeight: interpolate(animationProgress.value, [0, 1], [0, 500]),
      marginTop: interpolate(animationProgress.value, [0, 1], [0, 20]),
    };
  });

  const renderStageIcon = (status: ServiceStage['status']) => {
    switch (status) {
      case 'completed':
        return (
          <View style={styles.stageIconCompleted}>
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          </View>
        );
      case 'current':
        return (
          <View style={styles.stageIconCurrent}>
            <Clock size={12} color="#FFFFFF" strokeWidth={2} />
          </View>
        );
      case 'pending':
        return (
          <View style={styles.stageIconPending}>
            <Check size={14} color="#D1D5DB" strokeWidth={2} />
          </View>
        );
    }
  };

  return (
    <View style={styles.card}>
      {/* In Progress Badge */}
      <View style={styles.progressBadge}>
        <Text weight="semiBold" size="sm" color="#5299FE">
          In Progress...
        </Text>
      </View>

      {/* Car and Mechanic Info Row */}
      <View style={styles.infoRow}>
        {/* Car Info */}
        <View style={styles.carInfo}>
          <Image 
            source={require('@/assets/images/bmwm5.png')} 
            style={styles.carImage}
            resizeMode="contain"
          />
          <View style={styles.carDetails}>
            <Text weight="bold" size="sm" color="#1F2937">
              {tracking.carModel} {tracking.carYear}
            </Text>
            <Text weight="regular" size="xs" color="#6B7280">
              {tracking.licensePlate}
            </Text>
          </View>
        </View>

        {/* Mechanic Info */}
        <View style={styles.mechanicInfo}>
          <Image 
            source={{ uri: tracking.mechanicImage || 'https://randomuser.me/api/portraits/men/32.jpg' }} 
            style={styles.mechanicImage}
          />
          <View style={styles.mechanicDetails}>
            <Text weight="bold" size="sm" color="#1F2937">
              {tracking.mechanicName}
            </Text>
            <Text weight="regular" size="xs" color="#6B7280">
              {tracking.shopName}
            </Text>
          </View>
        </View>
      </View>

      {/* Progress Section */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text weight="semiBold" size="sm" color="#5299FE">
            {tracking.currentStage}
          </Text>
          <Text weight="semiBold" size="sm" color="#5299FE">
            {tracking.progressPercent}%
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${tracking.progressPercent}%` }]} />
        </View>
      </View>

      {/* Service Status Section */}
      <View style={styles.serviceStatusContainer}>
        <Pressable onPress={toggleExpanded} style={styles.serviceStatusHeader}>
          <View style={styles.serviceStatusTitleRow}>
            <View style={styles.greenDot} />
            <Text weight="bold" size="lg" color="#1F2937">
              Service Status
            </Text>
          </View>
          <Animated.View style={chevronAnimatedStyle}>
            <ChevronDown size={24} color="#6B7280" />
          </Animated.View>
        </Pressable>

        <Animated.View style={[styles.stagesContainer, contentAnimatedStyle]}>
          {tracking.stages.map((stage, index) => (
            <View key={stage.id} style={styles.stageRow}>
              <View style={styles.stageIconColumn}>
                {renderStageIcon(stage.status)}
                {index < tracking.stages.length - 1 && (
                  <View style={[
                    styles.stageLine,
                    stage.status === 'completed' && styles.stageLineCompleted,
                  ]} />
                )}
              </View>
              <View style={styles.stageContent}>
                <Text 
                  weight="bold" 
                  size="sm" 
                  color={stage.status === 'pending' ? '#9CA3AF' : '#1F2937'}
                >
                  {stage.title}
                </Text>
                <Text 
                  weight="regular" 
                  size="xs" 
                  color={stage.status === 'pending' ? '#D1D5DB' : '#6B7280'}
                >
                  {stage.description}
                </Text>
              </View>
            </View>
          ))}
        </Animated.View>
      </View>

      {/* Delay Notification */}
      {tracking.delayMinutes && tracking.delayMinutes > 0 && (
        <Text weight="regular" size="sm" color="#1F2937" style={styles.delayText}>
          Your service is running{' '}
          <Text weight="semiBold" size="sm" color="#EF4444">
            {tracking.delayMinutes} min late
          </Text>
        </Text>
      )}

      {/* Reschedule Button */}
      <Pressable
        onPress={onReschedule}
        style={({ pressed }) => [
          styles.rescheduleButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Text weight="semiBold" size="sm" color="#1F2937">
          Reschedule
        </Text>
      </Pressable>

      {/* Contact Shop Section */}
      <Text weight="regular" size="sm" color="#1F2937" style={styles.contactLabel}>
        Contact Shop:
      </Text>
      <Pressable
        onPress={onContactShop}
        style={({ pressed }) => [
          styles.contactButton,
          pressed && styles.buttonPressed,
        ]}
      >
        <Phone size={20} color="#FFFFFF" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#5299FE',
  },
  progressBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DBEAFE',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  carInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  carImage: {
    width: 50,
    height: 32,
    marginRight: 8,
  },
  carDetails: {
    gap: 2,
  },
  mechanicInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  mechanicImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  mechanicDetails: {
    gap: 2,
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#5299FE',
    borderRadius: 3,
  },
  serviceStatusContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  serviceStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  serviceStatusTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22C55E',
  },
  stagesContainer: {
    overflow: 'hidden',
  },
  stageRow: {
    flexDirection: 'row',
    minHeight: 60,
  },
  stageIconColumn: {
    width: 30,
    alignItems: 'center',
  },
  stageIconCompleted: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#5299FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageIconCurrent: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#5299FE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageIconPending: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 4,
  },
  stageLineCompleted: {
    backgroundColor: '#5299FE',
  },
  stageContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
  },
  delayText: {
    marginBottom: 12,
  },
  rescheduleButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    marginBottom: 16,
  },
  contactLabel: {
    marginBottom: 8,
  },
  contactButton: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#1F2937',
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
});

export default LiveTrackerCard;

