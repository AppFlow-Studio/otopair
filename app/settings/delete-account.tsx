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

import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput,
  Image,
  ActivityIndicator,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  useWindowDimensions,
  Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { User } from "lucide-react-native";
import {
  BottomSheetTextInput,
  BottomSheetModal,
  BottomSheetScrollView,
} from "@gorhom/bottom-sheet";
import { BlurBackdrop } from "@/components/shared-ui/BlurBackdrop";
import { useQuery } from "convex/react";

import {
  BrandColors,
  Spacing,
  Text,
  BlurHeaderOverlay,
  FontSize,
  FontFamily,
} from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useAccountDeletion } from "@/hooks/useAccountDeletion";

export default function DeleteAccountScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const router = useRouter();

  // Hook for account deletion logic
  const { sendVerificationCode, verifyDeletionCode, markAccountForDeletion } =
    useAccountDeletion();

  // Convex data
  const me = useQuery(api.users.getMe);
  const data = useOnboardingStore((state) => state.data);

  // Local state
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isSurveyStep, setIsSurveyStep] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [surveyDetails, setSurveyDetails] = useState("");
  const [sheetKeyboardInset, setSheetKeyboardInset] = useState(0);
  const [isSurveyDetailsFocused, setIsSurveyDetailsFocused] = useState(false);

  const inputRefs = useRef<(TextInput | null)[]>([]);
  const lastAutoSubmittedCode = useRef<string | null>(null);
  const shouldExitAfterSheetDismiss = useRef(false);
  const sheetRef = useRef<BottomSheetModal>(null);
  const sheetScrollRef = useRef<BottomSheetScrollView>(null);
  const snapPoints = useMemo(() => ["88%"], []);
  const isCodeComplete = useMemo(() => code.join("").length === 6, [code]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      setSheetKeyboardInset(event.endCoordinates.height);

      if (isSurveyStep && isSurveyDetailsFocused) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            sheetScrollRef.current?.scrollToEnd({ animated: true });
          });
        });
      }
    });

    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setSheetKeyboardInset(0);
    });

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [isSurveyStep, isSurveyDetailsFocused]);

  const fullName = useMemo(() => {
    const fromConvex =
      me != null && (me.first_name ?? me.last_name)
        ? `${me.first_name ?? ""} ${me.last_name ?? ""}`.trim()
        : "";
    if (fromConvex.length > 0) return fromConvex;
    const fromOnboarding =
      `${data.firstName ?? ""} ${data.lastName ?? ""}`.trim();
    return fromOnboarding.length > 0 ? fromOnboarding : "User";
  }, [me, data.firstName, data.lastName]);

  const email = useMemo(() => {
    return me?.email ?? data.email ?? "your email";
  }, [me?.email, data.email]);

  const profilePhotoUri = useMemo(() => {
    return me?.profile_photo_url ?? data.profilePhotoUri ?? null;
  }, [me?.profile_photo_url, data.profilePhotoUri]);

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
    } else if (digit && index === 5) {
      inputRefs.current[index]?.blur();
      Keyboard.dismiss();
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

  const handleVerifyDeletionCode = useCallback(async (fullCode: string) => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await verifyDeletionCode(fullCode);
      setIsSurveyStep(false);
      setSelectedReason(null);
      setSurveyDetails("");
      sheetRef.current?.present();
    } catch (error: any) {
      const msg =
        error?.errors?.[0]?.longMessage ||
        error?.errors?.[0]?.message ||
        error?.message ||
        "";
      const lowerMsg = msg.toLowerCase();

      if (
        lowerMsg.includes("incorrect") ||
        lowerMsg.includes("invalid") ||
        lowerMsg.includes("expired")
      ) {
        setErrorMessage(
          "The verification code you entered is incorrect or has expired.",
        );
      } else if (lowerMsg.includes("already been verified")) {
        setErrorMessage(
          "This verification code has already been used. Please request a new one.",
        );
      } else {
        setErrorMessage(msg || "Failed to verify code. Please try again.");
      }
    } finally {
      setIsDeleting(false);
    }
  }, [verifyDeletionCode]);

  useEffect(() => {
    const fullCode = code.join("");
    if (!codeSent) {
      lastAutoSubmittedCode.current = null;
      return;
    }

    if (fullCode.length < 6) {
      lastAutoSubmittedCode.current = null;
      return;
    }

    if (!isDeleting && lastAutoSubmittedCode.current !== fullCode) {
      lastAutoSubmittedCode.current = fullCode;
      void handleVerifyDeletionCode(fullCode);
    }
  }, [code, codeSent, isDeleting, handleVerifyDeletionCode]);

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

    const fullCode = code.join("");
    if (fullCode.length < 6) {
      setErrorMessage(
        "Please enter the 6-digit verification code sent to your email.",
      );
      return;
    }

    await handleVerifyDeletionCode(fullCode);
  };

  const handleProceedToSurvey = () => {
    setIsSurveyStep(true);
  };

  const handleSheetDismiss = () => {
    setIsSurveyStep(false);
    setSelectedReason(null);
    setSurveyDetails("");
    if (shouldExitAfterSheetDismiss.current) {
      shouldExitAfterSheetDismiss.current = false;
      router.back();
    }
  };

  const handleCancelDeletionFlow = () => {
    shouldExitAfterSheetDismiss.current = true;
    sheetRef.current?.dismiss();
  };

  const handleSurveyDetailsFocus = useCallback(() => {
    setSelectedReason(OTHER_REASON);
    setIsSurveyDetailsFocused(true);
    requestAnimationFrame(() => {
      sheetScrollRef.current?.scrollToEnd({ animated: true });
    });
  }, []);

  const handleSurveyDetailsBlur = useCallback(() => {
    setIsSurveyDetailsFocused(false);
  }, []);

  const handleFinalizeDeletion = async (survey: { response?: string; skipped?: boolean }) => {
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await markAccountForDeletion(survey);
      sheetRef.current?.dismiss();
      router.replace("/(onboarding)");
    } catch (error: any) {
      console.error("Final delete error:", error);
      sheetRef.current?.dismiss();
      setErrorMessage(error?.message || "Failed to finalize account deletion.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSubmitSurvey = async () => {
    if (!selectedReason || isDeleting) return;

    const trimmedDetails = surveyDetails.trim();
    const response =
      selectedReason && trimmedDetails
        ? `Reason: ${selectedReason} | Details: ${trimmedDetails}`
        : selectedReason ?? (trimmedDetails.length > 0 ? trimmedDetails : undefined);

    await handleFinalizeDeletion({
      response,
      skipped: false,
    });
  };

  const handleSkipSurvey = async () => {
    await handleFinalizeDeletion({
      skipped: true,
    });
  };

  const handleResendCode = async () => {
    if (timer > 0) return;
    setCode(["", "", "", "", "", ""]);
    setFocusedIndex(0);
    setErrorMessage(null);
    inputRefs.current[0]?.focus();
    setIsDeleting(true);
    try {
      await sendVerificationCode();
      setTimer(60);
    } catch {
      setErrorMessage("Failed to resend code. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenPrivacyPolicy = useCallback(async () => {
    const url = "https://www.otopair.com/privacy-policy";
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      }
    } catch (error) {
      console.error("Failed to open privacy policy:", error);
    }
  }, []);

  const containerPadding = Spacing["2xl"] * 2;
  const boxMargin = Spacing.sm * 2;
  const totalMarginSpace = 6 * boxMargin;
  const availableWidth = width - containerPadding;
  const OTHER_REASON = "Other";
  const surveyOptions = [
    "Duplicate account",
    "No longer need the service",
    "Difficult to use",
    "Moving out of NYC",
    "Privacy concerns",
    "Not satisfied with the app",
    OTHER_REASON,
  ];
  const isSurveySubmitDisabled = isDeleting || !selectedReason;
  const calculatedBoxWidth = Math.max(
    40,
    Math.floor((availableWidth - totalMarginSpace) / 6),
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <BlurHeaderOverlay
        title="Delete Account"
        titleColor={BrandColors.primary}
        onBack={() => router.back()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 80,
            paddingBottom:
              insets.bottom +
              (Platform.OS === "ios" &&
              parseInt(Platform.Version as string, 10) >= 26
                ? 80
                : 100),
          },
        ]}
      >
        {!codeSent ? (
          <>
            <View style={styles.header}>
              <Text style={styles.subtitle}>
                Permanently delete your account from Otopair. This cannot be
                undone. Your data can never be retrieved once deleted.
              </Text>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text size="sm" color="#f87171" weight="medium">
                  {errorMessage}
                </Text>
              </View>
            )}

            <View style={styles.profileCard}>
              <View style={styles.avatarContainer}>
                {profilePhotoUri ? (
                  <Image
                    source={{ uri: profilePhotoUri }}
                    style={styles.avatar}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <User size={30} color="#9CA3AF" />
                  </View>
                )}
              </View>
              <View style={styles.profileInfo}>
                <Text
                  weight="semiBold"
                  size="md"
                  color="#1d1d1f"
                  numberOfLines={1}
                >
                  {fullName}
                </Text>
                <Text size="sm" color="#86868b" numberOfLines={1}>
                  {email}
                </Text>
              </View>
            </View>

            <View style={styles.inputSection}>
              <Text
                weight="semiBold"
                size="sm"
                color="#1d1d1f"
                style={styles.inputLabel}
              >
                Security Confirmation
              </Text>
              <View style={styles.inputCard}>
                <View style={styles.inputWrapper}>
                  <Text size="sm" color="#86868b" style={styles.infoText}>
                    For security purposes, we will send a verification code to
                    your email address to confirm this action.
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.footer}>
              <Pressable
                style={({ pressed }) => [
                  styles.deleteButton,
                  {
                    backgroundColor: codeSent ? "#F87171" : BrandColors.primary,
                    shadowColor: codeSent ? "#F87171" : BrandColors.primary,
                  },
                  (pressed || isDeleting) && {
                    opacity: 0.8,
                    transform: [{ scale: 0.98 }],
                  },
                ]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text
                    weight="semiBold"
                    color="#FFF"
                    style={styles.deleteButtonText}
                  >
                    Send Verification Code
                  </Text>
                )}
              </Pressable>

              <Pressable
                style={styles.cancelButton}
                onPress={() => router.back()}
                disabled={isDeleting}
              >
                <Text
                  weight="medium"
                  color="#1d1d1f"
                  style={styles.cancelButtonText}
                >
                  Cancel
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.verificationContainer}>
            <View style={styles.header}>
              <Text weight="bold" style={styles.title}>
                Verify it&apos;s you
              </Text>
              <Text style={styles.subtitle}>
                Enter the 6-digit code sent to {email}
              </Text>
            </View>

            {/* Error Message */}
            {errorMessage && (
              <View style={styles.errorContainer}>
                <Text size="sm" color="#f87171" weight="medium">
                  {errorMessage}
                </Text>
              </View>
            )}

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
              <Text
                style={[styles.resendText, timer > 0 && styles.resendDisabled]}
              >
                {timer > 0 ? `Resend code in ${timer}s` : "Resend code"}
              </Text>
            </Pressable>

            <View style={styles.footer}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setCodeSent(false)}
                disabled={isDeleting}
              >
                <Text
                  weight="medium"
                  color="#1d1d1f"
                  style={styles.cancelButtonText}
                >
                  Back
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <BottomSheetModal
        ref={sheetRef}
        snapPoints={snapPoints}
        backdropComponent={BlurBackdrop}
        enableDynamicSizing={false}
        enableContentPanningGesture={false}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
        onDismiss={handleSheetDismiss}
        handleIndicatorStyle={styles.sheetHandle}
        backgroundStyle={styles.sheetBackground}
      >
        <BottomSheetScrollView
          ref={sheetScrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.sheetContentContainer,
            {
              paddingBottom:
                insets.bottom +
                24 +
                (isSurveyStep
                  ? Math.max(sheetKeyboardInset - insets.bottom, 0) * 0.32 + 8
                  : 0),
            },
          ]}
        >
          {!isSurveyStep ? (
            <>
              <View style={styles.sheetTitleWrap}>
                <Text style={styles.sheetTitle}>Are you sure?</Text>
              </View>

              <View style={styles.sheetBody}>
                <Text style={styles.sheetSectionTitle}>
                  What&apos;s going to happen:
                </Text>

                <View style={styles.sheetBulletRow}>
                  <View style={styles.sheetBulletDot} />
                  <Text style={styles.sheetBulletText}>
                    Your account will be{" "}
                    <Text style={styles.sheetBulletStrong}>
                      deactivated immediately
                    </Text>
                    .
                  </Text>
                </View>

                <View style={styles.sheetBulletRow}>
                  <View style={styles.sheetBulletDot} />
                  <Text style={styles.sheetBulletText}>
                    It will be reactivated if you relogin{" "}
                    <Text style={styles.sheetBulletStrong}>within 30 days</Text>
                    .
                  </Text>
                </View>

                <View style={styles.sheetBulletRow}>
                  <View style={styles.sheetBulletDot} />
                  <Text style={styles.sheetBulletText}>
                    Afterwards, your data will be{" "}
                    <Text style={styles.sheetBulletStrong}>
                      permanently deleted
                    </Text>
                    .
                  </Text>
                </View>

                <Text style={styles.sheetInfoText}>
                  For more information about account deletion, read our{" "}
                  <Text
                    style={styles.sheetLinkText}
                    onPress={handleOpenPrivacyPolicy}
                  >
                    Privacy Policy
                  </Text>
                  .
                </Text>
              </View>

              <View style={styles.sheetActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetDeleteButton,
                    (pressed || isDeleting) && styles.sheetPressed,
                  ]}
                  onPress={handleProceedToSurvey}
                  disabled={isDeleting}
                >
                  <Text
                    weight="semiBold"
                    color="#FFF"
                    style={styles.sheetDeleteButtonText}
                  >
                    I&apos;m sure
                  </Text>
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.sheetCancelButton,
                    pressed && styles.sheetPressed,
                  ]}
                  onPress={handleCancelDeletionFlow}
                  disabled={isDeleting}
                >
                  <Text weight="semiBold" style={styles.sheetCancelButtonText}>
                    I changed my mind
                  </Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <View style={styles.surveyHeader}>
                <Text style={styles.surveyTitle}>Account Deletion</Text>
                <Text style={styles.surveySubtitle}>
                  Why are you interested in deleting your account?
                </Text>
              </View>

              <View style={styles.surveyOptionsList}>
                {surveyOptions.map((option) => {
                  const selected = selectedReason === option;
                  return (
                    <Pressable
                      key={option}
                      style={styles.surveyOptionRow}
                      onPress={() => setSelectedReason(option)}
                    >
                      <View
                        style={[
                          styles.surveyRadio,
                          selected && styles.surveyRadioSelected,
                        ]}
                      />
                      <Text style={styles.surveyOptionText}>{option}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <BottomSheetTextInput
                value={surveyDetails}
                onChangeText={setSurveyDetails}
                onFocus={handleSurveyDetailsFocus}
                onBlur={handleSurveyDetailsBlur}
                placeholder="(Optional) Enter more details"
                placeholderTextColor="#9CA3AF"
                style={styles.surveyDetailsInput}
                multiline
              />

              <View style={styles.sheetActions}>
                <Pressable
                  style={({ pressed }) => [
                    styles.sheetSubmitButton,
                    isSurveySubmitDisabled && styles.sheetDisabled,
                    (pressed || isSurveySubmitDisabled) && styles.sheetPressed,
                  ]}
                  onPress={handleSubmitSurvey}
                  disabled={isSurveySubmitDisabled}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text
                      weight="semiBold"
                      color="#FFF"
                      style={styles.sheetDeleteButtonText}
                    >
                      Submit
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  style={({ pressed }) => [
                    styles.surveySkipButton,
                    pressed && styles.sheetPressed,
                  ]}
                  onPress={handleSkipSurvey}
                  disabled={isDeleting}
                >
                  <Text weight="semiBold" style={styles.surveySkipButtonText}>
                    Skip
                  </Text>
                </Pressable>
              </View>

              {sheetKeyboardInset > 0 && (
                <View style={{ height: Math.max(sheetKeyboardInset * 0.1, 20) }} />
              )}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheetModal>
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
  errorContainer: {
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
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
  profileCard: {
    backgroundColor: "rgba(255, 255, 255, 1)",
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "#000",
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
    backgroundColor: "#F3F4F6",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  profileInfo: {
    flex: 1,
    overflow: "hidden",
  },
  inputSection: {
    gap: 12,
  },
  inputLabel: {
    marginLeft: 8,
    fontFamily: FontFamily.semiBold,
  },
  inputCard: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    overflow: "hidden",
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
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
  deleteButton: {
    backgroundColor: BrandColors.primary,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
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
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: 17,
    fontFamily: FontFamily.medium,
  },
  sheetBackground: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  sheetHandle: {
    backgroundColor: "#E5E5EA",
    width: 44,
  },
  sheetContentContainer: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  sheetTitleWrap: {
    marginTop: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  sheetTitle: {
    fontSize: 24,
    lineHeight: 30,
    color: "#1d1d1f",
    fontFamily: FontFamily.bold,
  },
  sheetBody: {
    gap: 16,
  },
  sheetSectionTitle: {
    fontSize: 17,
    lineHeight: 22,
    color: "#1d1d1f",
    fontFamily: FontFamily.medium,
  },
  sheetBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  sheetBulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#1d1d1f",
    marginTop: 10,
  },
  sheetBulletText: {
    flex: 1,
    fontSize: 17,
    lineHeight: 26,
    color: "#1d1d1f",
    fontFamily: FontFamily.regular,
  },
  sheetBulletStrong: {
    fontFamily: FontFamily.bold,
    color: "#1d1d1f",
  },
  sheetInfoText: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 22,
    color: "#86868b",
    fontFamily: FontFamily.regular,
  },
  sheetLinkText: {
    color: "#2563EB",
    fontFamily: FontFamily.semiBold,
  },
  sheetActions: {
    marginTop: 28,
    gap: 12,
  },
  sheetDeleteButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F87171",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F87171",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sheetDeleteButtonText: {
    fontSize: 17,
    fontFamily: FontFamily.semiBold,
  },
  sheetSubmitButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  sheetCancelButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCancelButtonText: {
    fontSize: 17,
    color: "#1d1d1f",
    fontFamily: FontFamily.semiBold,
  },
  surveyHeader: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 12,
  },
  surveyTitle: {
    fontSize: 36,
    lineHeight: 42,
    color: "#1d1d1f",
    fontFamily: FontFamily.bold,
    marginBottom: 6,
  },
  surveySubtitle: {
    fontSize: 17,
    lineHeight: 26,
    color: "#86868b",
    fontFamily: FontFamily.regular,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  surveyOptionsList: {
    marginTop: 8,
    gap: 6,
  },
  surveyOptionRow: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  surveyRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFF",
  },
  surveyRadioSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "rgba(82, 153, 254, 0.2)",
  },
  surveyOptionText: {
    fontSize: 18,
    lineHeight: 24,
    color: "#1d1d1f",
    fontFamily: FontFamily.medium,
  },
  surveyDetailsInput: {
    marginTop: 14,
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: "#F8F8F8",
    paddingHorizontal: 18,
    paddingVertical: 14,
    fontSize: 17,
    color: "#1d1d1f",
    fontFamily: FontFamily.regular,
  },
  surveySkipButton: {
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  surveySkipButtonText: {
    fontSize: 17,
    color: "#8B8B90",
    fontFamily: FontFamily.semiBold,
  },
  sheetPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  sheetDisabled: {
    opacity: 0.6,
  },
});
