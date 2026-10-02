/**
 * N2 · Verify phone (masked)
 *
 * The number is never typed — it is the one the shop already has on file, shown
 * masked so the customer can confirm it is theirs without exposing it to anyone
 * holding the phone.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Smartphone } from 'lucide-react-native';
import { useAction } from 'convex/react';

import { GlassCard, PrimaryCta, useClaimData, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useWalkInClaimStore } from '@/stores/useWalkInClaimStore';

export default function VerifyPhoneScreen() {
  const data = useClaimData();
  const router = useRouter();
  const token = useWalkInClaimStore((s) => s.token);
  const sendCode = useAction(api.walkin_phone_verify.sendCode);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* The number is never typed and never sent from here — the server reads it
     off the booking the shop created. A tracker link is shareable by design,
     so if the client could name the destination, anyone holding the link
     could point a verification code at a phone of their choosing. */
  const handleSend = useCallback(async () => {
    if (!token) {
      // No token means this is the design preview, not a real claim. Let the
      // flow continue so the screens stay walkable.
      router.push('/(walk-in)/enter-code');
      return;
    }
    if (sending) return;
    setSending(true);
    setError(null);
    try {
      const res = await sendCode({ token });
      if (res.ok) {
        router.push('/(walk-in)/enter-code');
      } else {
        setError(res.message);
        setSending(false);
      }
    } catch {
      setError("We couldn't send that just now. Please try again.");
      setSending(false);
    }
  }, [token, sending, sendCode, router]);

  return (
    <WalkInScreen title="Verify" showBack>
      <Text style={styles.headline}>Is this your number?</Text>
      <Text style={styles.sub}>
        We&apos;ll text a 6-digit code to the number {data.shop} has on file for this job.
      </Text>

      <GlassCard radius={18} style={styles.numberCard}>
        <View style={styles.iconTile}>
          <Smartphone size={22} color="#FFFFFF" strokeWidth={2.2} />
        </View>
        <View style={styles.numberCopy}>
          <Text style={styles.number}>{data.phoneMasked}</Text>
          <Text style={styles.onFile}>On file for this booking</Text>
        </View>
      </GlassCard>

      <Text
        style={styles.altLink}
        onPress={() => router.push('/(walk-in)/welcome-back')}
      >
        Use a different number
      </Text>

      <View style={styles.footer}>
        <Text style={styles.legal}>
          Message and data rates may apply. By continuing you agree to the Terms and Privacy Policy.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <PrimaryCta
          label={sending ? 'Sending…' : 'Text me a code'}
          onPress={handleSend}
        />
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: FontFamily.bold, fontSize: 27, lineHeight: 33, color: WI.ink, marginTop: 18 },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: WI.muted,
    marginTop: 10,
  },
  numberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 40,
    padding: 18,
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: 13,
    backgroundColor: WI.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberCopy: { flex: 1 },
  number: { fontFamily: FontFamily.bold, fontSize: 19, color: WI.ink },
  onFile: { fontFamily: FontFamily.medium, fontSize: 13, color: WI.accent, marginTop: 3 },
  altLink: {
    fontFamily: FontFamily.semiBold,
    fontSize: 14.5,
    color: WI.accent,
    textAlign: 'center',
    marginTop: 22,
  },
  footer: { marginTop: 'auto', paddingBottom: 28 },
  error: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: '#B91C1C',
    marginBottom: 12,
  },
  legal: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: WI.low,
    marginBottom: 20,
  },
});
