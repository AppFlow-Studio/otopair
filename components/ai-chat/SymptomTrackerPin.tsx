/**
 * SymptomTrackerPin
 *
 * PURPOSE: Issue 2 (Aug-08 QA report) — pins the conversation's unresolved
 * symptoms to the thread as visible state: "Tracking: no-start · check-engine
 * light · AC smell". Backed by the W3.2 open-symptom ledger
 * (ai_conversations.open_symptoms), so the list is deterministic — the
 * classifier appends rows, a booking render marks them addressed, and this
 * pill reflects both reactively via the parent's useQuery.
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (floats under the context bar)
 *
 * OWNER: Waleed Mansour
 */

import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { ClipboardList } from 'lucide-react-native';

import { Text } from '@/components/shared-ui';
import { FontFamily } from '@/constants/theme';
import { symptomDisplayLabel } from '@/lib/symptomTracking';

export interface OpenSymptomRow {
  text: string;
  category: string;
  safety_relevant: boolean;
}

interface SymptomTrackerPinProps {
  symptoms: OpenSymptomRow[];
  top: number;
}

export function SymptomTrackerPin({ symptoms, top }: SymptomTrackerPinProps) {
  const labels = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const s of symptoms) {
      const label = symptomDisplayLabel(s.category, s.text);
      if (!seen.has(label)) {
        seen.add(label);
        out.push(label);
      }
    }
    return out;
  }, [symptoms]);

  if (labels.length === 0) return null;

  return (
    <Animated.View
      entering={FadeIn.duration(250)}
      exiting={FadeOut.duration(150)}
      style={[styles.wrapper, { top }]}
      pointerEvents="none"
    >
      <BlurView intensity={60} tint="light" style={styles.pill}>
        <ClipboardList size={13} color="rgba(0,0,0,0.45)" />
        <Text style={styles.label} numberOfLines={2}>
          <Text style={styles.labelPrefix}>Tracking: </Text>
          {labels.join(' · ')}
        </Text>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 4,
    paddingHorizontal: 32,
  },
  pill: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    shadowOpacity: 0.05,
    maxWidth: '100%',
  },
  label: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    color: 'rgba(0,0,0,0.6)',
    marginLeft: 6,
    flexShrink: 1,
  },
  labelPrefix: {
    fontSize: 12,
    fontFamily: FontFamily.semiBold,
    color: 'rgba(0,0,0,0.45)',
  },
});
