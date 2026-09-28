/**
 * N3 · Enter code
 *
 * The boxes are a presentation layer over ONE hidden TextInput. Six separate
 * inputs is the usual way to build this and it fights iOS: SMS autofill fills
 * a single field, and backspace across six fields never behaves. One field,
 * six painted cells, `textContentType="oneTimeCode"` — the code drops in from
 * the keyboard suggestion in one tap.
 *
 * The footer note is the point of the screen: verifying is optional, tracking
 * continues either way, so the code is never a wall. Every failure here
 * degrades to "not verified" and the Continue path stays open.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAction, useMutation } from 'convex/react';

import { PrimaryCta, useClaimData, WalkInScreen, WI } from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';
import { api } from '@/convex/_generated/api';
import { useWalkInClaimStore } from '@/stores/useWalkInClaimStore';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function EnterCodeScreen() {
  const data = useClaimData();
  const router = useRouter();
  const token = useWalkInClaimStore((s) => s.token);
  const verifyCode = useMutation(api.walkin_phone_verify.verifyCode);
  const resend = useAction(api.walkin_phone_verify.sendCode);

  const inputRef = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const handleVerify = useCallback(
    async (value: string) => {
      if (!token) {
        // Design preview — no claim behind it. Keep the flow walkable.
        router.push('/(walk-in)/claim');
        return;
      }
      if (busy) return;
      setBusy(true);
      setError(null);
      try {
        const res = await verifyCode({ token, code: value });
        if (res.ok) {
          router.push('/(walk-in)/claim');
        } else {
          setError(res.message);
          setCode('');
          setBusy(false);
        }
      } catch {
        setError("We couldn't check that just now. Please try again.");
        setBusy(false);
      }
    },
    [token, busy, verifyCode, router],
  );

  const handleChange = useCallback(
    (raw: string) => {
      const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH);
      setCode(digits);
      if (error) setError(null);
      // Submit on the sixth digit. Nobody wants to reach for a button after
      // typing a code they already know is complete.
      if (digits.length === CODE_LENGTH) void handleVerify(digits);
    },
    [error, handleVerify],
  );

  const handleResend = useCallback(async () => {
    if (!token || cooldown > 0 || busy) return;
    setError(null);
    const res = await resend({ token });
    if (!res.ok) setError(res.message);
    setCooldown(RESEND_SECONDS);
  }, [token, cooldown, busy, resend]);

  return (
    <WalkInScreen title="Verify" showBack>
      <Text style={styles.headline}>Enter the code</Text>
      <Text style={styles.sub}>
        Sent to {data.phoneMasked}. It should fill in automatically.
      </Text>

      <Pressable style={styles.boxes} onPress={() => inputRef.current?.focus()}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => {
          const d = code[i];
          const active = i === code.length;
          return (
            <View key={i} style={[styles.box, active && styles.boxActive]}>
              {d ? <Text style={styles.digit}>{d}</Text> : null}
              {active ? <View style={styles.caret} /> : null}
            </View>
          );
        })}
        {/* One real field behind the six painted cells. `oneTimeCode` is what
            makes iOS offer the code above the keyboard. */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={handleChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          autoFocus
          editable={!busy}
          maxLength={CODE_LENGTH}
          style={styles.hiddenInput}
          caretHidden
        />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.resendRow}>
        <Text style={styles.resendLead}>Didn&apos;t get it?</Text>
        <Text
          style={[styles.resendTimer, cooldown === 0 && styles.resendActive]}
          onPress={handleResend}
        >
          {cooldown > 0
            ? `Resend in 0:${String(cooldown).padStart(2, '0')}`
            : 'Resend code'}
        </Text>
      </View>

      <View style={styles.footer}>
        <View style={styles.note}>
          <Text style={styles.noteEmoji}>👀</Text>
          <Text style={styles.noteText}>
            Your job status keeps updating in the browser either way — verifying never blocks
            tracking.
          </Text>
        </View>
        {/* Verifying never blocks tracking, so Continue stays live even with
            an incomplete code — it just carries on unverified. */}
        <PrimaryCta
          label={busy ? 'Checking…' : 'Continue'}
          onPress={() =>
            code.length === CODE_LENGTH
              ? void handleVerify(code)
              : router.push('/(walk-in)/claim')
          }
        />
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
  hiddenInput: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    opacity: 0,
  },
  error: {
    fontFamily: FontFamily.medium,
    fontSize: 13,
    lineHeight: 18,
    color: '#B91C1C',
    marginTop: 12,
  },
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
  resendActive: { fontFamily: FontFamily.semiBold, color: WI.accent },
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
