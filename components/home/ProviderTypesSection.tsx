/**
 * ProviderTypesSection
 *
 * PURPOSE: Compact row of flat-white provider-type cards
 *          (Mechanic / Mobile Mechanic / Mobile Detailers).
 *          Tapping any card opens the booking flow on the
 *          Maintenance tab. Provider-type filtering is wired
 *          separately later — for now this is a visual entry
 *          point with the booking-store default fallback.
 *
 *          Visually distinct from `MoreServicesSection` (which
 *          is the 6-card service-type grid above): flat white
 *          cards with a soft drop shadow, no glass effect.
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import { Dimensions, Image, ImageSourcePropType, Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { useRouter } from 'expo-router';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Stores
import { useBookingStore } from '@/stores/useBookingStore';
import type { ServiceCategory } from '@/stores/types/store.types';

// Card id → booking-store ServiceCategory tab. None of the
// provider-type cards map to a specific category yet — they all
// fall through to the `basic_maintenance` default in
// `handleCardPress`. When provider-type filtering lands we'll
// extend this map (or add a sibling provider-type signal on the
// booking store).
const CARD_TO_CATEGORY: Record<string, ServiceCategory> = {};

// ============================================================================
// TYPES
// ============================================================================

interface ProviderCard {
  id: string;
  label: string;
  image: ImageSourcePropType;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Sized to match MoreServicesSection one-to-one so the two grids on
// home read as the same design system: 27% screen width, 95 px tall,
// 85 px icons, 14 px label.
const GRID_PADDING = 16;
const CARD_WIDTH = SCREEN_WIDTH * 0.25;
const CARD_HEIGHT = 88;
const IMAGE_ICON_SIZE = 92;

const PROVIDER_CARDS: ProviderCard[] = [
  {
    id: 'mechanic',
    label: 'Mechanic',
    image: require('@/assets/images/services/newIcons/mechanic.png'),
  },
  {
    id: 'mobile-mechanic',
    label: 'Mobile Mechanic',
    image: require('@/assets/images/services/newIcons/mobile-mechanic.png'),
  },
  {
    id: 'mobile-detailers',
    label: 'Mobile Detailers',
    image: require('@/assets/images/services/newIcons/mobile-detailers.png'),
  },
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ProviderTypesSection() {
  const router = useRouter();
  const setInitialServiceCategory = useBookingStore(
    (state) => state.setInitialServiceCategory,
  );

  const handleCardPress = (cardId: string) => {
    setInitialServiceCategory(CARD_TO_CATEGORY[cardId] ?? 'basic_maintenance');
    router.push('/(booking-flow)/select-services');
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.headerContainer}>
        <Text size="md" color="#000000" style={styles.sectionHeader}>
          More
        </Text>
      </View>

      {/* Cards row */}
      <View style={styles.gridContainer}>
        {PROVIDER_CARDS.map((card) => (
          <Pressable
            key={card.id}
            style={({ pressed }) => [
              styles.cardWrapper,
              pressed && styles.cardPressed,
            ]}
            onPress={() => handleCardPress(card.id)}
          >
            <View style={styles.card}>
              <View style={styles.cardContent} pointerEvents="box-none">
                <View style={styles.iconContainer}>
                  <Image
                    source={card.image}
                    style={styles.imageIcon}
                    resizeMode="contain"
                  />
                </View>
                <Text
                  weight="bold"
                  color="#374151"
                  center
                  style={styles.cardLabel}
                >
                  {card.label}
                </Text>
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
    paddingHorizontal: GRID_PADDING,
    // Matches MoreServicesSection: cards anchor to the edges within
    // the padding and split the remaining space evenly between them.
    justifyContent: 'space-between',
  },
  cardWrapper: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
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
  },
  cardContent: {
    width: '100%',
    height: '100%',
    paddingVertical: 8,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    height: 50,
    marginBottom: 4,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  imageIcon: {
    width: IMAGE_ICON_SIZE,
    height: IMAGE_ICON_SIZE,
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
});

export default ProviderTypesSection;
