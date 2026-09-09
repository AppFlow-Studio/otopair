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
  useClaimStages,
  PrimaryCta,
  ProgressCard,
  WalkInScreen,
  WI,
} from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

export default function TrackerScreen() {
  const data = useClaimData();
  const stages = useClaimStages();
  const router = useRouter();

  return (
    <WalkInScreen
      brand
      scroll
      contentStyle={styles.content}
      headerRight={
        <View style={styles.claimedChip}>
          <Text style={styles.claimedText}>CLAIMED</Text>
        </View>
      }
    >
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
            sentence is what's legible before the user scrolls. */}
        <Text style={styles.continueHint}>
          Your {data.vehicleShort} is ready to save to your Garage.
        </Text>
        <PrimaryCta
          label="Continue to the app"
          onPress={() => router.push('/(walk-in)/create-account')}
        />
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
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
