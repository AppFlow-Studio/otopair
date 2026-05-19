/**
 * BiometricSetupScreen
 *
 * PURPOSE: Setup page for biometric authentication (Face ID, Touch ID, or generic Biometrics).
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <BiometricSetupScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Fingerprint, X, ScanFace } from 'lucide-react-native';

import {
  BrandColors,
  Button,
  FontSize,
  Spacing,
  Text,
} from '@/components/shared-ui';
import { Layout } from '@/constants/theme';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

type BiometricType = 'face' | 'touch' | 'fingerprint' | 'biometric' | 'none';

const labelMap: Record<Exclude<BiometricType, 'none'>, string> = {
  face: 'Face ID',
  touch: 'Touch ID',
  fingerprint: 'Fingerprint',
  biometric: 'Biometrics',
};

const getAuthErrorMessage = (error: string | undefined, label: string) => {
  switch (error) {
    case 'not_enrolled':
      return `${label} isn't set up on this device. Add it in system settings and try again.`;
    case 'not_available':
      return 'Biometric authentication is not available on this device.';
    case 'user_cancel':
    case 'user_fallback':
    case 'system_cancel':
      return `Permission not granted. You can try again when you're ready.`;
    case 'lockout':
      return 'Too many attempts. Please try again later.';
    default:
      return `Could not enable ${label}. Please try again.`;
  }
};

export default function BiometricSetupScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { updateData } = useOnboardingStore();

  const [biometricType, setBiometricType] = useState<BiometricType>('none');
  const [hasHardware, setHasHardware] = useState<boolean | null>(null);
  const [isEnrolled, setIsEnrolled] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const checkBiometrics = async () => {
      try {
        setIsChecking(true);
        const hardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const supportedTypes = await LocalAuthentication.supportedAuthenticationTypesAsync();

        if (!isMounted) return;
        setHasHardware(hardware);
        setIsEnrolled(enrolled);

        if (!hardware || supportedTypes.length === 0) {
          setBiometricType('none');
          return;
        }

        const hasFace = supportedTypes.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
        const hasFingerprint = supportedTypes.includes(LocalAuthentication.AuthenticationType.FINGERPRINT);

        if (Platform.OS === 'ios') {
          if (hasFace) {
            setBiometricType('face');
          } else if (hasFingerprint) {
            setBiometricType('touch');
          } else {
            setBiometricType('biometric');
          }
        } else {
          if (supportedTypes.length === 1 && hasFingerprint) {
            setBiometricType('fingerprint');
          } else {
            setBiometricType('biometric');
          }
        }
      } catch {
        if (!isMounted) return;
        setHasHardware(false);
        setIsEnrolled(false);
        setBiometricType('none');
        setErrorMessage('Unable to check biometric settings right now.');
      } finally {
        if (isMounted) setIsChecking(false);
      }
    };

    checkBiometrics();
    return () => {
      isMounted = false;
    };
  }, []);

  const biometricLabel = useMemo(() => {
    if (biometricType === 'none') return 'Biometrics';
    return labelMap[biometricType];
  }, [biometricType]);

  const titleText = useMemo(() => {
    if (biometricType === 'none') return 'Set up Biometrics';
    return `Set up ${biometricLabel}`;
  }, [biometricLabel, biometricType]);

  const descriptionText = useMemo(() => {
    if (hasHardware === false) {
      return 'This device does not support biometric login.';
    }
    if (isEnrolled === false) {
      return `${biometricLabel} is not set up on this device. Add it in system settings to continue.`;
    }
    return `Add ${biometricLabel} to make your account more secure.`;
  }, [biometricLabel, hasHardware, isEnrolled]);

  const handleEnable = useCallback(async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!hasHardware) {
      setErrorMessage('This device does not support biometric login.');
      return;
    }
    if (isEnrolled === false) {
      setErrorMessage(`${biometricLabel} is not set up on this device.`);
      return;
    }

    setIsLoading(true);
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: `Enable ${biometricLabel}`,
        cancelLabel: 'Cancel',
        disableDeviceFallback: true,
      });

      if (result.success) {
        updateData({
          biometricLoginEnabled: true,
          biometricLoginType: biometricType === 'none' ? null : biometricType,
          biometricLoginSkipped: false,
        });
        router.replace({ 
          pathname: '/settings/success', 
          params: { type: biometricType } 
        });
      } else {
        setErrorMessage(getAuthErrorMessage(result.error, biometricLabel));
      }
    } catch {
      setErrorMessage(`Could not enable ${biometricLabel}. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  }, [biometricLabel, biometricType, hasHardware, isEnrolled, router, updateData]);

  const handleSkip = useCallback(() => {
    updateData({
      biometricLoginEnabled: false,
      biometricLoginType: null,
      biometricLoginSkipped: true,
    });
    router.replace('/home');
  }, [router, updateData]);

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={10}>
          <X size={18} color="#111827" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <Text weight="bold" size="xl" color="#111827" style={styles.title}>
          {titleText}
        </Text>
        <Text size="sm" color="#6B7280" style={styles.subtitle}>
          {descriptionText}
        </Text>

        <View style={styles.iconWrap}>
          <View style={styles.iconCircle}>
            {biometricType === 'face' ? (
              <ScanFace size={64} color={BrandColors.secondary} />
            ) : (
              <Fingerprint size={64} color={BrandColors.secondary} />
            )}
          </View>
        </View>

        {isChecking ? (
          <View style={styles.statusRow}>
            <ActivityIndicator size="small" color={BrandColors.secondary} />
            <Text size="sm" color="#6B7280">
              Checking device settings...
            </Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + Layout.footerHeight }]}>
        {errorMessage ? (
          <Text size="sm" color="#EF4444" style={styles.message}>
            {errorMessage}
          </Text>
        ) : null}
        {successMessage ? (
          <Text size="sm" color="#10B981" style={styles.message}>
            {successMessage}
          </Text>
        ) : null}

        <Button
          variant="primary"
          fullWidth
          loading={isLoading}
          disabled={isChecking || hasHardware === false}
          onPress={handleEnable}
          style={styles.enableButton}
        >
          {biometricType === 'face' ? "Enable Face ID" : 
           biometricType === 'touch' ? "Enable Touch ID" : 
           biometricType === 'fingerprint' ? "Enable Fingerprint" : "Enable Biometrics"}
        </Button>
        
        {/*Skip, I'll do it later button 
        <Pressable onPress={handleSkip} style={styles.skipButton}>
          <Text size="sm" color="#6B7280">
            Skip, I'll do it later
          </Text>
        </Pressable>
        */}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E8ECF0',
    paddingHorizontal: Spacing['2xl'],
  },
  header: {
    paddingBottom: 0,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    paddingTop: Spacing.xl,
    alignItems: 'center',
  },
  title: {
    textAlign: 'center',
  },
  subtitle: {
    textAlign: 'center',
    marginTop: Spacing.sm,
    maxWidth: 280,
  },
  iconWrap: {
    marginTop: Spacing.xl,
    marginBottom: Spacing.lg,
  },
  iconCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(59, 130, 246, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
  },
  actions: {
    paddingHorizontal: Spacing.xl,
  },
  enableButton: {
    paddingVertical: 14,
    borderRadius: 14,
  },
  skipButton: {
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingVertical: 6,
  },
  message: {
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
});
