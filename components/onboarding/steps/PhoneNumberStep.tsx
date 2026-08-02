/**
 * PhoneNumberStep
 *
 * PURPOSE: Collects and formats the user's phone number with country code selection.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <PhoneNumberStep
 *     onNext={handleNext}
 *     onBack={handleBack}
 *     progress={{ total: 8, filled: 0 }}
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

// TODO: Use numeric keyboard by default — defaulting to this isn't working on all devices

import { BrandColors, FontFamily, FontSize, Spacing, Text } from "@/components/shared-ui";
import { ProgressBar } from "@/components/shared-ui/ProgressBar";
import { FooterButton } from "@/components/shared-ui/FooterButton";
import { BackButton } from "@/components/shared-ui/BackButton";
import { useState, useEffect, useMemo, useRef } from "react";
import {
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  Modal,
  FlatList,
  Animated,
  Easing,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GestureHandlerRootView, PanGestureHandler, State } from "react-native-gesture-handler";
import { Country } from "react-native-country-picker-modal";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useOnboardingPersistence } from "@/hooks/useOnboardingPersistence";
import { useUser, useSignUp } from "@clerk/clerk-expo";
import { Search } from "lucide-react-native";
import { OnboardingSurfaceColors } from "../onboardingColors";
import {
  cleanupStaleUnverifiedPhoneNumbers,
  findPhoneNumberByNormalizedValue,
  isIdentifierAlreadyTakenError,
  isPhoneNumberVerified,
  normalizePhoneForComparison,
} from "@/lib/clerk-phone-numbers";
import { isValidPhoneNumber } from "@/lib/contact-validation";
// Try to import getAllCountries from the library
let getAllCountries: ((locale?: string) => Promise<Country[]>) | undefined;
try {
  const countryPickerModule = require("react-native-country-picker-modal");
  getAllCountries = countryPickerModule.getAllCountries;
} catch (e) {
  console.log("getAllCountries not available in library");
}

interface PhoneNumberStepProps {
  onNext: () => void;
  onBack: () => void;
  progress: { total: number; filled: number };
  allowBack?: boolean;
}

export function PhoneNumberStep({ onNext, onBack, progress, allowBack = false }: PhoneNumberStepProps) {
  const insets = useSafeAreaInsets();
  const { height, width } = useWindowDimensions();
  const { updateData, data } = useOnboardingStore();
  const { persistProfileField } = useOnboardingPersistence();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState<string>(data.phoneCountryCode || "US");
  const [country, setCountry] = useState<Country | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  // Refocus the phone input as the country modal closes so the
  // keyboard comes back up in parallel with the modal-close animation
  // instead of after it. Removes the perceived lag PM flagged.
  const phoneInputRef = useRef<TextInput | null>(null);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allCountries, setAllCountries] = useState<Country[]>([]);
  const slideAnim = useRef(new Animated.Value(height)).current;
  const panY = useRef(new Animated.Value(0)).current;
  // Confirm-modal slide animation. Mirrors the country picker so
  // both sheets share the same "calm ease-out" motion vocabulary.
  const confirmSlideAnim = useRef(new Animated.Value(height)).current;
  // Error-message bottom sheet — surfaces prepError in the same
  // floating-card visual as the confirm sheet instead of an inline
  // red text block.
  const errorSlideAnim = useRef(new Animated.Value(height)).current;
  const currentSlidePosition = useRef(height);

  // Block Android hardware back — user cannot go back after email verification
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (allowBack) {
        onBack();
      }
      return true;
    });
    return () => sub.remove();
  }, [allowBack, onBack]);

  // Track the actual position of slideAnim
  useEffect(() => {
    const listenerId = slideAnim.addListener(({ value }) => {
      currentSlidePosition.current = value;
    });
    return () => {
      slideAnim.removeListener(listenerId);
    };
  }, [slideAnim]);

  // Snap points (no expanded position - sheet is fixed size)
  const COLLAPSED_POSITION = height * 0.15;
  const DISMISSED_POSITION = height;

  // Load countries
  useEffect(() => {
    const loadCountries = async () => {
      try {
        if (getAllCountries) {
          const countries = await getAllCountries("en");
          if (countries && Array.isArray(countries) && countries.length > 0) {
            const validCountries = countries.filter(
              (c: Country) =>
                c.callingCode &&
                Array.isArray(c.callingCode) &&
                c.callingCode.length > 0 &&
                c.callingCode[0] &&
                c.callingCode[0].trim() !== "",
            );
            setAllCountries(validCountries);

            // Set initial country based on store
            const initialCountry = validCountries.find((c) => c.cca2 === (data.phoneCountryCode || "US"));
            if (initialCountry) {
              setCountry(initialCountry);

              // If we have a phone number in store, strip the calling code for display
              if (data.phoneNumber) {
                const prefix = `+${initialCountry.callingCode[0]}`;
                if (data.phoneNumber.startsWith(prefix)) {
                  setPhoneNumber(data.phoneNumber.replace(prefix, "").trim());
                } else {
                  setPhoneNumber(data.phoneNumber);
                }
              }
            }
            return;
          }
        }

        // Fallback to common countries
        const commonCountries: Country[] = [
          { cca2: "US", callingCode: ["1"], name: { common: "United States" } } as any,
          { cca2: "CA", callingCode: ["1"], name: { common: "Canada" } } as any,
          {
            cca2: "GB",
            callingCode: ["44"],
            name: { common: "United Kingdom" },
          } as any,
          { cca2: "AU", callingCode: ["61"], name: { common: "Australia" } } as any,
          { cca2: "DE", callingCode: ["49"], name: { common: "Germany" } } as any,
          { cca2: "FR", callingCode: ["33"], name: { common: "France" } } as any,
          { cca2: "IT", callingCode: ["39"], name: { common: "Italy" } } as any,
          { cca2: "ES", callingCode: ["34"], name: { common: "Spain" } } as any,
          { cca2: "MX", callingCode: ["52"], name: { common: "Mexico" } } as any,
          { cca2: "BR", callingCode: ["55"], name: { common: "Brazil" } } as any,
        ];
        setAllCountries(commonCountries);

        // Set initial country from fallback
        const initialCountry = commonCountries.find((c) => c.cca2 === (data.phoneCountryCode || "US"));
        if (initialCountry) {
          setCountry(initialCountry);

          if (data.phoneNumber) {
            const prefix = `+${initialCountry.callingCode[0]}`;
            if (data.phoneNumber.startsWith(prefix)) {
              setPhoneNumber(data.phoneNumber.replace(prefix, "").trim());
            } else {
              setPhoneNumber(data.phoneNumber);
            }
          }
        }
      } catch (error) {
        console.error("Error loading countries:", error);
      }
    };
    loadCountries();
  }, []);

  // Filter countries
  const filteredCountries = useMemo(() => {
    if (allCountries.length === 0) return [];

    const validCountries = allCountries.filter(
      (c: Country) =>
        c.callingCode &&
        Array.isArray(c.callingCode) &&
        c.callingCode.length > 0 &&
        c.callingCode[0] &&
        c.callingCode[0].trim() !== "",
    );

    if (!searchQuery.trim()) {
      const usCountry = validCountries.find((c: Country) => c.cca2 === "US");
      const otherCountries = validCountries.filter((c: Country) => c.cca2 !== "US");
      return usCountry ? [usCountry, ...otherCountries] : validCountries;
    }
    const query = searchQuery.toLowerCase();
    return validCountries.filter((c: Country) => {
      const name = typeof c.name === "string" ? c.name : (c.name as any)?.common || "";
      const nameStr = typeof name === "string" ? name : "";
      return (
        nameStr.toLowerCase().includes(query) ||
        c.callingCode[0]?.includes(query) ||
        c.cca2.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, allCountries]);

  // Bottom sheet animation. Slide-in uses a slow cubic ease-out
  // instead of a spring — the spring's snappy start read as jank
  // while the FlatList was doing initial render work in parallel.
  // Predictable ease + slightly longer duration gives the list a
  // beat to paint before the eye follows the sheet up.
  useEffect(() => {
    if (showCountryPicker) {
      slideAnim.setValue(height);
      panY.setValue(0);
      requestAnimationFrame(() => {
        Animated.timing(slideAnim, {
          toValue: COLLAPSED_POSITION,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [showCountryPicker, slideAnim, height, COLLAPSED_POSITION]);

  // Confirm-number bottom-sheet slide. Same ease + duration as the
  // country picker for consistency.
  useEffect(() => {
    if (showConfirmationModal) {
      confirmSlideAnim.setValue(height);
      requestAnimationFrame(() => {
        Animated.timing(confirmSlideAnim, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.timing(confirmSlideAnim, {
        toValue: height,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [showConfirmationModal, confirmSlideAnim, height]);


  // Only track downward gestures for dismissal
  const handleGestureEvent = (event: any) => {
    const { translationY } = event.nativeEvent;
    // Clamp to only allow downward movement (positive values)
    panY.setValue(Math.max(0, translationY));
  };

  const handleGestureStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const { translationY, velocityY } = event.nativeEvent;

      // Only consider downward movement
      const clampedTranslation = Math.max(0, translationY);
      const currentVisualPosition = currentSlidePosition.current + clampedTranslation;

      // Dismiss if dragged down far enough or with velocity
      if (velocityY > 500 || (clampedTranslation > 100 && currentVisualPosition > COLLAPSED_POSITION + 50)) {
        slideAnim.setValue(currentVisualPosition);
        panY.setValue(0);
        handleClosePicker();
      } else {
        // Snap back to collapsed position
        slideAnim.setValue(currentVisualPosition);
        panY.setValue(0);
        Animated.spring(slideAnim, {
          toValue: COLLAPSED_POSITION,
          useNativeDriver: true,
          tension: 40,
          friction: 8,
        }).start();
      }
    }
  };

  const translateY = Animated.add(slideAnim, panY);

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
  };

  const isCompact = height < 720;
  const buttonSize: "md" | "lg" = isCompact ? "md" : "lg";
  const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

  const handleCreateAccount = () => {
    // Prime slide off-screen synchronously so the Modal mounts with
    // the sheet already hidden (same flash-fix pattern as the country
    // picker).
    confirmSlideAnim.setValue(height);
    setShowConfirmationModal(true);
  };

  const { user } = useUser();
  const { signUp } = useSignUp();
  const [prepError, setPrepError] = useState<string | null>(null);
  const [prepLoading, setPrepLoading] = useState(false);

  // Wrapper that primes the sheet's slide value off-screen BEFORE
  // the Modal mounts. Without this, the eye catches one frame of
  // the sheet at its layout position (bottom of screen) before the
  // useEffect fires — reads as a flash-then-glide.
  const showPrepError = (message: string) => {
    errorSlideAnim.setValue(height);
    setPrepError(message);
  };

  // Error bottom-sheet slide — mirrors the confirm sheet's motion.
  // Runs whenever `prepError` toggles between null/set.
  useEffect(() => {
    if (prepError) {
      errorSlideAnim.setValue(height);
      requestAnimationFrame(() => {
        Animated.timing(errorSlideAnim, {
          toValue: 0,
          duration: 450,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      });
    } else {
      Animated.timing(errorSlideAnim, {
        toValue: height,
        duration: 300,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [prepError, errorSlideAnim, height]);

  const handleConfirmPhoneNumber = async () => {
    const fullPhoneNumber = `+${getCallingCode()}${phoneNumber.replace(/\D/g, "")}`;
    const normalizedFullPhoneNumber = normalizePhoneForComparison(fullPhoneNumber);
    updateData({
      phoneNumber: fullPhoneNumber,
      phoneCountryCode: countryCode,
      phoneVerified: false,
    });
    setShowConfirmationModal(false);
    setPrepError(null);
    setPrepLoading(true);

    // Two paths: if user exists (OAuth flow), use user.createPhoneNumber.
    // If no user yet (email signup with missing_requirements), use signUp flow.
    let prepared = false;

    if (user) {
      try {
        await cleanupStaleUnverifiedPhoneNumbers(user, normalizedFullPhoneNumber);
        const existingPhoneNumber = findPhoneNumberByNormalizedValue(user, normalizedFullPhoneNumber);
        if (existingPhoneNumber) {
          const isVerified = isPhoneNumberVerified(existingPhoneNumber);
          if (!isVerified) {
            await existingPhoneNumber.prepareVerification?.();
          }
          updateData({
            phoneNumberId: existingPhoneNumber.id,
            phoneVerified: isVerified,
          });
          console.log("Phone verification resumed via existing user phone for:", fullPhoneNumber);
          prepared = true;
        } else {
          const phoneNumberResource = await user.createPhoneNumber({
            phoneNumber: fullPhoneNumber,
          });
          await phoneNumberResource.prepareVerification();
          updateData({ phoneNumberId: phoneNumberResource.id });
          console.log("Phone verification prepared via user for:", fullPhoneNumber);
          prepared = true;
        }
      } catch (err) {
        if (isIdentifierAlreadyTakenError(err)) {
          try {
            await user.reload();
            const existingPhoneNumber = findPhoneNumberByNormalizedValue(user, normalizedFullPhoneNumber);
            if (existingPhoneNumber) {
              const isVerified = isPhoneNumberVerified(existingPhoneNumber);
              if (!isVerified) {
                await existingPhoneNumber.prepareVerification?.();
              }
              updateData({
                phoneNumberId: existingPhoneNumber.id,
                phoneVerified: isVerified,
              });
              console.log("Phone verification resumed after Clerk duplicate response for:", fullPhoneNumber);
              prepared = true;
            } else {
              showPrepError("That phone number is already associated with another account.");
            }
          } catch (retryErr) {
            console.error("Failed to resume existing phone verification:", retryErr);
            showPrepError("Couldn't send verification code. Please try again.");
          }
        } else {
          console.error("Failed to prepare phone verification via user:", err);
          showPrepError(err instanceof Error ? err.message : "Couldn't send verification code. Please try again.");
        }
      }
    } else if (signUp) {
      try {
        await signUp.update({ phoneNumber: fullPhoneNumber });
        await signUp.preparePhoneNumberVerification({ strategy: "phone_code" });
        updateData({ phoneNumberId: "signup_flow" });
        console.log("Phone verification prepared via signUp for:", fullPhoneNumber);
        prepared = true;
      } catch (err) {
        console.error("Failed to prepare phone verification via signUp:", err);
        showPrepError(err instanceof Error ? err.message : "Couldn't send verification code. Please try again.");
      }
    } else {
      showPrepError("Sign-in session not ready. Please go back and try signing in again.");
    }

    setPrepLoading(false);
    if (prepared) {
      onNext();
    }
  };

  const handleGoBack = () => {
    setShowConfirmationModal(false);
  };

  const formatPhoneNumberForDisplay = () => {
    const callingCode = getCallingCode();
    const cleaned = phoneNumber.replace(/\D/g, "");
    if (cleaned.length === 0) return `+${callingCode}`;

    if (callingCode === "1" && cleaned.length === 10) {
      return `+${callingCode} ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
    }
    const formatted = cleaned.match(/.{1,4}/g)?.join(" ") || cleaned;
    return `+${callingCode} ${formatted}`;
  };

  // Sequence keyboard-dismiss → country picker open. When the phone
  // input has the keypad up, opening the sheet immediately reads as
  // jank because both animations play at once. Dismiss first, wait
  // for `keyboardDidHide`, then open the sheet on a clean stage.
  //
  // `primeAndOpen` also resets `slideAnim` to off-screen BEFORE
  // flipping `showCountryPicker` on. Without this, the Modal mounts
  // with slideAnim at its last-known value (often the previous
  // COLLAPSED_POSITION or a mid-animation frame from close), which
  // reads as a one-frame flash of the sheet at the wrong position
  // before the useEffect snaps it off-screen and animates it back.
  const primeAndOpen = () => {
    slideAnim.setValue(height);
    panY.setValue(0);
    setShowCountryPicker(true);
  };
  const handleOpenCountryPicker = () => {
    if (!Keyboard.isVisible()) {
      primeAndOpen();
      return;
    }
    // Belt-and-suspenders: subscribe first (so we don't miss the
    // event if dismissal is instant on Android), then fire dismiss.
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      sub.remove();
      primeAndOpen();
    });
    Keyboard.dismiss();
  };

  const handleCountrySelect = (selectedCountry: Country) => {
    setCountryCode(selectedCountry.cca2);
    setCountry(selectedCountry);
    setShowCountryPicker(false);
    setSearchQuery("");
    // Kick focus back to the phone field so the keypad reanimates in
    // over the modal-close instead of after it.
    requestAnimationFrame(() => phoneInputRef.current?.focus());
  };

  const handleClosePicker = () => {
    setShowCountryPicker(false);
    setSearchQuery("");
    requestAnimationFrame(() => phoneInputRef.current?.focus());
  };

  const renderCountryItem = ({ item }: { item: Country }) => {
    const isSelected = item.cca2 === countryCode;
    return (
      <TouchableOpacity
        style={[styles.countryItem, isSelected && styles.countryItemSelected]}
        onPress={() => handleCountrySelect(item)}
      >
        <View style={styles.countryItemFlag}>
          <Text style={styles.countryItemFlagText}>{getFlagEmoji(item.cca2)}</Text>
        </View>
        <Text style={styles.countryItemCode}>+{item.callingCode[0]}</Text>
        <Text style={styles.countryItemName} numberOfLines={1}>
          {typeof item.name === "string" ? item.name : item.name?.common || item.cca2}
        </Text>
      </TouchableOpacity>
    );
  };

  const getFlagEmoji = (code: string) => {
    if (code && code.length === 2) {
      try {
        const codePoints = code
          .toUpperCase()
          .split("")
          .map((char) => 0x1f1e6 + (char.charCodeAt(0) - 65));
        return String.fromCodePoint(...codePoints);
      } catch (e) {
        return "🇺🇸";
      }
    }
    return "🇺🇸";
  };

  const getCallingCode = () => {
    if (country?.callingCode && country.callingCode.length > 0) {
      return country.callingCode[0];
    }
    return "1";
  };

  const canCreateAccount = isValidPhoneNumber(phoneNumber, getCallingCode());

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      style={styles.keyboardView}
    >
      <View style={[styles.container, dynamicStyles.container]}>
        <ProgressBar
          total={progress.total}
          filled={progress.filled}
          leftElement={allowBack ? <BackButton onBack={onBack} alwaysShow /> : undefined}
          reserveLeftSpace={!allowBack}
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerContent}>
            <Text style={styles.title}>{"What's your number?"}</Text>
            <Text style={styles.subtitle}>{"We'll send a verification code to secure your account."}</Text>
          </View>

          <View style={styles.formStack}>
            <View style={styles.inputContainer}>
              <Pressable onPress={handleOpenCountryPicker} style={styles.countryCodeContainer}>
                <View style={styles.flagContainer}>
                  <Text style={styles.countryCodeText}>{getFlagEmoji(countryCode)}</Text>
                </View>
                <Text style={styles.countryCodeNumber}>+{getCallingCode()}</Text>
              </Pressable>
              <TextInput
                ref={phoneInputRef}
                style={styles.phoneInput}
                placeholder="Enter your phone"
                placeholderTextColor="#9CA3AF"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
                autoComplete="off"
                importantForAutofill="no"
                textContentType="none"
              />
            </View>

            <View style={styles.continueButtonContainer}>
              <FooterButton
                label="Continue"
                onPress={handleCreateAccount}
                disabled={!canCreateAccount || prepLoading}
                size={buttonSize}
                paddingVertical={buttonPaddingVertical}
                variant={canCreateAccount ? "primary" : undefined}
                backgroundColor={canCreateAccount ? undefined : "#6B7280"}
                textColor={canCreateAccount ? undefined : BrandColors.white}
              />
            </View>

            {/* TEMP (dev-only): skip the Clerk phone verification
                entirely so Ahmad can walk the flow with the same
                phone number across multiple test accounts. Sets
                `phoneVerified: true` in both Convex and the store,
                then advances — the confirm step auto-skips forward
                on mount when phoneVerified is already true. */}
            {__DEV__ && (
              <TouchableOpacity
                onPress={async () => {
                  const placeholder =
                    phoneNumber.trim().length > 0
                      ? `+${getCallingCode()}${phoneNumber.replace(/\D/g, "")}`
                      : "+15550100000";
                  updateData({
                    phoneNumber: placeholder,
                    phoneCountryCode: countryCode,
                    phoneVerified: true,
                    phoneNumberId: "dev_bypass",
                  });
                  try {
                    await persistProfileField({
                      phone: placeholder,
                      phoneVerified: true,
                    });
                  } catch (e) {
                    console.warn("dev bypass: persistProfileField failed", e);
                  }
                  onNext();
                }}
                style={styles.devSkipButton}
              >
                <Text style={styles.devSkipText}>
                  DEV: skip phone verification
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>

        {/* Country Picker Bottom Sheet.
            `presentationStyle="overFullScreen"` keeps the phone
            input's keyboard up when the sheet opens — the default
            iOS modal presentation controller steals focus and
            dismisses the keyboard, which then races the sheet's
            slide-up animation and reads as jank. */}
        <Modal
          visible={showCountryPicker}
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={handleClosePicker}
        >
          <GestureHandlerRootView style={{ flex: 1 }}>
            <Pressable style={styles.bottomSheetBackdrop} onPress={handleClosePicker}>
              <Animated.View
                style={[
                  styles.bottomSheet,
                  {
                    transform: [{ translateY: translateY }],
                    paddingBottom: insets.bottom,
                    height: height * 0.85,
                  },
                ]}
              >
                {/* Only the handle area is draggable */}
                <PanGestureHandler
                  onGestureEvent={handleGestureEvent}
                  onHandlerStateChange={handleGestureStateChange}
                  activeOffsetY={[0, 10]}
                >
                  <Animated.View>
                    <View style={styles.handleContainer}>
                      <View style={styles.bottomSheetHandle} />
                    </View>

                    <View style={[styles.bottomSheetHeader, { gap: width < 360 ? Spacing.xs : Spacing.md }]}>
                      <View style={styles.searchContainer}>
                        <Search
                          size={width < 360 ? 18 : 20}
                          color={OnboardingSurfaceColors.placeholder}
                          style={styles.searchIcon}
                        />
                        <TextInput
                          style={styles.searchInput}
                          placeholder="Search country / region"
                          placeholderTextColor={OnboardingSurfaceColors.placeholder}
                          value={searchQuery}
                          onChangeText={setSearchQuery}
                          autoFocus={false}
                        />
                      </View>
                      <TouchableOpacity onPress={handleClosePicker} style={styles.cancelButton}>
                        <Text style={[styles.cancelButtonText, { fontSize: width < 360 ? FontSize.sm : FontSize.md }]}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </Animated.View>
                </PanGestureHandler>

                {/* FlatList is outside PanGestureHandler so it can scroll */}
                <FlatList
                  data={filteredCountries.length > 0 ? filteredCountries : allCountries}
                  renderItem={renderCountryItem}
                  keyExtractor={(item) => item.cca2}
                  style={styles.countryList}
                  contentContainerStyle={styles.countryListContent}
                  showsVerticalScrollIndicator={true}
                  keyboardShouldPersistTaps="handled"
                  ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                      <Text style={styles.emptyText}>No countries found</Text>
                    </View>
                  }
                />
              </Animated.View>
            </Pressable>
          </GestureHandlerRootView>
        </Modal>

        {/* Confirmation bottom sheet — slides up calmly instead of
            appearing as a centered floating card. Same slide/ease as
            the country picker for visual consistency. */}
        <Modal
          visible={showConfirmationModal}
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={handleGoBack}
        >
          <Pressable style={styles.confirmationModalBackdrop} onPress={handleGoBack}>
            <Animated.View
              style={[
                styles.confirmationSheet,
                {
                  // Sit right above the home indicator (~8pt gap
                  // from the screen bottom). Matches the reference
                  // "Edit Maintenance Info" sheet.
                  marginBottom: 8,
                  transform: [{ translateY: confirmSlideAnim }],
                },
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View style={styles.confirmationHandleContainer}>
                  <View style={styles.confirmationHandle} />
                </View>
                <Text style={styles.confirmationPhoneNumber}>
                  {getFlagEmoji(countryCode)} {formatPhoneNumberForDisplay()}
                </Text>
                <Text style={styles.confirmationQuestion}>Is this number correct?</Text>
                <View style={styles.confirmationButtons}>
                  <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPhoneNumber}>
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.goBackButton} onPress={handleGoBack}>
                    <Text style={styles.goBackButtonText}>Go back</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

        {/* Error bottom sheet — same floating-card visual as the
            confirm sheet. Surfaces prepError (e.g. "phone already
            associated with another account") in a dismissible sheet
            instead of an inline red text block. */}
        <Modal
          visible={prepError != null}
          transparent
          animationType="none"
          statusBarTranslucent
          navigationBarTranslucent
          presentationStyle="overFullScreen"
          onRequestClose={() => setPrepError(null)}
        >
          <Pressable style={styles.confirmationModalBackdrop} onPress={() => setPrepError(null)}>
            <Animated.View
              style={[
                styles.confirmationSheet,
                {
                  marginBottom: 8,
                  transform: [{ translateY: errorSlideAnim }],
                },
              ]}
            >
              <Pressable onPress={(e) => e.stopPropagation()}>
                <View style={styles.confirmationHandleContainer}>
                  <View style={styles.confirmationHandle} />
                </View>
                <Text style={styles.confirmationPhoneNumber}>
                  {getFlagEmoji(countryCode)} {formatPhoneNumberForDisplay()}
                </Text>
                <Text style={styles.confirmationQuestion}>
                  {prepError}
                </Text>
                <View style={styles.confirmationButtons}>
                  <TouchableOpacity style={styles.confirmButton} onPress={() => setPrepError(null)}>
                    <Text style={styles.confirmButtonText}>Got it</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Animated.View>
          </Pressable>
        </Modal>

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
    paddingBottom: Spacing.xl,
  },
  headerContent: {
    paddingHorizontal: Spacing["2xl"],
    marginBottom: Spacing["3xl"],
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.semiBold,
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
  formStack: {
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.lg,
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
    // Room for the emoji glyph without vertical clipping. Height ~28
    // matches the emoji's natural glyph box so it centers on the
    // "+1" text baseline instead of hugging the top of the row.
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.xs,
  },
  countryCodeText: {
    fontSize: 22,
    // iOS flag emojis sit ~2-3pt above the font baseline; nudge down
    // so the flag optically centers with the "+1" text next to it.
    // Transform keeps the layout box the same size.
    transform: [{ translateY: 2 }],
    ...Platform.select({
      android: { includeFontPadding: false },
      default: {},
    }),
  },
  countryCodeNumber: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.medium,
    color: '#0F172A',
  },
  phoneInput: {
    flex: 1,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    paddingVertical: 0,
  },
  prepError: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.regular,
    color: "#DC2626",
    marginBottom: 0,
    paddingHorizontal: 0,
    textAlign: "center",
  },
  continueButtonContainer: { marginTop: 0 },
  devSkipButton: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  devSkipText: {
    fontSize: 12,
    color: "#9CA3AF",
    letterSpacing: 0.4,
    textDecorationLine: "underline",
  },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: OnboardingSurfaceColors.backdrop,
    justifyContent: "flex-end",
  },
  bottomSheet: {
    backgroundColor: OnboardingSurfaceColors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.border,
    maxHeight: "100%",
    paddingTop: Spacing.md,
  },
  handleContainer: { paddingVertical: Spacing.sm, alignItems: "center" },
  bottomSheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: OnboardingSurfaceColors.handle,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  bottomSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  searchContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: OnboardingSurfaceColors.cardSoft,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.borderStrong,
    minWidth: 0,
  },
  searchIcon: { marginRight: Spacing.xs },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.text,
    paddingVertical: 0,
    minWidth: 0,
  },
  cancelButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginLeft: Spacing.xs,
  },
  cancelButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: OnboardingSurfaceColors.linkText,
  },
  countryList: { flex: 1 },
  countryListContent: { paddingBottom: Spacing.lg },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: OnboardingSurfaceColors.border,
  },
  countryItemSelected: { backgroundColor: OnboardingSurfaceColors.selected },
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
  emptyContainer: { padding: Spacing["2xl"], alignItems: "center" },
  emptyText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.mutedText,
  },
  confirmationModalBackdrop: {
    flex: 1,
    backgroundColor: OnboardingSurfaceColors.backdrop,
    // Floating / detached bottom-sheet pattern used across the app:
    // sheet sits above the home indicator with equal horizontal
    // margins so it reads as a card floating above the base surface.
    justifyContent: "flex-end",
    paddingHorizontal: Spacing.sm,
  },
  confirmationSheet: {
    backgroundColor: OnboardingSurfaceColors.card,
    // Concentric corner radius — modern iPhone displays curve at
    // ~55pt; with the sheet inset by Spacing.sm on each side, ~44
    // makes the sheet's outer curve visually parallel the screen's
    // curve at the bottom corners. Same iOS system-sheet aesthetic.
    borderRadius: 44,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing["2xl"],
  },
  confirmationHandleContainer: {
    alignItems: "center",
    paddingBottom: Spacing.lg,
  },
  confirmationHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(15, 23, 42, 0.15)",
  },
  confirmationPhoneNumber: {
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: OnboardingSurfaceColors.text,
    textAlign: "center",
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  confirmationQuestion: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.mutedText,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
  },
  confirmationButtons: { gap: Spacing.md },
  confirmButton: {
    backgroundColor: "#5299FE",
    borderRadius: 14,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  confirmButtonText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semiBold,
    color: "#FFFFFF",
  },
  goBackButton: {
    backgroundColor: "transparent",
    borderRadius: 14,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  goBackButtonText: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.medium,
    color: OnboardingSurfaceColors.mutedText,
  },
});
