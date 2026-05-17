/**
 * MoreServicesSection
 *
 * PURPOSE: Displays a grid of service cards with glassy/glossy effect
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import { Dimensions, Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Battery,
  LifeBuoy,
  ClipboardCheck,
  Droplet,
  Gauge,
} from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { Spacing, BorderRadius } from '@/constants/theme';

// 5. Stores
import { useBookingStore } from '@/stores/useBookingStore';
import type { ServiceCategory } from '@/stores/types/store.types';

// Maps each card id to the service category tab the booking sheet
// should open on. Cards not listed here fall back to basic_maintenance
// (the default "Maintenance" tab) — i.e. Oil Change, Battery, Inspection.
const CARD_TO_CATEGORY: Record<string, ServiceCategory> = {
  diagnostics: 'system_diagnostics',
  brakes: 'brakes_suspension',
  tires: 'tires_wheels',
};

// ============================================================================
// TYPES
// ============================================================================

interface ServiceCard {
  id: string;
  label: string;
  subText?: string;
  icon: React.ReactNode; // Fallback lucide icon
  image?: ImageSourcePropType; // 3D icon image (optional until added)
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Toggle this to true once you've added the 3D icon images
const USE_3D_ICONS = true;

// Calculate card width for 3 columns × 2 rows grid
const GRID_PADDING = 16;
const GRID_GAP = 10;
// Use 27% width to leave room for gaps between cards
const CARD_WIDTH = SCREEN_WIDTH * 0.27;
const CARD_HEIGHT = 95;
const ICON_SIZE = 28;
const IMAGE_ICON_SIZE = 85;

// Service cards data - using new icons from newIcons folder
const SERVICE_CARDS: ServiceCard[] = [
  {
    id: 'diagnostics',
    label: 'Diagnostics',
    icon: <AlertCircle size={ICON_SIZE} color="#F97316" fill="#FFEDD5" strokeWidth={1.5} />,
    image: require('@/assets/images/services/newIcons/Engineicon.png'),
  },
  {
    id: 'oil-change',
    label: 'Oil Change',
    icon: <Droplet size={ICON_SIZE} color="#EAB308" fill="#FEF9C3" strokeWidth={1.5} />,
    image: require('@/assets/images/services/newIcons/oilchangeicon.png'),
  },
  {
    id: 'brakes',
    label: 'Brakes',
    icon: <Gauge size={ICON_SIZE} color="#EF4444" strokeWidth={1.5} />,
    image: require('@/assets/images/services/newIcons/brakesicon.png'),
  },
  {
    id: 'battery',
    label: 'Battery',
    icon: <Battery size={ICON_SIZE} color="#22C55E" strokeWidth={1.5} />,
    image: require('@/assets/images/services/newIcons/batteryicon.png'),
  },
  {
    id: 'tires',
    label: 'Tires',
    icon: <LifeBuoy size={ICON_SIZE} color="#374151" fill="#E5E7EB" strokeWidth={1.5} />,
    image: require('@/assets/images/services/newIcons/tiresicon.png'),
  },
  {
    id: 'inspection',
    label: 'Inspection',
    icon: <ClipboardCheck size={ICON_SIZE} color="#8B5CF6" fill="#EDE9FE" strokeWidth={1.5} />,
    image: require('@/assets/images/services/newIcons/inspection.png'),
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function MoreServicesSection() {
  const router = useRouter();
  const setInitialServiceCategory = useBookingStore(
    (state) => state.setInitialServiceCategory,
  );

  const handleCardPress = (serviceId: string) => {
    // Seed the booking-store one-shot category signal so the service
    // selector mounts on the right tab. Cards not in the map default
    // to `basic_maintenance` (Maintenance tab).
    setInitialServiceCategory(CARD_TO_CATEGORY[serviceId] ?? 'basic_maintenance');
    router.push('/home/map');
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerContainer}>
        <Text size="md" color="#000000" style={styles.sectionHeader}>
          More Services
        </Text>
      </View>

      {/* Grid Layout */}
      <View style={styles.gridContainer}>
        {SERVICE_CARDS.map((card) => (
          <Pressable
            key={card.id}
            style={({ pressed }) => [
              styles.cardWrapper,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handleCardPress(card.id)}
          >
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
                {/* Icon - 3D image or fallback lucide icon */}
                <View style={styles.iconContainer}>
                  {USE_3D_ICONS && card.image ? (
                    <Image
                      source={card.image}
                      style={styles.imageIcon}
                      resizeMode="contain"
                    />
                  ) : (
                    card.icon
                  )}
                </View>

                {/* Label */}
                <Text
                  weight="bold"
                  color="#374151"
                  center
                  style={styles.cardLabel}
                >
                  {card.label}
                </Text>

                {/* Sub-text */}
                {card.subText && (
                  <Text
                    color="#9CA3AF"
                    center
                    style={styles.cardSubText}
                  >
                    {card.subText}
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: 40,
  },
  headerContainer: {
    marginBottom: -5,
    paddingLeft: 0,
    marginLeft: -4,
    marginTop: 5,
  },
  sectionHeader: {
    marginBottom: 20,
    marginLeft: 0,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: GRID_PADDING,
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: GRID_GAP,
  },
  cardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  card: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'transparent',
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
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  glossyShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '35%',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  cardContent: {
    width: '100%',
    height: '100%',
    paddingVertical: 6,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 1,
  },
  iconContainer: {
    height: 50, // Fixed height so label stays in place
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  imageIcon: {
    width: IMAGE_ICON_SIZE,
    height: IMAGE_ICON_SIZE,
    marginTop: 0, // Allow icon to extend upward
  },
  cardLabel: {
    marginBottom: 2,
    fontSize: 14,
    lineHeight: 18,
  },
  cardSubText: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
});

export default MoreServicesSection;
