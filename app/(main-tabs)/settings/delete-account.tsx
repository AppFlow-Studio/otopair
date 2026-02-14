/**
 * DeleteAccountScreen
 *
 * PURPOSE: Allows users to permanently delete their account.
 * Requires email verification code for security.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * OWNER: Daniel Chelala
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { User } from 'lucide-react-native';
import { useQuery, useMutation } from 'convex/react';

import {
  BrandColors,
  Spacing,
  Text,
  BlurHeaderOverlay,
  FontSize,
  FontFamily,
} from '@/components/shared-ui';
import { api } from '@/convex/_generated/api';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useAccountDeletion } from '@/hooks/useAccountDeletion';

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { isLoaded: isAuthLoaded } = useAuth();
  const { user, isLoaded: isUserLoaded } = useUser();
  
  // Hook for account deletion logic
  const { sendVerificationCode, confirmDeletion } = useAccountDeletion();
  
  // Convex data
  const me = useQuery(api.users.getMe);
  const data = useOnboardingStore((state) => state.data);

  // Local state
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [timer, setTimer] = useState(0);
  
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const fullName = useMemo(() => {
    const fromConvex = me != null && (me.first_name ?? me.last_name) 
      ? `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim() 
      : "";
    if (fromConvex.length > 0) return fromConvex;
    const fromOnboarding = `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
    return fromOnboarding.length > 0 ? fromOnboarding : "User";
  }, [me, data.firstName, data.lastName]);

  const email = useMemo(() => {
    return me?.email ?? data.email ?? "your email";
  }, [me?.email, data.email]);

  const profilePhotoUri = useMemo(() => {
    return me?.profile_photo_url ?? data.profilePhotoUri ?? null;
  }, [me?.profile_photo_url, data.profilePhotoUri]);

  const handleCodeChange = (value: string, index: number) => {
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

  const handleDeleteAccount = async () => {
    if (!codeSent) {
      setIsDeleting(true);
      try {
        await sendVerificationCode();
        console.log("Triggering verification code for:", email);
        setCodeSent(true);
        setTimer(60); // 60 second resend timer
        setErrorMessage(null);
      } catch (error: any) {
        console.error("Failed to send verification code:", error);
        setErrorMessage("Failed to send verification code. Please try again.");
      } finally {
        setIsDeleting(false);
      }
      return;
    }

    const fullCode = code.join('');
    if (fullCode.length < 6) {
      setErrorMessage("Please enter the 6-digit verification code sent to your email.");
      return;
    }

    if (!user || !isUserLoaded) {
      setErrorMessage("User data not loaded. Please try again.");
      return;
    }

    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? Your account will be deactivated for 30 days before permanent deletion. You can log back in anytime during this period to reactivate it.",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            setErrorMessage(null);
            try {
              // Use the hook to confirm deletion
              await confirmDeletion(fullCode);
              
              // Redirect (signOut is handled by the hook)
              router.replace('/(onboarding)');
            } catch (error: any) {
              console.error("Delete account error:", error);
              setErrorMessage(error.message || "Failed to delete account. Please check the code and try again.");
            } finally {
              setIsDeleting(false);
            }
          }
        }
      ]
    );
  };

  const handleResendCode = () => {
    if (timer > 0) return;
    setCode(['', '', '', '', '', '']);
    setFocusedIndex(0);
    inputRefs.current[0]?.focus();
    // Re-trigger code
    handleDeleteAccount();
  };

  const containerPadding = Spacing['2xl'] * 2;
  const boxMargin = Spacing.sm * 2;
  const totalMarginSpace = 6 * boxMargin;
  const availableWidth = width - containerPadding;
  const calculatedBoxWidth = Math.max(40, Math.floor((availableWidth - totalMarginSpace) / 6));

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}
    >
      <BlurHeaderOverlay
        title="Delete Account"
        titleColor={BrandColors.primary}
        onBack={() => {
          if (codeSent) {
            setCodeSent(false);
            setCode(['', '', '', '', '', '']);
            setFocusedIndex(0);
          } else {
            router.back();
          }
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.container,
          { 
            paddingTop: insets.top + 80, 
            paddingBottom: insets.bottom + (Platform.OS === 'ios' && parseInt(Platform.Version as string, 10) >= 26 ? 80 : 100) 
          }
        ]}
      >
        {!codeSent ? (
          <>
            <View style={styles.header}>
              <Text weight="bold" style={styles.title}>Delete account</Text>
              <Text style={styles.subtitle}>
                Permanently delete your account from Otopair. This cannot be undone. Your data can never be retrieved once deleted.
              </Text>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text size="sm" color="#f87171" weight="medium">{errorMessage}</Text>
              </View>
            )}

            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                {profilePhotoUri ? (
                  <Image source={{ uri: profilePhotoUri }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={30} color="#9CA3AF" />
                  </View>
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text weight="semiBold" size="md" color="#1d1d1f" numberOfLines={1}>
                  {fullName}
                </Text>
                <Text size="sm" color="#86868b" numberOfLines={1}>
                  {email}
                </Text>
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text weight="semiBold" size="sm" color="#1d1d1f" style={styles.inputLabel}>
                Security Confirmation
              </Text>
              <View style={styles.inputCard}>
                <View style={styles.inputWrapper}>
                  <Text size="sm" color="#86868b" style={styles.infoText}>
                    For security purposes, we will send a verification code to your email address to confirm this action.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  { backgroundColor: codeSent ? '#F87171' : BrandColors.primary, shadowColor: codeSent ? '#F87171' : BrandColors.primary },
                  (pressed || isDeleting) && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text weight="semiBold" color="#FFF" style={styles.deleteButtonText}>
                    Send Verification Code
                  </Text>
                )}
              </Pressable>

              <Pressable 
                style={styles.cancelButton}
                onPress={() => router.back()}
                disabled={isDeleting}
              >
                <Text weight="medium" color="#1d1d1f" style={styles.cancelButtonText}>
                  Cancel
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.verificationContainer}>
            <View style={styles.header}>
              <Text weight="bold" style={styles.title}>Verify it's you</Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to {email}
              </Text>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text size="sm" color="#f87171" weight="medium">{errorMessage}</Text>
              </View>
            )}

            <View style={styles.codeContainer}>
              {code.map((digit, index) => (
                <View key={index} style={styles.codeInputWrapper}>
                  {index === 3 && <Text style={styles.codeSeparator}>-</Text>}
                  <TextInput
                    ref={(ref) => { inputRefs.current[index] = ref; }}
                    style={[
                      styles.codeInput,
                      { width: calculatedBoxWidth },
                      focusedIndex === index && styles.codeInputFocused,
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
                </View>
              ))}
            </View>

            <Pressable 
              onPress={handleResendCode}
              style={styles.resendContainer}
              disabled={timer > 0}
            >
              <Text style={[styles.resendText, timer > 0 && styles.resendDisabled]}>
                {timer > 0 ? `Resend code in ${timer}s` : "Resend code"}
              </Text>
            </Pressable>

            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  { backgroundColor: codeSent ? '#F87171' : BrandColors.primary, shadowColor: codeSent ? '#F87171' : BrandColors.primary },
                  (pressed || isDeleting) && { opacity: 0.8, transform: [{ scale: 0.98 }] }
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text weight="semiBold" color="#FFF" style={styles.deleteButtonText}>
                    Delete account
                  </Text>
                )}
              </Pressable>

              <Pressable 
                style={styles.cancelButton}
                onPress={() => setCodeSent(false)}
                disabled={isDeleting}
              >
                <Text weight="medium" color="#1d1d1f" style={styles.cancelButtonText}>
                  Back
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  errorContainer: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  header: {
    paddingVertical: Spacing.lg,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    color: '#1d1d1f',
    letterSpacing: -0.5,
    fontFamily: FontFamily.bold,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: '#86868b',
    marginTop: 8,
    fontFamily: FontFamily.regular,
  },
  profileCard: {
    backgroundColor: 'rgba(255, 255, 255, 1)',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 40,
    elevation: 2,
    marginBottom: 24,
  },
  avatarContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F3F4F6',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatar: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  avatarPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInfo: {
    flex: 1,
    overflow: 'hidden',
  },
  inputSection: {
    gap: 12,
  },
  inputLabel: {
    marginLeft: 8,
    fontFamily: FontFamily.semiBold,
  },
  inputCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    overflow: 'hidden',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoText: {
    paddingVertical: 4,
    lineHeight: 20,
    fontFamily: FontFamily.regular,
  },
  verificationContainer: {
    flex: 1,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    marginBottom: Spacing.xl,
    marginTop: 8,
  },
  codeInputWrapper: { 
    position: 'relative', 
    marginHorizontal: Spacing.sm 
  },
  codeSeparator: {
    position: 'absolute',
    left: -Spacing.lg + 2.5,
    top: '50%',
    marginTop: -12,
    fontSize: FontSize['2xl'],
    fontFamily: FontFamily.bold,
    color: '#1d1d1f',
    opacity: 0.3,
  },
  codeInput: {
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    fontSize: FontSize['2xl'],
    fontFamily: FontFamily.bold,
    color: '#1d1d1f',
    textAlign: 'center',
    padding: 0,
  },
  codeInputFocused: {
    borderColor: BrandColors.primary,
    borderWidth: 2,
    backgroundColor: 'rgba(255, 255, 255, 1)',
  },
  resendContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  resendText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.primary,
  },
  resendDisabled: {
    color: '#86868b',
    opacity: 0.7,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 40,
    gap: 16,
  },
  deleteButton: {
    backgroundColor: BrandColors.primary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  deleteButtonText: {
    fontSize: 17,
    fontFamily: FontFamily.semiBold,
  },
  cancelButton: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 17,
    fontFamily: FontFamily.medium,
  },
});
