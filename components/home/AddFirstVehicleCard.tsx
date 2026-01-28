/**
 * AddFirstVehicleCard
 *
 * PURPOSE: Displays an onboarding card encouraging users to add their first vehicle
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - onAddVehicle (() => void): Called when "Add Your First Vehicle" button is pressed [optional]
 *
 * EXAMPLE:
 *   <AddFirstVehicleCard
 *     onAddVehicle={() => router.push('/add-vehicle')}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';

// 3. Shared UI
import { Button, Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

interface AddFirstVehicleCardProps {
  onAddVehicle?: () => void;
  showAccountSetup?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AddFirstVehicleCard({
  onAddVehicle,
  showAccountSetup = false,
}: AddFirstVehicleCardProps) {
  const router = useRouter();

  const handleAddVehicle = () => {
    if (onAddVehicle) {
      onAddVehicle();
    } else {
      // Default: navigate to add vehicle page
      router.push('/add-vehicle');
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#000000" style={styles.sectionHeader}>
        {showAccountSetup ? 'Add a vehicle' : 'Vehicle Maintenance'}
      </Text>

      {/* Card */}
      <View style={styles.card}>
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
        <View style={styles.cardContent}>
          {/* Covered Car Image */}
          <View style={styles.imageContainer}>
            <Image
              source={require('@/assets/images/covered-car.png')}
              style={styles.coveredCarImage}
              resizeMode="contain"
            />
          </View>

          {/* Text Section */}
          <View style={styles.textSection}>
            <Text weight="bold" size="2xl" color="#141C24" style={styles.heading}>
              Unlock Your Connected{'\n'}Driving Experience
            </Text>
            <Text size="md" color="#6B7280" style={styles.subtitle}>
              Add Your First Vehicle To Access Diagnostics, Service History, And Personalized Insights.
            </Text>
          </View>

          {/* Call-to-Action Button */}
          <Pressable
            onPress={handleAddVehicle}
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
          >
            <LinearGradient
              colors={['#6091dc', '#8cb6fb']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <View style={styles.buttonContent}>
                <View style={styles.plusIconContainer}>
                  <Plus size={16} color="#FFFFFF" />
                </View>
                <Text weight="semiBold" size="md" color="#FFFFFF">
                  Add Your First Vehicle
                </Text>
              </View>
            </LinearGradient>
          </Pressable>
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
    marginTop: 16,
  },
  sectionHeader: {
    marginBottom: 28,
    fontStyle: 'italic',
  },
  card: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardContent: {
    padding: 20,
    position: 'relative',
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
  imageContainer: {
    alignItems: 'center',
    marginBottom: 16,
    height: 150,
    justifyContent: 'center',
  },
  coveredCarImage: {
    width: '100%',
    height: '100%',
  },
  textSection: {
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  heading: {
    textAlign: 'center',
    lineHeight: 32,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  button: {
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  buttonPressed: {
    opacity: 0.9,
  },
  buttonGradient: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  plusIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AddFirstVehicleCard;

