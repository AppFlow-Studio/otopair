/**
 * Walk-in claim entry — `otopair://claim/<token>`
 *
 * The mechanic creates the walk-in on the web portal; the customer opens
 * https://otopair.com/t/<token>, which deep-links here. This screen resolves
 * the token and routes; it renders only while resolving or when the link
 * cannot be used.
 *
 * `walkin_claims.resolveClaimToken` is a public query — no auth — and returns
 * one of three shapes, all handled below:
 *   null                      → no such token
 *   { expired: true }         → token past its expiry
 *   { alreadyClaimed, email, phone, firstName, lastName, shopName,
 *     vehicleSummary }        → usable
 *
 * `alreadyClaimed` used to be a shape of its OWN, returned instead of the
 * payload, and this screen rendered it as "This job is already claimed. Sign
 * in and you'll find it in your Garage." — a wall shown to the person whose
 * job it actually is. Ahmad, 2026-09-10. It is a flag on the payload now.
 *
 * NOTE: completing the claim is not wired yet. The app syncs users through
 * `users.getOrCreateMe`, which matches on clerkUserId alone and would insert a
 * second row, orphaning the walk-in booking. The logic that adopts the stub
 * lives in `users.upsertFromClerk` (matches by email or normalized phone, then
 * stamps clerkUserId + walkInClaimedAt) and nothing in the app calls it.
 * See the handover notes before wiring the confirm step.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';

import { api } from '@/convex/_generated/api';
import { useWalkInClaimStore, type WalkInTracker } from '@/stores/useWalkInClaimStore';
import { parkClaimToken } from '@/lib/pendingWalkInClaim';
import { GhostButton, PrimaryCta, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

type ClaimResult =
  | null
  | { expired: true }
  | {
      /** The customer already has an Otopair account. The job is theirs
       *  either way — this only decides whether the flow asks them to claim
       *  anything or takes them straight to the tracker. */
      alreadyClaimed?: boolean;
      email: string | null;
      phone: string | null;
      firstName: string | null;
      lastName: string | null;
      shopName: string | null;
      vehicleSummary: string | null;
    };

