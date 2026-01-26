/**
 * AddVehicleScreen
 *
 * PURPOSE: Screen for adding a vehicle with background image
 *
 * USED IN: Navigated from AddFirstVehicleCard component
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useState, useEffect, useRef } from 'react';
import { Dimensions, Pressable, StyleSheet, View, Image, TextInput, Keyboard, Platform, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { ArrowLeft, QrCode, Edit3 } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { Spacing } from '@/constants/theme';

// ============================================================================
// COMPONENT
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate keyboard offset multiplier based on screen height
// iPhone 14 Pro Max (~932 points) works well with 0.65
// iPhone 17 Pro (smaller screen ~852 points) needs more movement to avoid blocking VIN badge
const getKeyboardOffsetMultiplier = () => {
  if (SCREEN_HEIGHT >= 900) return 0.65; // iPhone 14 Pro Max
  return 0.75; // iPhone 17 Pro - move car content up more
};

export default function AddVehicleScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [vinNumber, setVinNumber] = useState('');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const keyboardHeight = useRef(new Animated.Value(0)).current;

  // Listen to keyboard events with smooth animation
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    
    const showSubscription = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      Animated.spring(keyboardHeight, {
        toValue: e.endCoordinates.height,
        useNativeDriver: false,
        damping: 20,
        stiffness: 150,
      }).start();
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
      Animated.spring(keyboardHeight, {
        toValue: 0,
        useNativeDriver: false,
        damping: 20,
        stiffness: 150,
      }).start();
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const handleBack = () => {
    router.back();
  };

  const handleVinSubmit = () => {
    if (vinNumber.trim().length > 0) {
      router.push({
        pathname: '/add-car-info',
        params: { vin: vinNumber },
      });
    }
  };

  const handleScanVin = () => {
    router.push('/vin-scanner');
  };

  const handleManualEntry = () => {
    router.push({
      pathname: '/add-car-info',
      params: { manual: 'true' },
    });
  };

  // Calculate animated offset to shift content up when keyboard is visible
  const keyboardOffset = keyboardHeight.interpolate({
    inputRange: [0, 400],
    outputRange: [0, 400 * getKeyboardOffsetMultiplier()],
    extrapolate: 'clamp',
  });

  // Positioning for dots and lines (relative to screen)
  const windshieldDotLeft = SCREEN_WIDTH * 0.32;
  const doorDotLeft = SCREEN_WIDTH * 0.59;
  
  // Animated positions
  const windshieldDotTop = Animated.subtract(SCREEN_HEIGHT * 0.51, keyboardOffset);
  const doorDotTop = Animated.subtract(SCREEN_HEIGHT * 0.525, keyboardOffset);
  const vinBadgeTop = Animated.subtract(SCREEN_HEIGHT * 0.60, keyboardOffset);
  const imageTop = Animated.subtract(SCREEN_HEIGHT * 0.08, keyboardOffset);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" translucent />
      
      {/* Full Screen Car Image */}
      <Animated.Image
        source={require('@/assets/images/addYourVehiclev2.png')}
        style={[styles.fullScreenImage, { top: imageTop }]}
        resizeMode="cover"
      />

      {/* Back Button */}
      <Pressable
        onPress={handleBack}
        style={({ pressed }) => [
          styles.backButton,
          { top: insets.top + 12 },
          pressed && styles.backButtonPressed,
        ]}
        hitSlop={12}
      >
        <ArrowLeft size={24} color="#000000" strokeWidth={2} />
      </Pressable>

      {/* Title - Overlaid on image (hidden when keyboard is up) */}
      {!keyboardVisible && (
        <View style={[styles.titleContainer, { top: insets.top + 40 }]}>
          <Text weight="bold" size="2xl" color="#333333" style={styles.title}>
            ADD YOUR VEHICLE
          </Text>
          <Text size="sm" color="#666666" style={styles.description}>
            Scan or enter your VIN to add your vehicle. You can find your 17-digit Vehicle Identification Number (VIN) on your driver side door panel or on the windshield.
          </Text>
        </View>
      )}

      {/* Red Dot - Door Panel */}
      <Animated.View style={[styles.redDot, { top: doorDotTop, left: doorDotLeft }]}>
        <View style={styles.redDotInner} />
      </Animated.View>

      {/* Red Dot - Windshield */}
      <Animated.View style={[styles.redDot, { top: windshieldDotTop, left: windshieldDotLeft }]}>
        <View style={styles.redDotInner} />
      </Animated.View>

      {/* Line from Door Dot to VIN Badge */}
      <Animated.View style={[
        styles.connectorLine,
        {
          top: Animated.add(doorDotTop, 12),
          left: doorDotLeft - 6,
          height: Animated.subtract(Animated.subtract(vinBadgeTop, doorDotTop), 10),
          transform: [{ rotate: '1deg' }, { translateX: 15 }],
        }
      ]} />

      {/* Line from Windshield Dot to VIN Badge */}
      <Animated.View style={[
        styles.connectorLine,
        {
          top: Animated.add(windshieldDotTop, 12),
          left: windshieldDotLeft + 18.5,
          height: Animated.subtract(Animated.subtract(vinBadgeTop, windshieldDotTop), 5),
          transform: [{ rotate: '1deg' }, { translateX: -10 }],
        }
      ]} />

      {/* VIN Badge */}
      <Animated.View style={[styles.vinBadge, { top: vinBadgeTop }]}>
        <Text weight="semiBold" size="sm" color="#FFFFFF" style={styles.vinBadgeText}>
          1FDXV92H6KCB23213
        </Text>
      </Animated.View>

      {/* Bottom Buttons */}
      <Animated.View style={[
        styles.bottomButtonsContainer, 
        { 
          paddingBottom: keyboardVisible ? 20 : insets.bottom + 20,
          bottom: keyboardHeight,
        }
      ]}>
        {/* VIN Input Field */}
        <TextInput
          style={styles.vinInput}
          placeholder="Enter VIN"
          placeholderTextColor="#999999"
          value={vinNumber}
          onChangeText={setVinNumber}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={17}
          returnKeyType="done"
          onSubmitEditing={handleVinSubmit}
        />

        {/* Scan VIN Button */}
        <Pressable
          onPress={handleScanVin}
          style={({ pressed }) => [
            styles.scanVinButton,
            pressed && styles.scanVinButtonPressed,
          ]}
        >
          <QrCode size={20} color="#FFFFFF" strokeWidth={2} />
          <Text weight="semiBold" size="md" color="#FFFFFF" style={styles.scanVinButtonText}>
            SCAN VIN
          </Text>
        </Pressable>

        {/* Manual Entry Link */}
        <Pressable
          onPress={handleManualEntry}
          style={({ pressed }) => [
            styles.manualEntryButton,
            pressed && styles.manualEntryButtonPressed,
          ]}
        >
          <Edit3 size={16} color="#5299FE" strokeWidth={2} />
          <Text weight="semiBold" size="sm" color="#5299FE" style={styles.manualEntryText}>
            Enter car information manually
          </Text>
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
  titleContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    zIndex: 10,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
    letterSpacing: 1,
  },
  description: {
    textAlign: 'center',
    lineHeight: 20,
  },
  redDot: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 82, 82, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 15,
  },
  redDotInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#FF5252',
  },
  connectorLine: {
    position: 'absolute',
    width: 1.5,
    backgroundColor: '#888888',
    zIndex: 10,
  },
  vinBadge: {
    position: 'absolute',
    alignSelf: 'center',
    left: SCREEN_WIDTH * 0.5 - 90,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    zIndex: 15,
  },
  vinBadgeText: {
    letterSpacing: 1,
  },
  bottomButtonsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    gap: 12,
    zIndex: 20,
  },
  vinInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 30,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
    textAlign: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  scanVinButton: {
    backgroundColor: '#5299FE',
    borderRadius: 30,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  scanVinButtonPressed: {
    opacity: 0.8,
  },
  scanVinButtonText: {
    letterSpacing: 0.5,
  },
  manualEntryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  manualEntryButtonPressed: {
    opacity: 0.7,
  },
  manualEntryText: {
    textDecorationLine: 'underline',
  },
});
