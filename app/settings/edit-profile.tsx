import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { useShallow } from "zustand/react/shallow";
import { Country } from "react-native-country-picker-modal";
// @ts-ignore Expo module available at runtime
import * as ImagePicker from "expo-image-picker";
import { useQuery } from "convex/react";
import { useUser } from "@clerk/clerk-expo";

import {
  BlurHeaderOverlay,
  BrandColors,
  Button,
  Spacing,
  Text,
} from "@/components/shared-ui";
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useOnboardingPersistence } from "@/hooks/useOnboardingPersistence";
import { useToast } from "@/hooks/useToast";

// Try to import getAllCountries from the country picker module.
let getAllCountries: ((locale?: string) => Promise<Country[]>) | undefined;
try {
  const countryPickerModule = require("react-native-country-picker-modal");
  getAllCountries = countryPickerModule.getAllCountries;
} catch {
  console.log("getAllCountries not available in library");
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const router = useRouter();
  const params = useLocalSearchParams<{ showPhotos?: string }>();
  const { user: clerkUser } = useUser();
  const me = useQuery(api.users.getMe);
  const { persistProfileField, persistProfilePhoto } =
    useOnboardingPersistence();

  const { data, updateData } = useOnboardingStore(
    useShallow((state) => ({
      data: state.data,
      updateData: state.updateData,
    })),
  );

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [editPhotoUri, setEditPhotoUri] = useState<string | null>(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState("");
  const [allCountries, setAllCountries] = useState<Country[]>([]);
  const [phoneCountryCode, setPhoneCountryCode] = useState("US");
  const [phoneCountry, setPhoneCountry] = useState<Country | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const hasHydratedRef = useRef(false);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (event) => {
        setIsKeyboardVisible(true);
        setKeyboardHeight(event.endCoordinates?.height ?? 0);
      },
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setIsKeyboardVisible(false);
        setKeyboardHeight(0);
      },
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const profilePhotoUri = useMemo(() => {
    if (me?.profile_photo_url) return me.profile_photo_url;
    if (data.profilePhotoUri) return data.profilePhotoUri;
    return clerkUser?.imageUrl ?? null;
  }, [me?.profile_photo_url, data.profilePhotoUri, clerkUser?.imageUrl]);

  const initials = useMemo(() => {
    const first = (
      me != null ? (me.first_name ?? "") : (data.firstName ?? "")
    ).trim();
    const last = (
      me != null ? (me.last_name ?? "") : (data.lastName ?? "")
    ).trim();
    const value = `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
    return value.length > 0 ? value : "AJ";
  }, [me, data.firstName, data.lastName]);

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
            const usCountry = validCountries.find((c) => c.cca2 === "US");
            if (usCountry) {
              setPhoneCountry(usCountry);
              setPhoneCountryCode("US");
            }
            return;
          }
        }

        const commonCountries: Country[] = [
          {
            cca2: "US",
            callingCode: ["1"],
            name: { common: "United States" },
          } as any,
          { cca2: "CA", callingCode: ["1"], name: { common: "Canada" } } as any,
          {
            cca2: "GB",
            callingCode: ["44"],
            name: { common: "United Kingdom" },
          } as any,
          {
            cca2: "AU",
            callingCode: ["61"],
            name: { common: "Australia" },
          } as any,
        ];
        setAllCountries(commonCountries);
        setPhoneCountry(commonCountries[0]);
        setPhoneCountryCode("US");
      } catch (error) {
        console.error("Error loading countries:", error);
      }
    };
    loadCountries();
  }, []);

  useEffect(() => {
    if (hasHydratedRef.current || allCountries.length === 0) return;

    const fromConvexFirst = (me?.first_name ?? "").toString().trim();
    const fromConvexLast = (me?.last_name ?? "").toString().trim();
    const fromStoreFirst = (data.firstName ?? "").toString().trim();
    const fromStoreLast = (data.lastName ?? "").toString().trim();
    const nextFirst =
      fromConvexFirst.length > 0 ? fromConvexFirst : fromStoreFirst;
    const nextLast = fromConvexLast.length > 0 ? fromConvexLast : fromStoreLast;

    const nextEmail = (me?.email ?? data.email ?? "")
      .toString()
      .toLowerCase()
      .trim();
    const rawPhone = (me?.phone ?? data.phoneNumber ?? "").toString();
    const digitsOnlyPhone = rawPhone.replace(/\D/g, "");
    let nationalPhone = digitsOnlyPhone;
    let selectedCountryCode = "US";
    let selectedCountry: Country | null =
      allCountries.find((c) => c.cca2 === "US") ?? null;

    if (rawPhone.trim().startsWith("+")) {
      const matches = allCountries
        .filter(
          (c) =>
            c.callingCode?.[0] && rawPhone.startsWith(`+${c.callingCode[0]}`),
        )
        .sort(
          (a, b) =>
            (b.callingCode?.[0]?.length ?? 0) -
            (a.callingCode?.[0]?.length ?? 0),
        );

      if (matches.length > 0) {
        const usPlusOneMatch = matches.find(
          (c) => c.cca2 === "US" && c.callingCode?.[0] === "1",
        );
        const bestMatch = usPlusOneMatch ?? matches[0];
        const callingPrefix = bestMatch.callingCode?.[0] ?? "";
        selectedCountryCode = bestMatch.cca2;
        selectedCountry = bestMatch;
        nationalPhone = rawPhone
          .replace(`+${callingPrefix}`, "")
          .replace(/\D/g, "");
      }
    }

    setFirstName(nextFirst);
    setLastName(nextLast);
    setEmail(nextEmail);
    setPhone(nationalPhone);
    setPhoneCountryCode(selectedCountryCode);
    setPhoneCountry(selectedCountry);
    setEditPhotoUri(profilePhotoUri);
    setShowPhotoOptions(params.showPhotos === "1");
    hasHydratedRef.current = true;
  }, [
    allCountries,
    data.email,
    data.firstName,
    data.lastName,
    data.phoneNumber,
    me?.email,
    me?.first_name,
    me?.last_name,
    me?.phone,
    params.showPhotos,
    profilePhotoUri,
  ]);

  const getFlagEmoji = useCallback((code: string) => {
    if (code && code.length === 2) {
      try {
        const codePoints = code
          .toUpperCase()
          .split("")
          .map((char) => 0x1f1e6 + (char.charCodeAt(0) - 65));
        return String.fromCodePoint(...codePoints);
      } catch {
        return "🇺🇸";
      }
    }
    return "🇺🇸";
  }, []);

  const getCallingCode = useCallback(() => {
    if (phoneCountry?.callingCode && phoneCountry.callingCode.length > 0) {
      return phoneCountry.callingCode[0];
    }
    return "1";
  }, [phoneCountry]);

  const filteredCountries = useMemo(() => {
    if (!countrySearchQuery.trim()) {
      const usCountry = allCountries.find((c) => c.cca2 === "US");
      const others = allCountries.filter((c) => c.cca2 !== "US");
      return usCountry ? [usCountry, ...others] : allCountries;
    }
    const query = countrySearchQuery.toLowerCase();
    return allCountries.filter((c) => {
      const name = typeof c.name === "string" ? c.name : c.name?.common || "";
      const nameStr = typeof name === "string" ? name : "";
      return (
        nameStr.toLowerCase().includes(query) ||
        c.callingCode[0]?.includes(query) ||
        c.cca2.toLowerCase().includes(query)
      );
    });
  }, [allCountries, countrySearchQuery]);

  const handleCountrySelect = useCallback((selectedCountry: Country) => {
    setPhoneCountryCode(selectedCountry.cca2);
    setPhoneCountry(selectedCountry);
    setShowCountryPicker(false);
    setCountrySearchQuery("");
  }, []);

  const handleCloseCountryPicker = useCallback(() => {
    setShowCountryPicker(false);
    setCountrySearchQuery("");
  }, []);

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  };

  const handleChooseFromLibrary = useCallback(async () => {
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) {
      setShowPhotoOptions(false);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    setShowPhotoOptions(false);
    if (!result.canceled && result.assets?.length) {
      setEditPhotoUri(result.assets[0].uri);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setShowPhotoOptions(false);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      mediaTypes: ["images"],
    });
    setShowPhotoOptions(false);
    if (!result.canceled && result.assets?.length) {
      setEditPhotoUri(result.assets[0].uri);
    }
  }, []);

  const handleRemovePhoto = useCallback(() => {
    setShowPhotoOptions(false);
    setEditPhotoUri(null);
  }, []);

  const handleSaveProfile = useCallback(async () => {
    if (isSaving) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const normalizedFirstName = firstName.trim();
      const normalizedLastName = lastName.trim();
      const normalizedEmail = email.trim().toLowerCase();
      const normalizedPhoneDigits = phone.replace(/\D/g, "");

      const nextEmail = normalizedEmail.length > 0 ? normalizedEmail : null;
      const nextPhoneNumber =
        normalizedPhoneDigits.length > 0
          ? `+${getCallingCode()}${normalizedPhoneDigits}`
          : null;

      const currentEmail = (me?.email ?? data.email ?? "")
        .toString()
        .trim()
        .toLowerCase();
      const currentPhoneDigits = (me?.phone ?? data.phoneNumber ?? "")
        .toString()
        .replace(/\D/g, "");
      const nextPhoneDigits = (nextPhoneNumber ?? "").replace(/\D/g, "");
      const emailChanged = nextEmail != null && nextEmail !== currentEmail;
      const phoneChanged =
        nextPhoneNumber != null && nextPhoneDigits !== currentPhoneDigits;

      if (editPhotoUri !== profilePhotoUri) {
        updateData({ profilePhotoUri: editPhotoUri });
        try {
          await persistProfilePhoto(editPhotoUri);
        } catch (error) {
          console.warn("Convex photo update failed:", error);
          toast.error("Couldn't update your profile photo.");
        }
      }

      updateData({
        firstName: normalizedFirstName || null,
        lastName: normalizedLastName || null,
      });
      try {
        await persistProfileField({
          first_name: normalizedFirstName || undefined,
          last_name: normalizedLastName || undefined,
        });
      } catch (error) {
        console.warn("Convex name update failed:", error);
        toast.error("Couldn't update your name.");
      }

      if (emailChanged || phoneChanged) {
        router.push({
          pathname: "/settings/verify-contact-update" as any,
          params: {
            verifyPhone: phoneChanged ? "1" : "0",
            verifyEmail: emailChanged ? "1" : "0",
            pendingPhone: nextPhoneNumber ?? "",
            pendingEmail: nextEmail ?? "",
          },
        });
        return;
      }

      updateData({ email: nextEmail, phoneNumber: nextPhoneNumber });
      try {
        await persistProfileField({
          email: nextEmail ?? undefined,
          phone: nextPhoneNumber ?? undefined,
        });
      } catch (error) {
        console.warn("Convex profile contact update failed:", error);
        toast.error("Couldn't update your contact info.");
      }

      router.back();
    } catch (error: any) {
      const message =
        error?.errors?.[0]?.longMessage ||
        error?.errors?.[0]?.message ||
        error?.message ||
        "Unable to save your profile right now.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }, [
    data.email,
    data.phoneNumber,
    editPhotoUri,
    email,
    firstName,
    getCallingCode,
    isSaving,
    lastName,
    me?.email,
    me?.phone,
    persistProfileField,
    persistProfilePhoto,
    phone,
    profilePhotoUri,
    router,
    updateData,
  ]);

  const renderCountryItem = useCallback(
    ({ item }: { item: Country }) => {
      const isSelected = item.cca2 === phoneCountryCode;
      const countryName =
        typeof item.name === "string"
          ? item.name
          : item.name?.common || item.cca2;
      return (
        <TouchableOpacity
          style={[styles.countryItem, isSelected && styles.countryItemSelected]}
          onPress={() => handleCountrySelect(item)}
        >
          <View style={styles.countryItemFlag}>
            <Text style={styles.countryItemFlagText}>
              {getFlagEmoji(item.cca2)}
            </Text>
          </View>
          <Text style={styles.countryItemCode}>
            +{item.callingCode?.[0] ?? ""}
          </Text>
          <Text style={styles.countryItemName} numberOfLines={1}>
            {countryName}
          </Text>
        </TouchableOpacity>
      );
    },
    [getFlagEmoji, handleCountrySelect, phoneCountryCode],
  );

  const canSave = !isSaving;
  const isIOS26Plus =
    Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;
  const bottomActionPadding = insets.bottom + (isIOS26Plus ? 80 : 100);

  return (
    <View style={styles.screen}>
      <BlurHeaderOverlay title="Edit Profile" onBack={() => router.back()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 80,
              paddingBottom:
                bottomActionPadding +
                (isKeyboardVisible ? keyboardHeight + 24 : 0),
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          keyboardDismissMode="none"
          scrollEnabled
        >
          <View style={styles.avatarSection}>
            <View style={styles.avatarPortraitFrame}>
              <Pressable
                style={styles.avatarWrapper}
                onPress={() => setShowPhotoOptions(true)}
              >
                {editPhotoUri ? (
                  <Image
                    source={{ uri: editPhotoUri }}
                    style={styles.avatarImage}
                  />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <Text
                      weight="semiBold"
                      size="xl"
                      color={BrandColors.secondary}
                    >
                      {initials}
                    </Text>
                  </View>
                )}
                <View style={styles.avatarEditBadge}>
                  <Text weight="semiBold" size="sm" color="#FFF">
                    +
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>

          <Text weight="bold" style={styles.personalInfoTitle}>
            Personal information
          </Text>

          {errorMessage ? (
            <View style={styles.errorContainer}>
              <Text size="sm" color="#f87171" weight="medium">
                {errorMessage}
              </Text>
            </View>
          ) : null}

          <View style={styles.glassCard}>
            <View style={styles.formRow}>
              <Text
                weight="medium"
                size="xs"
                color="#86868b"
                style={styles.rowLabel}
              >
                FIRST NAME
              </Text>
              <TextInput
                value={firstName}
                onChangeText={setFirstName}
                placeholder="Enter first name"
                placeholderTextColor="#AEAEB2"
                style={styles.rowInput}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.separator} />

            <View style={styles.formRow}>
              <Text
                weight="medium"
                size="xs"
                color="#86868b"
                style={styles.rowLabel}
              >
                LAST NAME
              </Text>
              <TextInput
                value={lastName}
                onChangeText={setLastName}
                placeholder="Enter last name"
                placeholderTextColor="#AEAEB2"
                style={styles.rowInput}
                autoCapitalize="words"
              />
            </View>
            <View style={styles.separator} />

            <View style={styles.formRow}>
              <Text
                weight="medium"
                size="xs"
                color="#86868b"
                style={styles.rowLabel}
              >
                PHONE
              </Text>
              <View style={styles.phoneRow}>
                <Pressable
                  style={styles.countryPrefix}
                  onPress={() => setShowCountryPicker(true)}
                >
                  <Text style={styles.countryFlag}>
                    {getFlagEmoji(phoneCountryCode)}
                  </Text>
                  <Text style={styles.countryNumber}>+{getCallingCode()}</Text>
                </Pressable>
                <TextInput
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="(000) 000-0000"
                  placeholderTextColor="#AEAEB2"
                  style={styles.phoneInput}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
            <View style={styles.separator} />

            <View style={styles.formRow}>
              <Text
                weight="medium"
                size="xs"
                color="#86868b"
                style={styles.rowLabel}
              >
                EMAIL
              </Text>
              <TextInput
                value={email}
                onChangeText={(value) => setEmail(value.toLowerCase())}
                placeholder="Enter email address"
                placeholderTextColor="#AEAEB2"
                style={styles.rowInput}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          <View style={styles.submitArea}>
            <Pressable
              style={[
                styles.submitButton,
                !canSave && styles.submitButtonDisabled,
              ]}
              onPress={handleSaveProfile}
              disabled={!canSave}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFF" />
              ) : (
                <Text weight="semiBold" size="md" color="#FFF">
                  Save changes
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        transparent
        visible={showPhotoOptions}
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setShowPhotoOptions(false)}
      >
        <TouchableWithoutFeedback onPress={() => setShowPhotoOptions(false)}>
          <View style={styles.modalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.photoModalCard}>
                <Text
                  weight="semiBold"
                  size="xl"
                  color="#111827"
                  style={styles.photoModalTitle}
                >
                  Profile Photo
                </Text>
                <Text
                  size="sm"
                  color="#6B7280"
                  style={styles.photoModalSubtitle}
                >
                  Select an option to update your profile picture
                </Text>
                <View style={styles.photoModalButtons}>
                  <Pressable
                    style={styles.photoModalPrimaryButton}
                    onPress={handleChooseFromLibrary}
                  >
                    <Text weight="semiBold" size="md" color={BrandColors.white}>
                      Choose from library
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.photoModalSecondaryButton}
                    onPress={handleTakePhoto}
                  >
                    <Text weight="semiBold" size="md" color="#111827">
                      Take a photo
                    </Text>
                  </Pressable>
                  {editPhotoUri ? (
                    <Pressable
                      style={styles.photoModalRemoveButton}
                      onPress={handleRemovePhoto}
                    >
                      <Text weight="semiBold" size="md" color="#EF4444">
                        Remove photo
                      </Text>
                    </Pressable>
                  ) : null}
                  <Button
                    variant="ghost"
                    fullWidth
                    style={styles.photoModalCancelButton}
                    onPress={() => setShowPhotoOptions(false)}
                  >
                    Cancel
                  </Button>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      <Modal
        visible={showCountryPicker}
        transparent
        animationType="slide"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleCloseCountryPicker}
      >
        <Pressable
          style={styles.countryPickerBackdrop}
          onPress={handleCloseCountryPicker}
        >
          <Pressable
            style={[
              styles.countryPickerSheet,
              { paddingBottom: insets.bottom },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.countryPickerHandle} />
            <View style={styles.countryPickerHeader}>
              <Text weight="semiBold" size="lg" color="#111827">
                Select Country
              </Text>
              <Pressable onPress={handleCloseCountryPicker}>
                <Text weight="medium" size="md" color={BrandColors.secondary}>
                  Close
                </Text>
              </Pressable>
            </View>
            <View style={styles.countrySearchContainer}>
              <TextInput
                style={styles.countrySearchInput}
                placeholder="Search country / region"
                placeholderTextColor="#9CA3AF"
                value={countrySearchQuery}
                onChangeText={setCountrySearchQuery}
              />
            </View>
            <FlatList
              data={filteredCountries}
              renderItem={renderCountryItem}
              keyExtractor={(item) => item.cca2}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.countryListContent}
              style={styles.countryList}
              ListEmptyComponent={
                <View style={styles.emptyCountryList}>
                  <Text size="sm" color="#6B7280">
                    No countries found.
                  </Text>
                </View>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
  },
  avatarSection: {
    alignItems: "center",
    paddingTop: 0,
    paddingBottom: 28,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPortraitFrame: {
    width: 110,
    height: 110,
    borderRadius: 55,
    padding: 4,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(81, 146, 251, 0.25)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: "100%",
    height: "100%",
    borderRadius: 50,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  personalInfoTitle: {
    fontSize: 24,
    lineHeight: 40,
    color: "#111318",
    marginBottom: 10,
    marginLeft: 6,
  },
  avatarEditBadge: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: BrandColors.background,
  },
  errorContainer: {
    backgroundColor: "rgba(248, 113, 113, 0.1)",
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(248, 113, 113, 0.2)",
  },
  glassCard: {
    backgroundColor: "rgba(255, 255, 255, 1)",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: Spacing["2xl"],
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 2,
  },
  formRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLabel: {
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  rowInput: {
    fontSize: 17,
    color: "#1d1d1f",
    padding: 0,
    minHeight: 24,
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(60, 60, 67, 0.12)",
    marginLeft: 16,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  countryPrefix: {
    flexDirection: "row",
    alignItems: "center",
    borderRightWidth: 1,
    borderRightColor: "rgba(60, 60, 67, 0.2)",
    paddingRight: 10,
    gap: 6,
  },
  countryFlag: {
    fontSize: 18,
  },
  countryNumber: {
    fontSize: 17,
    color: "#1d1d1f",
  },
  phoneInput: {
    flex: 1,
    fontSize: 17,
    color: "#1d1d1f",
    padding: 0,
    minHeight: 24,
  },
  submitArea: {
    marginTop: 0,
    paddingBottom: 20,
  },
  submitButton: {
    backgroundColor: BrandColors.secondary,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  photoModalCard: {
    width: "100%",
    backgroundColor: "#FFF",
    borderRadius: 24,
    padding: 24,
  },
  photoModalTitle: {
    textAlign: "center",
    marginBottom: 6,
  },
  photoModalSubtitle: {
    textAlign: "center",
    marginBottom: 16,
  },
  photoModalButtons: {
    gap: 10,
  },
  photoModalPrimaryButton: {
    height: 48,
    borderRadius: 24,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  photoModalSecondaryButton: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF",
  },
  photoModalRemoveButton: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.05)",
  },
  photoModalCancelButton: {
    marginTop: 2,
  },
  countryPickerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  countryPickerSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  countryPickerHandle: {
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#D1D5DB",
    alignSelf: "center",
    marginBottom: 10,
  },
  countryPickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  countrySearchContainer: {
    marginBottom: 10,
  },
  countrySearchInput: {
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: "#111827",
  },
  countryList: {
    flexGrow: 0,
  },
  countryListContent: {
    paddingBottom: 12,
  },
  emptyCountryList: {
    paddingVertical: 18,
    alignItems: "center",
  },
  countryItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  countryItemSelected: {
    backgroundColor: "#EEF2FF",
    borderRadius: 10,
  },
  countryItemFlag: {
    width: 30,
    alignItems: "center",
    marginRight: 10,
  },
  countryItemFlagText: {
    fontSize: 22,
  },
  countryItemCode: {
    width: 56,
    fontSize: 15,
    color: "#111827",
    fontWeight: "500",
  },
  countryItemName: {
    flex: 1,
    fontSize: 15,
    color: "#111827",
  },
});
