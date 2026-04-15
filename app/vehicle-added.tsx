/**
 * VehicleAddedScreen
 *
 * PURPOSE: Success screen shown after adding a vehicle
 *
 * USED IN: Navigated from add-car-info.tsx after adding vehicle
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, View, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Path } from 'react-native-svg';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { Spacing } from '@/constants/theme';
import { scale, verticalScale, moderateScale } from '@/utils/responsive';

// ============================================================================
// ANIMATED CHECK COMPONENT
// ============================================================================

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface AnimatedCheckmarkProps {
  size: number;
  color: string;
  strokeWidth: number;
  progress: Animated.Value;
}

const AnimatedCheckmark = ({ size, color, strokeWidth, progress }: AnimatedCheckmarkProps) => {
  // Checkmark path that draws nicely
  const checkPath = "M6 12L10 16L18 8";
  const pathLength = 24; // Approximate length of the checkmark path

  const strokeDashoffset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [pathLength, 0],
  });

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <AnimatedPath
        d={checkPath}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={pathLength}
        strokeDashoffset={strokeDashoffset}
      />
    </Svg>
  );
};

// ============================================================================
// COMPONENT
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VehicleAddedScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ flow?: string; vehicleOwnerId?: string; fromPreOnboarding?: string }>();
  const isManualAddFlow = params.flow === "manual";
  const vehicleOwnerId = typeof params.vehicleOwnerId === "string" ? params.vehicleOwnerId : "";
  const cameFromPreOnboarding = params.fromPreOnboarding === "true";

  // Animation values
  const checkmarkScale = useRef(new Animated.Value(0)).current;
  const checkmarkDrawProgress = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(20)).current;
  const buttonTranslateY = useRef(new Animated.Value(100)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;
  const imageScale = useRef(new Animated.Value(1)).current;

  // Run animations on mount
  useEffect(() => {
    // Trigger success haptic
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    // Checkmark circle bounce in
    Animated.spring(checkmarkScale, {
      toValue: 1,
      useNativeDriver: true,
      damping: 12,
      stiffness: 180,
    }).start();

    // Checkmark drawing animation (starts after circle appears)
    setTimeout(() => {
      Animated.timing(checkmarkDrawProgress, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }, 200);

    // Text fade in with upward movement (staggered)
    setTimeout(() => {
      Animated.parallel([
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(textTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 100,
        }),
      ]).start();
    }, 300);

    // Button slide up
    setTimeout(() => {
      Animated.parallel([
        Animated.spring(buttonTranslateY, {
          toValue: 0,
          useNativeDriver: true,
          damping: 15,
          stiffness: 120,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }, 500);

    // Subtle car image zoom
    Animated.timing(imageScale, {
      toValue: 1.05,
      duration: 3000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleViewVehicle = () => {
    if (vehicleOwnerId) {
      router.replace({
        pathname: '/car-pre-onboarding',
        params: { vehicleOwnerId, flow: params.flow ?? "manual" },
      });
      return;
    }
    router.replace('/(main-tabs)/cars');
  };


  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent />
      
      {/* Full Screen Car Image with subtle zoom */}
      <Animated.Image
        source={require('@/assets/images/carComplete.jpeg')}
        style={[
          styles.fullScreenImage,
          { transform: [{ scale: imageScale }] }
        ]}
        resizeMode="cover"
      />
      
      {/* Back Button */}
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [
          styles.backButton,
          { top: insets.top + scale(12) },
          pressed && styles.backButtonPressed,
        ]}
        hitSlop={12}
      >
        <ArrowLeft size={scale(24)} color="#000000" strokeWidth={2} />
      </Pressable>

      {/* Success Content */}
      <View style={[styles.successContainer, { top: insets.top + scale(40) }]}>
        {/* Checkmark Circle - Animated */}
        <Animated.View 
          style={[
            styles.checkmarkCircle,
            { transform: [{ scale: checkmarkScale }] }
          ]}
        >
          <AnimatedCheckmark
            size={scale(40)}
            color="#FFFFFF"
            strokeWidth={3}
            progress={checkmarkDrawProgress}
          />
        </Animated.View>
        
        {/* Success Text - Animated */}
        <Animated.View
          style={{
            opacity: textOpacity,
            transform: [{ translateY: textTranslateY }],
          }}
        >
          <Text weight="bold" size="2xl" color="#333333" style={styles.successTitle}>
            YOUR VEHICLE HAS BEEN ADDED
          </Text>
          <Text size="sm" color="#666666" style={styles.successDescription}>
            Just a few quick questions about your car and we'll set up your personalized maintenance plan.
          </Text>
        </Animated.View>
      </View>

      {/* Bottom Button - Animated */}
      <Animated.View 
        style={[
          styles.bottomButtonContainer, 
          { 
            paddingBottom: insets.bottom + scale(20),
            opacity: buttonOpacity,
            transform: [{ translateY: buttonTranslateY }],
          }
        ]}
      >
        <Pressable
          onPress={handleViewVehicle}
          style={({ pressed }) => [
            styles.viewVehicleButton,
            pressed && styles.viewVehicleButtonPressed,
          ]}
        >
          <LinearGradient
            colors={['#7BB8FF', '#5299FE', '#3B7FEB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.viewVehicleButtonGradient}
          >
            <Text weight="bold" size="md" color="#FFFFFF">
              {isManualAddFlow ? "Continue" : "View My Vehicle"}
            </Text>
          </LinearGradient>
        </Pressable>

      </Animated.View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  fullScreenImage: {
    position: 'absolute',
    top: SCREEN_HEIGHT * 0.06,
    left: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    zIndex: 1,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.md,
    zIndex: 20,
    width: SCREEN_WIDTH * 0.1,
    height: SCREEN_WIDTH * 0.1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  successContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  checkmarkCircle: {
    width: scale(80),
    height: scale(80),
    borderRadius: scale(40),
    backgroundColor: '#5299FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    shadowColor: '#5299FE',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  successTitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  successDescription: {
    textAlign: 'center',
    lineHeight: moderateScale(20),
  },
  bottomButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    zIndex: 20,
  },
  viewVehicleButton: {
    borderRadius: moderateScale(24),
    overflow: 'hidden',
    shadowColor: 'rgba(82,153,254,0.3)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 12,
    elevation: 4,
  },
  viewVehicleButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  viewVehicleButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: scale(16),
    paddingHorizontal: scale(32),
  },
});
