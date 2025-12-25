/**
 * AIAssistantButton
 *
 * PURPOSE: Displays an animated AI assistant button with Siri icon that navigates to AI assistant features
 *
 * USED IN: app/(main-tabs)/home/index.tsx, app/(main-tabs)/home/search.tsx
 *
 * PROPS:
 *   - onPress (() => void): Called when button is pressed [optional]
 *
 * EXAMPLE:
 *   <AIAssistantButton onPress={() => router.push('/ai-assistant')} />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, StyleSheet } from 'react-native';

// 2. Expo & Third-party
import { useRouter } from 'expo-router';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// ============================================================================
// TYPES
// ============================================================================

interface AIAssistantButtonProps {
  onPress?: () => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function AIAssistantButton({ onPress }: AIAssistantButtonProps) {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      // Default: navigate to AI chat (coming soon for now)
      router.push('/coming-soon');
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <Pressable
        onPress={handlePress}
        style={({ pressed }) => [
          styles.button,
          pressed && styles.buttonPressed,
        ]}
      >
        {/* AI Avatar - Siri Icon */}
        <Image
          source={require('@/assets/images/siriIcon.png')}
          style={styles.siriIcon}
        />

        {/* Text Label */}
        <Text weight="medium" size="sm" color="#374151" style={styles.label}>
          How can i help?
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: 150,
    marginBottom: 16,
    alignItems: 'center',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    paddingLeft: 8,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 10,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  siriIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  label: {
    letterSpacing: 0.3,
  },
});

export default AIAssistantButton;

