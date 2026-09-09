/**
 * WalkInKit
 *
 * PURPOSE: Shared chrome and building blocks for the walk-in first-run flow —
 *          the screens a customer sees when a shop created their booking and
 *          they open the app for the first time.
 *
 * USED IN: app/(walk-in)/*
 *
 * DESIGN: Figma "Otopair — Purchase to Post-Job Flow (Copy)" →
 *         page `Walk-in → App Flow`, the `OTO · N1…N7` row.
 *
 *         Surfaces are frosted glass over the Oto gradient rather than solid
 *         cards: a BlurView with a translucent white wash and a light hairline.
 *         The gradient stays visible through every card, which is what keeps
 *         the flow feeling like Otopair instead of a generic white checkout.
 *         Same BlurView approach as HomeHeaderBar.
 *
 * NOTE: Presentation only. No Convex, no Clerk, no claim logic — every screen
 *       is driven by the MOCK constant below while the flow is being reviewed.
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React from 'react';
import {
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check, ChevronLeft } from 'lucide-react-native';

// 3. Constants
import { BrandColors, FontFamily, OtoGradient } from '@/constants/theme';
import { useWalkInClaimStore } from '@/stores/useWalkInClaimStore';

/** The app's mark — same asset the home hero and map pin use. */
export const OTOPAIR_LOGO = require('@/assets/images/pin-logo-3d.png');

// ============================================================================
// TOKENS
// ============================================================================

export const WI = {
  accent: BrandColors.secondary,      // #5299FE
  ink: BrandColors.primary,           // #141C24
  muted: '#5A6472',
  low: '#8A94A3',
  hairline: 'rgba(20,28,36,0.07)',
  /** Frosted surface: white wash + hairline. */
  glassTint: 'rgba(255,255,255,0.58)',
  glassEdge: 'rgba(255,255,255,0.75)',
  /** Accent-tinted well used inside glass cards. */
  wellBg: 'rgba(82,153,254,0.10)',
  wellEdge: 'rgba(82,153,254,0.22)',
  railIdle: '#CBD5E1',
} as const;

/** Placeholder job. Replaced by the real booking once the claim flow is wired. */
export const MOCK = {
  shop: 'Bay Ridge Auto Care',
  title: "Marcus's 2019 Toyota RAV4",
  titleClaimed: 'Your 2019 Toyota RAV4',
  plate: 'Plate ··· 4419 · Front brakes',
  plateClaimed: 'Plate HRT-4419 · Front brakes',
  ready: 'Today by ~4:30 PM',
  firstName: 'Marcus',
  fullName: 'Marcus Reyes',
  vehicle: '2019 Toyota RAV4 XLE',
  vehicleShort: '2019 Toyota RAV4',
  phoneMasked: '(•••) •••-4821',
  phoneFull: '(917) 555-4821 · verified',
  mechanic: 'Danny R.',
  mechanicMeta: 'ASE-certified · 9 years at this shop',
  mechanicInitials: 'DR',
} as const;

/**
 * `+19175554821` → `(917) 555-4821`. Anything that isn't a 10-digit US number
 * (or +1 + 10) is handed back untouched rather than mangled — better to show a
 * foreign number as-is than to reformat it wrongly.
 */
export function formatPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  const local = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits;
  if (local.length !== 10) return e164;
  return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
}

/**
 * `+19175554821` → `(•••) •••-4821`. The verify screen is shown before the
 * customer has proved who they are, so only the last four are revealed —
 * anyone holding the phone must already know the rest.
 */
export function maskPhone(e164: string | null | undefined): string | null {
  if (!e164) return null;
  const digits = e164.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `(•••) •••-${digits.slice(-4)}`;
}

/** epoch ms → `2:15 PM`. */
export function formatTime(ms: number | null | undefined): string | null {
  if (!ms) return null;
  return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/**
 * ISO → `Today by ~4:30 PM`, or `Thu, Aug 21 by ~4:30 PM` when it isn't today.
 * Matches how the web tracker renders the same value, so a customer moving
 * between browser and app doesn't see the estimate re-worded.
 */
export function formatEta(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) return `Today by ~${time}`;
  const day = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  return `${day} by ~${time}`;
}

/** `{year, make, model, trim}` → `2019 Toyota RAV4 XLE`. */
export function vehicleLabel(v?: {
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
} | null): string | null {
  if (!v) return null;
  const parts = [v.year, v.make, v.model, v.trim].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
}

/**
 * The live stage list from `getTrackerData.timeline`, mapped onto the
 * timeline's three visual states. The last reached entry is "current"; the
 * ones before it are done. Falls back to MOCK_STAGES during preview.
 *
 * Labels come from the server rather than being re-worded here, so the app and
 * the web tracker can never disagree about what stage a job is at.
 */
