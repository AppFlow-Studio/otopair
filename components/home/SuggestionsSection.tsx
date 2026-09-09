/**
 * SuggestionsSection
 *
 * PURPOSE: Displays a horizontal scrollable section of service suggestions with liquid glass effect and category icons
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - suggestions (Suggestion[]): Array of service suggestions to display
 *   - onSuggestionPress ((suggestionId: string) => void): Called when a suggestion card is pressed [optional]
 *
 * EXAMPLE:
 *   <SuggestionsSection
 *     suggestions={serviceSuggestions}
 *     onSuggestionPress={(id) => router.push(`/services/${id}`)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import {
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { BriefcaseBusiness, Car, Sparkles, Truck, Wrench } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// Safely import liquid glass - requires native rebuild
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassSupported = false;

try {
  const liquidGlass = require('@callstack/liquid-glass');
  LiquidGlassView = liquidGlass.LiquidGlassView;
  isLiquidGlassSupported = liquidGlass.isLiquidGlassSupported;
} catch {
  // Native module not available - will use fallback
}

// ============================================================================
// TYPES
// ============================================================================

export type ServiceType = 'mechanic' | 'mobile-mechanic' | 'mobile-detailers';

interface ServiceCard {
  id: ServiceType;
  label: string;
  icon?: React.ReactNode;
  image?: ImageSourcePropType;
  isComingSoon?: boolean;
}

interface SuggestionsSectionProps {
  onCardPress?: (serviceType: ServiceType) => void;
}

// ============================================================================
// SERVICE DATA
// ============================================================================

const SERVICE_CARDS: ServiceCard[] = [
  {
    id: 'mechanic',
    label: 'Mechanic',
    image: require('@/assets/images/services/mechanicicon.png'),
    isComingSoon: true,
  },
  {
    id: 'mobile-mechanic',
    label: 'Mobile\nMechanic',
    image: require('@/assets/images/services/mobilemechanic.png'),
    isComingSoon: true,
  },
  {
    id: 'mobile-detailers',
    label: 'Mobile\nDetailers',
    image: require('@/assets/images/services/mobiledetail.png'),
    isComingSoon: true,
  },
];

// ============================================================================
// ICON COMPONENTS
// ============================================================================

function MechanicIcon() {
  return (
    <View style={styles.iconWrapper}>
      <BriefcaseBusiness size={32} color="#6B7280" strokeWidth={1.5} />
      <View style={styles.wrenchOverlay}>
        <Wrench size={14} color="#6B7280" strokeWidth={2} />
      </View>
    </View>
  );
}

function MobileMechanicIcon() {
  return (
    <View style={styles.iconWrapper}>
      <Truck size={32} color="#6B7280" strokeWidth={1.5} />
      <View style={styles.toolsOverlay}>
        <Wrench size={12} color="#6B7280" strokeWidth={2} />
      </View>
    </View>
  );
}

function MobileDetailersIcon() {
  return (
    <View style={styles.iconWrapper}>
      <Car size={32} color="#6B7280" strokeWidth={1.5} />
      <View style={styles.sparklesOverlay}>
        <Sparkles size={14} color="#6B7280" strokeWidth={2} />
      </View>
    </View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SuggestionsSection({ onCardPress }: SuggestionsSectionProps) {
  const router = useRouter();

  const handleCardPress = (card: ServiceCard) => {
    if (onCardPress) {
      onCardPress(card.id);
      return;
    }

    if (card.isComingSoon) {
      router.push({
        pathname: '/coming-soon',
        params: {
          serviceType: card.id,
          serviceName: card.label.replace('\n', ' '),
        },
      });
    } else {
      // Navigate to the booking flow's service picker
      router.push('/(booking-flow)/select-services');
    }
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#000000" style={styles.sectionHeader}>
        More
      </Text>

      {/* Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {SERVICE_CARDS.map((card) => (
          <Pressable
            key={card.id}
            onPress={() => handleCardPress(card)}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.cardWrapper}>
              {/* Card Content */}
              <View style={styles.cardContent} pointerEvents="box-none">
                {/* Icon Container */}
                <View style={styles.iconContainer}>
                  {card.image ? (
                    <Image
                      source={card.image}
                      style={styles.serviceImage}
                      resizeMode="contain"
                    />
                  ) : (
                    card.icon
                  )}
                </View>
              </View>
            </View>
            
            {/* Label - Outside the card wrapper, below it */}
            <Text
              weight="medium"
              size="sm"
              color="#4B5563"
              center
              style={styles.cardLabel}
            >
              {card.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
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
  sectionHeader: {
    marginBottom: 20,
    fontStyle: 'italic',
  },
  scrollContent: {
    paddingLeft: 34.5,
    paddingRight: 16,
    gap: 60,
  },
  card: {
    alignItems: 'center',
    gap: 10,
  },
  cardPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
  cardWrapper: {
    width: 70,
    height: 70,
    borderRadius: 13,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  cardContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  iconContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconContainerGlass: {
    width: 70,
    height: 70,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  serviceImage: {
    width: 75,
    height: 75,
  },
  cardLabel: {
    lineHeight: 18,
    minHeight: 36,
  },
  iconWrapper: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  wrenchOverlay: {
    position: 'absolute',
    top: 6,
    right: -2,
  },
  toolsOverlay: {
    position: 'absolute',
    top: -4,
    right: -6,
    transform: [{ rotate: '-30deg' }],
  },
  sparklesOverlay: {
    position: 'absolute',
    top: -6,
    right: -8,
  },
});

export default SuggestionsSection;

