import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  TouchableOpacity,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { 
  BrandColors, 
  FontFamily, 
  FontSize, 
  Spacing, 
  Text, 
  GlassCircleButton,
  BorderRadius,
  Shadows
} from '@/components/shared-ui';
import { useOnboardingStore } from '@/stores/useOnboardingStore';

// TODO: Replace with actual code verification logic
const CORRECT_CODE = "676767";

export default function TwoFactorAuthScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { data } = useOnboardingStore();

  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60); // 1 minute in seconds
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayTarget = useMemo(() => {
    return data.email || data.phoneNumber || 'your device';
  }, [data.email, data.phoneNumber]);

  useEffect(() => {
    if (timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(prev => prev - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeRemaining]);

  const handleCodeChange = (value: string, index: number) => {
    setErrorMessage(null);
    const digit = value.replace(/\D/g, '');
    if (digit.length > 1) return;

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    if (digit && index < 5) {
      setFocusedIndex(index + 1);
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace') {
      const newCode = [...code];

      if (newCode[index]) {
        newCode[index] = '';
        setCode(newCode);
      } else if (index > 0) {
        newCode[index - 1] = '';
        setCode(newCode);
        setFocusedIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleResendCode = () => {
    setTimeRemaining(60);
    setCode(['', '', '', '', '', '']);
    setFocusedIndex(0);
    setErrorMessage(null);
    inputRefs.current[0]?.focus();
    console.log('Resending 2FA code...');
  };

  // Auto-submit effect when code is complete
  useEffect(() => {
    const fullCode = code.join('');
    if (fullCode.length === 6 && !isLoading) {
      const verifyCode = async () => {
        Keyboard.dismiss();
        setIsLoading(true);
        setErrorMessage(null);

        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (timeRemaining <= 0) {
          setErrorMessage('Code has expired. Please request a new one.');
          setIsLoading(false);
          return;
        }

        if (fullCode === CORRECT_CODE) {
          console.log('2FA verified successfully');
          router.back();
        } else {
          setErrorMessage('Incorrect code entered. Please check and try again.');
          setCode(['', '', '', '', '', '']);
          setFocusedIndex(0);
          inputRefs.current[0]?.focus();
          setIsLoading(false);
        }
      };

      verifyCode();
    }
  }, [code, router]);

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Responsive sizing for boxes
  const boxWidth = Math.min(50, (width - Spacing['2xl'] * 2 - Spacing.sm * 10) / 6);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.screen}
    >
      <View style={[styles.container, { paddingTop: insets.top + 10 }]}>
        {/* Header */}
        <View style={styles.header}>
          <GlassCircleButton 
            size={40} 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <ArrowLeft size={20} color={BrandColors.secondary} strokeWidth={2.5} />
          </GlassCircleButton>
        </View>

        <View style={styles.content}>
          <Text weight="bold" size="3xl" color="#111827" style={styles.title}>
            Enter the code we sent you
          </Text>
          <Text size="md" color="#6B7280" style={styles.subtitle}>
            Please verify the 6-digit code we sent to <Text weight="bold" color="#111827">{displayTarget}</Text>. It's valid for 1 minute.
          </Text>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[
                  styles.codeInput,
                  { width: boxWidth, height: boxWidth * 1.2 },
                  focusedIndex === index && styles.codeInputFocused,
                  digit !== '' && styles.codeInputFilled,
                ]}
                value={digit}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
                onFocus={() => setFocusedIndex(index)}
                keyboardType="number-pad"
                maxLength={1}
                selectTextOnFocus
                autoFocus={index === 0}
              />
            ))}
          </View>

          <View style={styles.resendContainer}>
            {timeRemaining > 0 ? (
              <Text size="sm" color="#6B7280">
                Resend code in <Text weight="bold" color={BrandColors.secondary}>{formatTimer(timeRemaining)}</Text>
              </Text>
            ) : (
              <View style={styles.resendRow}>
                <Text size="sm" color="#6B7280">No code received? </Text>
                <TouchableOpacity onPress={handleResendCode}>
                  <Text weight="semiBold" size="sm" color={BrandColors.secondary}>
                    Resend Code
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          {errorMessage && (
            <View style={styles.errorBox}>
              <Text size="sm" color="#EF4444" style={styles.errorText}>
                {errorMessage}
              </Text>
            </View>
          )}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={BrandColors.secondary} />
              <Text size="sm" color="#6B7280" style={{ marginTop: 12 }}>
                Verifying code...
              </Text>
            </View>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#E8ECF0',
  },
  container: {
    flex: 1,
    paddingHorizontal: Spacing['2xl'],
  },
  header: {
    marginBottom: Spacing.xl,
  },
  backButton: {
    marginLeft: -10, // Adjust for shadow/rim
  },
  content: {
    flex: 1,
  },
  title: {
    marginBottom: Spacing.md,
    lineHeight: 38,
  },
  subtitle: {
    marginBottom: Spacing['3xl'],
    lineHeight: 22,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xl,
  },
  codeInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    fontSize: FontSize['3xl'],
    fontFamily: FontFamily.bold,
    color: '#111827',
    textAlign: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    ...Shadows.sm,
  },
  codeInputFocused: {
    borderColor: BrandColors.secondary,
    borderWidth: 2,
  },
  codeInputFilled: {
    // Optional styling for filled boxes
  },
  resendContainer: {
    alignItems: 'flex-start',
    marginBottom: Spacing.xl,
  },
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  errorBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  errorText: {
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing['3xl'],
  },
});
