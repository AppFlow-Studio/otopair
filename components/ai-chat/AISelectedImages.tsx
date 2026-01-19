/**
 * AISelectedImages
 *
 * PURPOSE: Display selected images as thumbnails with remove buttons
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (above input box)
 *
 * FEATURES:
 *   - Horizontal scrollable list of selected images
 *   - X button to remove each image
 *   - Smooth animations
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Dimensions,
} from 'react-native';

// 2. Expo & Third-party
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  FadeIn,
  FadeOut,
  Layout,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { X } from 'lucide-react-native';

// 3. Constants, hooks, types
import { Spacing } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

interface AISelectedImagesProps {
  images: string[];
  onRemove: (uri: string) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const THUMBNAIL_SIZE = 72;

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AISelectedImages({ images, onRemove }: AISelectedImagesProps) {
  if (images.length === 0) {
    return null;
  }

  return (
    <Animated.View 
      style={styles.container}
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(150)}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {images.map((uri, index) => (
          <Animated.View 
            key={uri} 
            style={styles.imageContainer}
            layout={Layout.springify()}
            entering={FadeIn.delay(index * 50)}
          >
            <Image 
              source={{ uri }} 
              style={styles.thumbnail}
              contentFit="cover"
              transition={150}
            />
            <Pressable
              style={({ pressed }) => [
                styles.removeButton,
                pressed && styles.removeButtonPressed,
              ]}
              onPress={() => onRemove(uri)}
              hitSlop={8}
            >
              <X size={12} color="#FFF" strokeWidth={3} />
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    backgroundColor: '#E8ECF0',
  },
  scrollContent: {
    gap: Spacing.sm,
    paddingTop: 6,
  },
  imageContainer: {
    position: 'relative',
  },
  thumbnail: {
    width: THUMBNAIL_SIZE,
    height: THUMBNAIL_SIZE,
    borderRadius: 12,
  },
  removeButton: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  removeButtonPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    transform: [{ scale: 0.95 }],
  },
});
