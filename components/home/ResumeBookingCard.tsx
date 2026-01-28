/**
 * ResumeBookingCard
 *
 * PURPOSE: Displays a card prompting users to resume an incomplete booking with available mechanics count and service preview
 *
 * USED IN: app/(main-tabs)/home/index.tsx, components/home/ActionCardsCarousel.tsx
 *
 * PROPS:
 *   - mechanicsAvailable (number): Number of available mechanics
 *   - servicesPreview (string): Preview text of services selected
 *   - onPress (() => void): Called when card is pressed [optional]
 *   - onDismiss (() => void): Called when dismiss button is pressed [optional]
 *
 * EXAMPLE:
 *   <ResumeBookingCard
 *     mechanicsAvailable={12}
 *     servicesPreview="Oil Change, Tire Rotation"
 *     onPress={() => router.push('/booking/resume')}
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
import { useRouter } from 'expo-router';
import { ArrowRight, Clock } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

interface ResumeBookingCardProps {
  mechanicsAvailable: number;
  servicesPreview: string;
  onPress?: () => void;
  onDismiss?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ResumeBookingCard({
  mechanicsAvailable,
  servicesPreview,
  onPress,
}: ResumeBookingCardProps) {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default: navigate to booking flow
      router.push('/coming-soon');
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#6B7280" style={styles.sectionHeader}>
        Resume Booking Service
      </Text>

      {/* Card */}
      <View style={styles.card}>
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
          {/* Left - Icon */}
          <View style={styles.iconContainer}>
            <Clock size={24} color="#5299FE" />
          </View>

          {/* Middle - Content */}
          <View style={styles.contentSection}>
            <Text weight="bold" size="lg" color="#141C24">
              Resume Booking Service
            </Text>
            <Text size="sm" color="#6B7280">
              Pick up where you left off
            </Text>
          </View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          {/* Left - Info */}
          <View style={styles.infoSection}>
            <Text weight="semiBold" size="sm" color="#5299FE">
              {mechanicsAvailable} Mechanics Available
            </Text>
            <Text size="sm" color="#6B7280" numberOfLines={1}>
              {servicesPreview}
            </Text>
          </View>

          {/* Right - Button */}
          <Pressable
            onPress={handlePress}
            style={({ pressed }) => [
              styles.resumeButton,
              pressed && styles.resumeButtonPressed,
            ]}
          >
            <Text weight="semiBold" size="sm" color="#FFFFFF">
              Resume
            </Text>
            <ArrowRight size={16} color="#FFFFFF" />
          </Pressable>
        </View>
        </View>
      </View>
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
  topSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 16,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EBF4FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentSection: {
    flex: 1,
    gap: 4,
  },
  bottomSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    marginHorizontal: -20,
    marginBottom: -20,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
  infoSection: {
    flex: 1,
    gap: 2,
    marginRight: 12,
  },
  resumeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#5299FE',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  resumeButtonPressed: {
    opacity: 0.8,
  },
});

export default ResumeBookingCard;

