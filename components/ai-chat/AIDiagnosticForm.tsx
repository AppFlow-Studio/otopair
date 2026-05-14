/**
 * AIDiagnosticForm
 *
 * PURPOSE: Pre-filled diagnostic booking form (subsystem selector + notes) shown
 * inline in the AI chat when the assistant emits render_diagnostic_form.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (stage === "diagnostic_form")
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState, useCallback } from 'react';
import { View, Pressable, StyleSheet, TextInput } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from '@/constants/theme';
import type { DiagnosticSystem } from '@/lib/diagnostic-checklist-templates';

// ============================================================================
// SUBSYSTEM DEFINITIONS (locked)
// ============================================================================

export const SYSTEMS: { value: DiagnosticSystem; label: string }[] = [
  { value: 'brakes', label: 'Brakes' },
  { value: 'tires_wheels', label: 'Tires & Wheels' },
  { value: 'engine', label: 'Engine' },
  { value: 'battery_electrical', label: 'Battery & Electrical' },
  { value: 'not_sure', label: 'Not Sure' },
];

// ============================================================================
// TYPES
// ============================================================================

interface AIDiagnosticFormProps {
  initialSystem?: DiagnosticSystem;
  initialNotes?: string;
  vehicleId: string;
  onConfirm: (system: DiagnosticSystem, notes: string) => void;
  disabled?: boolean;
}

// ============================================================================
// SUBSYSTEM ROW
// ============================================================================

function SubsystemRow({
  system,
  selected,
  onSelect,
  index,
  disabled,
}: {
  system: { value: DiagnosticSystem; label: string };
  selected: boolean;
  onSelect: () => void;
  index: number;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View entering={FadeInUp.delay(index * 40).duration(200)}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onSelect}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
          style={({ pressed }) => [
            styles.serviceItem,
            selected && styles.serviceItemSelected,
            pressed && !disabled && styles.serviceItemPressed,
            disabled && styles.serviceItemDisabled,
          ]}
        >
          <View style={styles.serviceInfo}>
            <Text
              style={[styles.serviceName, selected && styles.serviceNameSelected]}
              weight="semiBold"
            >
              {system.label}
            </Text>
          </View>
          <View style={[styles.selectionCircle, selected && styles.selectionCircleSelected]}>
            {selected && <Check size={12} color={BrandColors.white} strokeWidth={3} />}
          </View>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIDiagnosticForm({
  initialSystem,
  initialNotes,
  vehicleId: _vehicleId,
  onConfirm,
  disabled = false,
}: AIDiagnosticFormProps) {
  const [selectedSystem, setSelectedSystem] = useState<DiagnosticSystem | undefined>(initialSystem);
  const [notesText, setNotesText] = useState<string>(initialNotes ?? '');

  const handleSelect = useCallback(
    (value: DiagnosticSystem) => {
      if (disabled) return;
      setSelectedSystem(value);
    },
    [disabled],
  );

  const handleConfirm = useCallback(() => {
    if (!selectedSystem || disabled) return;
    onConfirm(selectedSystem, notesText);
  }, [selectedSystem, notesText, disabled, onConfirm]);

  const isReady = !!selectedSystem && !disabled;

  return (
    <View style={styles.container}>
      {/* Subsystem rows */}
      <View style={styles.serviceList}>
        {SYSTEMS.map((system, index) => (
          <SubsystemRow
            key={system.value}
            system={system}
            selected={selectedSystem === system.value}
            onSelect={() => handleSelect(system.value)}
            index={index}
            disabled={disabled}
          />
        ))}
      </View>

      {/* Notes input */}
      <View style={styles.notesWrapper}>
        <TextInput
          value={notesText}
          onChangeText={setNotesText}
          placeholder="Add a note for the mechanic (optional)"
          placeholderTextColor="#A0AEC0"
          multiline
          numberOfLines={3}
          editable={!disabled}
          style={styles.notesInput}
        />
      </View>

      {/* Confirm */}
      <View style={styles.footer}>
        <Pressable
          onPress={handleConfirm}
          disabled={!isReady}
          style={({ pressed }) => [
            styles.confirmButton,
            isReady && styles.confirmButtonEnabled,
            pressed && isReady && styles.confirmButtonPressed,
            !isReady && styles.confirmButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.confirmButtonText,
              isReady && styles.confirmButtonTextEnabled,
            ]}
            weight="semiBold"
          >
            {selectedSystem ? 'Confirm diagnostic' : 'Pick a subsystem'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  serviceList: {
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  serviceItemSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  serviceItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  serviceItemDisabled: {
    opacity: 0.5,
  },
  serviceInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  serviceName: {
    color: '#4A5568',
    fontSize: 14,
    lineHeight: 18,
  },
  serviceNameSelected: {
    color: BrandColors.secondary,
  },
  selectionCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleSelected: {
    backgroundColor: BrandColors.secondary,
    borderColor: BrandColors.secondary,
  },
  // Notes input — mirrors AIInputBox.textInput typography
  notesWrapper: {
    marginHorizontal: Spacing.sm,
    marginBottom: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  notesInput: {
    fontSize: 16,
    fontFamily: FontFamily.regular,
    color: BrandColors.primary,
    lineHeight: 22,
    paddingVertical: 6,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  // Footer
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    gap: Spacing.xs,
  },
  confirmButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  confirmButtonEnabled: {
    backgroundColor: BrandColors.secondary,
  },
  confirmButtonPressed: {
    opacity: 0.9,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#4A5568',
    fontSize: 15,
  },
  confirmButtonTextEnabled: {
    color: BrandColors.white,
  },
});
