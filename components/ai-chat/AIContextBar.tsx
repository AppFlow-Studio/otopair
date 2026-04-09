/**
 * AIContextBar
 *
 * PURPOSE: Frosted pill showing the selected vehicle during chat
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (visible during active conversation)
 *
 * OWNER: Waleed Mansour
 */

import React from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { Car } from 'lucide-react-native';

import { Text } from '@/components/shared-ui';
import { FontFamily, Spacing } from '@/constants/theme';
import type { VehicleCard } from './AIGreeting';

interface AIContextBarProps {
  vehicle: VehicleCard;
  onChangeVehicle: () => void;
  top?: number;
}

export function AIContextBar({ vehicle, onChangeVehicle, top = 0 }: AIContextBarProps) {
  const imageSource = vehicle.localImage
    ? vehicle.localImage
    : vehicle.imageUrl
      ? { uri: vehicle.imageUrl }
      : null;

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(150)}
      style={[styles.wrapper, { top }]}
    >
      <Pressable onPress={onChangeVehicle}>
        <BlurView intensity={60} tint="light" style={styles.pill}>
          {imageSource ? (
            <Image
              source={imageSource}
              style={styles.thumbnail}
              contentFit="contain"
              transition={0}
              placeholder={null}
            />
          ) : (
            <View style={styles.thumbnailPlaceholder}>
              <Car size={16} color="#9CA3AF" />
            </View>
          )}
          <Text style={styles.vehicleName} numberOfLines={1}>
            {vehicle.year} {vehicle.make} {vehicle.model}
          </Text>
        </BlurView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  pill: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    shadowOpacity: 0.05,
  },
  thumbnail: {
    width: 40,
    height: 28,
  },
  thumbnailPlaceholder: {
    width: 40,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    borderRadius: 6,
  },
  vehicleName: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    color: 'rgba(0,0,0,0.7)',
    marginLeft: 8,
  },
});
