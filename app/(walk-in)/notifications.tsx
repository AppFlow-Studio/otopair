/**
 * N6 · Notification prime
 *
 * Shows the payoff rather than asking for a permission: a mock lock screen with
 * the one notification this actually buys.
 *
 * OWNER: Ahmad Hamoudeh
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import {
  CenterHero,
  GhostButton,
  OTOPAIR_LOGO,
  PrimaryCta,
  WalkInScreen,
  WI,
} from '@/components/walk-in/WalkInKit';
import { FontFamily } from '@/constants/theme';

export default function NotificationsPrimeScreen() {
  const router = useRouter();
  const next = () => router.replace('/(walk-in)/tracker');

  return (
    <WalkInScreen>
      <View style={styles.lock}>
        {/* Neutral graphite, not the brand navy — this is a mock of the OS lock
            screen, so it should read as the phone rather than as one of our
            own surfaces. */}
        <LinearGradient
          colors={['#20242B', '#33383F']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.lockStatus}>9:41</Text>
        <Text style={styles.lockTime}>4:31</Text>
        <Text style={styles.lockDate}>Friday, August 7</Text>

        <View style={styles.notification}>
          <Image source={OTOPAIR_LOGO} style={styles.notifIcon} resizeMode="contain" />
          <View style={styles.notifCopy}>
            <View style={styles.notifTopRow}>
              <Text style={styles.notifApp}>OTOPAIR</Text>
              <Text style={styles.notifWhen}>now</Text>
            </View>
            <Text style={styles.notifBody}>Your RAV4 is ready for pickup 🎉</Text>
          </View>
        </View>
      </View>

      <CenterHero
        headline="Know the second it's ready"
        sub="One notification when your car is done. That's it."
      />

      <View style={styles.footer}>
        <PrimaryCta label="Turn on notifications" onPress={next} />
        <GhostButton label="Not now" onPress={next} />
      </View>
    </WalkInScreen>
  );
}

const styles = StyleSheet.create({
  lock: {
    marginTop: 12,
    marginHorizontal: 20,
    height: 232,
    borderRadius: 28,
    overflow: 'hidden',
    paddingHorizontal: 18,
    shadowColor: '#0D1A33',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 8,
  },
  lockStatus: {
    fontFamily: FontFamily.semiBold,
    fontSize: 12.5,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    marginTop: 16,
  },
  lockTime: {
    fontFamily: FontFamily.bold,
    fontSize: 60,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 4,
  },
  lockDate: {
    fontFamily: FontFamily.medium,
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.62)',
    textAlign: 'center',
    marginTop: 2,
  },
  notification: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.96)',
  },
  notifIcon: { width: 30, height: 30 },
  notifCopy: { flex: 1 },
  notifTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  notifApp: {
    fontFamily: FontFamily.semiBold,
    fontSize: 9.5,
    letterSpacing: 0.9,
    color: WI.low,
  },
  notifWhen: { fontFamily: FontFamily.regular, fontSize: 9.5, color: WI.low },
  notifBody: { fontFamily: FontFamily.bold, fontSize: 13.5, color: WI.ink, marginTop: 3 },
  footer: { marginTop: 'auto', paddingBottom: 34 },
});
