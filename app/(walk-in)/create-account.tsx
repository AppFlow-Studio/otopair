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

import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAction, useMutation } from 'convex/react';

import { PrimaryCta, useClaimData, useReturningCustomer, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';
import { useWalkInClaimStore } from '@/stores/useWalkInClaimStore';
import { api } from '@/convex/_generated/api';

const FALLBACK_VEHICLE_IMAGE = require('@/assets/images/covered-car.png');

export default function CreateAccountGateScreen() {
  const router = useRouter();
  const data = useClaimData();
  // `isReturning` rather than Clerk's `isSignedIn` directly: the dev demo
  // override decides which flow is being shown, so a presenter walking the
  // NEW-user path is not bounced out of it just because a real account happens
  // to be signed in on the device. In production the two are the same value.
  const { isReturning } = useReturningCustomer();

  const token = useWalkInClaimStore((s) => s.token);
  const cachedUrl = useWalkInClaimStore((s) => s.tracker?.vehicle?.imageUrl) ?? null;

  const ensureImage = useAction(api.walkin_claims.ensureTrackerImage);
  const claimByToken = useMutation(api.walkin_claims.claimByToken);
  const clearClaim = useWalkInClaimStore((s) => s.clear);

  const [photoUrl, setPhotoUrl] = useState<string | null>(cachedUrl);
  const [photoLoading, setPhotoLoading] = useState(!cachedUrl);
  /* Resolving the URL and DOWNLOADING it are two different waits, and only
     the first was being tracked. `photoLoading` covers `ensureTrackerImage`
     returning a URL; after that the remote file still has to come down the
     wire. These cover the second wait so the placeholder can stay hidden for
     both. */
  const [remoteReady, setRemoteReady] = useState(false);
  const [remoteFailed, setRemoteFailed] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;

  // Already has an account — claim the job onto it, THEN go to the garage.
  //
  // This used to route straight to Cars, which is how the whole flow quietly
  // did nothing for an existing customer (Ahmad, 2026-09-07): the walk-in's
  // car stayed on the shop-built stub and the carousel was unchanged. The
  // signup path adopts a stub inside `users.getOrCreateMe`, but that only runs
  // when it is inserting a NEW user — an existing account is found by
  // clerkUserId and returns long before it looks for a stub.
  //
  // Navigating regardless of the outcome is deliberate: the customer asked to
  // see their car, and a failed merge is our problem to fix, not a dead end to
  // strand them on. `claimByToken` is idempotent, so a retry costs nothing.
  useEffect(() => {
    if (!isReturning) return;
    let cancelled = false;
    const go = () => { if (!cancelled) router.replace('/(main-tabs)/cars'); };
    if (!token) { go(); return; }
    claimByToken({ token })
      .then((r) => { if (r?.ok) clearClaim(); })
      .catch(() => {})
      .finally(go);
    return () => { cancelled = true; };
  }, [isReturning, token, claimByToken, clearClaim, router]);

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

  // A new URL means a new download — start the next one hidden.
  useEffect(() => {
    setRemoteReady(false);
    setRemoteFailed(false);
    fade.setValue(0);
  }, [photoUrl, fade]);

  /* Show the covered-car placeholder ONLY once we know there is no real photo
     coming — resolution finished and produced nothing, or the download failed.
     It used to render underneath the spinner during BOTH waits, so the first
     thing the driver saw on a screen headlined "Nice ride" was a generic
     shrouded car. That is the wrong picture to greet someone with, and it is
     wrong in a way that looks like the app got their car wrong.
     Waiting on nothing is better than showing the wrong thing. */
  const waitingOnPhoto =
    photoLoading || (!!photoUrl && !remoteReady && !remoteFailed);
  const showFallback = !waitingOnPhoto && (!photoUrl || remoteFailed);

  const subtitle = data.shop;

  return (
    <WalkInScreen>
      <View style={styles.body}>
        <Text style={styles.title}>{data.vehicleShort}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

        {/* No card — the car sits on the page, with a soft contact shadow so
            it reads as resting rather than floating. */}
        <View style={styles.photoWrap}>
          {/* Kept mounted while it downloads — it cannot load if it is not
              rendered — but held at opacity 0 until the bytes are in, then
              faded up. The swap is the reveal, so it should not snap. */}
          {photoUrl && !remoteFailed ? (
            <Animated.Image
              source={{ uri: photoUrl }}
              style={[styles.photo, { opacity: fade }]}
              resizeMode="contain"
              accessibilityLabel={data.vehicleShort}
              onLoad={() => {
                setRemoteReady(true);
                Animated.timing(fade, {
                  toValue: 1,
                  duration: 260,
                  useNativeDriver: true,
                }).start();
              }}
              onError={() => setRemoteFailed(true)}
            />
          ) : null}

          {showFallback ? (
            <Image
              source={FALLBACK_VEHICLE_IMAGE}
              style={styles.photo}
              resizeMode="contain"
              accessibilityLabel={data.vehicleShort}
            />
          ) : null}

          {/* Sits on top of the (still invisible) image. photoWrap reserves
              the height, so nothing below moves when the car arrives. */}
          {waitingOnPhoto ? (
            <View style={styles.photoPlaceholder}>
              <ActivityIndicator color={WI.accent} />
            </View>
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
  /* Fixed height, and every child overlays inside it. The image is rendered
     while it downloads (at opacity 0) and the spinner sits on top of it — if
     they stacked in normal flow the block would be 320pt tall during loading
     and snap to 160 when the car arrived, taking the headline with it. */
  photoWrap: { marginTop: 106, height: 160 },
  photo: { ...StyleSheet.absoluteFillObject, width: '100%', height: 160 },
  photoSpinner: { position: 'absolute', alignSelf: 'center', top: '46%' },
  /* Same height as the photo so the layout below it never shifts. The image
     itself is absolutely positioned over this while it fades in. */
  photoPlaceholder: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
