import { ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSignIn } from "@clerk/clerk-expo";
import { zxcvbn, zxcvbnOptions } from "@zxcvbn-ts/core";
import * as zxcvbnCommonPackage from "@zxcvbn-ts/language-common";
import {
  Country,
  CountryCode,
  FlagType,
  getAllCountries,
} from "react-native-country-picker-modal";
import { Eye, EyeOff, Mail, Phone, Search } from "lucide-react-native";
import {
  ActivityIndicator,
  Animated,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Text } from "@/components/shared-ui";
import { BackButton } from "@/components/shared-ui/BackButton";
import { FooterButton } from "@/components/shared-ui/FooterButton";
import {
  BorderRadius,
  BrandColors,
  FontFamily,
  FontSize,
  SemanticColors,
  Spacing,
} from "@/constants/theme";
import { OnboardingSurfaceColors } from "../onboardingColors";
import {
  distributePasswordResetCodeInput,
  PasswordResetFlowStep,
  PasswordResetMethod,
  getPasswordResetErrorMessage,
  getPasswordResetAttempt,
  getPasswordResetBackTarget,
  getPasswordResetIdentifierLabel,
  getPasswordResetStrategy,
  isValidResetEmail,
  validateResetPassword,
} from "@/lib/password-reset";

zxcvbnOptions.setOptions({
  dictionary: {
    ...zxcvbnCommonPackage.dictionary,
  },
  graphs: zxcvbnCommonPackage.adjacencyGraphs,
});

type LoadingState = "send" | "verify" | "reset" | null;

interface ForgotPasswordFlowProps {
  initialEmail?: string;
  onBackToLogin: () => void;
  onAuthenticated: () => Promise<void>;
}

