/**
 * N1 · Booking-first landing
 *
 * The app opens on the job, not a sign-up wall. The sheet asks for identity
 * only after the customer can already see their car's status, and
 * "Just watch the status" is a real way out.
 *
 * The progress card is deliberately clipped by the sheet — the half-visible
 * stage is what signals there is more underneath.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GhostButton,
  JobCard,
  useClaimData,
  useClaimStages,
  PrimaryCta,
  ProgressCard,
  WalkInScreen,
  WI,
} from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

export default function WalkInLandingScreen() {
  const data = useClaimData();
  const stages = useClaimStages();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <WalkInScreen brand>
      <JobCard title={data.title} plate={data.plate} />
      <ProgressCard stages={stages} style={styles.progress} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 10 }]}>
        <View style={styles.grabber} />
        <Text style={styles.headline}>This is your car&apos;s job</Text>
        <Text style={styles.sub}>
          Verify it&apos;s you to get updates, message the shop, and keep this in your Garage.
        </Text>
        <View style={styles.ctaWrap}>
          <PrimaryCta label="Verify it's me" onPress={() => router.push('/(walk-in)/verify-phone')} />
          <GhostButton label="Just watch the status" onPress={() => router.push('/(walk-in)/tracker')} />
        </View>
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  progress: { marginTop: 12 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 14,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    shadowColor: '#0D1A33',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 12,
  },
  grabber: {
    width: 37,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#D5DAE2',
    alignSelf: 'center',
  },
  headline: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    color: WI.ink,
    marginTop: 16,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: WI.muted,
    marginTop: 8,
  },
  ctaWrap: { marginTop: 20 },
});