export function useClaimStages(): Stage[] {
  const tracker = useWalkInClaimStore((s) => s.tracker);
  const timeline = tracker?.timeline;
  if (!timeline?.length) return MOCK_STAGES;

  let lastReached = -1;
  timeline.forEach((t, i) => {
    if (t.reached) lastReached = i;
  });

  return timeline.map((t, i) => ({
    label: t.label,
    time: formatTime(t.atMs) ?? '—',
    state: !t.reached ? 'todo' : i === lastReached ? 'current' : 'done',
  }));
}

/**
 * The job as the screens should render it: the resolved claim where a real
 * value exists, MOCK everywhere else.
 *
 * `resolveClaimToken` returns email / phone / firstName / lastName / shopName /
 * vehicleSummary. Plate, estimated-ready, the stage timeline and the mechanic
 * are still MOCK — none of them are on the claim payload, so they need either
 * a widened query or a booking fetch before this screen tells the truth.
 */
export function useClaimData() {
  const claim = useWalkInClaimStore((s) => s.claim);
  const tracker = useWalkInClaimStore((s) => s.tracker);

  // Preview only. The moment a real claim or tracker exists, MOCK is out of
  // the picture entirely — a per-field fallback silently renders another
  // person's name and plate onto a real customer's job, which is worse than
  // showing nothing.
  if (!claim && !tracker) return MOCK;

  // Prefer the tracker's VIN-derived vehicle over the claim's summary string:
  // it reflects any post-booking decode, not the mechanic's first keystrokes.
  const first = (tracker?.firstName || claim?.firstName)?.trim() || null;
  const vehicle = vehicleLabel(tracker?.vehicle) || claim?.vehicleSummary?.trim() || null;
  const fullName = [claim?.firstName, claim?.lastName].filter(Boolean).join(' ').trim();
  const pretty = formatPhone(claim?.phone);
  const service = tracker?.primaryService?.trim() || null;
  const plateLast4 = tracker?.vehicle?.plateLast4 || null;
  const eta = formatEta(tracker?.estimatedReadyIso);
  const shop = tracker?.shopName?.trim() || claim?.shopName?.trim() || null;

  const plateLine =
    [plateLast4 ? `Plate ··· ${plateLast4}` : null, service].filter(Boolean).join(' · ');

  const mech = tracker?.mechanic;
  const mechMeta = [
    mech?.aseCertified ? 'ASE-certified' : null,
    mech?.yearsAtShop ? `${mech.yearsAtShop} years at this shop` : null,
  ].filter(Boolean).join(' · ');

  return {
    // Neutral, honest placeholders — never MOCK — where the payload is thin.
    shop: shop || 'Your shop',
    firstName: first || 'there',
    fullName: fullName || first || '',
    vehicle: vehicle || 'Your vehicle',
    vehicleShort: vehicle || 'Your vehicle',
    title: vehicle
      ? first
        ? `${first}'s ${vehicle}`
        : vehicle
      : first
        ? `${first}'s vehicle`
        : 'Your vehicle',
    titleClaimed: vehicle ? `Your ${vehicle}` : 'Your vehicle',
    // Empty string renders as nothing rather than a fabricated plate.
    plate: plateLine,
    plateClaimed: plateLine,
    ready: eta || 'Estimate to come',
    phoneMasked: maskPhone(claim?.phone) || 'your number on file',
    phoneFull: pretty ? `${pretty} · verified` : 'On file with the shop',
    mechanic: mech?.displayName || 'Your mechanic',
    mechanicMeta: mechMeta,
    mechanicInitials:
      mech?.displayName
        ?.split(' ')
        .map((w) => w[0])
        .filter(Boolean)
        .slice(0, 2)
        .join('')
        .toUpperCase() || '—',
  };
}

export type Stage = { label: string; time: string; state: 'done' | 'current' | 'todo' };

export const MOCK_STAGES: Stage[] = [
  { label: 'Checked in at the shop', time: '2:15 PM', state: 'done' },
  { label: 'Vehicle inspected — findings logged', time: '2:32 PM', state: 'done' },
  { label: 'In the bay · front brake service', time: '3:05 PM', state: 'current' },
  { label: 'Quality check', time: '—', state: 'todo' },
  { label: 'Ready for pickup', time: '—', state: 'todo' },
];

// ============================================================================
// GLASS
// ============================================================================

/**
 * Frosted card. Android's BlurView is expensive and inconsistent, so it falls
 * back to a heavier opaque wash there — the layout is identical either way.
 */
