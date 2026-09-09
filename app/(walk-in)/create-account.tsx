/**
 * Account gate — the end of the walk-in flow.
 *
 * A walk-in has no account: the shop created their booking, so everything up
 * to here worked without one. This is the hard stop. The car leads, because
 * what's on offer is *their car* in their Garage — the account is the means,
 * not the ask.
 *
 * Deliberately has no Skip and no back. An already-authenticated user is sent
 * straight through, so re-opening a claim link while signed in doesn't
 * dead-end on a signup screen.
 *
 * IMAGE: VDB needs a VIN or a verbose trim string and the tracker payload
 * carries neither by design, so `walkin_claims.ensureTrackerImage` resolves the
 * VIN server-side, checks both cache levels, and writes the result back. The
 * colour shown is VDB's default for the trim.
 *
 * The paint picker that used to sit here is gone for now. Its Convex side —
 * `listTrackerColors` and `setTrackerImage` — stays deployed and unused, so
 * bringing it back is a client-only change.
 *
 * DESIGN: Figma `Walk-in → App Flow`, the G-row at y=5500 — G2's centred
 * title and G1's copy.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useAction } from 'convex/react';

import { PrimaryCta, useClaimData, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';
import { useWalkInClaimStore } from '@/stores/useWalkInClaimStore';
import { api } from '@/convex/_generated/api';

const FALLBACK_VEHICLE_IMAGE = require('@/assets/images/covered-car.png');

export default function CreateAccountGateScreen() {
  const router = useRouter();
  const data = useClaimData();
  const { isSignedIn } = useAuth();

  const token = useWalkInClaimStore((s) => s.token);
  const cachedUrl = useWalkInClaimStore((s) => s.tracker?.vehicle?.imageUrl) ?? null;

  const ensureImage = useAction(api.walkin_claims.ensureTrackerImage);

  const [photoUrl, setPhotoUrl] = useState<string | null>(cachedUrl);
  const [photoLoading, setPhotoLoading] = useState(!cachedUrl);

  // Already has an account — nothing to gate, so don't stand in the way.
  useEffect(() => {
    if (isSignedIn) router.replace('/(main-tabs)/cars');
  }, [isSignedIn, router]);

  // The store holds a snapshot from when the token resolved, so a photo
  // fetched after that won't appear there — take the action's return directly.
  useEffect(() => {
    if (cachedUrl || !token) {
      setPhotoLoading(false);
      return;
    }
    let cancelled = false;
    setPhotoLoading(true);
    ensureImage({ token })
      .then((url) => {
        if (!cancelled) setPhotoUrl(url ?? null);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPhotoLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, cachedUrl, ensureImage]);

  const subtitle = data.shop;

  return (
    <WalkInScreen hideSkip>
      <View style={styles.body}>
        <Text style={styles.title}>{data.vehicleShort}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {/* No card — the car sits on the page, with a soft contact shadow so
            it reads as resting rather than floating. */}
        <View style={styles.photoWrap}>
          <Image
            source={photoUrl ? { uri: photoUrl } : FALLBACK_VEHICLE_IMAGE}
            style={styles.photo}
            resizeMode="contain"
            accessibilityLabel={data.vehicleShort}
          />
          {photoLoading && !photoUrl ? (
            <ActivityIndicator color={WI.accent} style={styles.photoSpinner} />
          ) : null}
        </View>

        <Text style={styles.headline}>Nice ride, {data.firstName}.</Text>
        <Text style={styles.sub}>
          Create your account and it&apos;s yours in Otopair — this job, past visits, and
          whatever&apos;s due next, all in one place.
        </Text>
      </View>

      <View style={styles.footer}>
        <PrimaryCta label="Create your account" onPress={() => router.replace('/(onboarding)')} />
        <Pressable onPress={() => router.replace('/(onboarding)')} hitSlop={8}>
          <Text style={styles.signIn}>Already have one? Sign in</Text>
        </Pressable>
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  // Top-aligned rather than centred: centring left ~145pt of dead space
  // above the title, which pushed the car and the copy down the screen.
  body: { flex: 1, justifyContent: 'flex-start', paddingTop: 4 },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 24,
    color: WI.ink,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    color: WI.muted,
    textAlign: 'center',
    marginTop: 6,
  },
  // The title is top-aligned, but the car and everything under it stay at
  // their original height — this gap absorbs the difference.
  photoWrap: { marginTop: 106 },
  photo: { width: '100%', height: 160 },
  photoSpinner: { position: 'absolute', alignSelf: 'center', top: '46%' },
  headline: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    lineHeight: 32,
    color: WI.ink,
    textAlign: 'center',
    marginTop: 118,
  },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: WI.muted,
    textAlign: 'center',
    marginTop: 10,
    paddingHorizontal: 6,
  },
  footer: { paddingBottom: 30 },
  signIn: {
    fontFamily: FontFamily.semiBold,
    fontSize: 13.5,
    color: WI.muted,
    textAlign: 'center',
    marginTop: 16,
  },
});
