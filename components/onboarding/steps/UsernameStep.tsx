/**
 * UsernameStep
 *
 * PURPOSE: Allows the user to choose a unique username.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *
 * EXAMPLE:
 *   <UsernameStep onNext={handleNext} onBack={handleBack} />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

// TODO: Adjust or verify spacing of scrollContent

import {
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  Text,
} from "@/components/shared-ui";
import { ProgressBar } from "@/components/shared-ui/ProgressBar";
import { FooterButton } from "@/components/shared-ui/FooterButton";
import { BackButton } from "@/components/shared-ui/BackButton";
import { useState, useRef } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useOnboardingStore } from "@/stores/useOnboardingStore";

interface UsernameStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function UsernameStep({ onNext, onBack }: UsernameStepProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const { data, updateData } = useOnboardingStore();

  const [username, setUsername] = useState(data.username || "");
  const inputRef = useRef<TextInput>(null);

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
    bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
  };

  const isCompact = height < 720;
  const buttonSize: "md" | "lg" = isCompact ? "md" : "lg";
  const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

  const handleContinue = () => {
    updateData({
      username: username.trim(),
    });

    console.log("Username saved:", useOnboardingStore.getState().data.username);
    onNext();
  };

  const canContinue = username.trim().length >= 3;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      style={styles.keyboardView}
    >
      <View style={[styles.container, dynamicStyles.container]}>
        <ProgressBar
          total={8}
          filled={3}
          leftElement={<BackButton onBack={onBack} alwaysShow />}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>Choose your username</Text>
          </View>

          <View style={styles.inputsContainer}>
            <View style={styles.inputWrapper}>
              <Pressable 
                style={styles.usernameInputContainer}
                onPress={() => inputRef.current?.focus()}
              >
                <Text style={styles.atSymbol}>@</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  placeholder="username"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={(text) => setUsername(text.toLowerCase().replace(/[^a-z0-9_.]/g, ""))}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoFocus={true}
                />
              </Pressable>
              <Text style={styles.helperText}>
                This will be your unique identifier on Otopair
              </Text>
            </View>
          </View>
        </ScrollView>

        <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
          <FooterButton
            label="Continue"
            onPress={handleContinue}
            disabled={!canContinue}
            size={buttonSize}
            paddingVertical={buttonPaddingVertical}
            variant={canContinue ? "primary" : undefined}
            backgroundColor={canContinue ? undefined : "#6B7280"}
            textColor={canContinue ? undefined : BrandColors.white}
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: { flex: 1 },
  container: { flex: 1 },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 4*Spacing['5xl'],
    justifyContent: 'center',
  },
  headerContent: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["2xl"],
    alignItems: 'center',
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.bold,
    color: BrandColors.white,
    textAlign: 'center',
    lineHeight: Spacing['5xl'],
  },
  inputsContainer: { paddingHorizontal: Spacing["2xl"] },
  inputWrapper: { marginBottom: Spacing.md },
  usernameInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 999, // Pill shape like in screenshot
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  atSymbol: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.medium,
    color: BrandColors.white,
    marginRight: 2,
  },
  input: {
    fontSize: FontSize.xl,
    fontFamily: FontFamily.medium,
    color: BrandColors.white,
    padding: 0,
  },
  helperText: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: BrandColors.white,
    opacity: 0.7,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  bottomContainer: {
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing["2xl"],
    backgroundColor: 'transparent',
  },
});

