/**
 * UpcomingAppointmentCard
 *
 * PURPOSE: Displays an upcoming appointment card with business info, mechanic details, rating, date/time, and late indicator
 *
 * USED IN: app/(main-tabs)/home/index.tsx, components/home/ActionCardsCarousel.tsx
 *
 * PROPS:
 *   - businessName (string): Name of the business/shop
 *   - mechanicName (string): Name of the assigned mechanic
 *   - rating (number): Rating value (0-5)
 *   - isVerified (boolean): Whether the business is verified [optional]
 *   - date (string): Appointment date
 *   - timeSlot (string): Appointment time slot
 *   - lateMinutes (number): Minutes late if appointment is delayed [optional]
 *   - onPress (() => void): Called when card is pressed [optional]
 *
 * EXAMPLE:
 *   <UpcomingAppointmentCard
 *     businessName="Premium Auto Care"
 *     mechanicName="John Rodriguez"
 *     rating={4.8}
 *     isVerified={true}
 *     date="Sep 10"
 *     timeSlot="2:30 PM"
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { BriefcaseBusiness, CheckCircle, Star } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

interface UpcomingAppointmentCardProps {
  businessName: string;
  mechanicName: string;
  rating: number;
  isVerified?: boolean;
  date: string;
  timeSlot: string;
  lateMinutes?: number;
  onPress?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UpcomingAppointmentCard({
  businessName,
  mechanicName,
  rating,
  isVerified = true,
  date,
  timeSlot,
  lateMinutes,
  onPress,
}: UpcomingAppointmentCardProps) {
  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#6B7280" style={styles.sectionHeader}>
        Upcoming Appointment
      </Text>

      {/* Card */}
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.card,
          pressed && styles.cardPressed,
        ]}
      >
        {/* Glassy/Glossy Effect Layers */}
        <BlurView intensity={100} tint="light" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0.55)']}
          style={StyleSheet.absoluteFill}
        />
        {/* Glossy top highlight - stronger */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0)']}
          locations={[0, 0.2, 0.5]}
          style={styles.glossyHighlight}
        />
        {/* Additional shine layer */}
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0)']}
          locations={[0, 0.15, 0.4]}
          style={styles.glossyShine}
        />
        
        {/* Card Content */}
        <View style={styles.cardContent} pointerEvents="box-none">
          {/* Top Section */}
          <View style={styles.topSection}>
          {/* Left - Business Info */}
          <View style={styles.businessInfo}>
            <View style={styles.iconContainer}>
              <BriefcaseBusiness size={24} color="#5299FE" />
            </View>
            <View style={styles.businessDetails}>
              <Text weight="bold" size="2xl" color="#141C24" style={styles.businessName}>
                {businessName}
              </Text>
              <Text size="sm" color="#6B7280">
                {mechanicName}
              </Text>
            </View>
          </View>

          {/* Right - Badges */}
          <View style={styles.badges}>
            {/* Rating */}
            <View style={styles.ratingBadge}>
              <Star size={14} color="#5299FE" fill="#5299FE" />
              <Text weight="semiBold" size="sm" color="#141C24">
                {rating}
              </Text>
            </View>

            {/* Verified */}
            {isVerified && (
              <View style={styles.verifiedBadge}>
                <CheckCircle size={18} color="#FFFFFF" fill="#22C55E" />
                <Text weight="medium" size="sm" color="#22C55E">
                  Verified
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Bottom Section - Date & Time */}
        <View style={styles.bottomSection}>
          {/* Date */}
          <Text weight="semiBold" size="md" color="#141C24">
            {date}
          </Text>

          {/* Time & Late Status */}
          <View style={styles.timeSection}>
            <Text weight="medium" size="md" color="#141C24">
              {timeSlot}
            </Text>
            {lateMinutes && lateMinutes > 0 && (
              <Text weight="medium" size="sm" color="#F59E0B">
                Late - {lateMinutes} min
              </Text>
            )}
          </View>
        </View>
        </View>
      </Pressable>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  sectionHeader: {
    marginLeft: 4,
  },
  card: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardContent: {
    padding: 20,
    paddingTop: 24,
    paddingBottom: 20,
    position: 'relative',
    zIndex: 1,
  },
  glossyHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  glossyShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
  cardPressed: {
    opacity: 0.95,
    transform: [{ scale: 0.99 }],
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 20,
  },
  businessInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  iconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessDetails: {
    flex: 1,
    gap: 4,
  },
  businessName: {
    lineHeight: 28,
  },
  badges: {
    alignItems: 'flex-end',
    gap: 7,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    marginHorizontal: -20,
    marginBottom: -20,
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  timeSection: {
    alignItems: 'flex-end',
    gap: 2,
  },
});

export default UpcomingAppointmentCard;

