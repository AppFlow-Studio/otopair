/**
 * N7 · Live tracker (claimed)
 *
 * The end state, and the screen this whole flow exists to reach.
 *
 * Message shop / Call are the things to do about *this job*; the CTA beneath
 * them leaves the flow for the rest of the app. Without it the tracker is a
 * dead end — the whole point of claiming is that the vehicle is now theirs to
 * look at.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import {
  GlassCard,
  JobCard,
  useClaimData,
  useReturningCustomer,
  useClaimStages,
  PrimaryCta,
  ProgressCard,
  WalkInScreen,
  WI,
} from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

export default function TrackerScreen() {
  const data = useClaimData();
  const { isReturning, firstName } = useReturningCustomer();
  const stages = useClaimStages();
  const router = useRouter();

  return (
    <WalkInScreen
      brand
      scroll
      contentStyle={styles.content}
      headerRight={
        <View style={styles.claimedChip}>
          {/* "CLAIMED" describes an action the customer just took. A returning
              one took no action — the job was already theirs — so the chip
              states where it lives instead. */}
          <Text style={styles.claimedText}>{isReturning ? 'IN YOUR GARAGE' : 'CLAIMED'}</Text>
        </View>
      }
    >
      {/* The greeting lives here rather than on the landing screen, because a
          returning customer is routed straight past that screen — the link is
          for the job, not for an introduction. */}
      {isReturning && firstName ? (
        <Text style={styles.welcomeBack}>Welcome back, {firstName}</Text>
      ) : null}
      <JobCard title={data.titleClaimed} plate={data.plateClaimed} />
      <ProgressCard stages={stages} style={styles.progress} />

      <GlassCard radius={20} style={styles.mechanicCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{data.mechanicInitials}</Text>
        </View>
        <View style={styles.mechanicCopy}>
          <Text style={styles.mechanicName}>{data.mechanic} is working on it</Text>
          {data.mechanicMeta ? (
            <Text style={styles.mechanicMeta}>{data.mechanicMeta}</Text>
          ) : null}
        </View>
      </GlassCard>

      <View style={styles.actions}>
        <Pressable style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
          <Text style={styles.actionText}>Message shop</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}>
          <Text style={styles.actionText}>Call</Text>
        </Pressable>
      </View>

      <View style={styles.continue}>
        {/* Hint sits above the button: this sits below the fold, so the
            sentence is what's legible before the user scrolls.

            A returning customer is not being asked to save anything — the job
            was merged onto their account before they ever reached the flow —
            so the sentence states a fact instead of making an offer, and the
            button goes where they already have a garage rather than to a
            sign-up screen. */}
        {isReturning ? (
          <>
            <Text style={styles.continueHint}>
              Your {data.vehicleShort} is already in your Garage.
            </Text>
            <PrimaryCta
              label="Go to my Garage"
              onPress={() => router.replace('/(main-tabs)/cars')}
            />
          </>
        ) : (
          <>
            <Text style={styles.continueHint}>
              Your {data.vehicleShort} is ready to save to your Garage.
            </Text>
            <PrimaryCta
              label="Continue to the app"
              onPress={() => router.push('/(walk-in)/create-account')}
            />
          </>
        )}
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  welcomeBack: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: WI.ink,
    marginBottom: 12,
  },
  claimedChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: 'rgba(82,153,254,0.12)',
  },
  claimedText: {
    fontFamily: FontFamily.bold,
    fontSize: 9.5,
    letterSpacing: 0.6,
    color: WI.accent,
  },
  progress: { marginTop: 10 },
  mechanicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 10,
    padding: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(82,153,254,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontFamily: FontFamily.bold, fontSize: 14, color: WI.accent },
  mechanicCopy: { flex: 1 },
  mechanicName: { fontFamily: FontFamily.semiBold, fontSize: 15, color: WI.ink },
  mechanicMeta: {
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    color: WI.muted,
    marginTop: 3,
  },
  actions: { flexDirection: 'row', gap: 13, marginTop: 12 },
  action: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontFamily: FontFamily.semiBold, fontSize: 14.5, color: WI.ink },
  continue: { marginTop: 10 },
  continueHint: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 18,
    color: WI.muted,
    textAlign: 'center',
    marginBottom: 10,
  },
});
