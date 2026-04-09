/**
 * LoyaltyPoints
 *
 * PURPOSE: Displays a "Loyalty Points" section that, when pressed, expands into
 *          a full-screen modal with a shared element transition and glassy blur effect.
 *          Shows user's points, tier status, and progress to next tier.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (below ServiceHistory on My Car page)
 *
 * PROPS:
 *   - totalPoints (number): Total loyalty points earned with this vehicle
 *   - currentTier (string): Current loyalty tier name (e.g., "Gold Member")
 *   - currentPoints (number): Points in current tier progress
 *   - pointsToNextTier (number): Points needed to reach next tier
 *   - nextTier (string): Next tier name (e.g., "Platinum")
 *   - maxPoints (number): Maximum points for current tier
 *   - onViewFullPage (() => void): Called when "View Full Loyalty Page" is pressed [optional]
 *
 * EXAMPLE:
 *   <LoyaltyPoints
 *     totalPoints={1240}
 *     currentTier="Gold Member"
 *     currentPoints={240}
 *     pointsToNextTier={260}
 *     nextTier="Platinum"
 *     maxPoints={500}
 *     onViewFullPage={() => router.push('/loyalty')}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Coins, Gift, Star, Trophy } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Flow-specific components
import SharedElementModal, { LayoutInfo } from './SharedElementModal';

// 5. Constants, hooks, types
import { BorderRadius, Colors, Shadows, Spacing } from '@/constants/theme';
import { scale, moderateScale } from '@/utils/responsive';

// ============================================================================
// TYPES
// ============================================================================

interface LoyaltyPointsProps {
  totalPoints?: number;
  currentTier?: string;
  currentPoints?: number;
  pointsToNextTier?: number;
  nextTier?: string;
  maxPoints?: number;
  onViewFullPage?: () => void;
}

// Milestone markers on the progress bar
const MILESTONES = [25, 100, 200, 300, 400];

// ============================================================================
// COMPONENT
// ============================================================================

export function LoyaltyPoints({
  totalPoints = 1240,
  currentTier = 'Gold Member',
  currentPoints = 240,
  pointsToNextTier = 260,
  nextTier = 'Platinum',
  maxPoints = 500,
  onViewFullPage,
}: LoyaltyPointsProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [layoutInfo, setLayoutInfo] = useState<LayoutInfo | null>(null);
  const cardRef = useRef<View>(null);

  // Measure the card position and open modal
  const handlePress = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      setLayoutInfo({ x, y, width, height });
      setModalVisible(true);
    });
  };

  // Close modal
  const handleClose = () => {
    setModalVisible(false);
  };

  // Check if a milestone is reached
  const isMilestoneReached = (milestone: number) => {
    return currentPoints >= milestone;
  };

  // Padding on each side (percentage)
  const PADDING = 10;
  const USABLE_WIDTH = 100 - PADDING * 2;

  // Get milestone position as percentage
  const getMilestonePosition = (index: number) => {
    return PADDING + (index / (MILESTONES.length - 1)) * USABLE_WIDTH;
  };

  // Get fill percentage based on which milestones are reached
  const getFillPercentage = () => {
    let lastReachedIndex = -1;
    for (let i = 0; i < MILESTONES.length; i++) {
      if (currentPoints >= MILESTONES[i]) {
        lastReachedIndex = i;
      }
    }

    if (lastReachedIndex === -1) return 0;
    if (lastReachedIndex === MILESTONES.length - 1)
      return getMilestonePosition(MILESTONES.length - 1);

    const nextMilestone = MILESTONES[lastReachedIndex + 1];
    const prevMilestone = MILESTONES[lastReachedIndex];
    const progressBetween =
      (currentPoints - prevMilestone) / (nextMilestone - prevMilestone);

    const basePercent = getMilestonePosition(lastReachedIndex);
    const nextPercent = getMilestonePosition(lastReachedIndex + 1);

    return basePercent + progressBetween * (nextPercent - basePercent);
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text weight="semiBold" size="lg" color={Colors.light.text}>
          Loyalty Points
        </Text>
      </View>

      {/* Pressable Card - triggers modal */}
      <Pressable
        ref={cardRef}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.cardOuter,
          pressed && styles.cardPressed,
        ]}
      >
        {/* Frosted glass blur layer */}
        <BlurView intensity={22} tint="light" style={styles.blurContainer}>
          {/* White overlay for frosted effect */}
          <View style={styles.whiteOverlay} />
        </BlurView>
        <View style={styles.collapsibleCard}>
          {/* Preview Header */}
          <View style={styles.headerSection}>
            <View style={styles.collapsibleHeader}>
              <View style={styles.headerLeft}>
                {/* Points Badge */}
                <View style={styles.pointsBadge}>
                  <Coins size={18} color="#5299FE" />
                  <Text weight="bold" size="md" color="#5299FE">
                    {totalPoints} points
                  </Text>
                </View>
                <Text size="sm" color={Colors.light.text}>
                  earned with this vehicle
                </Text>
              </View>

              {/* Arrow indicator */}
              <Ionicons
                name="chevron-forward"
                size={24}
                color="#D1D5DB"
              />
            </View>
          </View>
        </View>
      </Pressable>

      {/* Expanded Modal */}
      <SharedElementModal
        visible={modalVisible}
        layoutInfo={layoutInfo}
        onClose={handleClose}
        title="Loyalty Points"
      >
        {/* Points Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Coins size={24} color="#5299FE" />
              <Text weight="bold" size="xl" color={Colors.light.text}>
                {totalPoints}
              </Text>
              <Text size="sm" color="#6B7280">
                Total Points
              </Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryItem}>
              <Trophy size={24} color="#F59E0B" />
              <Text weight="bold" size="lg" color={Colors.light.text}>
                {currentTier}
              </Text>
              <Text size="sm" color="#6B7280">
                Current Tier
              </Text>
            </View>
          </View>
        </View>

        {/* Tier Badge Section */}
        <View style={styles.tierSection}>
          <LinearGradient
            colors={['#fdf4b2', '#f8d34b']}
            style={styles.tierBadge}
          >
            <Star size={32} color="#fffbdf" fill="#fffbdf" />
          </LinearGradient>
          <View style={styles.tierInfo}>
            <Text weight="bold" size="xl" color="#1F2937">
              {currentTier}
            </Text>
            <Text size="sm" color="#6B7280">
              {pointsToNextTier} points to {nextTier}
            </Text>
          </View>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text weight="medium" size="sm" color="#1F2937">
              Progress to {nextTier}
            </Text>
            <Text weight="semiBold" size="sm" color="#5299FE">
              {currentPoints}/{maxPoints}
            </Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            <View style={styles.progressTrack} />
            <View
              style={[styles.progressFill, { width: `${getFillPercentage()}%` }]}
            />

            {/* Milestone Markers */}
            {MILESTONES.map((milestone, index) => (
              <View
                key={milestone}
                style={[
                  styles.milestoneMarker,
                  { left: `${getMilestonePosition(index)}%` },
                ]}
              >
                <View
                  style={[
                    styles.milestoneDot,
                    isMilestoneReached(milestone) && styles.milestoneDotReached,
                  ]}
                />
                <Text
                  size="xs"
                  weight="semiBold"
                  color="#1F2937"
                  style={styles.milestoneLabel}
                >
                  {milestone}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Rewards Section */}
        <View style={styles.rewardsSection}>
          <Text weight="semiBold" size="lg" color={Colors.light.text}>
            Available Rewards
          </Text>
          
          <View style={styles.rewardsList}>
            <View style={styles.rewardItem}>
              <View style={styles.rewardIcon}>
                <Gift size={20} color="#5299FE" />
              </View>
              <View style={styles.rewardInfo}>
                <Text weight="medium" size="md" color={Colors.light.text}>
                  Free Oil Change
                </Text>
                <Text size="sm" color="#6B7280">
                  500 points
                </Text>
              </View>
              <Pressable style={styles.redeemButton}>
                <Text weight="medium" size="xs" color="#5299FE">
                  Redeem
                </Text>
              </Pressable>
            </View>

            <View style={styles.rewardItem}>
              <View style={styles.rewardIcon}>
                <Gift size={20} color="#5299FE" />
              </View>
              <View style={styles.rewardInfo}>
                <Text weight="medium" size="md" color={Colors.light.text}>
                  $25 Off Service
                </Text>
                <Text size="sm" color="#6B7280">
                  750 points
                </Text>
              </View>
              <Pressable style={styles.redeemButton}>
                <Text weight="medium" size="xs" color="#5299FE">
                  Redeem
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        {/* CTA Button */}
        <Pressable
          onPress={onViewFullPage}
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && styles.ctaButtonPressed,
          ]}
        >
          <Text weight="semiBold" size="md" color="#FFFFFF">
            View Full Loyalty Page
          </Text>
        </Pressable>
      </SharedElementModal>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: scale(24),
    paddingHorizontal: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
  },
  cardOuter: {
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    position: 'relative',
    // Frosted glass border
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    // Soft diffused shadow
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(16),
  },
  whiteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
  },
  collapsibleCard: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderRadius: moderateScale(16),
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  headerSection: {
    backgroundColor: 'transparent',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(8),
    flex: 1,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: moderateScale(20),
    gap: scale(6),
  },
  // Expanded modal content styles
  summaryCard: {
    backgroundColor: '#f0f7ff',
    borderRadius: moderateScale(16),
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: scale(4),
  },
  summaryDivider: {
    width: 1,
    height: scale(60),
    backgroundColor: '#D1D5DB',
  },
  tierSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(16),
    marginBottom: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  tierBadge: {
    width: scale(56),
    height: scale(56),
    borderRadius: scale(28),
    justifyContent: 'center',
    alignItems: 'center',
  },
  tierInfo: {
    gap: scale(4),
  },
  progressSection: {
    marginBottom: Spacing.xl,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: scale(12),
  },
  progressBarContainer: {
    height: scale(50),
    position: 'relative',
  },
  progressTrack: {
    position: 'absolute',
    top: scale(8),
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    top: scale(8),
    left: 0,
    height: 4,
    backgroundColor: '#5299FE',
    borderRadius: 2,
  },
  milestoneMarker: {
    position: 'absolute',
    top: 0,
    marginLeft: scale(-8),
    alignItems: 'center',
  },
  milestoneDot: {
    width: scale(16),
    height: scale(16),
    borderRadius: scale(8),
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#5299FE',
  },
  milestoneDotReached: {
    backgroundColor: '#5299FE',
    borderColor: '#FFFFFF',
    borderWidth: 2,
  },
  milestoneLabel: {
    marginTop: scale(4),
  },
  rewardsSection: {
    marginBottom: Spacing.lg,
  },
  rewardsList: {
    marginTop: Spacing.md,
    gap: scale(12),
  },
  rewardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafc',
    padding: Spacing.md,
    borderRadius: moderateScale(12),
    gap: scale(12),
  },
  rewardIcon: {
    width: scale(40),
    height: scale(40),
    borderRadius: scale(20),
    backgroundColor: '#EBF4FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardInfo: {
    flex: 1,
    gap: scale(2),
  },
  redeemButton: {
    paddingHorizontal: scale(12),
    paddingVertical: scale(6),
    borderRadius: moderateScale(6),
    borderWidth: 1,
    borderColor: '#5299FE',
  },
  ctaButton: {
    backgroundColor: '#5299FE',
    paddingVertical: Spacing.md,
    borderRadius: moderateScale(12),
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  ctaButtonPressed: {
    opacity: 0.9,
  },
});

export default LoyaltyPoints;