export function GlassCard({
  children,
  style,
  radius = 24,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  radius?: number;
}) {
  return (
    <View style={[styles.glass, { borderRadius: radius }, style]}>
      {Platform.OS === 'ios' ? (
        <BlurView intensity={26} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: Platform.OS === 'ios' ? WI.glassTint : 'rgba(255,255,255,0.88)' },
        ]}
      />
      {children}
    </View>
  );
}

// ============================================================================
// SCREEN SHELL
// ============================================================================

interface WalkInScreenProps {
  children: React.ReactNode;
  title?: string;
  brand?: boolean;
  showBack?: boolean;
  headerRight?: React.ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  /** Drop the Skip control. Used by the account gate, which is a hard stop. */
  hideSkip?: boolean;
}

export function WalkInScreen({
  children,
  title,
  brand,
  showBack,
  headerRight,
  scroll,
  contentStyle,
  hideSkip,
}: WalkInScreenProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const Body = scroll ? ScrollView : View;
  const bodyProps = scroll
    ? { contentContainerStyle: [styles.body, contentStyle], showsVerticalScrollIndicator: false }
    : { style: [styles.body, contentStyle] };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#A5CDFF', '#CFE4FA', '#FFFFFF']}
        locations={[0, 0.5, 1]}
        start={OtoGradient.start}
        end={OtoGradient.end}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <View style={styles.headerSide}>
          {showBack ? (
            <Pressable
              onPress={() => router.back()}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <ChevronLeft size={24} color={WI.accent} strokeWidth={2.4} />
            </Pressable>
          ) : brand ? (
            <View style={styles.brandRow}>
              <Image source={OTOPAIR_LOGO} style={styles.brandMark} resizeMode="contain" />
              <Text style={styles.brandName}>Otopair</Text>
            </View>
          ) : null}
        </View>

        {title ? <Text style={styles.headerTitle}>{title}</Text> : <View style={styles.headerFill} />}

        <View style={styles.headerRight}>
          {headerRight}
          {hideSkip ? null : (
          <Pressable
            onPress={() => router.replace('/(main-tabs)/home')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Skip walk-in preview"
            style={({ pressed }) => [styles.skip, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.skipText}>Skip</Text>
          </Pressable>
          )}
        </View>
      </View>

      <Body {...(bodyProps as any)}>{children}</Body>
    </View>
  );
}

// ============================================================================
// BLOCKS
// ============================================================================

export function JobCard({
  title,
  plate,
  style,
}: {
  title: string;
  plate: string;
  style?: ViewStyle;
}) {
  const data = useClaimData();
  return (
    <GlassCard style={StyleSheet.flatten([styles.cardPad, style])}>
      <View style={styles.jobTopRow}>
        <Text style={styles.eyebrow}>{data.shop.toUpperCase()}</Text>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>IN SERVICE</Text>
        </View>
      </View>
      <Text style={styles.jobTitle}>{title}</Text>
      {plate ? <Text style={styles.jobPlate}>{plate}</Text> : null}
      <View style={styles.readyWell}>
        <Text style={styles.readyLabel}>ESTIMATED READY</Text>
        <Text style={styles.readyValue}>{data.ready}</Text>
      </View>
    </GlassCard>
  );
}

export function ProgressCard({ stages, style }: { stages: Stage[]; style?: ViewStyle }) {
  return (
    <GlassCard style={StyleSheet.flatten([styles.cardPad, styles.progressCard, style])}>
      <Text style={[styles.eyebrow, styles.progressLabel]}>PROGRESS</Text>
      {stages.map((s, i) => {
        const done = s.state === 'done';
        const current = s.state === 'current';
        const last = i === stages.length - 1;
        return (
          <View key={s.label} style={styles.stageRow}>
            <View style={styles.stageRail}>
              <View style={styles.stageDotWrap}>
                {/* The current stage carries a halo rather than its own colour
                    — every check is the same blue, so "in progress" has to be
                    signalled by the ring plus the accent timestamp. */}
                {current ? <View style={styles.stageHalo} /> : null}
                <View
                  style={[
                    styles.stageDot,
                    (done || current) && { backgroundColor: WI.accent },
                    !done && !current && styles.stageDotTodo,
                  ]}
                >
                  {(done || current) && <Check size={11} color="#FFFFFF" strokeWidth={3} />}
                </View>
              </View>
              {!last && (
                <View
                  style={[
                    styles.stageConnector,
                    { backgroundColor: done ? WI.accent : WI.railIdle },
                  ]}
                />
              )}
            </View>
            <View style={[styles.stageCopy, last && styles.stageCopyLast]}>
              <Text style={[styles.stageLabel, !done && !current && styles.stageLabelTodo]}>
                {s.label}
              </Text>
              <Text style={[styles.stageTime, current && { color: WI.accent }]}>{s.time}</Text>
            </View>
          </View>
        );
      })}
    </GlassCard>
  );
}

export function PrimaryCta({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
    >
      <Text style={styles.ctaText}>{label}</Text>
    </Pressable>
  );
}

export function GhostButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8}>
      <Text style={styles.ghost}>{label}</Text>
    </Pressable>
  );
}

