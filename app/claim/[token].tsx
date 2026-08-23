/**
 * Walk-in claim entry — `otopair://claim/<token>`
 *
 * The mechanic creates the walk-in on the web portal; the customer opens
 * https://otopair.com/t/<token>, which deep-links here. This screen resolves
 * the token and routes; it renders only while resolving or when the link
 * cannot be used.
 *
 * `walkin_claims.resolveClaimToken` is a public query — no auth — and returns
 * one of four shapes, all handled below:
 *   null                      → no such token
 *   { expired: true }         → token past claim_token_expires_at
 *   { alreadyClaimed: true }  → walkInClaimedAt already stamped
 *   { email, phone, firstName, lastName, shopName, vehicleSummary } → claimable
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

import React, { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from 'convex/react';

import { api } from '@/convex/_generated/api';
import { useWalkInClaimStore, type WalkInTracker } from '@/stores/useWalkInClaimStore';
import { GhostButton, PrimaryCta, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

type ClaimResult =
  | null
  | { expired: true }
  | { alreadyClaimed: true }
  | {
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
  const setClaim = useWalkInClaimStore((s) => s.setClaim);
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

  const isClaimable =
    !!result && !('expired' in result) && !('alreadyClaimed' in result);

  useEffect(() => {
    if (tracker) setTracker(tracker);
  }, [tracker, setTracker]);

  useEffect(() => {
    if (!token || !isClaimable || !result) return;
    setClaim(token, result as Exclude<ClaimResult, null | { expired: true } | { alreadyClaimed: true }>);
    router.replace('/(walk-in)');
  }, [token, isClaimable, result, setClaim, router]);

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

  // Already claimed — the account exists, so this is a sign-in, not a claim.
  if (result && 'alreadyClaimed' in result) {
    return (
      <ClaimProblem
        headline="This job is already claimed"
        body="It's on an existing Otopair account. Sign in and you'll find it in your Garage."
        ctaLabel="Sign in"
        onCta={() => router.replace('/(onboarding)')}
      />
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
