/**
 * N2 · Verify phone (masked)
 *
 * The number is never typed — it is the one the shop already has on file, shown
 * masked so the customer can confirm it is theirs without exposing it to anyone
 * holding the phone.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Smartphone } from 'lucide-react-native';

import { GlassCard, PrimaryCta, useClaimData, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

export default function VerifyPhoneScreen() {
  const data = useClaimData();
  const router = useRouter();

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
        <PrimaryCta label="Text me a code" onPress={() => router.push('/(walk-in)/enter-code')} />
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
  legal: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: WI.low,
    marginBottom: 20,
  },
});
