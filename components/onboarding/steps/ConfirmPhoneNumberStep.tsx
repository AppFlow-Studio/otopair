/**
 * ConfirmPhoneNumberStep
 *
 * PURPOSE: 6-digit code verification step for OnboardingFlow.
 *
 * OWNER: Daniel Chelala
 */

import {
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  Text,
} from "@/components/shared-ui";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OnboardingProgress } from "../common/OnboardingProgress";
import { OnboardingBackButton } from "../common/OnboardingBackButton";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { X } from "lucide-react-native";

const CORRECT_CODE = "676767";

interface ConfirmPhoneNumberStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function ConfirmPhoneNumberStep({
  onNext,
  onBack,
}: ConfirmPhoneNumberStepProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { data } = useOnboardingStore();

  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(15);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    if (fullCode.length === 6) {
      if (fullCode === CORRECT_CODE) {
        console.log("Code verified successfully");
        onNext();
      } else {
        setShowErrorModal(true);
        setCode(["", "", "", "", "", ""]);
        setFocusedIndex(0);
        inputRefs.current[0]?.focus();
      }
    }
  }, [code, onNext]);

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

  const handleResendCode = () => {
    setTimeRemaining(15);
    setCode(["", "", "", "", "", ""]);
    setFocusedIndex(0);
    inputRefs.current[0]?.focus();
    console.log("Resending code...");
  };

  const handleCloseErrorModal = () => {
    setShowErrorModal(false);
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Calculate responsive box width for smaller screens
  const containerPadding = Spacing["2xl"] * 2; // Left + right padding
  const boxMargin = Spacing.sm * 2; // Left + right margin per box (8px each side)
  const totalMarginSpace = 6 * boxMargin; // Total margin space for 6 boxes
  const availableWidth = width - containerPadding;
  const calculatedBoxWidth = Math.max(
    40, // Minimum width
    Math.floor((availableWidth - totalMarginSpace) / 6)
  );

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
    codeInput: { width: calculatedBoxWidth },
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={styles.keyboardView}
    >
      <View style={[styles.container, dynamicStyles.container]}>
        <OnboardingProgress
          total={6}
          filled={1}
          leftElement={<OnboardingBackButton onBack={onBack} alwaysShow />}
        />

        <View style={styles.headerContent}>
          <Text style={styles.title}>6-digit code</Text>
          <Text style={styles.subtitle}>
            Enter the code sent to {formatPhoneNumberForDisplay()}
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
                  dynamicStyles.codeInput,
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

        <View style={styles.resendContainer}>
          {timeRemaining > 0 ? (
            <Text style={styles.resendTimer}>
              Resend code in {formatTimer(timeRemaining)}
            </Text>
          ) : (
            <Pressable onPress={handleResendCode}>
              <Text style={styles.resendButton}>Resend code</Text>
            </Pressable>
          )}
        </View>

        <View style={{ flex: 1 }} />
      </View>

      <Modal
        visible={showErrorModal}
        transparent
        animationType="fade"
        onRequestClose={handleCloseErrorModal}
      >
        <Pressable
          style={styles.errorModalBackdrop}
          onPress={handleCloseErrorModal}
        >
          <Pressable
            style={styles.errorModal}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.errorModalHandle} />
            <View style={styles.errorIconContainer}>
              <X size={48} color="#EF4444" strokeWidth={3} />
            </View>
            <Text style={styles.errorTitle}>Incorrect code entered</Text>
            <Text style={styles.errorMessage}>
              Please check the code and try again
            </Text>
            <TouchableOpacity
              style={styles.errorButton}
              onPress={handleCloseErrorModal}
            >
              <Text style={styles.errorButtonText}>Got it</Text>
            </TouchableOpacity>
          </Pressable>
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
    color: BrandColors.white,
    marginBottom: Spacing.md,
    lineHeight: Spacing['5xl'],
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.9,
    lineHeight: Spacing['2xl'],
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
    color: BrandColors.white,
    opacity: 0.5,
  },
  codeInput: {
    width: 50,
    height: 60,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: BrandColors.white,
    textAlign: "center",
    padding: 0,
  },
  codeInputFocused: {
    borderColor: BrandColors.white,
    borderWidth: 2,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  resendContainer: { alignItems: "center", paddingHorizontal: Spacing["2xl"] },
  resendTimer: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.8,
  },
  resendButton: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: "#60A5FA",
    opacity: 1,
  },
  errorModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  errorModal: {
    backgroundColor: "#1F2937",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing["2xl"],
    paddingBottom: Spacing["3xl"],
    alignItems: "center",
  },
  errorModalHandle: {
    width: 40,
    height: 4,
    backgroundColor: "#6B7280",
    borderRadius: 2,
    marginBottom: Spacing.xl,
  },
  errorIconContainer: { marginBottom: Spacing.lg },
  errorTitle: {
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: BrandColors.white,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  errorMessage: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
  },
  errorButton: {
    backgroundColor: BrandColors.white,
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
