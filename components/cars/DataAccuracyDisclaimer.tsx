/**
 * DataAccuracyDisclaimer
 *
 * PURPOSE: Sets honest expectations for older vehicles on the Cars tab. When the
 *          active vehicle is a 2012-or-older model year, renders a compact chip
 *          reading "Data may not be 100% accurate." Tapping it opens a small popup
 *          explaining that, due to the vehicle's age, some manufacturer/parts/
 *          maintenance data may be limited or unavailable.
 *
 *          Self-hides for newer vehicles (year > 2012) and unknown years (0), so
 *          callers can render it unconditionally.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (under the vehicle carousel)
 *
 * OWNER: AppFlow Studios
 */

// 1. React & React Native
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

// 2. Third-party
import { ChevronRight, Info, X } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '@/components/shared-ui';

// 4. Constants, utils
import { BorderRadius, Spacing } from '@/constants/theme';
import { moderateScale, scale } from '@/utils/responsive';

// ============================================================================
// CONSTANTS
// ============================================================================

// Vehicles at or below this model year get the reduced-accuracy disclaimer —
// enrichment source coverage thins out for older cars.
const DATA_ACCURACY_MAX_YEAR = 2012;

// ============================================================================
// TYPES
// ============================================================================

interface DataAccuracyDisclaimerProps {
  /** Active vehicle model year. 0 (or falsy) means unknown → chip is hidden. */
  year: number;
  make?: string;
  model?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function DataAccuracyDisclaimer({ year, make, model }: DataAccuracyDisclaimerProps) {
  const [showInfo, setShowInfo] = useState(false);

  // Hide for unknown-year and newer vehicles.
  if (!year || year > DATA_ACCURACY_MAX_YEAR) {
    return null;
  }

  const vehicleLabel = [year, make, model].filter(Boolean).join(' ').trim() || 'this vehicle';

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Data accuracy notice for older vehicles. Tap to learn why."
        hitSlop={8}
        onPress={() => setShowInfo(true)}
        style={({ pressed }) => [styles.chip, pressed && { opacity: 0.7 }]}
      >
        <Info size={scale(14)} color="#475569" strokeWidth={2.2} />
        <Text weight="medium" size="sm" color="#475569" style={styles.chipText}>
          Data may not be 100% accurate
        </Text>
        <ChevronRight size={scale(14)} color="#94A3B8" strokeWidth={2.2} />
      </Pressable>

      <Modal
        visible={showInfo}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setShowInfo(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setShowInfo(false)}>
          <View style={styles.card} onStartShouldSetResponder={() => true}>
            <Pressable
              accessibilityLabel="Close"
              hitSlop={16}
              onPress={() => setShowInfo(false)}
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.6 }]}
            >
              <X size={22} color="#475569" strokeWidth={2.4} />
            </Pressable>

            <Text weight="bold" size="lg" color="#0F172A" style={styles.title}>
              About older vehicles
            </Text>

            <Text weight="regular" size="sm" color="#64748B" style={styles.body}>
              {`Because your ${vehicleLabel} is a 2012-or-older model, some manufacturer specs, parts, and maintenance details may be limited or unavailable. We always show our best available information — you or your mechanic can confirm anything during service.`}
            </Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: scale(6),
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(15,23,42,0.05)',
    marginTop: Spacing.sm,
    marginHorizontal: Spacing.lg,
  },
  chipText: {
    flexShrink: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  card: {
    width: '100%',
    maxWidth: scale(360),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(20),
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    paddingBottom: Spacing.xl,
  },
  closeBtn: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: scale(28),
    height: scale(28),
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  title: {
    marginBottom: Spacing.sm,
    paddingRight: scale(28),
  },
  body: {
    lineHeight: moderateScale(20),
  },
});

export default DataAccuracyDisclaimer;
