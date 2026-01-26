/**
 * AISources
 *
 * PURPOSE: Displays source citation pills (Smartcar API, Error Codes, etc.) with tooltip modals
 *
 * USED IN: components/ai-chat/AIMessageBubble.tsx (renders inside AI messages with sources)
 *
 * PROPS:
 *   - sources (Source[]): Array of source objects to display as pills
 *
 * EXAMPLE:
 *   <AISources
 *     sources={[
 *       { type: 'smartcar_api', label: 'Smartcar API', icon: '🚗', description: '...' }
 *     ]}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState } from 'react';
import { View, ScrollView, Pressable, StyleSheet, Modal } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { X } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily, Shadows } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export type SourceType = 
  | 'smartcar_api'
  | 'error_codes'
  | 'service_history'
  | 'common_scenarios'
  | 'manufacturer_data';

export interface Source {
  type: SourceType;
  label: string;
  icon: string;
  description: string;
  details?: string; // Additional details shown in tooltip
}

interface AISourcesProps {
  sources: Source[];
}

// ============================================================================
// SOURCE DEFINITIONS
// ============================================================================

export const SOURCE_DEFINITIONS: Record<SourceType, Omit<Source, 'details'>> = {
  smartcar_api: {
    type: 'smartcar_api',
    label: 'Smartcar API',
    icon: '🚗',
    description: 'Real-time vehicle data and sensor readings',
  },
  error_codes: {
    type: 'error_codes',
    label: 'Error Codes',
    icon: '📖',
    description: 'OBD-II diagnostic trouble code dictionary',
  },
  service_history: {
    type: 'service_history',
    label: 'Service History',
    icon: '🕐',
    description: 'Your past maintenance and repair records',
  },
  common_scenarios: {
    type: 'common_scenarios',
    label: 'Common Scenarios',
    icon: '📋',
    description: 'Pattern matching from known issue database',
  },
  manufacturer_data: {
    type: 'manufacturer_data',
    label: 'Manufacturer Data',
    icon: '🏭',
    description: 'Vehicle specifications and VIN database',
  },
};

// ============================================================================
// SOURCE PRESETS BY SCENARIO
// ============================================================================

export function getSourcesForScenario(scenario: string): Source[] {
  switch (scenario) {
    case 'brake_noise':
      return [
        { ...SOURCE_DEFINITIONS.smartcar_api, details: 'Checking for brake system warnings' },
        { ...SOURCE_DEFINITIONS.service_history, details: 'Last brake service date' },
        { ...SOURCE_DEFINITIONS.common_scenarios, details: 'Squeal pattern matching' },
      ];
    case 'check_engine':
      return [
        { ...SOURCE_DEFINITIONS.smartcar_api, details: 'Reading error codes from vehicle' },
        { ...SOURCE_DEFINITIONS.error_codes, details: 'Code definition lookup' },
        { ...SOURCE_DEFINITIONS.common_scenarios, details: 'Known causes for this code' },
      ];
    case 'oil_change':
      return [
        { ...SOURCE_DEFINITIONS.smartcar_api, details: 'Current oil life percentage' },
        { ...SOURCE_DEFINITIONS.service_history, details: 'Preferred shops from past visits' },
      ];
    case 'tire_pressure':
      return [
        { ...SOURCE_DEFINITIONS.smartcar_api, details: 'Tire pressure sensor readings' },
        { ...SOURCE_DEFINITIONS.service_history, details: 'Recent tire service records' },
      ];
    case 'vague_issue':
      return [
        { ...SOURCE_DEFINITIONS.smartcar_api, details: 'Full vehicle diagnostic scan' },
        { ...SOURCE_DEFINITIONS.service_history, details: 'Recent maintenance history' },
        { ...SOURCE_DEFINITIONS.common_scenarios, details: 'Symptom pattern analysis' },
      ];
    default:
      return [
        { ...SOURCE_DEFINITIONS.smartcar_api },
        { ...SOURCE_DEFINITIONS.service_history },
      ];
  }
}

// ============================================================================
// SOURCE PILL COMPONENT
// ============================================================================

function SourcePill({ 
  source, 
  onPress,
  index,
}: { 
  source: Source; 
  onPress: () => void;
  index: number;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View 
      entering={FadeIn.delay(index * 100).duration(200)}
    >
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          style={({ pressed }) => [
            styles.pill,
            pressed && styles.pillPressed,
          ]}
        >
          <Text style={styles.pillIcon}>{source.icon}</Text>
          <Text style={styles.pillLabel} size="xs" weight="medium">
            {source.label}
          </Text>
        </Pressable>
      </Animated.View>
    </Animated.View>
  );
}

// ============================================================================
// SOURCE TOOLTIP MODAL
// ============================================================================

function SourceTooltip({ 
  source, 
  visible, 
  onClose 
}: { 
  source: Source | null; 
  visible: boolean;
  onClose: () => void;
}) {
  if (!source) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Animated.View 
          style={styles.tooltip}
          entering={FadeIn.duration(150)}
        >
          <View style={styles.tooltipHeader}>
            <View style={styles.tooltipTitleRow}>
              <Text style={styles.tooltipIcon}>{source.icon}</Text>
              <Text style={styles.tooltipTitle} weight="semiBold">
                {source.label}
              </Text>
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <X size={18} color="#6B7280" />
            </Pressable>
          </View>
          <Text style={styles.tooltipDescription}>
            {source.description}
          </Text>
          {source.details && (
            <View style={styles.tooltipDetails}>
              <Text style={styles.tooltipDetailsText} size="sm">
                {source.details}
              </Text>
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AISources({ sources }: AISourcesProps) {
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  const handleSourcePress = (source: Source) => {
    setSelectedSource(source);
    setTooltipVisible(true);
  };

  const handleCloseTooltip = () => {
    setTooltipVisible(false);
    setTimeout(() => setSelectedSource(null), 200);
  };

  if (sources.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {sources.map((source, index) => (
          <SourcePill
            key={source.type}
            source={source}
            index={index}
            onPress={() => handleSourcePress(source)}
          />
        ))}
      </ScrollView>

      <SourceTooltip
        source={selectedSource}
        visible={tooltipVisible}
        onClose={handleCloseTooltip}
      />
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.sm,
  },
  scrollContent: {
    gap: Spacing.xs,
    flexDirection: 'row',
  },
  // Pill styles
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    gap: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillPressed: {
    backgroundColor: '#F3F4F6',
    borderColor: BrandColors.secondary + '40',
  },
  pillIcon: {
    fontSize: 12,
  },
  pillLabel: {
    color: '#6B7280',
    fontFamily: FontFamily.medium,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  tooltip: {
    backgroundColor: BrandColors.white,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 320,
    ...Shadows.lg,
  },
  tooltipHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  tooltipTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tooltipIcon: {
    fontSize: 20,
  },
  tooltipTitle: {
    color: BrandColors.primary,
    fontSize: 16,
  },
  closeBtn: {
    padding: Spacing.xs,
  },
  tooltipDescription: {
    color: '#6B7280',
    lineHeight: 22,
  },
  tooltipDetails: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tooltipDetailsText: {
    color: BrandColors.secondary,
    fontFamily: FontFamily.medium,
  },
});
