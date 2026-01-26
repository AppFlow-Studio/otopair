/**
 * VinScannerScreen
 *
 * PURPOSE: Camera screen to scan VIN barcodes
 *
 * USED IN: Navigated from add-vehicle.tsx
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useState, useEffect } from 'react';
import { Dimensions, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// 2. Expo & Third-party
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { X, Flashlight } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants
import { Spacing } from '@/constants/theme';

// ============================================================================
// COMPONENT
// ============================================================================

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function VinScannerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

  const handleClose = () => {
    router.back();
  };

  const handleBarCodeScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    
    const { data } = result;
    
    // VINs are 17 characters
    if (data && data.length === 17) {
      setScanned(true);
      // Navigate to add-car-info with the scanned VIN
      router.replace({
        pathname: '/add-car-info',
        params: { vin: data.toUpperCase() },
      });
    }
  };

  const toggleTorch = () => {
    setTorch(!torch);
  };

  if (!permission) {
    return (
      <View style={styles.container}>
        <Text color="#FFFFFF">Requesting camera permission...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text weight="bold" size="xl" color="#FFFFFF" style={styles.permissionTitle}>
            Camera Permission Required
          </Text>
          <Text size="md" color="#CCCCCC" style={styles.permissionText}>
            We need camera access to scan your VIN barcode
          </Text>
          <Pressable
            onPress={requestPermission}
            style={({ pressed }) => [
              styles.permissionButton,
              pressed && styles.permissionButtonPressed,
            ]}
          >
            <Text weight="semiBold" size="md" color="#000000">
              Grant Permission
            </Text>
          </Pressable>
          <Pressable onPress={handleClose} style={styles.cancelButton}>
            <Text weight="medium" size="md" color="#FFFFFF">
              Cancel
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent />
      
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{
          barcodeTypes: ['code128', 'code39', 'code93', 'datamatrix', 'qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top Section */}
        <View style={[styles.overlaySection, styles.overlayTop, { paddingTop: insets.top }]}>
          {/* Close Button */}
          <Pressable
            onPress={handleClose}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
          >
            <X size={28} color="#FFFFFF" strokeWidth={2} />
          </Pressable>

          {/* Torch Button */}
          <Pressable
            onPress={toggleTorch}
            style={({ pressed }) => [
              styles.torchButton,
              torch && styles.torchButtonActive,
              pressed && styles.torchButtonPressed,
            ]}
          >
            <Flashlight size={24} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>

        {/* Middle Section with Scanner Frame */}
        <View style={styles.middleSection}>
          <View style={styles.sideOverlay} />
          <View style={styles.scannerFrame}>
            {/* Corner Markers */}
            <View style={[styles.corner, styles.cornerTopLeft]} />
            <View style={[styles.corner, styles.cornerTopRight]} />
            <View style={[styles.corner, styles.cornerBottomLeft]} />
            <View style={[styles.corner, styles.cornerBottomRight]} />
          </View>
          <View style={styles.sideOverlay} />
        </View>

        {/* Bottom Section */}
        <View style={[styles.overlaySection, styles.overlayBottom, { paddingBottom: insets.bottom + 40 }]}>
          <Text weight="bold" size="lg" color="#FFFFFF" style={styles.instructionTitle}>
            Scan VIN Barcode
          </Text>
          <Text size="sm" color="#CCCCCC" style={styles.instructionText}>
            Position the VIN barcode within the frame.{'\n'}
            Usually found on the driver's door or dashboard.
          </Text>
        </View>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const SCANNER_WIDTH = SCREEN_WIDTH * 0.85;
const SCANNER_HEIGHT = 120;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlaySection: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  overlayTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
  overlayBottom: {
    flex: 1,
    alignItems: 'center',
    paddingTop: Spacing.xl,
  },
  middleSection: {
    flexDirection: 'row',
    height: SCANNER_HEIGHT,
  },
  sideOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scannerFrame: {
    width: SCANNER_WIDTH,
    height: SCANNER_HEIGHT,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderColor: '#5B7FFF',
    borderWidth: 3,
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 8,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 8,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  torchButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  torchButtonActive: {
    backgroundColor: '#5B7FFF',
  },
  torchButtonPressed: {
    opacity: 0.7,
  },
  instructionTitle: {
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  instructionText: {
    textAlign: 'center',
    lineHeight: 20,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  permissionTitle: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  permissionText: {
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  permissionButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: 30,
    marginBottom: Spacing.md,
  },
  permissionButtonPressed: {
    opacity: 0.8,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
  },
});

