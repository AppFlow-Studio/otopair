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
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
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

// 5. Constants
import type { TaxonomyTab } from '@/constants/serviceTaxonomy';

// Maps each card to the v5 taxonomy tab it belongs to AND the exact
// service slug to land on. Tapping a card deep-links straight to that
// service in the category list (screen 2) — scrolled into view and
// briefly highlighted — instead of the generic services landing.
const CARD_TO_DESTINATION: Record<string, { tab: TaxonomyTab; focus: string }> = {
  diagnostics: { tab: 'inspections', focus: 'diagnostic_scan' },
  'oil-change': { tab: 'routine_upkeep', focus: 'oil_change' },
  brakes: { tab: 'tires_brakes', focus: 'brake_pad_replacement' },
  battery: { tab: 'routine_upkeep', focus: 'battery_test' },
  tires: { tab: 'tires_brakes', focus: 'tire_rotation' },
  inspection: { tab: 'inspections', focus: 'state_inspection' },
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
  /** Multiplier applied to IMAGE_ICON_SIZE when this card uses the 3D
   *  image. Lets a single asset render visually larger/smaller without
   *  changing the source PNG (e.g. brakes art has more whitespace
   *  around it than the others, so we scale it up to compensate). */
  imageScale?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Toggle this to true once you've added the 3D icon images
const USE_3D_ICONS = true;

// Matched to ProviderTypesSection so the two grids on home share the
// same design system: 25% screen width, 88 px tall, 92 px icons.
const GRID_PADDING = 16;
const GRID_GAP = 10;
const CARD_WIDTH = SCREEN_WIDTH * 0.25;
const CARD_HEIGHT = 88;
const ICON_SIZE = 28;
const IMAGE_ICON_SIZE = 92;

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
    imageScale: 1.15,
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

  const handleCardPress = (serviceId: string) => {
    const dest = CARD_TO_DESTINATION[serviceId];
    // Fallback: unmapped card → generic services landing.
    if (!dest) {
      router.push('/(booking-flow)/select-services');
      return;
    }
    // Deep-link to the exact service in the category list (screen 2). The
    // `focus` param scrolls it into view and briefly highlights it.
    router.push({
      pathname: '/(booking-flow)/category/[tab]',
      params: { tab: dest.tab, focus: dest.focus },
    });
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
              
              {/* Card Content */}
              <View style={styles.cardContent} pointerEvents="box-none">
                {/* Icon - 3D image or fallback lucide icon */}
                <View style={styles.iconContainer}>
                  {USE_3D_ICONS && card.image ? (
                    <Image
                      source={card.image}
                      style={[
                        styles.imageIcon,
                        card.imageScale != null && {
                          width: IMAGE_ICON_SIZE * card.imageScale,
                          height: IMAGE_ICON_SIZE * card.imageScale,
                        },
                      ]}
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
    backgroundColor: '#FFFFFF',
    position: 'relative',
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
    marginTop: 0,
    // Shape-aware drop shadow matching ProviderTypesSection.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
  },
  cardLabel: {
    marginBottom: 2,
    fontSize: 11,
    lineHeight: 14,
  },
  cardSubText: {
    fontSize: 10,
    lineHeight: 13,
    marginTop: 2,
  },
});

export default MoreServicesSection;
