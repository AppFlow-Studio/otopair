/**
 * LoyaltyCard
 *
 * PURPOSE: Displays user loyalty points, current tier, progress to next tier, and provides navigation to full loyalty page
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - totalPoints (number): Total loyalty points accumulated
 *   - currentTier (string): Current loyalty tier name
 *   - currentPoints (number): Points in current tier
 *   - pointsToNextTier (number): Points needed to reach next tier
 *   - nextTier (string): Next tier name
 *   - maxPoints (number): Maximum points for current tier
 *   - onViewFullPage (() => void): Called when "View Full Page" is pressed [optional]
 *   - onClose (() => void): Called when close button is pressed [optional]
 *
 * EXAMPLE:
 *   <LoyaltyCard
 *     totalPoints={1250}
 *     currentTier="Bronze"
 *     currentPoints={1250}
 *     pointsToNextTier={1250}
 *     nextTier="Silver"
 *     maxPoints={2500}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { LinearGradient } from 'expo-linear-gradient';
import { Coins, Star, X } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

interface LoyaltyCardProps {
  totalPoints: number;
  currentTier: string;
  currentPoints: number;
  pointsToNextTier: number;
  nextTier: string;
  maxPoints: number;
  onViewFullPage?: () => void;
  onClose?: () => void;
}

// Milestone markers on the progress bar
const MILESTONES = [25, 100, 200, 300, 400];

// ============================================================================
// COMPONENT
// ============================================================================

export function LoyaltyCard({
  totalPoints = 1240,
  currentTier = 'Gold Member',
  currentPoints = 240,
  pointsToNextTier = 260,
  nextTier = 'Platinum',
  maxPoints = 500,
  onViewFullPage,
  onClose,
}: LoyaltyCardProps) {
  // Check if a milestone is reached
  const isMilestoneReached = (milestone: number) => {
    return currentPoints >= milestone;
  };

  // Padding on each side (percentage)
  const PADDING = 10;
  const USABLE_WIDTH = 100 - (PADDING * 2); // 90% usable

  // Get milestone position as percentage - evenly spaced with padding
  const getMilestonePosition = (index: number) => {
    // 5 milestones evenly spaced from PADDING% to (100-PADDING)%
    return PADDING + (index / (MILESTONES.length - 1)) * USABLE_WIDTH;
  };

  // Get fill percentage based on which milestones are reached
  const getFillPercentage = () => {
    // Find the last reached milestone index
    let lastReachedIndex = -1;
    for (let i = 0; i < MILESTONES.length; i++) {
      if (currentPoints >= MILESTONES[i]) {
        lastReachedIndex = i;
      }
    }
    
    if (lastReachedIndex === -1) return 0;
    if (lastReachedIndex === MILESTONES.length - 1) return getMilestonePosition(MILESTONES.length - 1);
    
    // Calculate partial progress between milestones
    const nextMilestone = MILESTONES[lastReachedIndex + 1];
    const prevMilestone = MILESTONES[lastReachedIndex];
    const progressBetween = (currentPoints - prevMilestone) / (nextMilestone - prevMilestone);
    
    const basePercent = getMilestonePosition(lastReachedIndex);
    const nextPercent = getMilestonePosition(lastReachedIndex + 1);
    
    return basePercent + progressBetween * (nextPercent - basePercent);
  };

  return (
    <Pressable style={styles.overlay} onPress={onClose}>
      <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
        {/* Close Button */}
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.closeButton,
            pressed && styles.closeButtonPressed,
          ]}
        >
          <X size={20} color="#9CA3AF" />
        </Pressable>

        {/* Points Summary */}
        <View style={styles.pointsSummary}>
          <View style={styles.pointsBadge}>
            <Coins size={18} color="#5299FE" />
            <Text weight="semiBold" size="md" color="#5299FE">{totalPoints} points</Text>
          </View>
          <Text size="md" color="#4B5563">earned in total</Text>
        </View>

        {/* Tier Badge - Same as header Gold Tier */}
        <View style={styles.tierSection}>
          <LinearGradient
            colors={['#fdf4b2', '#f8d34b']}
            style={styles.tierBadge}
          >
            <Star size={30} color="#fffbdf" fill="#fffbdf" />
          </LinearGradient>
          <Text weight="bold" size="xl" color="#1F2937">{currentTier}</Text>
        </View>

        {/* Progress Section */}
        <View style={styles.progressSection}>
          <View style={styles.progressHeader}>
            <Text size="md" color="#1F2937">{pointsToNextTier} pts to {nextTier}</Text>
            <Text weight="semiBold" size="md" color="#5299FE">{currentPoints}/{maxPoints}</Text>
          </View>

          {/* Progress Bar */}
          <View style={styles.progressBarContainer}>
            {/* Background Track */}
            <View style={styles.progressTrack} />
            
            {/* Filled Progress */}
            <View style={[styles.progressFill, { width: `${getFillPercentage()}%` }]} />

            {/* Milestone Markers - Evenly Spaced */}
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
                <Text size="sm" weight="semiBold" color="#1F2937" style={styles.milestoneLabel}>
                  {milestone}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* CTA Button */}
        <View style={styles.ctaContainer}>
          <Pressable
            onPress={onViewFullPage}
            style={({ pressed }) => [
              styles.ctaButton,
              pressed && styles.ctaButtonPressed,
            ]}
          >
            <Text weight="medium" size="md" color="#1F2937">
              View Full Loyalty Page
            </Text>
          </Pressable>
        </View>
      </Pressable>
    </Pressable>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 16,
    zIndex: 100,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 25,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 4,
    zIndex: 1,
  },
  closeButtonPressed: {
    opacity: 0.6,
  },
  pointsSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  pointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EBF4FF',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  tierSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 14,
  },
  tierBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressSection: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressBarContainer: {
    height: 50,
    position: 'relative',
  },
  progressTrack: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: '#E5E7EB',
    borderRadius: 2,
  },
  progressFill: {
    position: 'absolute',
    top: 8,
    left: 0,
    height: 4,
    backgroundColor: '#5299FE',
    borderRadius: 2,
  },
  milestoneMarker: {
    position: 'absolute',
    top: 2,
    marginLeft: -8,
    alignItems: 'center',
  },
  milestoneDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
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
    marginTop: 2,
  },
  ctaContainer: {
    alignItems: 'flex-end',
  },
  ctaButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  ctaButtonPressed: {
    backgroundColor: '#F3F4F6',
  },
});

export default LoyaltyCard;

