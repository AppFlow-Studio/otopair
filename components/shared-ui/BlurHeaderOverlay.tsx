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
 *
 * EXAMPLE:
 *   <BlurHeaderOverlay title="FAQ" />
 *   <BlurHeaderOverlay title="Settings" onBack={() => router.back()} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useState } from 'react';
import { InteractionManager, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { BlurView } from 'expo-blur';
import { X } from 'lucide-react-native';

import { Text } from './Text';

type BlurTint = 'light' | 'dark' | 'default';

export interface BlurHeaderOverlayProps {
  title: string;
  onBack?: () => void;
  intensity?: number;
  tint?: BlurTint;
  androidDelayMs?: number;
  blurReductionFactor?: number;
}

const DEFAULT_ANDROID_DELAY_MS = 250;

export function BlurHeaderOverlay({
  title,
  onBack,
  intensity = 5,
  tint = 'light',
  androidDelayMs = DEFAULT_ANDROID_DELAY_MS,
  blurReductionFactor = 7,
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
        <BlurView
          experimentalBlurMethod={Platform.OS === 'android' ? 'dimezisBlurView' : undefined}
          intensity={intensity}
          tint={tint}
          blurReductionFactor={blurReductionFactor}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View style={styles.fallback} />
      )}
      <View style={[styles.headerContent, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={handleBack} style={styles.backButton} hitSlop={10}>
          <X size={18} color="#1F2937" />
        </Pressable>
        <Text weight="semiBold" size="xl" color="#000" style={styles.title}>
          {title}
        </Text>
        <View style={{ width: 40 }} />
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
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
});
