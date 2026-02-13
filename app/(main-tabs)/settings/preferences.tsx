/**
 * PreferencesScreen
 *
 * PURPOSE: Allows users to customize app-wide preferences such as language and units.
 *          Features a clean iOS-style list inside a glass-morphism card.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx (via navigation)
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <PreferencesScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  Pressable,
  ActivityIndicator,
  Modal,
  TouchableWithoutFeedback,
  Platform,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronRight, Check } from 'lucide-react-native';
import { useQuery } from "convex/react";
import { BlurView } from 'expo-blur';

import { BrandColors, Spacing, Text, BlurHeaderOverlay } from '@/components/shared-ui';
import { getSheetContentPadding, FontFamily } from '@/constants/theme';
import { api } from "@/convex/_generated/api";
import { useOnboardingStore } from "@/stores/useOnboardingStore";
import { useOnboardingPersistence } from "@/hooks/useOnboardingPersistence";

const LANGUAGES = [
  { label: 'English', value: 'English' },
  { label: 'Español', value: 'Spanish' },
  { label: 'Français', value: 'French' },
  { label: 'Italiano', value: 'Italian' }
];
const UNITS = [
  { label: 'Miles (mi)', value: 'mi' },
  { label: 'Kilometers (km)', value: 'km' }
];

export default function PreferencesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Convex & Zustand
  const me = useQuery(api.users.getMe);
  const { data, updateData } = useOnboardingStore();
  const { persistProfileField } = useOnboardingPersistence();

  // Local state for the form
  const [language, setLanguage] = useState(data.language || 'English');
  const [units, setUnits] = useState(data.units || 'mi');
  const [isSaving, setIsSaving] = useState(false);
  const [visibleSheet, setVisibleSheet] = useState<'language' | 'units' | null>(null);
  const [tempValue, setTempValue] = useState<string>('');

  // Animation values
  const sheetAnim = useRef(new Animated.Value(0)).current; // 0 = closed, 1 = open
  const backdropAnim = useRef(new Animated.Value(0)).current; // 0 = transparent, 1 = semi-opaque

  // Trigger slide and fade animations when sheet visibility changes
  useEffect(() => {
    if (visibleSheet) {
      // Open animation
      Animated.parallel([
        Animated.timing(sheetAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visibleSheet, sheetAnim, backdropAnim]);

  const closeSheet = () => {
    // Close animation
    Animated.parallel([
      Animated.timing(sheetAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisibleSheet(null);
      setTempValue('');
    });
  };

  const handleDone = () => {
    if (visibleSheet === 'language') setLanguage(tempValue);
    else if (visibleSheet === 'units') setUnits(tempValue);
    closeSheet();
  };

  // Sync local state if Convex data arrives and store is empty
  useEffect(() => {
    if (me) {
      if (me.language && !data.language) {
        setLanguage(me.language);
        updateData({ language: me.language });
      }
      if (me.units && !data.units) {
        setUnits(me.units);
        updateData({ units: me.units });
      }
    }
  }, [me, data.language, data.units, updateData]);

  const handleSave = async () => {
    setIsSaving(true);

    // 1. Update Zustand store for immediate UI update
    updateData({ language, units });

    // 2. Persist to Convex database
    try {
      await persistProfileField({ 
        language, 
        units 
      });
      router.back();
    } catch (error) {
      console.error("Error saving preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const renderSheet = () => {
    if (!visibleSheet) return null;

    const isLanguage = visibleSheet === 'language';
    const title = isLanguage ? 'Select Language' : 'Select Units';
    const options = isLanguage ? LANGUAGES : UNITS;

    return (
      <Modal
        transparent
        visible={!!visibleSheet}
        animationType="none"
        onRequestClose={closeSheet}
      >
        <TouchableWithoutFeedback onPress={closeSheet}>
          <Animated.View 
            style={[
              styles.sheetOverlay,
              {
                opacity: backdropAnim
              }
            ]}
          >
            <TouchableWithoutFeedback>
              <Animated.View 
                style={[
                  styles.sheetContainer, 
                  { 
                    paddingBottom: insets.bottom + 20,
                    transform: [{
                      translateY: sheetAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [400, 0], // Optimized slide distance
                      })
                    }]
                  }
                ]}
              >
                <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
                <View style={styles.sheetHandle} />
                <Text weight="semiBold" size="lg" color="#1d1d1f" style={styles.sheetTitle}>
                  {title}
                </Text>

                <View style={styles.optionsList}>
                  <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
                  {options.map((option, index) => {
                    const label = typeof option === 'string' ? option : option.label;
                    const value = typeof option === 'string' ? option : option.value;
                    const isSelected = value === tempValue;
                    const isLast = index === options.length - 1;

                    return (
                      <Pressable
                        key={value}
                        style={({ pressed }) => [
                          styles.optionItem,
                          pressed && styles.optionItemPressed,
                          !isLast && styles.optionBorder
                        ]}
                        onPress={() => setTempValue(value)}
                      >
                        <Text 
                          size="md" 
                          color="#1d1d1f" 
                          weight={isSelected ? 'medium' : 'regular'}
                        >
                          {label}
                        </Text>
                        {isSelected && <Check size={24} color={BrandColors.primary} />}
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable
                  style={styles.doneButton}
                  onPress={handleDone}
                >
                  <Text weight="semiBold" size="md" color="#FFF">
                    Done
                  </Text>
                </Pressable>
              </Animated.View>
            </TouchableWithoutFeedback>
          </Animated.View>
        </TouchableWithoutFeedback>
      </Modal>
    );
  };

  return (
    <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
      <BlurHeaderOverlay title="Settings" />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 80,
            paddingBottom: getSheetContentPadding(true, insets.bottom)
          }
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroArea}>
          <Text weight="bold" style={styles.heroTitle}>Preferences</Text>
          <Text size="md" color="#86868b">Tailor Otopair to your needs</Text>
        </View>

        {/* Preferences Card */}
        <View style={styles.glassCard}>
          {/* Language Selection */}
          <Pressable 
            style={({ pressed }) => [styles.formRow, pressed && styles.rowPressed]}
            onPress={() => {
              setTempValue(language);
              setVisibleSheet('language');
            }}
          >
            <View style={styles.rowContent}>
              <Text weight="medium" size="xs" color="#86868b" style={styles.rowLabel}>
                LANGUAGE
              </Text>
              <View style={styles.rowValueContainer}>
                <Text size="md" color="#1d1d1f">{LANGUAGES.find(l => l.value === language)?.label || language}</Text>
                <ChevronRight size={20} color="#86868b" />
              </View>
            </View>
          </Pressable>

          <View style={styles.separator} />

          {/* Units Selection */}
          <Pressable 
            style={({ pressed }) => [styles.formRow, pressed && styles.rowPressed]}
            onPress={() => {
              setTempValue(units);
              setVisibleSheet('units');
            }}
          >
            <View style={styles.rowContent}>
              <Text weight="medium" size="xs" color="#86868b" style={styles.rowLabel}>
                UNITS
              </Text>
              <View style={styles.rowValueContainer}>
                <Text size="md" color="#1d1d1f">{UNITS.find(u => u.value === units)?.label || units}</Text>
                <ChevronRight size={20} color="#86868b" />
              </View>
            </View>
          </Pressable>
        </View>

        <View style={{ flex: 1 }} />

        {/* Submit Area */}
        <View style={styles.submitArea}>
          <Pressable
            style={({ pressed }) => [
              styles.submitButton,
              (pressed || isSaving) && { opacity: 0.7 }
            ]}
            onPress={handleSave}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text weight="semiBold" size="md" color="#FFF">
                Save preferences
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      {renderSheet()}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  heroArea: {
    marginBottom: 32,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: '#111318',
    marginBottom: 8,
  },
  glassCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  formRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowPressed: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  rowContent: {
    width: '100%',
  },
  rowLabel: {
    marginBottom: 4,
    letterSpacing: 0.5,
  },
  rowValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  separator: {
    height: 1,
    backgroundColor: 'rgba(60, 60, 67, 0.12)',
    marginLeft: 16,
  },
  submitArea: {
    marginTop: 'auto',
    paddingBottom: 20,
  },
  submitButton: {
    backgroundColor: BrandColors.secondary,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.7)' : '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    overflow: 'hidden',
  },
  sheetHandle: {
    width: 36,
    height: 5,
    backgroundColor: '#D1D1D6',
    borderRadius: 2.5,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 20,
  },
  sheetTitle: {
    textAlign: 'center',
    marginBottom: 24,
  },
  optionsList: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 32,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  optionItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  optionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(60, 60, 67, 0.1)',
  },
  doneButton: {
    backgroundColor: BrandColors.primary,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