export function ForgotPasswordFlow({
  initialEmail,
  onBackToLogin,
  onAuthenticated,
}: ForgotPasswordFlowProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [step, setStep] = useState<PasswordResetFlowStep>("method");
  const [method, setMethod] = useState<PasswordResetMethod>("email");
  const [email, setEmail] = useState(initialEmail?.trim() ?? "");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState<CountryCode>("US");
  const [country, setCountry] = useState<Country | null>(null);
  const [countries, setCountries] = useState<Country[]>([]);
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [identifier, setIdentifier] = useState("");
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [focusedCodeIndex, setFocusedCodeIndex] = useState(0);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState<LoadingState>(null);
  const [error, setError] = useState<string | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const codeInputRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const slideAnim = useRef(new Animated.Value(height)).current;

  const isCompact = height < 720;
  const buttonSize: "md" | "lg" = isCompact ? "md" : "lg";
  const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
    codeInput: {
      width: Math.max(
        40,
        Math.floor((width - Spacing["2xl"] * 2 - Spacing.sm * 12) / 6)
      ),
    },
  };

  const selectedIdentifierLabel = getPasswordResetIdentifierLabel(method, identifier);
  const passwordValidation = validateResetPassword(newPassword, confirmPassword);

  const strength = useMemo(() => {
    if (!newPassword) return 0;
    return Math.max(zxcvbn(newPassword).score, 1);
  }, [newPassword]);

  const strengthLabel = useMemo(() => {
    if (!newPassword) return "";
    switch (strength) {
      case 1:
        return "Weak";
      case 2:
        return "Fair";
      case 3:
        return "Good";
      case 4:
        return "Strong";
      default:
        return "";
    }
  }, [newPassword, strength]);

  const strengthColor = useMemo(() => {
    switch (strength) {
      case 1:
        return SemanticColors.errorRedLightOnDark;
      case 2:
        return SemanticColors.warningAmber;
      case 3:
        return SemanticColors.warningAmberLight;
      case 4:
        return SemanticColors.successGreenLightOnDark;
      default:
        return SemanticColors.border;
    }
  }, [strength]);

  const canSubmitEmail = isValidResetEmail(email);
  const canSubmitPhone = phoneNumber.replace(/\D/g, "").length > 0;
  const canSubmitPassword =
    passwordValidation.canSubmit && loading === null && isLoaded && newPassword.length > 0;

  const handleBack = useCallback(() => {
    setError(null);

    switch (getPasswordResetBackTarget(step, method)) {
      case "login":
        onBackToLogin();
        break;
      case "method":
        setStep("method");
        break;
      case "email":
        setStep("email");
        break;
      case "phone":
        setStep("phone");
        break;
    }
  }, [method, onBackToLogin, step]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });

    return () => sub.remove();
  }, [handleBack]);

  useEffect(() => {
    getAllCountries(FlagType.EMOJI, "common")
      .then((allCountries) => {
        const validCountries = allCountries.filter(
          (item) => item.callingCode.length > 0 && item.callingCode[0].trim().length > 0
        );
        setCountries(validCountries);
        setCountry(validCountries.find((item) => item.cca2 === "US") ?? null);
      })
      .catch(() => {
        setCountries([]);
      });
  }, []);

  useEffect(() => {
    if (timeRemaining <= 0) return;

    timerRef.current = setTimeout(() => {
      setTimeRemaining((current) => Math.max(0, current - 1));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [timeRemaining]);

  useEffect(() => {
    if (showCountryPicker) {
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
        duration: 240,
        useNativeDriver: true,
      }).start();
    }
  }, [height, showCountryPicker, slideAnim]);

  const filteredCountries = useMemo(() => {
    const validCountries = countries.filter(
      (item) => item.callingCode.length > 0 && item.callingCode[0].trim().length > 0
    );

    if (!countrySearch.trim()) {
      const usCountry = validCountries.find((item) => item.cca2 === "US");
      const otherCountries = validCountries.filter((item) => item.cca2 !== "US");
      return usCountry ? [usCountry, ...otherCountries] : validCountries;
    }

    const query = countrySearch.toLowerCase();
    return validCountries.filter((item) => {
      const name = getCountryName(item).toLowerCase();
      return (
        name.includes(query) ||
        item.cca2.toLowerCase().includes(query) ||
        item.callingCode[0].includes(query)
      );
    });
  }, [countries, countrySearch]);

  function selectMethod(nextMethod: PasswordResetMethod) {
    setMethod(nextMethod);
    setError(null);
    setStep(nextMethod);
  }

  function getCallingCode() {
    return country?.callingCode[0] ?? "1";
  }

  function getFormattedPhoneIdentifier() {
    return `+${getCallingCode()}${phoneNumber.replace(/\D/g, "")}`;
  }

  function resetCodeInputs() {
    setCode(["", "", "", "", "", ""]);
    setFocusedCodeIndex(0);
    requestAnimationFrame(() => {
      codeInputRefs.current[0]?.focus();
    });
  }

  async function sendResetCode(nextMethod: PasswordResetMethod, nextIdentifier: string) {
    if (!isLoaded || !signIn || loading !== null) return;

    setLoading("send");
    setError(null);

    try {
      await signIn.create({
        strategy: getPasswordResetStrategy(nextMethod),
        identifier: nextIdentifier,
      });

      setMethod(nextMethod);
      setIdentifier(nextIdentifier);
      resetCodeInputs();
      setTimeRemaining(60);
      setStep("code");
    } catch (err: unknown) {
      setError(
        getPasswordResetErrorMessage(
          err,
          "Unable to send a reset code. Please try again.",
          { method: nextMethod, phase: "send" }
        )
      );
    } finally {
      setLoading(null);
    }
  }

  async function submitEmailReset() {
    const trimmedEmail = email.trim();
    if (!isValidResetEmail(trimmedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    await sendResetCode("email", trimmedEmail);
  }

  async function verifyCode(fullCode: string) {
    if (!isLoaded || !signIn || loading !== null) return;

    setLoading("verify");
    setError(null);

    try {
      const result = await signIn.attemptFirstFactor(
        getPasswordResetAttempt(method, fullCode)
      );

      if (result.status === "needs_new_password") {
        setStep("password");
        return;
      }

      if (result.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        await onAuthenticated();
        return;
      }

      setError("Verification incomplete. Please try again.");
      resetCodeInputs();
    } catch (err: unknown) {
      const message = getPasswordResetErrorMessage(
        err,
        "Invalid verification code. Please try again.",
        { method, phase: "verify" }
      );
      if (message === "This code expired. Send a new one.") {
        setTimeRemaining(0);
      }
      setError(message);
      resetCodeInputs();
    } finally {
      setLoading(null);
    }
  }

  async function resendCode() {
    if (!identifier) return;
    await sendResetCode(method, identifier);
  }

  async function submitNewPassword() {
    if (!canSubmitPassword || !signIn) return;

    setLoading("reset");
    setError(null);

    try {
      const result = await signIn.resetPassword({
        password: newPassword,
        signOutOfOtherSessions: true,
      });

      if (result.status === "complete" && result.createdSessionId) {
        await setActive?.({ session: result.createdSessionId });
        await onAuthenticated();
        return;
      }

      if (result.status === "needs_second_factor") {
        setError("Additional verification is required. Please log in with your new password.");
        return;
      }

      setError("Password reset is not complete. Please try again.");
    } catch (err: unknown) {
      setError(
        getPasswordResetErrorMessage(
          err,
          "Unable to update your password. Please try again.",
          { method, phase: "reset" }
        )
      );
    } finally {
      setLoading(null);
    }
  }

  function handleCodeChange(value: string, index: number) {
    const distributed = distributePasswordResetCodeInput(code, value, index);
    const digits = value.replace(/\D/g, "");

    setCode(distributed.code);
    setFocusedCodeIndex(distributed.nextFocusIndex);

    if (digits) {
      codeInputRefs.current[distributed.nextFocusIndex]?.focus();
    }

    if (step === "code" && distributed.fullCode.length === 6 && loading === null) {
      verifyCode(distributed.fullCode);
    }
  }

  function handleCodeKeyPress(key: string, index: number) {
    if (key !== "Backspace") return;

    const nextCode = [...code];
    if (nextCode[index]) {
      nextCode[index] = "";
      setCode(nextCode);
      return;
    }

    if (index > 0) {
      nextCode[index - 1] = "";
      setCode(nextCode);
      setFocusedCodeIndex(index - 1);
      codeInputRefs.current[index - 1]?.focus();
    }
  }

  function renderShell(title: string, subtitle: string, content: ReactNode) {
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={[styles.container, dynamicStyles.container]}>
          <View style={styles.backButtonRow}>
            <BackButton onBack={handleBack} alwaysShow />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerContent}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.subtitle}>{subtitle}</Text>
            </View>

            {content}

            {error ? (
              <Text style={styles.errorText} accessibilityRole="alert">
                {error}
              </Text>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  if (step === "method") {
    return renderShell(
      "Reset password",
      "Choose where we should send your verification code.",
      <View style={styles.formStack}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset password with email"
          style={styles.methodCard}
          onPress={() => selectMethod("email")}
        >
          <View style={styles.methodIcon}>
            <Mail size={24} color={BrandColors.secondary} />
          </View>
          <View style={styles.methodCopy}>
            <Text style={styles.methodTitle}>Email</Text>
            <Text style={styles.methodSubtitle}>Send a code to your email address</Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Reset password with phone"
          style={styles.methodCard}
          onPress={() => selectMethod("phone")}
        >
          <View style={styles.methodIcon}>
            <Phone size={24} color={BrandColors.secondary} />
          </View>
          <View style={styles.methodCopy}>
            <Text style={styles.methodTitle}>Phone number</Text>
            <Text style={styles.methodSubtitle}>Send a code by SMS</Text>
          </View>
        </Pressable>
      </View>
    );
  }

  if (step === "email") {
    return renderShell(
      "Reset password",
      "Enter the email address connected to your account.",
      <View style={styles.formStack}>
        <TextInput
          style={styles.input}
          placeholder="Email address"
          placeholderTextColor={OnboardingSurfaceColors.placeholder}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (error === "Enter a valid email address.") {
              setError(null);
            }
          }}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          autoFocus
        />
        <FooterButton
          label={loading === "send" ? "Sending..." : "Continue"}
          onPress={submitEmailReset}
          disabled={!canSubmitEmail || loading !== null}
          loading={loading === "send"}
          size={buttonSize}
          paddingVertical={buttonPaddingVertical}
          variant={canSubmitEmail ? "primary" : undefined}
          backgroundColor={canSubmitEmail ? undefined : SemanticColors.textMuted}
          textColor={BrandColors.white}
        />
      </View>
    );
  }

  if (step === "phone") {
    return renderShell(
      "Reset password",
      "Enter the phone number connected to your account.",
      <View style={styles.formStack}>
        <View style={styles.inputContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose country code"
            onPress={() => setShowCountryPicker(true)}
            style={styles.countryCodeContainer}
          >
            <View style={styles.flagContainer}>
              <Text style={styles.countryCodeText}>{getFlagEmoji(countryCode)}</Text>
            </View>
            <Text style={styles.countryCodeNumber}>+{getCallingCode()}</Text>
          </Pressable>
          <TextInput
            style={styles.phoneInput}
            placeholder="Enter your phone"
            placeholderTextColor="#9CA3AF"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
            autoComplete="off"
            importantForAutofill="no"
            textContentType="none"
            autoFocus
          />
        </View>

        <FooterButton
          label={loading === "send" ? "Sending..." : "Continue"}
          onPress={() => sendResetCode("phone", getFormattedPhoneIdentifier())}
          disabled={!canSubmitPhone || loading !== null}
          loading={loading === "send"}
          size={buttonSize}
          paddingVertical={buttonPaddingVertical}
          variant={canSubmitPhone ? "primary" : undefined}
          backgroundColor={canSubmitPhone ? undefined : SemanticColors.textMuted}
          textColor={BrandColors.white}
        />

        {renderCountryPicker()}
      </View>
    );
  }

  if (step === "code") {
    return renderShell(
      "6-digit code",
      `Enter the code sent to ${selectedIdentifierLabel || "your account"}.`,
      <View style={styles.formStack}>
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <View key={index} style={styles.codeInputWrapper}>
              {index === 3 ? <Text style={styles.codeSeparator}>-</Text> : null}
              <TextInput
                ref={(ref) => {
                  codeInputRefs.current[index] = ref;
                }}
                style={[
                  styles.codeInput,
                  dynamicStyles.codeInput,
                  focusedCodeIndex === index && styles.codeInputFocused,
                ]}
                value={digit}
                onChangeText={(value) => handleCodeChange(value, index)}
                onKeyPress={(event) => handleCodeKeyPress(event.nativeEvent.key, index)}
                onFocus={() => setFocusedCodeIndex(index)}
                keyboardType="number-pad"
                maxLength={6}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                importantForAutofill="yes"
                selectTextOnFocus
                autoFocus={index === 0}
              />
            </View>
          ))}
        </View>

        <View style={styles.resendContainer}>
          {loading === "verify" ? (
            <ActivityIndicator size="small" color={BrandColors.secondary} />
          ) : timeRemaining > 0 ? (
            <Text style={styles.resendTimer}>Resend code in {formatTimer(timeRemaining)}</Text>
          ) : (
            <Pressable accessibilityRole="button" onPress={resendCode}>
              <Text style={styles.resendButton}>Resend code</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return renderShell(
    "Set new password",
    "Choose a strong password to protect your account.",
    <View style={styles.formStack}>
      <PasswordField
        value={newPassword}
        onChangeText={setNewPassword}
        placeholder="New password"
        visible={showNewPassword}
        onToggleVisible={() => setShowNewPassword((current) => !current)}
        autoFocus
      />
      <PasswordField
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        placeholder="Confirm password"
        visible={showConfirmPassword}
        onToggleVisible={() => setShowConfirmPassword((current) => !current)}
      />

      <View style={styles.strengthArea}>
        <View style={styles.strengthHeader}>
          <Text style={styles.strengthLabel}>Password Strength</Text>
          <Text style={[styles.strengthValue, { color: strengthColor }]}>{strengthLabel}</Text>
        </View>
        <View style={styles.strengthBarContainer}>
          {[1, 2, 3, 4].map((segment) => (
            <View
              key={segment}
              style={[
                styles.strengthSegment,
                {
                  backgroundColor:
                    strength >= segment ? strengthColor : SemanticColors.border,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.validationStack}>
          <Text
            style={[
              styles.validationHint,
              newPassword.length > 0 &&
                !passwordValidation.isLongEnough &&
                styles.validationHintError,
            ]}
          >
            • 8+ characters
          </Text>
          <Text style={styles.validationHint}>
            • Use a longer phrase for better security
          </Text>
          {confirmPassword.length > 0 && !passwordValidation.passwordsMatch ? (
            <Text style={[styles.validationHint, styles.validationHintError]}>
              • Passwords do not match
            </Text>
          ) : null}
        </View>
      </View>

      <FooterButton
        label={loading === "reset" ? "Updating..." : "Update password"}
        onPress={submitNewPassword}
        disabled={!canSubmitPassword}
        loading={loading === "reset"}
        size={buttonSize}
        paddingVertical={buttonPaddingVertical}
        variant={canSubmitPassword ? "primary" : undefined}
        backgroundColor={canSubmitPassword ? undefined : SemanticColors.textMuted}
        textColor={BrandColors.white}
      />
    </View>
  );

  function renderCountryPicker() {
    return (
      <Modal
        visible={showCountryPicker}
        transparent
        animationType="none"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowCountryPicker(false)}
      >
        <Pressable
          style={styles.bottomSheetBackdrop}
          onPress={() => setShowCountryPicker(false)}
        >
          <Animated.View
            style={[
              styles.bottomSheet,
              {
                transform: [{ translateY: slideAnim }],
                maxHeight: height * 0.84,
                paddingBottom: insets.bottom,
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.bottomSheetHandle} />
            <View style={styles.bottomSheetHeader}>
              <View style={styles.searchContainer}>
                <Search size={20} color={OnboardingSurfaceColors.placeholder} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search country / region"
                  placeholderTextColor={OnboardingSurfaceColors.placeholder}
                  value={countrySearch}
                  onChangeText={setCountrySearch}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => setShowCountryPicker(false)}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.cca2}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected = item.cca2 === countryCode;
                return (
                  <Pressable
                    accessibilityRole="button"
                    style={[styles.countryItem, selected && styles.countryItemSelected]}
                    onPress={() => {
                      setCountry(item);
                      setCountryCode(item.cca2);
                      setCountrySearch("");
                      setShowCountryPicker(false);
                    }}
                  >
                    <View style={styles.countryItemFlag}>
                      <Text style={styles.countryItemFlagText}>{getFlagEmoji(item.cca2)}</Text>
                    </View>
                    <Text style={styles.countryItemCode}>+{item.callingCode[0]}</Text>
                    <Text style={styles.countryItemName} numberOfLines={1}>
                      {getCountryName(item)}
                    </Text>
                  </Pressable>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyCountryList}>
                  <Text style={styles.emptyCountryText}>No countries found</Text>
                </View>
              }
            />
          </Animated.View>
        </Pressable>
      </Modal>
    );
  }
}

interface PasswordFieldProps {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  visible: boolean;
  onToggleVisible: () => void;
  autoFocus?: boolean;
}

function PasswordField({
  value,
  onChangeText,
  placeholder,
  visible,
  onToggleVisible,
  autoFocus = false,
}: PasswordFieldProps) {
  return (
    <View style={styles.passwordInputContainer}>
      <TextInput
        style={styles.passwordInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={OnboardingSurfaceColors.placeholder}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="newPassword"
        autoComplete="new-password"
        autoFocus={autoFocus}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        onPress={onToggleVisible}
        style={styles.eyeButton}
      >
        {visible ? (
          <EyeOff size={22} color={OnboardingSurfaceColors.mutedText} />
        ) : (
          <Eye size={22} color={OnboardingSurfaceColors.mutedText} />
        )}
      </Pressable>
    </View>
  );
}

function getCountryName(country: Country) {
  if (typeof country.name === "string") {
    return country.name;
  }

  return country.name.common ?? country.cca2;
}

function getFlagEmoji(code: string) {
  if (code.length !== 2) {
    return "";
  }

  const codePoints = code
    .toUpperCase()
    .split("")
    .map((char) => 0x1f1e6 + (char.charCodeAt(0) - 65));

  return String.fromCodePoint(...codePoints);
}

function formatTimer(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  container: { flex: 1 },
  backButtonRow: {
    width: "100%",
    alignItems: "flex-start",
    paddingHorizontal: Spacing["2xl"],
    paddingTop: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  scrollView: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: Spacing.xl,
  },
  headerContent: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.bold,
    color: OnboardingSurfaceColors.text,
    marginBottom: Spacing.md,
    lineHeight: Spacing["5xl"],
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.text,
    opacity: 0.9,
    lineHeight: Spacing["2xl"],
  },
  formStack: {
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.lg,
  },
  methodCard: {
    minHeight: 84,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    backgroundColor: OnboardingSurfaceColors.card,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.border,
    padding: Spacing.lg,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: SemanticColors.primaryBlueLight,
  },
  methodCopy: { flex: 1 },
  methodTitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.bold,
    color: OnboardingSurfaceColors.text,
    marginBottom: Spacing.xs,
  },
  methodSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.mutedText,
    lineHeight: 20,
  },
  input: {
    backgroundColor: OnboardingSurfaceColors.card,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.text,
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.border,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden",
  },
  countryCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: Spacing.md,
    paddingRight: Spacing.md,
    paddingLeft: Spacing.xs,
    borderRightWidth: 1,
    borderRightColor: "#E2E8F0",
    overflow: "hidden",
  },
  flagContainer: {
    width: 28,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.xs,
    overflow: "hidden",
  },
  countryCodeText: {
    fontSize: FontSize.lg,
    includeFontPadding: false,
    textAlignVertical: "center",
    lineHeight: FontSize.lg,
  },
  countryCodeNumber: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: "#0F172A",
  },
  phoneInput: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: "#0F172A",
    paddingVertical: 0,
  },
  codeContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  codeInputWrapper: { position: "relative", marginHorizontal: Spacing.sm },
  codeSeparator: {
    position: "absolute",
    left: -Spacing.lg + 2.5,
    top: "50%",
    marginTop: -12,
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: OnboardingSurfaceColors.text,
    opacity: 0.5,
  },
  codeInput: {
    height: 60,
    backgroundColor: OnboardingSurfaceColors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.border,
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: OnboardingSurfaceColors.text,
    textAlign: "center",
    padding: 0,
  },
  codeInputFocused: {
    borderColor: BrandColors.white,
    borderWidth: 2,
    backgroundColor: BrandColors.secondary,
  },
  resendContainer: {
    alignItems: "center",
    minHeight: 28,
    justifyContent: "center",
  },
  resendTimer: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.mutedText,
  },
  resendButton: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: OnboardingSurfaceColors.linkText,
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: OnboardingSurfaceColors.card,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.border,
  },
  passwordInput: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.text,
    paddingVertical: 0,
  },
  eyeButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -Spacing.sm,
  },
  strengthArea: {
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  strengthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  strengthLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    color: OnboardingSurfaceColors.mutedText,
  },
  strengthValue: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.bold,
  },
  strengthBarContainer: {
    flexDirection: "row",
    height: 6,
    gap: Spacing.sm,
  },
  strengthSegment: {
    flex: 1,
    borderRadius: BorderRadius.full,
  },
  validationStack: {
    gap: Spacing.xs,
  },
  validationHint: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.mutedText,
    lineHeight: 18,
  },
  validationHintError: {
    color: SemanticColors.errorRed,
  },
  errorText: {
    textAlign: "center",
    color: SemanticColors.errorRed,
    fontSize: FontSize.sm,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.md,
    paddingHorizontal: Spacing["2xl"],
  },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: OnboardingSurfaceColors.backdrop,
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: OnboardingSurfaceColors.card,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.border,
    paddingTop: Spacing.md,
  },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: OnboardingSurfaceColors.handle,
    borderRadius: BorderRadius.full,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    backgroundColor: OnboardingSurfaceColors.cardSoft,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.borderStrong,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.text,
    paddingVertical: 0,
  },
  cancelButton: {
    minHeight: 44,
    justifyContent: "center",
  },
  cancelButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: OnboardingSurfaceColors.linkText,
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: OnboardingSurfaceColors.border,
    gap: Spacing.md,
  },
  countryItemSelected: {
    backgroundColor: OnboardingSurfaceColors.selected,
  },
  countryItemFlag: {
    width: 32,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  countryItemFlagText: { fontSize: 24 },
  countryItemCode: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: OnboardingSurfaceColors.text,
    marginRight: Spacing.md,
    minWidth: 50,
  },
  countryItemName: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.text,
  },
  emptyCountryList: {
    padding: Spacing["2xl"],
    alignItems: "center",
  },
  emptyCountryText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.mutedText,
  },
});
