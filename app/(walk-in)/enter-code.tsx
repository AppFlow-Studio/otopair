/**
 * N3 · Enter code
 *
 * Boxes are static in the preview — the fifth carries the caret so the design
 * reads as mid-entry. The footer note is the point of the screen: verifying is
 * optional, tracking continues either way, so the code is never a wall.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { PrimaryCta, useClaimData, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

const DIGITS = ['4', '9', '2', '1', '', ''];
const ACTIVE_INDEX = 4;

export default function EnterCodeScreen() {
  const data = useClaimData();
  const router = useRouter();

  return (
    <WalkInScreen title="Verify" showBack>
      <Text style={styles.headline}>Enter the code</Text>
      <Text style={styles.sub}>
        Sent to {data.phoneMasked}. It should fill in automatically.
      </Text>

      <View style={styles.boxes}>
        {DIGITS.map((d, i) => {
          const active = i === ACTIVE_INDEX;
          return (
            <View key={i} style={[styles.box, active && styles.boxActive]}>
              {d ? <Text style={styles.digit}>{d}</Text> : null}
              {active ? <View style={styles.caret} /> : null}
            </View>
          );
        })}
      </View>

      <View style={styles.resendRow}>
        <Text style={styles.resendLead}>Didn&apos;t get it?</Text>
        <Text style={styles.resendTimer}>Resend in 0:27</Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.note}>
          <Text style={styles.noteEmoji}>👀</Text>
          <Text style={styles.noteText}>
            Your job status keeps updating in the browser either way — verifying never blocks
            tracking.
          </Text>
        </View>
        <PrimaryCta label="Continue" onPress={() => router.push('/(walk-in)/claim')} />
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  headline: { fontFamily: FontFamily.bold, fontSize: 27, color: WI.ink, marginTop: 18 },
  sub: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: WI.muted,
    marginTop: 8,
  },
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 30 },
  box: {
    width: 48,
    height: 58,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.82)',
    borderWidth: 1.2,
    borderColor: 'rgba(255,255,255,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14273F',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 1,
  },
  boxActive: { borderWidth: 2, borderColor: WI.accent },
  digit: { fontFamily: FontFamily.bold, fontSize: 24, color: WI.ink },
  caret: { width: 2, height: 22, borderRadius: 1, backgroundColor: WI.accent },
  resendRow: { flexDirection: 'row', gap: 8, marginTop: 18 },
  resendLead: { fontFamily: FontFamily.semiBold, fontSize: 13.5, color: WI.ink },
  resendTimer: { fontFamily: FontFamily.regular, fontSize: 13.5, color: WI.low },
  footer: { marginTop: 'auto', paddingBottom: 28 },
  note: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.72)',
    marginBottom: 20,
  },
  noteEmoji: { fontSize: 17 },
  noteText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 12.5,
    lineHeight: 17,
    color: WI.muted,
  },
});
