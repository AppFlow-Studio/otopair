/**
 * N4a · Claim card, new user
 *
 * Nothing is asked that the shop already knows — the customer confirms rather
 * than fills in. Email is optional and skippable; the marketing toggle is off
 * by default and states plainly that job updates arrive regardless.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { GlassCard, PrimaryCta, useClaimData, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

export default function ClaimScreen() {
  const data = useClaimData();
  const router = useRouter();

  // Built from the resolved claim, so it has to live inside the component.
  const rows: { label: string; value: string; editable: boolean }[] = [
    { label: 'YOUR NAME', value: data.fullName, editable: true },
    { label: 'VEHICLE', value: data.vehicle, editable: true },
    { label: 'SHOP', value: data.shop, editable: false },
    { label: 'MOBILE', value: data.phoneFull, editable: false },
  ];

  return (
    <WalkInScreen title="Almost done" showBack scroll contentStyle={styles.content}>
      <Text style={styles.headline}>Welcome, {data.firstName}</Text>
      <Text style={styles.sub}>
        {data.shop} already gave us the details. Just check they&apos;re right.
      </Text>

      <GlassCard radius={20} style={styles.card}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i < rows.length - 1 && styles.rowDivider]}>
            <View style={styles.rowCopy}>
              <Text style={styles.rowLabel}>{r.label}</Text>
              <Text style={styles.rowValue}>{r.value}</Text>
            </View>
            {r.editable ? <Text style={styles.edit}>Edit</Text> : null}
          </View>
        ))}
      </GlassCard>

      <View style={styles.footer}>
        <Text style={styles.legal}>
          By continuing you agree to the Terms of Service and Privacy Policy.
        </Text>
        <PrimaryCta label="Claim this booking" onPress={() => router.push('/(walk-in)/welcome-back')} />
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 36 },
  headline: { fontFamily: FontFamily.bold, fontSize: 27, color: WI.ink, marginTop: 12 },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: WI.muted,
    marginTop: 8,
  },
  card: {
    marginTop: 56,
    paddingHorizontal: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 24 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: WI.hairline },
  rowCopy: { flex: 1 },
  rowLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.9,
    color: WI.low,
  },
  rowValue: { fontFamily: FontFamily.semiBold, fontSize: 15, color: WI.ink, marginTop: 3 },
  edit: { fontFamily: FontFamily.semiBold, fontSize: 13.5, color: WI.accent },
  // marginTop:'auto' pushes the footer to the bottom of the scroll container,
  // which no longer needs to scroll now the email and offers cards are gone.
  footer: { marginTop: 'auto', paddingBottom: 30 },
  legal: {
    fontFamily: FontFamily.regular,
    fontSize: 11.5,
    lineHeight: 16,
    color: WI.low,
    marginBottom: 18,
  },
});