export default function ClaimTokenScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const claimByToken = useMutation(api.walkin_claims.claimByToken);
  const setClaim = useWalkInClaimStore((s) => s.setClaim);
  const setVin = useWalkInClaimStore((s) => s.setVin);
  const setTracker = useWalkInClaimStore((s) => s.setTracker);


  // `undefined` = still loading; anything else is a resolved result.
  const result = useQuery(
    api.walkin_claims.resolveClaimToken,
    token ? { token } : 'skip',
  ) as ClaimResult | undefined;

  // Fetched alongside the resolver, not after it: the landing screen needs the
  // service, ETA and stage timeline, and none of those are on the claim
  // payload. Same token, so it costs one extra round trip and no extra state.
  const tracker = useQuery(
    api.walkin_claims.getTrackerData,
    token ? { token } : 'skip',
  ) as (WalkInTracker & { alreadyClaimed?: boolean }) | null | undefined;

  // `alreadyClaimed` is a flag on a full payload now, not a payload of its own.
  // A token that resolves at all is usable; whether the customer needs to
  // claim anything is a separate question the flow answers downstream.
  const isClaimable = !!result && !('expired' in result);

  useEffect(() => {
    if (tracker) setTracker(tracker);
  }, [tracker, setTracker]);

  useEffect(() => {
    if (!token || !isClaimable || !result) return;
    setClaim(token, result as Exclude<ClaimResult, null | { expired: true } | { alreadyClaimed: true }>);

    // Signed in already? Merge the job onto this account before going anywhere.
    //
    // This is the entry point EVERY branch of the walk-in flow passes through,
    // which is why the claim happens here. The screens downstream fan out —
    // verify-phone, tracker, create-account — and only one of them was ever
    // going to run a claim, so a customer who tapped "just watch the status"
    // would never get their car.
    //
    // For a signed-out customer this is a no-op: they claim by signing up, and
    // `users.getOrCreateMe` adopts the stub with this same token.
    //
    // Routing does not wait on the result. The merge is idempotent and the
    // Cars tab is a live Convex subscription, so the car appears the moment it
    // lands, whether or not this screen is still mounted.
    // AUTH FIRST (Ahmad, 2026-09-27). A walk-in job is now shown only to a
    // signed-in account: creating one takes you down the new-customer branch,
    // signing in takes you down the returning one, and the app never has to
    // guess which you are. The gate screen below does the asking.
    if (isSignedIn) {
      // Keep the VIN the merge confirms: "Go to my Garage" downstream opens
      // ON this car rather than on whichever one is primary.
      void claimByToken({ token })
        .then((r) => { if (r?.vin) setVin(r.vin); })
        .catch(() => {});
      // Straight to the live job. The landing screen exists to ask a stranger
      // to identify themselves, and there is nothing to ask someone whose
      // account already owns this booking — the tracker is what the shop
      // handed them a link for.
      router.replace('/(walk-in)/tracker');
      return;
    }
    // Signed out — hold here and render the gate rather than routing into the
    // flow. Park the token first: OAuth can cold-start the app on the way back
    // and the in-memory store would not survive it.

  }, [token, isClaimable, result, setClaim, setVin, router, isSignedIn, claimByToken]);


  if (result === undefined) {
    return (
      <WalkInScreen>
        <View style={styles.center}>
          <ActivityIndicator color={WI.accent} />
          <Text style={styles.loading}>Opening your job…</Text>
        </View>
      </WalkInScreen>
    );
  }

  /* THE GATE. A valid link, and nobody signed in.
   *
   * Signing in or creating an account is what decides which branch of the
   * walk-in flow they get, so it has to happen before the flow starts — a new
   * account goes down the new-customer path, an existing one down the
   * returning path, and nothing has to be inferred.
   *
   * It still shows WHAT they are signing in for. "Sign in to continue" with no
   * context is a wall; naming their car and the shop is the shop's handoff
   * arriving intact, and it is the thing that makes the ask reasonable. */
  if (isClaimable && !isSignedIn) {
    const r = result as Exclude<ClaimResult, null | { expired: true }>;
    const car = r.vehicleSummary?.trim();
    const shop = r.shopName?.trim();
    return (
      <WalkInScreen>
        <View style={styles.problem}>
          <Text style={styles.headline}>
            {car ? `Your ${car} is at the shop` : 'Your car is at the shop'}
          </Text>
          <Text style={styles.body}>
            {shop
              ? `Sign in or create an account to track this appointment at ${shop} — and keep the car, its history and every visit in one place.`
              : 'Sign in or create an account to track this appointment — and keep the car, its history and every visit in one place.'}
          </Text>
        </View>
        <View style={styles.footer}>
          {/* The choice here IS the branch. Parked with the token because
              everyone comes back signed in, so nothing downstream could
              otherwise tell a fresh account from one that already existed. */}
          <PrimaryCta
            label="Create an account"
            onPress={() => {
              void parkClaimToken(token, 'new');
              router.replace('/(onboarding)');
            }}
          />
          <GhostButton
            label="Already have one? Sign in"
            onPress={() => {
              void parkClaimToken(token, 'existing');
              router.replace('/(onboarding)');
            }}
          />
        </View>
      </WalkInScreen>
    );
  }

  // Expired or unknown. Both dead-end into a normal sign-up, which is the only
  // route left — the customer can still reach the shop by phone meanwhile.
  const expired = !!result && 'expired' in result;
  return (
    <ClaimProblem
      headline={expired ? 'This link has expired' : "We couldn't find that link"}
      body={
        expired
          ? 'Claim links are only good for a short window. You can still create an account with the same details the shop has on file.'
          : 'The link may be incomplete or already used. You can still create an account with the details the shop has on file.'
      }
      ctaLabel="Create an account"
      onCta={() => router.replace('/(onboarding)')}
    />
  );
}

function ClaimProblem({
  headline,
  body,
  ctaLabel,
  onCta,
}: {
  headline: string;
  body: string;
  ctaLabel: string;
  onCta: () => void;
}) {
  const router = useRouter();
  return (
    <WalkInScreen>
      <View style={styles.problem}>
        <Text style={styles.headline}>{headline}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <View style={styles.footer}>
        <PrimaryCta label={ctaLabel} onPress={onCta} />
        <GhostButton label="Not now" onPress={() => router.replace('/(main-tabs)/home')} />
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  loading: { fontFamily: FontFamily.medium, fontSize: 14.5, color: WI.muted },
  problem: { flex: 1, justifyContent: 'center', paddingBottom: 40 },
  headline: { fontFamily: FontFamily.bold, fontSize: 27, lineHeight: 33, color: WI.ink },
  body: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: WI.muted,
    marginTop: 10,
  },
  footer: { paddingBottom: 34 },
});
