/**
 * ServiceBundlesSection
 *
 * PURPOSE: Displays a horizontal scrollable section of seasonal service bundles with themed cards and gradient effects
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - bundles (ServiceBundle[]): Array of service bundles to display
 *   - onBundlePress ((bundleId: string) => void): Called when a bundle card is pressed [optional]
 *
 * EXAMPLE:
 *   <ServiceBundlesSection
 *     bundles={seasonalBundles}
 *     onBundlePress={(id) => router.push(`/bundles/${id}`)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text as RNText,
  ScrollView,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { FontFamily } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export type BundleTheme = 'winter' | 'summer' | 'spring' | 'fall';

interface ServiceBundle {
  id: string;
  name: string;
  theme: BundleTheme;
  services: string[];
}

interface ServiceBundlesSectionProps {
  bundles?: ServiceBundle[];
  onLearnMore?: (bundleId: string) => void;
  onBookNow?: (bundleId: string) => void;
}

// ============================================================================
// THEME COLORS
// ============================================================================

const THEME_COLORS: Record<BundleTheme, { 
  gradientStart: string; 
  gradientEnd: string;
  bookNowBorder: string;
  bookNowText: string;
}> = {
  summer: {
    gradientStart: '#f3b405',
    gradientEnd: '#1f2322',
    bookNowBorder: '#fcca40',
    bookNowText: '#D4A017',
  },
  winter: {
    gradientStart: '#04b9ec',
    gradientEnd: '#132934',
    bookNowBorder: '#04b9ec',
    bookNowText: '#04b9ec',
  },
  spring: {
    gradientStart: '#22C55E',
    gradientEnd: '#0d4f2a',
    bookNowBorder: '#22C55E',
    bookNowText: '#22C55E',
  },
  fall: {
    gradientStart: '#EA580C',
    gradientEnd: '#7c2d12',
    bookNowBorder: '#EA580C',
    bookNowText: '#EA580C',
  },
};

// ============================================================================
// SAMPLE DATA
// ============================================================================

const SAMPLE_BUNDLES: ServiceBundle[] = [
  {
    id: 'summer-care',
    name: 'Summer Care\nPackage',
    theme: 'summer',
    services: [
      'Full AC system check',
      'Coolant top-up',
      'Tire pressure adjustment',
      'Battery health inspection',
    ],
  },
  {
    id: 'winter-safety',
    name: 'Winter Safety\nPackage',
    theme: 'winter',
    services: [
      'Battery health inspection',
      'Antifreeze check',
      'Tire thread inspection',
      'Break system check',
    ],
  },
];

// ============================================================================
// GRADIENT TEXT COMPONENT
// ============================================================================

function GradientText({ 
  text, 
  gradientColors 
}: { 
  text: string; 
  gradientColors: [string, string];
}) {
  return (
    <MaskedView
      maskElement={
        <RNText style={styles.gradientTextMask}>
          {text}
        </RNText>
      }
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.gradientBackground}
      >
        <RNText style={[styles.gradientTextMask, { opacity: 0 }]}>
          {text}
        </RNText>
      </LinearGradient>
    </MaskedView>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceBundlesSection({
  bundles = SAMPLE_BUNDLES,
  onLearnMore,
  onBookNow,
}: ServiceBundlesSectionProps) {
  const handleLearnMore = (bundleId: string) => {
    if (onLearnMore) {
      onLearnMore(bundleId);
    }
    console.log('Learn more:', bundleId);
  };

  const handleBookNow = (bundleId: string) => {
    if (onBookNow) {
      onBookNow(bundleId);
    }
    console.log('Book now:', bundleId);
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#000000" style={styles.sectionHeader}>
        Service Bundles
      </Text>

      {/* Horizontal Scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        decelerationRate="fast"
        snapToInterval={250 + 16} // card width + gap
        snapToAlignment="start"
        style={styles.scrollView}
      >
        {bundles.map((bundle) => {
          const themeColor = THEME_COLORS[bundle.theme];
          
          return (
            <View key={bundle.id} style={styles.card}>
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
                {/* Package Name with Gradient */}
                <View style={styles.packageName}>
                <GradientText 
                  text={bundle.name} 
                  gradientColors={[themeColor.gradientStart, themeColor.gradientEnd]}
                />
              </View>

              {/* Services List */}
              <View style={styles.servicesList}>
                {bundle.services.map((service, index) => (
                  <View key={index} style={styles.serviceItem}>
                    <Text size="xs" color="#6B7280" style={styles.serviceNumber}>
                      {index + 1}.
                    </Text>
                    <Text size="xs" color="#4B5563" style={styles.serviceText}>
                      {service}
                    </Text>
                  </View>
                ))}
              </View>

              {/* Action Buttons */}
              <View style={styles.buttonRow}>
                {/* Learn More Button */}
                <Pressable
                  onPress={() => handleLearnMore(bundle.id)}
                  style={({ pressed }) => [
                    styles.learnMoreButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text weight="medium" size="xs" color="#000000">
                    Learn More
                  </Text>
                </Pressable>

                {/* Book Now Button */}
                <Pressable
                  onPress={() => handleBookNow(bundle.id)}
                  style={({ pressed }) => [
                    styles.bookNowButton,
                    { borderColor: themeColor.bookNowBorder },
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text weight="medium" size="xs" color={themeColor.bookNowText}>
                    Book Now
                  </Text>
                </Pressable>
              </View>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: 32,
  },
  sectionHeader: {
    marginBottom: 16,
    fontStyle: 'italic',
  },
  scrollView: {
    marginHorizontal: -16, // Extend scroll view to edges to remove hard line
  },
  scrollContent: {
    paddingLeft: 16,
    paddingRight: 16,
    gap: 16,
  },
  card: {
    width: 250,
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
    padding: 10,
    paddingBottom: 15,
    paddingTop: 20,
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
  packageName: {
    marginBottom: 8,
    marginLeft: 10,
  },
  gradientTextMask: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    lineHeight: 28,
  },
  gradientBackground: {
    flex: 1,
  },
  servicesList: {
    gap: 4,
    marginBottom: 10,
    marginLeft: 12,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 1,
  },
  serviceNumber: {
    width: 10,
  },
  serviceText: {
    flex: 1,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  learnMoreButton: {
    flex: 1,
    paddingVertical: 2,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e4e6ec',
    backgroundColor: '#e4e6ec',
    alignItems: 'center',
    justifyContent: 'center',
    height: 35,
  },
  bookNowButton: {
    flex: 1,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
});

export default ServiceBundlesSection;
