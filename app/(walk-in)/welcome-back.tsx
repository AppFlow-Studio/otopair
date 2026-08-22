/**
 * N4b · Claim confirmed
 *
 * Confirmation shown straight after the claim: the job is saved and the
 * vehicle is now in their Garage.
 *
 * This was the design's "Welcome back, auto-attach" screen — the branch for a
 * customer already known to Otopair. It now addresses a first-time user
 * instead, so the returning-customer copy ("we recognized your number",
 * "3rd vehicle") is gone. If the auto-attach branch is still wanted it needs
 * its own screen, because the two can't share this wording.
 *
 * No car here on purpose: the account gate at the end of the flow is the
 * screen that shows it, and repeating the render twice in one run drains it of
 * impact. The vehicle is named in the copy instead.
 *
 * ENTRANCE: staged rather than all-at-once — the tick lands first, then the
 * words. Fast enough that it never delays the tap.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';

import { PrimaryCta, useClaimData, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

export default function WelcomeBackScreen() {
  const data = useClaimData();
  const router = useRouter();

  return (
    <WalkInScreen>
      <View style={styles.body}>
        <Animated.View entering={ZoomIn.duration(380).delay(120)} style={styles.checkWell}>
          <Check size={38} color={WI.accent} strokeWidth={3.4} />
        </Animated.View>

        <Animated.Text entering={FadeInUp.duration(380).delay(280)} style={styles.headline}>
          You&apos;re all set, {data.firstName}
        </Animated.Text>
        <Animated.Text entering={FadeInUp.duration(380).delay(400)} style={styles.sub}>
          Your {data.vehicleShort} and this job are in your Garage. We&apos;ll keep it updated as
          the shop works.
        </Animated.Text>
      </View>

      <View style={styles.footer}>
        <PrimaryCta label="Track this job" onPress={() => router.push('/(walk-in)/notifications')} />
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, justifyContent: 'center', paddingBottom: 40 },
  checkWell: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(82,153,254,0.13)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  headline: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    color: WI.ink,
    textAlign: 'center',
    marginTop: 30,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: WI.muted,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 10,
  },
  footer: { marginTop: 'auto', paddingBottom: 34 },
});
