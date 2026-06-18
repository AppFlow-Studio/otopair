import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@clerk/clerk-expo";
import { X } from "lucide-react-native";

import {
  BlurHeaderOverlay,
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  Text,
} from "@/components/shared-ui";
import { useOnboardingPersistence } from "@/hooks/useOnboardingPersistence";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import {
  cleanupStaleUnverifiedPhoneNumbers,
  destroyOtherPhoneNumbers,
  findPhoneNumberByNormalizedValue,
  isPhoneNumberVerified,
  normalizePhoneForComparison,
} from "@/lib/clerk-phone-numbers";
import { normalizeContactEmail } from "@/lib/contact-validation";
import { OnboardingSurfaceColors } from "@/components/onboarding/onboardingColors";

type VerificationTarget = "phone" | "email";

// Prevent duplicate auto-send bursts across rapid remount/re-render cycles in dev.
const recentAutoSendMap = new Map<string, number>();
const AUTO_SEND_DEBOUNCE_MS = 5000;

export default function VerifyContactUpdateScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { user } = useUser();
  const { persistProfileField } = useOnboardingPersistence();
  const updateData = useOnboardingStore((s) => s.updateData);

  const {
    verifyPhone = "0",
    verifyEmail = "0",
    pendingPhone = "",
    pendingEmail = "",
    pendingPhoneVerificationId = "",
    pendingEmailVerificationId = "",
  } = useLocalSearchParams<{
    verifyPhone?: string;
    verifyEmail?: string;
    pendingPhone?: string;
    pendingEmail?: string;
    pendingPhoneVerificationId?: string;
    pendingEmailVerificationId?: string;
  }>();

  const steps = useMemo<VerificationTarget[]>(() => {
    const list: VerificationTarget[] = [];
    if (verifyPhone === "1" && pendingPhone) list.push("phone");
    if (verifyEmail === "1" && pendingEmail) list.push("email");
    return list;
  }, [verifyPhone, verifyEmail, pendingPhone, pendingEmail]);

  const [stepIndex, setStepIndex] = useState(0);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const phoneVerificationRef = useRef<any>(null);
  const emailVerificationRef = useRef<any>(null);
  const initialPrimaryEmailIdRef = useRef<string | null>(null);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const autoPreparedStepsRef = useRef<Record<VerificationTarget, boolean>>({
    phone: false,
    email: false,
  });

  const currentStep = steps[stepIndex];
  const isMultiStep = steps.length === 2;

  useEffect(() => {
    if (!user) return;
    if (initialPrimaryEmailIdRef.current === null) {
      initialPrimaryEmailIdRef.current = user.primaryEmailAddressId ?? null;
    }
  }, [user]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const destroyPendingResources = useCallback(async () => {
    try {
      if (phoneVerificationRef.current?.destroy) {
        await phoneVerificationRef.current.destroy();
      }
    } catch (error) {
      console.warn("Failed to cleanup pending phone resource:", error);
    }

    try {
      if (emailVerificationRef.current?.destroy) {
        await emailVerificationRef.current.destroy();
      }
    } catch (error) {
      console.warn("Failed to cleanup pending email resource:", error);
    }
  }, []);

  const handleCancel = useCallback(async () => {
    await destroyPendingResources();
    router.back();
  }, [destroyPendingResources, router]);

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
  }, [height, showErrorModal, slideAnim]);

  const showVerificationError = useCallback((message: string) => {
    setErrorMessage(message);
    setShowErrorModal(true);
  }, []);

  const handleCloseErrorModal = useCallback(() => {
    setShowErrorModal(false);
    setErrorMessage(null);
  }, []);

  const prepareVerificationForCurrentStep = useCallback(async (options?: { force?: boolean }) => {
    if (!currentStep) return;
    const force = options?.force === true;

    if (currentStep === "phone" && user && pendingPhoneVerificationId && !phoneVerificationRef.current) {
      phoneVerificationRef.current =
        user.phoneNumbers.find((phoneNumber) => phoneNumber.id === pendingPhoneVerificationId) ?? null;
    }
    if (currentStep === "email" && user && pendingEmailVerificationId && !emailVerificationRef.current) {
      emailVerificationRef.current =
        user.emailAddresses.find((emailAddress) => emailAddress.id === pendingEmailVerificationId) ?? null;
    }

    if (!force && autoPreparedStepsRef.current[currentStep]) {
      return;
    }

    if (!force) {
      const dedupeKey = `${currentStep}:${currentStep === "phone" ? pendingPhone : pendingEmail}`;
      const lastSentAt = recentAutoSendMap.get(dedupeKey) ?? 0;
      if (Date.now() - lastSentAt < AUTO_SEND_DEBOUNCE_MS) {
        autoPreparedStepsRef.current[currentStep] = true;
        return;
      }
      recentAutoSendMap.set(dedupeKey, Date.now());
    }

    if (!user) {
      showVerificationError("User session not ready. Please try again.");
      return;
    }

    setIsPreparing(true);
    setErrorMessage(null);
    try {
      if (currentStep === "phone") {
        const normalizedPendingPhone = normalizePhoneForComparison(pendingPhone);
        await cleanupStaleUnverifiedPhoneNumbers(user, normalizedPendingPhone);
        let preparedPhoneWasProvided =
          pendingPhoneVerificationId.length > 0 &&
          phoneVerificationRef.current?.id === pendingPhoneVerificationId;
        if (!phoneVerificationRef.current) {
          const preparedPhone = pendingPhoneVerificationId
            ? user.phoneNumbers.find((phoneNumber) => phoneNumber.id === pendingPhoneVerificationId)
            : null;
          preparedPhoneWasProvided = preparedPhone != null;
          const existingPhone = findPhoneNumberByNormalizedValue(user, normalizedPendingPhone);
          phoneVerificationRef.current =
            preparedPhone ??
            (existingPhone && !isPhoneNumberVerified(existingPhone)
              ? existingPhone
              : await user.createPhoneNumber({
                  phoneNumber: pendingPhone,
                }));
        }
        if (force || !pendingPhoneVerificationId || !preparedPhoneWasProvided) {
          await phoneVerificationRef.current.prepareVerification();
        }
      } else {
        let preparedEmailWasProvided =
          pendingEmailVerificationId.length > 0 &&
          emailVerificationRef.current?.id === pendingEmailVerificationId;
        if (!emailVerificationRef.current) {
          const preparedEmail = pendingEmailVerificationId
            ? user.emailAddresses.find((emailAddress) => emailAddress.id === pendingEmailVerificationId)
            : null;
          const existingEmail = user.emailAddresses.find(
            (emailAddress) =>
              normalizeContactEmail(emailAddress.emailAddress) === normalizeContactEmail(pendingEmail),
          );
          preparedEmailWasProvided = preparedEmail != null;
          emailVerificationRef.current =
            preparedEmail ??
            existingEmail ??
            (await user.createEmailAddress({
              email: pendingEmail,
            }));
        }
        if (force || !pendingEmailVerificationId || !preparedEmailWasProvided) {
          await emailVerificationRef.current.prepareVerification({ strategy: "email_code" });
        }
      }
      setTimer(60);
      autoPreparedStepsRef.current[currentStep] = true;
    } catch (error: any) {
      const msg =
        error?.errors?.[0]?.longMessage ||
        error?.errors?.[0]?.message ||
        error?.message ||
        "Unable to send verification code.";
      showVerificationError(msg);
    } finally {
      setIsPreparing(false);
    }
  }, [
    currentStep,
    pendingEmail,
    pendingEmailVerificationId,
    pendingPhone,
    pendingPhoneVerificationId,
    showVerificationError,
    user,
  ]);

  useEffect(() => {
    if (steps.length === 0) {
      router.back();
      return;
    }
    setCode(["", "", "", "", "", ""]);
    setFocusedIndex(0);
    setErrorMessage(null);
    setShowErrorModal(false);
    prepareVerificationForCurrentStep();
  }, [stepIndex, steps.length, prepareVerificationForCurrentStep, router]);

  const handleCodeChange = (value: string, index: number) => {
    const digit = value.replace(/\D/g, "");
    if (digit.length > 1) return;

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setErrorMessage(null);

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

  const finalizeUpdates = useCallback(async () => {
    const payload: Record<string, any> = {};
    const storePayload: Record<string, any> = {};
    const userUpdatePayload: Record<string, any> = {};

    // 1) Promote newly-verified resources to primary in Clerk.
    if (verifyPhone === "1" && phoneVerificationRef.current?.id) {
      userUpdatePayload.primaryPhoneNumberId = phoneVerificationRef.current.id;
    }
    if (verifyEmail === "1" && emailVerificationRef.current?.id) {
      userUpdatePayload.primaryEmailAddressId = emailVerificationRef.current.id;
    }

    if (Object.keys(userUpdatePayload).length > 0 && user) {
      await user.update(userUpdatePayload);
    }

    // 2) Remove old contact methods so updates act as replace (not append).
    if (verifyPhone === "1" && user && phoneVerificationRef.current?.id) {
      await destroyOtherPhoneNumbers(user, phoneVerificationRef.current.id);
    }

    if (
      verifyEmail === "1" &&
      user &&
      initialPrimaryEmailIdRef.current &&
      initialPrimaryEmailIdRef.current !== emailVerificationRef.current?.id
    ) {
      const previousPrimaryEmail = user.emailAddresses.find(
        (e) => e.id === initialPrimaryEmailIdRef.current,
      );
      try {
        await previousPrimaryEmail?.destroy();
      } catch (error) {
        console.warn("Failed to remove previous primary email address:", error);
      }
    }

    // 3) Persist final values in app data stores.
    if (verifyPhone === "1" && pendingPhone) {
      payload.phone = pendingPhone;
      payload.phoneVerified = true;
      storePayload.phoneNumber = pendingPhone;
      storePayload.phoneVerified = true;
    }
    if (verifyEmail === "1" && pendingEmail) {
      payload.email = pendingEmail;
      storePayload.email = pendingEmail;
    }

    updateData(storePayload);
    await persistProfileField(payload);
    router.replace("/home");
  }, [
    pendingEmail,
    pendingPhone,
    persistProfileField,
    router,
    updateData,
    verifyEmail,
    verifyPhone,
    user,
  ]);

  const handleSubmitCode = useCallback(async (fullCode: string) => {
    if (!currentStep || fullCode.length !== 6) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      if (currentStep === "phone") {
        await phoneVerificationRef.current?.attemptVerification({ code: fullCode });
      } else {
        await emailVerificationRef.current?.attemptVerification({ code: fullCode });
      }

      if (stepIndex < steps.length - 1) {
        setStepIndex((prev) => prev + 1);
      } else {
        await finalizeUpdates();
      }
    } catch (error: any) {
      const msg =
        error?.errors?.[0]?.longMessage ||
        error?.errors?.[0]?.message ||
        error?.message ||
        "Verification failed. Please check the code and try again.";
      showVerificationError(msg);
      setCode(["", "", "", "", "", ""]);
      setFocusedIndex(0);
      inputRefs.current[0]?.focus();
    } finally {
      setIsSubmitting(false);
    }
  }, [currentStep, finalizeUpdates, showVerificationError, stepIndex, steps.length]);

  useEffect(() => {
    const fullCode = code.join("");
    if (fullCode.length === 6 && !isSubmitting && !isPreparing) {
      handleSubmitCode(fullCode);
    }
  }, [code, handleSubmitCode, isPreparing, isSubmitting]);

  const handleResendCode = async () => {
    if (timer > 0 || isPreparing) return;
    setCode(["", "", "", "", "", ""]);
    setFocusedIndex(0);
    setErrorMessage(null);
    setShowErrorModal(false);
    inputRefs.current[0]?.focus();
    await prepareVerificationForCurrentStep({ force: true });
  };

  const destination = currentStep === "phone" ? pendingPhone : pendingEmail;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <BlurHeaderOverlay title="Verify Update" titleColor={BrandColors.primary} onBack={handleCancel} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 80,
            paddingBottom: insets.bottom + 100,
          },
        ]}
      >
        <View style={styles.verificationContainer}>
          {isMultiStep ? (
            <Text size="sm" color="#6B7280" style={styles.stepText}>
              Step {stepIndex + 1} of {steps.length}
            </Text>
          ) : null}

          <View style={styles.header}>
            <Text weight="bold" style={styles.title}>
              {"Verify it's you"}
            </Text>
            <Text style={styles.subtitle}>
              Enter the 6-digit code sent to {destination}
            </Text>
          </View>

          <View style={styles.codeContainer}>
            {code.map((digit, index) => (
              <View key={index} style={styles.codeInputWrapper}>
                {index === 3 && <Text style={styles.codeSeparator}>-</Text>}
                <TextInput
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.codeInput,
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
            disabled={timer > 0 || isPreparing}
          >
            <Text style={[styles.resendText, (timer > 0 || isPreparing) && styles.resendDisabled]}>
              {isPreparing
                ? "Sending code..."
                : timer > 0
                ? `Resend code in ${timer}s`
                : "Resend code"}
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Pressable style={styles.cancelButton} onPress={handleCancel} disabled={isSubmitting}>
              <Text weight="medium" color="#1d1d1f" style={styles.cancelButtonText}>
                Cancel
              </Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleCloseErrorModal}
      >
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
            <Text style={styles.errorTitle}>Incorrect code entered</Text>
            <Text style={styles.errorMessage}>
              {errorMessage || "Please check the code and try again"}
            </Text>
            <TouchableOpacity style={styles.errorButton} onPress={handleCloseErrorModal}>
              <Text style={styles.errorButtonText}>Got it</Text>
            </TouchableOpacity>
          </Animated.View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F5F5F7",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  verificationContainer: {
    flex: 1,
  },
  stepText: {
    textAlign: "center",
    marginBottom: 8,
  },
  header: {
    paddingVertical: Spacing.lg,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    color: "#1d1d1f",
    letterSpacing: -0.5,
    fontFamily: FontFamily.bold,
  },
  subtitle: {
    fontSize: 17,
    lineHeight: 24,
    color: "#86868b",
    marginTop: 8,
    fontFamily: FontFamily.regular,
  },
  errorContainer: {
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing.xl,
    marginTop: 8,
  },
  codeInputWrapper: {
    position: "relative",
    marginHorizontal: Spacing.sm,
  },
  codeSeparator: {
    position: "absolute",
    left: -Spacing.lg + 2.5,
    top: "50%",
    marginTop: -12,
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: "#1d1d1f",
    opacity: 0.3,
  },
  codeInput: {
    width: 44,
    height: 60,
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0, 0, 0, 0.1)",
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: "#1d1d1f",
    textAlign: "center",
    padding: 0,
  },
  codeInputFocused: {
    borderColor: BrandColors.primary,
    borderWidth: 2,
    backgroundColor: "rgba(255, 255, 255, 1)",
  },
  resendContainer: {
    alignItems: "center",
    marginTop: 24,
  },
  resendText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: BrandColors.primary,
  },
  resendDisabled: {
    color: "#86868b",
    opacity: 0.7,
  },
  footer: {
    marginTop: "auto",
    paddingTop: 40,
    gap: 16,
  },
  submitButton: {
    backgroundColor: BrandColors.secondary,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    fontSize: 17,
    fontFamily: FontFamily.semiBold,
  },
  cancelButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 17,
    fontFamily: FontFamily.medium,
  },
  errorModalBackdrop: {
    flex: 1,
    backgroundColor: OnboardingSurfaceColors.backdrop,
    justifyContent: "flex-end",
    alignItems: "center",
  },
  errorModal: {
    backgroundColor: OnboardingSurfaceColors.card,
    borderRadius: 28,
    padding: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
    alignItems: "center",
    width: "95%",
    alignSelf: "center",
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.border,
  },
  errorModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: OnboardingSurfaceColors.handle,
    borderRadius: 2,
    marginBottom: Spacing.xs,
  },
  errorIconContainer: {
    marginBottom: Spacing.lg,
  },
  errorTitle: {
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: OnboardingSurfaceColors.text,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  errorMessage: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.mutedText,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: OnboardingSurfaceColors.primaryButton,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
    width: "100%",
    alignItems: "center",
  },
  errorButtonText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semiBold,
    color: OnboardingSurfaceColors.primaryButtonText,
  },
});
