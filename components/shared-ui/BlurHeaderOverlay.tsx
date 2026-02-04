/**
 * BlurHeaderOverlay
 *
 * PURPOSE: Cross-platform blur header with delayed Android blur mount to prevent tinting.
 *
 * USED IN: Settings screens that need a blurred header over scroll content.
 *
 * PROPS:
 *   - title (string): Header title text
 *   - onBack (() => void): Optional callback for back button press (defaults to router.back)
 *   - intensity (number): Blur intensity (default: 20)
 *   - tint ('light' | 'dark' | 'default'): Blur tint (default: 'light')
 *   - androidDelayMs (number): Delay before mounting BlurView on Android (default: 250)
 *   - blurReductionFactor (number): Android blur reduction factor (default: 7)
 *   - gradientColors (string[]): Optional colors for the LinearGradient overlay
 *   - gradientLocations (number[]): Optional locations for the LinearGradient overlay
 *   - titleColor (string): Optional color for the title text (default: '#000')
 *   - rightElement (React.ReactNode): Optional element to render on the right side
 *   - backButtonIconColor (string): Optional olor for the back button icon (default: '#1F2937')
 *   - backButtonBgColor (string): Optional color for the back button background (default: '#FFFFFF')
 *
 * EXAMPLE:
 *   <BlurHeaderOverlay title="FAQ" />
 *   <BlurHeaderOverlay title="Settings" titleColor="#FFF" onBack={() => router.back()} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useState } from 'react';
import { InteractionManager, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';

import { Text } from './Text';

type BlurTint = 'light' | 'dark' | 'default';

export interface BlurHeaderOverlayProps {
  title: string;
  onBack?: () => void;
  intensity?: number;
  tint?: BlurTint;
  androidDelayMs?: number;
  blurReductionFactor?: number;
  gradientColors?: any[];
  gradientLocations?: number[];
  titleColor?: string;
  rightElement?: React.ReactNode;
  backButtonIconColor?: string;
  backButtonBgColor?: string;
}

const DEFAULT_ANDROID_DELAY_MS = 250;
const DEFAULT_GRADIENT_COLORS = [
  'rgba(245, 245, 247, 1)',
  'rgba(245, 245, 247, 0.7)',
  'rgba(245, 245, 247, 0.3)',
  'rgba(245, 245, 247, 0)',
];
const DEFAULT_GRADIENT_LOCATIONS = [0, 0.4, 0.7, 1];

export function BlurHeaderOverlay({
  title,
  onBack,
  intensity = 5,
  tint = 'light',
  androidDelayMs = DEFAULT_ANDROID_DELAY_MS,
  blurReductionFactor = 7,
  gradientColors = DEFAULT_GRADIENT_COLORS,
  gradientLocations = DEFAULT_GRADIENT_LOCATIONS,
  titleColor = '#000',
  rightElement,
  backButtonIconColor = '#1F2937',
  backButtonBgColor = '#FFFFFF',
}: BlurHeaderOverlayProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [showBlur, setShowBlur] = useState(false);

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };

  useFocusEffect(
    useCallback(() => {
      let timeout: ReturnType<typeof setTimeout> | undefined;
      let cancelled = false;

      setShowBlur(false);

      const task = InteractionManager.runAfterInteractions(() => {
        const delay = Platform.OS === 'android' ? androidDelayMs : 0;
        timeout = setTimeout(() => {
          if (!cancelled) setShowBlur(true);
        }, delay);
      });

      return () => {
        cancelled = true;
        task.cancel();
        if (timeout) clearTimeout(timeout);
        setShowBlur(false);
      };
    }, [androidDelayMs])
  );

  const headerHeight = insets.top + 64;

  return (
    <View style={[styles.container, { height: headerHeight }]} pointerEvents="box-none" collapsable={false}>
      {showBlur ? (
        <>
          <BlurView
            experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
            intensity={intensity}
            tint={tint}
            blurReductionFactor={blurReductionFactor}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={gradientColors as any}
            locations={gradientLocations as any}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />
        </>
      ) : (
        <View style={styles.fallback} />
      )}

      <View style={[styles.absoluteTitleContainer, { top: insets.top + 10 }]} pointerEvents="none">
        <Text weight="semiBold" size="xl" color={titleColor} style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>

      <View style={[styles.headerContent, { paddingTop: insets.top + 10 }]}>
        <View style={styles.leftContainer}>
          <Pressable 
            onPress={handleBack} 
            style={[styles.backButton, { backgroundColor: backButtonBgColor }]} 
            hitSlop={10}
          >
            <ArrowLeft size={20} color={backButtonIconColor} />
          </Pressable>
        </View>

        <View style={styles.rightContainer}>
          {rightElement || <View style={{ width: 40 }} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    overflow: 'hidden',
  },
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(245, 245, 247, 0.85)',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  leftContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 1, // Ensure buttons are on top
  },
  rightContainer: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    zIndex: 1, // Ensure buttons are on top
  },
  absoluteTitleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    width: '100%',
    height: 40, // Match button height for vertical alignment
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
  },
});