export function CenterHero({
  headline,
  sub,
  children,
}: {
  headline: string;
  sub: string;
  children?: React.ReactNode;
}) {
  return (
    <View style={styles.hero}>
      {children}
      <Text style={styles.heroHeadline}>{headline}</Text>
      <Text style={styles.heroSub}>{sub}</Text>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#CFE4FA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 12,
    gap: 8,
  },
  headerSide: { minWidth: 40, justifyContent: 'center' },
  headerFill: { flex: 1 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontFamily: FontFamily.bold,
    fontSize: 16.5,
    color: WI.ink,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 40,
    justifyContent: 'flex-end',
  },
  skip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.72)',
  },
  skipText: { fontFamily: FontFamily.semiBold, fontSize: 13.5, color: WI.muted },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 7, width: 150 },
  brandMark: { width: 32, height: 32 },
  brandName: { fontFamily: FontFamily.bold, fontSize: 16.5, color: WI.ink },
  body: { flexGrow: 1, paddingHorizontal: 20 },

  glass: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WI.glassEdge,
    shadowColor: '#14273F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 3,
  },
  cardPad: { padding: 18 },

  jobTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eyebrow: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10.5,
    letterSpacing: 0.9,
    color: WI.low,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 13,
    backgroundColor: 'rgba(82,153,254,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(82,153,254,0.28)',
  },
  statusChipText: {
    fontFamily: FontFamily.bold,
    fontSize: 10,
    letterSpacing: 0.5,
    color: WI.accent,
  },
  jobTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 21,
    lineHeight: 27,
    color: WI.ink,
    marginTop: 11,
  },
  jobPlate: { fontFamily: FontFamily.regular, fontSize: 13, color: WI.muted, marginTop: 6 },
  readyWell: {
    marginTop: 13,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: WI.wellBg,
    borderWidth: 1,
    borderColor: WI.wellEdge,
  },
  readyLabel: {
    fontFamily: FontFamily.semiBold,
    fontSize: 10,
    letterSpacing: 0.9,
    color: WI.accent,
  },
  readyValue: { fontFamily: FontFamily.bold, fontSize: 18, color: WI.ink, marginTop: 3 },

  progressCard: { paddingBottom: 8 },
  progressLabel: { marginBottom: 10 },
  stageRow: { flexDirection: 'row', gap: 14 },
  stageRail: { alignItems: 'center', width: 19 },
  stageDotWrap: { width: 19, height: 19, alignItems: 'center', justifyContent: 'center' },
  stageHalo: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: 'rgba(82,153,254,0.22)',
  },
  stageDot: { width: 19, height: 19, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stageDotTodo: { borderWidth: 1.5, borderColor: WI.railIdle },
  stageConnector: { width: 2, flex: 1, minHeight: 16, marginVertical: 2 },
  stageCopy: { flex: 1, paddingBottom: 12 },
  stageCopyLast: { paddingBottom: 0 },
  stageLabel: { fontFamily: FontFamily.semiBold, fontSize: 14.5, color: WI.ink },
  stageLabelTodo: { fontFamily: FontFamily.medium, color: WI.low },
  stageTime: { fontFamily: FontFamily.regular, fontSize: 12, color: WI.low, marginTop: 3 },

  cta: {
    height: 56,
    borderRadius: 16,
    backgroundColor: WI.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#14273F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 4,
  },
  ctaText: { fontFamily: FontFamily.bold, fontSize: 16.5, color: '#FFFFFF' },
  ghost: {
    fontFamily: FontFamily.semiBold,
    fontSize: 15,
    color: WI.muted,
    textAlign: 'center',
    marginTop: 18,
  },

  hero: { alignItems: 'center', paddingHorizontal: 24 },
  heroHeadline: {
    fontFamily: FontFamily.bold,
    fontSize: 26,
    color: WI.ink,
    textAlign: 'center',
    marginTop: 28,
  },
  heroSub: {
    fontFamily: FontFamily.regular,
    fontSize: 14.5,
    lineHeight: 21,
    color: WI.muted,
    textAlign: 'center',
    marginTop: 10,
  },
});
