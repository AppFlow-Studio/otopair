/**
 * ProfilePhotoStep
 *
 * PURPOSE: Allows the user to upload a profile photo or skip for now.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 *
 * PROPS:
 *   - onNext (() => void): Callback to navigate to the next step
 *   - onBack (() => void): Callback to navigate to the previous step
 *   - progress ({ total: number; filled: number }): Progress indicator data
 *
 * EXAMPLE:
 *   <ProfilePhotoStep 
 *     onNext={handleNext} 
 *     onBack={handleBack} 
 *     progress={{ total: 8, filled: 4 }} 
 *   />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

// TODO: Save profile photo

import {
  BrandColors,
  FontFamily,
  FontSize,
  Spacing,
  Text,
  FinishLater,
} from "@/components/shared-ui";
import { ProgressBar } from "@/components/shared-ui/ProgressBar";
import { FooterButton } from "@/components/shared-ui/FooterButton";
import { BackButton } from "@/components/shared-ui/BackButton";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useOnboardingPersistence } from "@/hooks/useOnboardingPersistence";
import { useState, useEffect } from "react";
import {
  BackHandler,
  StyleSheet,
  View,
  useWindowDimensions,
  Pressable,
  Modal,
  TouchableOpacity,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Plus } from "lucide-react-native";
import { OnboardingSurfaceColors } from "../onboardingColors";
// @ts-ignore Expo module available at runtime
import * as ImagePicker from "expo-image-picker";

interface ProfilePhotoStepProps {
  onNext: () => void;
  onBack: () => void;
  progress: { total: number; filled: number };
}

export function ProfilePhotoStep({ onNext, onBack, progress }: ProfilePhotoStepProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const data = useOnboardingStore((state) => state.data);
  const updateData = useOnboardingStore((state) => state.updateData);
  const { persistProfilePhoto } = useOnboardingPersistence();
  const [imageUri, setImageUri] = useState<string | null>(
    data.profilePhotoUri ?? null
  );
  const [showPhotoModal, setShowPhotoModal] = useState(false);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
    return () => sub.remove();
  }, [onBack]);
  const [isUploading, setIsUploading] = useState(false);

  const dynamicStyles = {
    container: { paddingTop: insets.top + Spacing.lg },
  };

  const isCompact = height < 720;
  const buttonSize: "md" | "lg" = isCompact ? "md" : "lg";
  const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

  const requestLibraryPermission = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  const requestCameraPermission = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === "granted";
  };

  const pickFromLibrary = async () => {
    const hasPermission = await requestLibraryPermission();
    if (!hasPermission) {
      setShowPhotoModal(false);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
    });
    
    setShowPhotoModal(false);
    if (!result.canceled && result.assets?.length) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      updateData({ profilePhotoUri: uri });
    }
  };

  const takePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    if (!hasPermission) {
      setShowPhotoModal(false);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.9,
      mediaTypes: ['images'],
    });

    setShowPhotoModal(false);
    if (!result.canceled && result.assets?.length) {
      const uri = result.assets[0].uri;
      setImageUri(uri);
      updateData({ profilePhotoUri: uri });
    }
  };

  const handlePhotoPress = () => {
    setShowPhotoModal(true);
  };

  const handleCloseModal = () => {
    setShowPhotoModal(false);
  };

  const handleContinue = async () => {
    if (imageUri) {
      setIsUploading(true);
      try {
        await persistProfilePhoto(imageUri);
      } catch (error) {
        console.error("Profile photo upload failed during onboarding:", error);
        // We still continue even if upload fails, as the local URI is saved in Zustand
      } finally {
        setIsUploading(false);
      }
    }
    onNext();
  };

  const canContinue = imageUri !== null;

  return (
    <View style={[styles.container, dynamicStyles.container]}>
      <ProgressBar
        total={progress.total}
        filled={progress.filled}
        leftElement={<BackButton onBack={onBack} alwaysShow />}
      />
      <FinishLater />

      <View style={styles.content}>
        <View style={styles.photoContainer}>
          <Pressable style={styles.photoCircle} onPress={handlePhotoPress}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.defaultAvatar}>
                <View style={styles.defaultAvatarHead} />
                <View style={styles.defaultAvatarBody} />
              </View>
            )}
          </Pressable>
          <Pressable style={styles.plusBadge} onPress={handlePhotoPress}>
            <Plus size={24} color={BrandColors.secondary} />
          </Pressable>
        </View>

        <View style={styles.headerContent}>
          <Text style={styles.title}>Add your profile photo</Text>
          <Text style={styles.subtitle}>
            Let&apos;s see the face behind the wheel!
          </Text>
        </View>

        <View style={styles.actionsContainer}>
          <FooterButton
            label="Continue"
            onPress={handleContinue}
            disabled={!canContinue || isUploading}
            loading={isUploading}
            size={buttonSize}
            paddingVertical={buttonPaddingVertical}
            backgroundColor={canContinue ? undefined : "#6B7280"}
            textColor={canContinue ? undefined : BrandColors.white}
          />
        </View>
      </View>

      <Modal
        visible={showPhotoModal}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={handleCloseModal}
      >
        <Pressable
          style={styles.photoModalBackdrop}
          onPress={handleCloseModal}
        >
          <Pressable
            style={styles.photoModalCard}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={styles.photoModalTitle}>Profile photo</Text>
            <Text style={styles.photoModalSubtitle}>Select an option</Text>
            <View style={styles.photoModalButtons}>
              <TouchableOpacity
                style={styles.photoModalPrimaryButton}
                onPress={pickFromLibrary}
              >
                <Text style={styles.photoModalPrimaryText}>Choose from library</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoModalSecondaryButton}
                onPress={takePhoto}
              >
                <Text style={styles.photoModalSecondaryText}>Take a photo</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.photoModalTextButton}
                onPress={handleCloseModal}
              >
                <Text style={styles.photoModalTextButtonLabel}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing["2xl"],
    gap: Spacing.lg,
  },
  photoContainer: {
    marginBottom: Spacing["3xl"],
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#94A3B8',
    overflow: 'hidden',
  },
  defaultAvatar: {
    width: "100%",
    height: "100%",
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  defaultAvatarHead: {
    position: "absolute",
    top: 42,
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "#374151",
  },
  defaultAvatarBody: {
    width: 142,
    height: 88,
    borderTopLeftRadius: 72,
    borderTopRightRadius: 72,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    backgroundColor: "#374151",
    marginBottom: -20,
  },
  photoPreview: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  plusBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#5299FE',
  },
  headerContent: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize["4xl"],
    fontFamily: FontFamily.bold,
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: Spacing['5xl'],
  },
  subtitle: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.regular,
    color: '#0F172A',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: Spacing['2xl'],
    paddingHorizontal: Spacing.lg,
  },
  actionsContainer: {
    width: "100%",
    gap: Spacing.lg,
  },
  photoModalBackdrop: {
    flex: 1,
    backgroundColor: OnboardingSurfaceColors.backdrop,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  photoModalCard: {
    backgroundColor: OnboardingSurfaceColors.card,
    borderRadius: 20,
    padding: Spacing["2xl"],
    width: "100%",
    maxWidth: 400,
    alignItems: "center",
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.border,
  },
  photoModalTitle: {
    fontSize: FontSize["2xl"],
    fontFamily: FontFamily.bold,
    color: OnboardingSurfaceColors.text,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  photoModalSubtitle: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.regular,
    color: OnboardingSurfaceColors.mutedText,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
  },
  photoModalButtons: {
    width: "100%",
    gap: Spacing.md,
  },
  photoModalPrimaryButton: {
    backgroundColor: OnboardingSurfaceColors.primaryButton,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
  },
  photoModalPrimaryText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semiBold,
    color: OnboardingSurfaceColors.primaryButtonText,
  },
  photoModalSecondaryButton: {
    backgroundColor: OnboardingSurfaceColors.secondaryButton,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    alignItems: "center",
    borderWidth: 1,
    borderColor: OnboardingSurfaceColors.borderStrong,
  },
  photoModalSecondaryText: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.semiBold,
    color: OnboardingSurfaceColors.secondaryButtonText,
  },
  photoModalTextButton: {
    paddingVertical: Spacing.sm,
    alignItems: "center",
  },
  photoModalTextButtonLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.semiBold,
    color: OnboardingSurfaceColors.linkText,
  },
});

