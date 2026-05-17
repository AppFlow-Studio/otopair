/**
 * ConfirmPhoneNumberStep
 *
 * PURPOSE: 6-digit code verification step for onboarding phone number validation.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <ConfirmPhoneNumberStep
 *     onNext={handleNext}
 *     onBack={handleBack}
 *     progress={{ total: 8, filled: 1 }}
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

// TODO: Replace with actual code verification logic

import { BrandColors, FontFamily, FontSize, Spacing, Text } from "@/components/shared-ui";
import { ProgressBar } from "@/components/shared-ui/ProgressBar";
import { BackButton } from "@/components/shared-ui/BackButton";
import { useState, useEffect, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  Modal,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useUser, useSignUp } from "@clerk/clerk-expo";
import { useOnboardingPersistence } from "@/hooks/useOnboardingPersistence";
import { useEnsureConvexUser } from "@/hooks/useEnsureConvexUser";
import { X } from "lucide-react-native";

interface ConfirmPhoneNumberStepProps {
  onNext: () => void;
  onBack: () => void;
  progress: { total: number; filled: number };
}

export function ConfirmPhoneNumberStep({ onNext, onBack, progress }: ConfirmPhoneNumberStepProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { data, updateData } = useOnboardingStore();
  const { user } = useUser();
  const { signUp, setActive } = useSignUp();
  const { persistProfileField } = useOnboardingPersistence();
  const ensureConvexUser = useEnsureConvexUser();
  const isSignUpFlow = data.phoneNumberId === "signup_flow";

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(60);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim = useRef(new Animated.Value(height)).current;

  const isVerificationNotStartedError = (msg: string | null) =>
    msg != null &&
    (msg.includes("Verification wasn't started") ||
      msg.includes("No phone number found") ||
      msg.includes("No user or signUp session"));

  const formatPhoneNumberForDisplay = () => {
    const phone = data.phoneNumber || "";
    if (phone.length === 0) return "+1";
    return phone;
  };

  useEffect(() => {
    console.log("Full phone number:", data.phoneNumber);
  }, []);

  useEffect(() => {
    if (timeRemaining > 0) {
      timerRef.current = setTimeout(() => {
        setTimeRemaining(timeRemaining - 1);
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeRemaining]);

  useEffect(() => {
    const fullCode = code.join("");
    if (fullCode.length === 6 && !verifying) {
      verifyPhoneCode(fullCode);
    }
  }, [code]);

  const verifyPhoneCode = async (fullCode: string) => {
    setVerifying(true);
    setErrorMessage(null);

    try {
      // No valid path: verification was never prepared (e.g. user landed here without sending a code)
      if (isSignUpFlow && !signUp) {
        setErrorMessage("Verification wasn't started. Go back and confirm your number to receive a code.");
        setShowErrorModal(true);
        return;
      }
      if (!isSignUpFlow && !user) {
        setErrorMessage("Verification wasn't started. Go back and confirm your number to receive a code.");
        setShowErrorModal(true);
        return;
      }
      if (!isSignUpFlow && user && !data.phoneNumberId && (!user.phoneNumbers || user.phoneNumbers.length === 0)) {
        setErrorMessage("Verification wasn't started. Go back and confirm your number to receive a code.");
        setShowErrorModal(true);
        return;
      }

      if (isSignUpFlow && signUp) {
        // Email signup flow: verify via signUp object
        const result = await signUp.attemptPhoneNumberVerification({ code: fullCode });
        console.log("Phone verified via signUp, status:", result.status);

        if (result.status === "complete" && result.createdSessionId) {
          await setActive?.({ session: result.createdSessionId });
          // Brief delay so Clerk session and JWT propagate before Convex calls
          await new Promise((r) => setTimeout(r, 400));
          try {
            await ensureConvexUser();
          } catch (e) {
            console.error("Failed to ensure Convex user after phone verification:", e);
          }
        }

        const phoneToSave = data.phoneNumber ?? (isSignUpFlow && signUp?.phoneNumber ? String(signUp.phoneNumber) : undefined);
        updateData({ phoneVerified: true });
        await persistProfileField(
          { phone: phoneToSave || undefined, phoneVerified: true },
          { skipSignedInCheck: true }
        );
        onNext();
      } else if (user) {
        // OAuth flow: verify via user object
        const phoneNumberId = data.phoneNumberId;
        const phoneNumberResource = user.phoneNumbers.find((p) => p.id === phoneNumberId);

        if (phoneNumberResource) {
          await phoneNumberResource.attemptVerification({ code: fullCode });
          console.log("Phone verified successfully");
        } else {
          // Fallback: try the most recent phone number
          const latestPhone = user.phoneNumbers?.[user.phoneNumbers.length - 1];
          if (latestPhone) {
            await latestPhone.attemptVerification({ code: fullCode });
            console.log("Phone verified successfully (fallback)");
          } else {
            setErrorMessage("Verification wasn't started. Go back and confirm your number to receive a code.");
            setShowErrorModal(true);
            return;
          }
        }

        const phoneToSave =
          data.phoneNumber ??
          (user?.phoneNumbers?.[0]?.phoneNumber ?? user?.phoneNumbers?.[user.phoneNumbers.length - 1]?.phoneNumber);
        updateData({ phoneVerified: true });
        await persistProfileField(
          { phone: phoneToSave || undefined, phoneVerified: true },
          { skipSignedInCheck: true }
        );
        onNext();
      } else {
        setErrorMessage("Verification wasn't started. Go back and confirm your number to receive a code.");
        setShowErrorModal(true);
        return;
      }
    } catch (err) {
      console.error("Phone verification failed:", err);
      setErrorMessage(err instanceof Error ? err.message : "Verification failed. Please try again.");
      setShowErrorModal(true);
      setCode(["", "", "", "", "", ""]);
      setFocusedIndex(0);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  };

  // Animate error modal slide up
  useEffect(() => {
    if (showErrorModal) {
      slideAnim.setValue(height);
      requestAnimationFrame(() => {
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      });
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [showErrorModal, slideAnim, height]);

  const handleCodeChange = (value: string, index: number) => {
    const digit = value.replace(/\D/g, "");
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
    if (e.nativeEvent.key === "Backspace") {
      const newCode = [...code];

      if (newCode[index]) {
        newCode[index] = "";
        setCode(newCode);
      } else if (index > 0) {
        newCode[index - 1] = "";
        setCode(newCode);
        setFocusedIndex(index - 1);
        inputRefs.current[index - 1]?.focus();
      }
    }
  };

  const handleResendCode = async () => {
    setTimeRemaining(60);
    setCode(["", "", "", "", "", ""]);
    setFocusedIndex(0);
    inputRefs.current[0]?.focus();

    try {
      if (isSignUpFlow && signUp) {
        await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
        console.log("Resent verification code via signUp");
      } else if (user) {
        const phoneNumberId = data.phoneNumberId;
        const phoneNumberResource = user.phoneNumbers.find((p) => p.id === phoneNumberId);
        if (phoneNumberResource) {
          await phoneNumberResource.prepareVerification();
          console.log("Resent verification code via user");
        }
      }
    } catch (err) {
      console.error("Failed to resend code:", err);
    }
  };

  const handleCloseErrorModal = () => {
    setShowErrorModal(false);
    setErrorMessage(null);
  };

  const handleGoBackFromError = () => {
    setShowErrorModal(false);
    setErrorMessage(null);
    onBack();
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Calculate responsive box width for smaller screens
  const containerPadding = Spacing["2xl"] * 2; // Left + right padding
  const boxMargin = Spacing.sm * 2; // Left + right margin per box (8px each side)
  const totalMarginSpace = 6 * boxMargin; // Total margin space for 6 boxes
  const availableWidth = width - containerPadding;
  const calculatedBoxWidth = Math.max(
    40, // Minimum width
    Math.floor((availableWidth - totalMarginSpace) / 6),
  );

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
    codeInput: { width: calculatedBoxWidth },
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardView}>
      <View style={[styles.container, dynamicStyles.container]}>
        <ProgressBar
          total={progress.total}
          filled={progress.filled}
          leftElement={<BackButton onBack={onBack} alwaysShow />}
        />

        <View style={styles.headerContent}>
          <Text style={styles.title}>6-digit code</Text>
          <Text style={styles.subtitle}>Enter the code sent to {formatPhoneNumberForDisplay()}</Text>
        </View>

        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <View key={index} style={styles.codeInputWrapper}>
              {index === 3 && <Text style={styles.codeSeparator}>-</Text>}
              <TextInput
                ref={(ref) => {
                  inputRefs.current[index] = ref;
                }}
                style={[styles.codeInput, dynamicStyles.codeInput, focusedIndex === index && styles.codeInputFocused]}
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

        <View style={styles.resendContainer}>
          {timeRemaining > 0 ? (
            <Text style={styles.resendTimer}>Resend code in {formatTimer(timeRemaining)}</Text>
          ) : (
            <Pressable onPress={handleResendCode}>
              <Text style={styles.resendButton}>Resend code</Text>
            </Pressable>
          )}
        </View>

        <View style={{ flex: 1 }} />
      </View>

      <Modal visible={showErrorModal} transparent animationType="none" onRequestClose={handleCloseErrorModal}>
        <Pressable style={styles.errorModalBackdrop} onPress={handleCloseErrorModal}>
          <Animated.View
            style={[
              styles.errorModal,
              {
                transform: [{ translateY: slideAnim }],
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.errorModalHandle} />
            <View style={styles.errorIconContainer}>
              <X size={48} color="#EF4444" strokeWidth={3} />
            </View>
            <Text style={styles.errorTitle}>
              {errorMessage && isVerificationNotStartedError(errorMessage)
                ? "Verification not started"
                : "Incorrect code entered"}
            </Text>
            <Text style={styles.errorMessage}>{errorMessage || "Please check the code and try again"}</Text>
            {errorMessage && isVerificationNotStartedError(errorMessage) ? (
              <TouchableOpacity style={styles.errorButton} onPress={handleGoBackFromError}>
                <Text style={styles.errorButtonText}>Go back</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity style={styles.errorButton} onPress={handleCloseErrorModal}>
                <Text style={styles.errorButtonText}>Got it</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  container: { flex: 1 },
  headerContent: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.bold,
    color: '#0F172A',
    marginBottom: Spacing.md,
    lineHeight: Spacing["5xl"],
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.9,
    lineHeight: Spacing["2xl"],
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.xl,
  },
  codeInputWrapper: { position: "relative", marginHorizontal: Spacing.sm },
  codeSeparator: {
    position: "absolute",
    left: -Spacing.lg + 2.5,
    top: "50%",
    marginTop: -12,
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: '#0F172A',
    opacity: 0.5,
  },
  codeInput: {
    width: 50,
    height: 60,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: '#0F172A',
    textAlign: "center",
    padding: 0,
  },
  codeInputFocused: {
    borderColor: BrandColors.white,
    borderWidth: 2,
    backgroundColor: "#5299FE",
  },
  resendContainer: { alignItems: "center", paddingHorizontal: Spacing["2xl"] },
  resendTimer: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.8,
  },
  resendButton: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: "#1E40AF",
    opacity: 1,
  },
  errorModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  errorModal: {
    backgroundColor: "#1F2937",
    borderRadius: 50,
    padding: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
    alignItems: "center",
    width: "95%",
    alignSelf: "center",
    marginBottom: Spacing.lg,
  },
  errorModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#6B7280",
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  errorIconContainer: { marginBottom: Spacing.lg },
  errorTitle: {
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: '#0F172A',
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  errorMessage: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: "#829BAD",
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    width: "100%",
    alignItems: "center",
  },
  errorButtonText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semiBold,
    color: "#000000",
  },
});
