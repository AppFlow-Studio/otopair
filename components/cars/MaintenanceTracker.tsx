/**
 * MaintenanceTracker
 *
 * PURPOSE: Displays a "Maintenance Tracker" section with a vertical list of maintenance
 *          cards for a vehicle, showing status (On Time, Due Soon, Overdue, Unknown),
 *          last service information, and action buttons (Book Now / Add Info).
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (below VehicleCard on My Car page)
 *
 * PROPS:
 *   - items (MaintenanceItem[]): Array of maintenance items to render
 *   - onBookNow ((id: string) => void): Called when "Book Now" is pressed for an item [optional]
 *   - onAddInfo ((id: string) => void): Called when "Add Info" is pressed for an item [optional]
 *
 * EXAMPLE:
 *   <MaintenanceTracker
 *     items={maintenanceItems}
 *     onBookNow={(id) => router.push(`/bookings/new?serviceId=${id}`)}
 *     onAddInfo={(id) => router.push(`/cars/maintenance/${id}/edit`)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { SLUG_DIAGNOSTIC_SCAN } from "@/constants/serviceTaxonomy";
import { Ionicons } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';

// Native iOS 26 liquid-glass for the "Update Info" button. Falls back
// gracefully on iOS < 26 / Android / Expo Go to the BlurView + gradient
// chrome below.
let LiquidGlassView: React.ComponentType<any> | null = null;
let isLiquidGlassEnabled = false;
try {
  const lg = require('@callstack/liquid-glass');
  LiquidGlassView = lg.LiquidGlassView;
  isLiquidGlassEnabled = !!lg.isLiquidGlassSupported;
} catch {
  // Native module unavailable — fallback chrome will render.
}
import Animated, {
  Easing as REasing,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

// 3. Shared UI
import { Text } from '@/components/shared-ui';
import { OilIcon, BrakesIcon, TireIcon, BatteryIcon, WarningIcon } from '@/components/cars/ServiceIcons';

// 4. Local components
import MaintenanceDetailView from '@/components/cars/MaintenanceDetailView';

// 5. Constants, hooks, types
import { healthySectionChip, splitQuietItems, type QuietSectionVariant } from '@/utils/healthySection';
import { computeProjectedHealthScore, type HealthScoreInput } from '@/utils/healthScore';
import { scale, moderateScale } from '@/utils/responsive';
import type { RankedMaintenanceItem } from '@/hooks/useUrgencyRankedItems';
import type { UrgencyTier } from '@/utils/urgency';
import { extractMaintenanceType } from '@/lib/maintenanceServiceMapping';

// ============================================================================
// TYPES
// ============================================================================

export type MaintenanceStatus = 'on_time' | 'needs_attention' | 'due_soon' | 'overdue' | 'unknown';

/** Which axis fired an item's current status — powers the signal-pill
 *  emphasis and the anchorless-CTA branch. */
export type MaintenanceTriggerAxis = 'time' | 'mileage' | 'both' | 'inference' | 'none';

/** "Flagged by Chelala Service Center, Jul 14" — degrades to whichever half
 *  is present rather than printing a dangling "by" or a bare date. */
function formatMechanicFlag(flag: {
  shopName?: string | null;
  gradedAt?: number | null;
}): string {
  const when = flag.gradedAt
    ? new Date(flag.gradedAt).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : null;
  if (flag.shopName && when) return `Flagged by ${flag.shopName}, ${when}`;
  if (flag.shopName) return `Flagged by ${flag.shopName}`;
  return when ? `Flagged ${when}` : "";
}

export interface MaintenanceItem {
  id: string;
  serviceName: string;
  description: string;
  // e.g. "Mar 2025", "Aug 2025", "Unknown"
  detail: string;
  status: MaintenanceStatus;
  /** 0–100 percent of interval used (mileage- or time-based), preserved
   *  from computeMaintenanceStatus so Action Engine proximity uses the
   *  real v0 ramp instead of inferring from status. Optional because
   *  inferred fallback items (no record) don't have an actual ramp. */
  percentUsed?: number;
  lastService?: string;
  urgency?: string;
  impacts?: Array<{ label: string; severity: 'high' | 'medium' | 'low' }>;
  recommendation?: string;
  /* ── Advisory (off-catalog) recommendation ──────────────────────────────
     Set when the mechanic flagged work the catalog can't name. There is no
     service behind it, so it cannot be booked, cannot be priced, and cannot
     move the health score — see the delta suppression in UrgentCard. */
  advisory?: boolean;
  advisoryDisclaimer?: string | null;
  authorLabel?: string | null;
  advisoryAged?: boolean;
  /** Set when this item comes from a mechanic-submitted job recommendation.
   *  Threaded through the booking flow as bookings.source_recommendation_id
   *  so the rec auto-closes when the booking completes. */
  sourceRecommendationId?: string;
  /** Item is shown to the driver but must never enter the health score.
   *  Set by the catalog-coverage inference pass: those rows are derived from
   *  an OEM interval and an odometer alone, with no service record and no
   *  mechanic behind them. Only the five core tiles score by default; a minor
   *  item earns its weight because a mechanic graded it, never because time
   *  passed. Kept as an explicit flag rather than sniffing the `catalog-` id
   *  prefix, matching how recommendation cards are already excluded. */
  excludeFromScore?: boolean;
  /** Who flagged a CORE or MINOR item and when — drives the "Flagged by
   *  <shop>, <date>" line. Distinct from `mechanicProvenance`, which belongs
   *  to recommendation cards and reads "Suggested by …": a grade is a finding
   *  recorded against the vehicle, not a suggestion to book something.
   *  Written by the inspection into the record's customInputs. */
  mechanicFlag?: {
    shopName?: string | null;
    gradedAt?: number | null;
  };
  /** Mechanic + shop provenance for recs — drives the "Suggested by …" subtitle. */
  mechanicProvenance?: {
    shopName?: string | null;
    mechanicName?: string | null;
  };
  /** Raw urgency literal from the mechanic rec — drives the timing-vs-date
   *  branch in the Take Action detail screen. */
  recUrgency?: "next_visit" | "within_3_months" | "soon";
  /** ms-epoch slot the shop pre-picked; when set the detail screen offers
   *  Confirm Date / Dismiss instead of Book This Service. */
  scheduledAt?: number | null;
  scheduledMechanicName?: string | null;
  /** Canonical service id behind the rec — surfaced for the booking flow
   *  pre-fill from the detail screen. */
  serviceId?: string | null;
  /** Taxonomy slug of the service that fixes this item. Set on minor
   *  eye-check items, whose card is named for the inspection line rather
   *  than the remedy the catalog sells. */
  serviceSlug?: string | null;
  /** Per-axis copy for the signal-pill row. */
  signals?: {
    time?: string;
    mileage?: string;
    interval?: string;
  };
  triggeredBy?: MaintenanceTriggerAxis;
  /** Precomputed 0–1 score, bypassing the STATUS_SCORE lookup, when a status
   *  alone can't capture severity (e.g. brakes' per-corner blend from a shop
   *  inspection). Only set for brakes today; every other item leaves this
   *  undefined and scores via the normal status lookup, unchanged. */
  rawScore?: number;
  /** The four-way interval band (Quick Check v2 §7). `status` stays the
   *  three-value display tier; this separates OVERDUE from SEVERELY OVERDUE
   *  so the latter can lead the NOW tier without a fourth heading. */
  bandStatus?: "on_time" | "due_soon" | "overdue" | "severely_overdue";
  /** Where the interval came from — drives the confidence hold. */
  intervalSource?: "oem" | "class_default" | "legacy_default" | "none";
  /** The factor the score used, after the hold. */
  factorApplied?: number;
}

interface MaintenanceTrackerProps {
  items: MaintenanceItem[];
  vehicleCondition?: number;
  healthScoreInput?: HealthScoreInput;
  /** Active vehicle model label (e.g. "Mustang") — piped into the
   *  Service Detail sheet for plain-English copy. */
  vehicleLabel?: string;
  onBookNow?: (id: string) => void;
  /** Fired when the driver taps "Take Action" on a mechanic-recommended urgent
   *  card. Routes to the recommendation detail screen. When omitted, the card
   *  falls back to the legacy onBookNow behavior. */
  onTakeAction?: (item: MaintenanceItem) => void;
  /** Advisory only — see UrgentCardProps.onMarkDone. */
  onMarkDone?: (item: MaintenanceItem) => void;
  /** Unknown rows only: driver answers "when was this last done?". */
  onAnswerRecency?: (item: MaintenanceItem) => void;
  onAddInfo?: (id: string) => void;
  onEditPressed?: () => void;
  /** Parent has determined the page bg is dark enough that the
   *  "Maintenance Tracker" header must flip to light to stay readable. */
  isDarkBg?: boolean;
  /** Action Engine tier groupings (Yassin v1.1 §3.2). When provided,
   *  the tracker renders Now / Soon / Soon-ish / Resting sections in
   *  place of the legacy Overdue / Needs Attention / Healthy buckets.
   *  Falls back to status-bucketed rendering when undefined so other
   *  callers (e.g. legacy preview paths) keep working. */
  tieredItems?: Record<UrgencyTier, RankedMaintenanceItem[]>;
  /** Deep-link: when this matches an item's id on mount, the detail
   *  modal opens automatically for that item exactly once. Lets
   *  Home's NowTierCallout route a tap straight into the detail view
   *  for the urgent item, instead of just landing on the cars page. */
  openItemId?: string;
  /** True while the vehicle's enrichment pipeline is still running. */
  isEnriching?: boolean;
  /** Taxonomy slugs the vehicle can book RIGHT NOW, from
   *  `useBookableServices`. Enrichment is not all-or-nothing: a diagnostic
   *  scan and a battery test are bookable while it runs, and the scan is
   *  precisely what a driver needs when we know nothing about the car. Gating
   *  every CTA on the vehicle-level flag was stricter than the service
   *  selector and greyed out the one card that could have helped.
   *  Undefined means the query has not resolved — fall back to the flag. */
  bookableSlugs?: Set<string>;
}

/**
 * Is this specific service still un-bookable?
 *
 * `isEnriching` alone is a vehicle-level answer to a per-service question.
 * Once the bookable set has resolved it is authoritative: a slug in it can be
 * booked whatever the pipeline is doing.
 */
function isBookingBlocked(
  isEnriching: boolean,
  bookableSlugs: Set<string> | undefined,
  slug: string | null | undefined,
): boolean {
  if (!isEnriching) return false;
  if (!bookableSlugs || !slug) return true;
  return !bookableSlugs.has(slug);
}

// ============================================================================
// STATUS CONFIG
// ============================================================================

// Status priority for sorting (lower number = higher priority)
const STATUS_PRIORITY: Record<MaintenanceStatus, number> = {
  overdue: 0,
  due_soon: 1,
  needs_attention: 2,
  on_time: 3,
  unknown: 4,
};

// ============================================================================
// CARD COLOR MAPPING
// ============================================================================

const CARD_COLORS: Partial<Record<MaintenanceStatus, { statusColor: string; iconBg: string }>> = {
  overdue: {
    statusColor: '#5299FE',
    iconBg: 'rgba(82, 153, 254, 0.07)',
  },
  needs_attention: {
    statusColor: '#5299FE',
    iconBg: 'rgba(82, 153, 254, 0.07)',
  },
  due_soon: {
    statusColor: '#5299FE',
    iconBg: 'rgba(82, 153, 254, 0.07)',
  },
};

function getServiceIcon(itemId: string, size: number, color: string) {
  const type = itemId.replace(/^(unknown-|user-)/, '');
  switch (type) {
    case 'oil': return <OilIcon size={size} color={color} />;
    case 'brakes': return <BrakesIcon size={size} color={color} />;
    case 'tires': return <TireIcon size={size} color={color} />;
    case 'battery': return <BatteryIcon size={size} color={color} />;
    default: return <WarningIcon size={size} color={color} />;
  }
}

// ============================================================================
// VEHICLE HEALTH RING COMPONENT (Apple Fitness Style)
// ============================================================================

interface VehicleHealthRingProps {
  percentage: number;
  size?: number;
}

function VehicleHealthRing({ percentage, size = 64 }: VehicleHealthRingProps) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  
  // Animation state
  const [animatedProgress, setAnimatedProgress] = useState(0);
  
  // Animate the ring fill on mount
  useEffect(() => {
    setAnimatedProgress(0);
    
    const duration = 1200;
    const steps = 40;
    const stepDuration = duration / steps;
    let currentStep = 0;
    
    const interval = setInterval(() => {
      currentStep++;
      // Ease-out cubic animation
      const progress = 1 - Math.pow(1 - currentStep / steps, 3);
      setAnimatedProgress(progress * percentage);
      
      if (currentStep >= steps) {
        clearInterval(interval);
      }
    }, stepDuration);
    
    return () => clearInterval(interval);
  }, [percentage]);
  
  const strokeDashoffset = circumference * (1 - animatedProgress / 100);
  
  // Determine ring color based on percentage
  const getRingColor = () => {
    if (percentage >= 80) return '#22C55E'; // Green
    if (percentage >= 60) return '#F5C623'; // Yellow
    if (percentage >= 40) return '#F97316'; // Orange
    return '#EF4444'; // Red
  };
  
  const ringColor = getRingColor();
  
  return (
    <View style={ringStyles.container}>
      <Svg width={size} height={size}>
        {/* Background ring (gray track) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke="rgba(255, 255, 255, 0.15)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Foreground ring (colored progress) */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={ringColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      {/* Percentage text in center */}
      <View style={[ringStyles.centerText, { width: size, height: size }]}>
        <Text weight="bold" size="md" style={{ color: ringColor }}>
          {Math.round(animatedProgress)}%
        </Text>
      </View>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// ============================================================================
// GROUP LABELS
// ============================================================================

function OverdueLabel() {
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
    ),
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(1.4, { duration: 1000 }),
            withTiming(1, { duration: 1000 }),
          ),
          -1,
        ),
      },
    ],
  }));

  return (
    <View style={groupLabelStyles.row}>
      <View style={[groupLabelStyles.chip, groupLabelStyles.chipNow]}>
        <Animated.View style={[groupLabelStyles.overdueDot, pulseStyle]} />
        <Text weight="bold" style={groupLabelStyles.chipTextNow}>OVERDUE</Text>
      </View>
    </View>
  );
}

/** Action Engine "Now" tier label — same pulsing-red treatment as
 *  OverdueLabel. v0 path keeps "OVERDUE"; v1 tier path uses "NOW". */
function NowLabel() {
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
    ),
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(1.4, { duration: 1000 }),
            withTiming(1, { duration: 1000 }),
          ),
          -1,
        ),
      },
    ],
  }));
  return (
    <View style={groupLabelStyles.row}>
      <View style={[groupLabelStyles.chip, groupLabelStyles.chipNow]}>
        <Animated.View style={[groupLabelStyles.overdueDot, pulseStyle]} />
        <Text weight="bold" style={groupLabelStyles.chipTextNow}>NOW</Text>
      </View>
    </View>
  );
}

/** Action Engine "Soon" tier label — same pulsing-amber treatment as
 *  NeedsAttentionLabel, relabeled per the v1 spec tier naming. */
function SoonLabel() {
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
    ),
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(1.4, { duration: 1000 }),
            withTiming(1, { duration: 1000 }),
          ),
          -1,
        ),
      },
    ],
  }));
  return (
    <View style={groupLabelStyles.row}>
      <View style={[groupLabelStyles.chip, groupLabelStyles.chipSoon]}>
        <Animated.View style={[groupLabelStyles.needsAttentionDot, pulseStyle]} />
        <Text weight="bold" style={groupLabelStyles.chipTextSoon}>SOON</Text>
      </View>
    </View>
  );
}

/** RECOMMENDED tier label. Static blue dot, no pulse: this is a suggestion
 *  we are making, not a finding pressing on the driver. */
function RecommendedLabel() {
  return (
    <View style={groupLabelStyles.row}>
      <View style={[groupLabelStyles.chip, groupLabelStyles.chipRecommended]}>
        <View style={groupLabelStyles.recommendedDot} />
        <Text weight="bold" style={groupLabelStyles.chipTextRecommended}>RECOMMENDED</Text>
      </View>
    </View>
  );
}

/** The one card in the RECOMMENDED tier: book a diagnostic scan to close the
 *  UNKNOWN list. Deliberately built on UrgentCard's shell — same icon well,
 *  same title/subtitle column, same CTA row — because it asks for the same
 *  kind of action and should not read as a lesser control. It carries no
 *  score delta: a scan turns unknowns into knowns, and which way the score
 *  then moves is exactly what we do not know yet. */
function DiagnosticScanCard({
  unknownCount,
  entryDelay,
  onBookNow,
  isEnriching = false,
  bookableSlugs,
}: {
  unknownCount: number;
  entryDelay: number;
  onBookNow?: (id: string) => void;
  isEnriching?: boolean;
  bookableSlugs?: Set<string>;
}) {
  // A scan is bookable during enrichment — it needs no parts data, and it is
  // the whole point of this card. Greying it out while the car is unknown was
  // exactly backwards.
  const scanBlocked = isBookingBlocked(isEnriching, bookableSlugs, SLUG_DIAGNOSTIC_SCAN);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  useEffect(() => {
    opacity.value = withDelay(
      entryDelay,
      withTiming(1, { duration: 550, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
    translateY.value = withDelay(
      entryDelay,
      withTiming(0, { duration: 550, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const entryStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const handlePress = () => {
    if (scanBlocked) return;
    // extractMaintenanceType → "warning" → MAINTENANCE_TYPE_TO_SLUG →
    // diagnostic_scan, so this reuses the normal booking handoff with no
    // special case at the call site.
    onBookNow?.('warning-unknown-scan');
  };

  return (
    <Animated.View style={[cardStyles.container, entryStyle]}>
      <View style={cardStyles.topRow}>
        <View style={[cardStyles.iconContainer, { backgroundColor: 'rgba(82,153,254,0.07)' }]}>
          <Ionicons name="search-outline" size={24} color="#5299FE" />
        </View>
        <View style={cardStyles.textColumn}>
          <Text weight="bold" style={cardStyles.title}>Diagnostic scan</Text>
          <Text style={cardStyles.subtitle}>
            {unknownCount === 1
              ? 'One service has no record on file. A scan confirms what it actually needs.'
              : `${unknownCount} services have no record on file. A scan confirms what they actually need.`}
          </Text>
        </View>
      </View>
      <View style={cardStyles.buttonRow}>
        <Pressable
          style={({ pressed }) => [
            cardStyles.bookServiceBtn,
            scanBlocked && cardStyles.bookServiceBtnDisabled,
            pressed && !scanBlocked && { opacity: 0.85 },
          ]}
          onPress={handlePress}
          disabled={scanBlocked}
        >
          <Text
            weight="semiBold"
            style={[cardStyles.bookServiceText, scanBlocked && cardStyles.bookServiceTextDisabled]}
          >
            {scanBlocked ? 'Setting up…' : 'Book Service'}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

/** "Show N more" / "Show less" pressable rendered at the bottom of
 *  NOW / SOON tiers when the ranked list exceeds CAP_PER_URGENT_TIER.
 *  Text-only, right-aligned, tier-colored. */
function ShowMoreButton({
  hidden,
  expanded,
  color,
  onPress,
}: {
  hidden: number;
  expanded: boolean;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={showMoreStyles.wrap} hitSlop={12}>
      <Text weight="semiBold" style={[showMoreStyles.text, { color }]}>
        {expanded ? "Show less" : `Show ${hidden} more`}
      </Text>
    </Pressable>
  );
}

function NeedsAttentionLabel() {
  const pulseStyle = useAnimatedStyle(() => ({
    opacity: withRepeat(
      withSequence(
        withTiming(0.5, { duration: 1000 }),
        withTiming(1, { duration: 1000 }),
      ),
      -1,
    ),
    transform: [
      {
        scale: withRepeat(
          withSequence(
            withTiming(1.4, { duration: 1000 }),
            withTiming(1, { duration: 1000 }),
          ),
          -1,
        ),
      },
    ],
  }));

  return (
    <View style={groupLabelStyles.row}>
      <Animated.View style={[groupLabelStyles.needsAttentionDot, pulseStyle]} />
      <Text weight="bold" style={groupLabelStyles.needsAttentionText}>NEEDS ATTENTION</Text>
    </View>
  );
}

// ============================================================================
// URGENT CARD COMPONENT
// ============================================================================

interface UrgentCardProps {
  item: MaintenanceItem;
  entryDelay: number;
  vehicleCondition: number;
  healthScoreInput?: HealthScoreInput;
  onBookNow?: (id: string) => void;
  onTakeAction?: (item: MaintenanceItem) => void;
  /** Advisory only: the driver had this done outside Otopair. Closes the
   *  recommendation and offers to attach the receipt. */
  onMarkDone?: (item: MaintenanceItem) => void;
  onAddInfo?: (id: string) => void;
  onCardPress?: (item: MaintenanceItem) => void;
  /** When true, the "Book Service" CTA is disabled — the vehicle is still
   *  enriching so we don't yet know the parts to book. */
  isEnriching?: boolean;
  bookableSlugs?: Set<string>;
}

function UrgentCard({ item, entryDelay, vehicleCondition, healthScoreInput, onBookNow, onTakeAction, onMarkDone, onCardPress, isEnriching = false, bookableSlugs }: UrgentCardProps) {
  // Mechanic-recommended items get the new single "Take Action" CTA that
  // routes to the detail screen. Algorithmic items keep the legacy two-button
  // layout (Book Service + View Details).
  const isMechanicRec = !!item.sourceRecommendationId;
  // Off-catalog advice. Nothing behind it to price or book, so the CTA, the
  // score delta and the headline all change.
  const isAdvisory = item.advisory === true;
  // Anchorless items (proposal Behavior #6): no stored interval + no
  // user record → the row's primary action becomes "Book diagnostic
  // scan" so the CTA lives INSIDE the tier rather than replacing it.
  const isAnchorless = item.triggeredBy === "none";
  const primaryLabel = isAdvisory
    // Advisory = the mechanic recommended work Otopair does not sell. We
    // deliberately do not try to book it: the driver is expected to get it
    // done elsewhere and tell us afterwards, at which point we ask for the
    // receipt. Product call, Ahmad + colleague, 2026-08-30.
    ? "Mark as Done"
    : isAnchorless
      ? "Book diagnostic scan"
      : "Book Service";
  // Only the algorithmic Book Service CTA is coverage-gated — mechanic "Take
  // Action" routes to its own rec flow with the parts the shop already picked.
  // Per service, not per vehicle: an item whose slug is bookable now stays
  // bookable even mid-enrichment.
  const bookDisabled =
    !isMechanicRec &&
    !isAdvisory &&
    isBookingBlocked(isEnriching, bookableSlugs, item.serviceSlug);
  const handlePrimary = () => {
    if (bookDisabled) return;
    // An advisory is closed out, not booked. Everything else books —
    // including a mechanic's recommendation, which used to route to the
    // detail screen under a "Take Action" label and left the driver to find
    // a second button there. Ahmad, 2026-08-30: a rec should behave like
    // every other card.
    if (isAdvisory) onMarkDone?.(item);
    else onBookNow?.(item.id);
  };
  const colors = CARD_COLORS[item.status] ?? { statusColor: '#5299FE', iconBg: 'rgba(82,153,254,0.07)' };

  // ─── CUSTOM JOB INVARIANT — APP-SIDE ───────────────────────────────────
  // Off-catalog work can never move the health score, so an advisory must not
  // advertise a gain for doing it. The projection function would happily
  // return a number here; printing it would be a promise the backend is
  // deliberately built never to keep.
  const delta = healthScoreInput && !isAdvisory
    ? Math.round(computeProjectedHealthScore(healthScoreInput, item.id) - vehicleCondition)
    : 0;

  const cardScale = useSharedValue(1);

  const entryOpacity = useSharedValue(0);
  const entryTranslateY = useSharedValue(18);
  useEffect(() => {
    entryOpacity.value = withDelay(
      entryDelay,
      withTiming(1, { duration: 550, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
    entryTranslateY.value = withDelay(
      entryDelay,
      withTiming(0, { duration: 550, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
  }, []);
  const entryStyle = useAnimatedStyle(() => ({
    opacity: entryOpacity.value,
    transform: [{ translateY: entryTranslateY.value }, { scale: cardScale.value }],
  }));

  return (
    <Pressable
      onPressIn={() => { cardScale.value = withSpring(0.98, { damping: 20, stiffness: 300 }); }}
      onPressOut={() => { cardScale.value = withSpring(1, { damping: 20, stiffness: 300 }); }}
      onPress={() => {
        if (isMechanicRec && onTakeAction) onTakeAction(item);
        else if (onCardPress) onCardPress(item);
        else if (!bookDisabled) onBookNow?.(item.id);
      }}
    >
      <Animated.View style={[cardStyles.container, entryStyle]}>
        <View style={cardStyles.topRow}>
          <View style={[cardStyles.iconContainer, { backgroundColor: colors.iconBg }]}>
            {getServiceIcon(item.id, 24, colors.statusColor)}
          </View>
          <View style={cardStyles.textColumn}>
            {/* On an advisory the attribution comes FIRST. The reader needs to
                know this is one mechanic's opinion before they read what the
                opinion is — otherwise it reads as an Otopair position. */}
            {isAdvisory && item.authorLabel ? (
              <Text style={cardStyles.advisoryAuthor}>{item.authorLabel}</Text>
            ) : null}
            <Text weight="bold" style={cardStyles.title}>{item.serviceName}</Text>
            <Text style={cardStyles.subtitle}>{item.description}</Text>
            {!isAdvisory && item.mechanicProvenance && (item.mechanicProvenance.mechanicName || item.mechanicProvenance.shopName) && (
              <Text style={cardStyles.provenance}>
                Suggested by {item.mechanicProvenance.mechanicName ?? 'your mechanic'}
                {item.mechanicProvenance.shopName ? ` at ${item.mechanicProvenance.shopName}` : ''}
              </Text>
            )}
            {/* Provenance for a graded finding. A driver watching points come
                off deserves to know which shop said so and when — the plan's
                principle that every flag carries a source and a date. Only on
                items that are actually flagged: an on-time item may still
                carry an old green-era grade, and "Flagged by" would misread. */}
            {!isAdvisory && item.mechanicFlag && item.status !== 'on_time' && (
              <Text style={cardStyles.provenance}>
                {formatMechanicFlag(item.mechanicFlag)}
              </Text>
            )}
            {isAdvisory && item.advisoryDisclaimer ? (
              <Text style={cardStyles.advisoryNote}>{item.advisoryDisclaimer}</Text>
            ) : null}
          </View>
          {delta > 0 && (
            <View style={cardStyles.scoreColumn}>
              <View style={cardStyles.scoreRow}>
                <Text style={cardStyles.scoreNumber}>+{delta}</Text>
                <Text style={cardStyles.scorePercent}>%</Text>
              </View>
            </View>
          )}
        </View>
        <View style={cardStyles.buttonRow}>
          <Pressable
            style={({ pressed }) => [
              cardStyles.bookServiceBtn,
              bookDisabled && cardStyles.bookServiceBtnDisabled,
              pressed && !bookDisabled && { opacity: 0.85 },
            ]}
            onPress={handlePrimary}
            disabled={bookDisabled}
          >
            <Text
              weight="semiBold"
              style={[cardStyles.bookServiceText, bookDisabled && cardStyles.bookServiceTextDisabled]}
            >
              {bookDisabled ? 'Setting up…' : primaryLabel}
            </Text>
          </Pressable>
          {!isAdvisory && (
            <Pressable
              style={({ pressed }) => [cardStyles.viewDetailsBtn, pressed && { opacity: 0.85 }]}
              // A mechanic rec has a richer detail screen than the generic
              // sheet — who suggested it, why, impact, and the Dismiss
              // affordance — so it keeps that as its details view.
              onPress={() => {
                if (isMechanicRec && onTakeAction) onTakeAction(item);
                else onCardPress?.(item);
              }}
            >
              <Text weight="semiBold" style={cardStyles.viewDetailsText}>View Details</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

// ============================================================================
// HEALTHY ITEMS SECTION (expandable)
// ============================================================================

// Cascade rhythm shared between the section header and the per-row
// slide-up. 80ms matches MaintenanceTracker's STEP_MS so the lift flows
// continuously from the last urgent card into the first healthy row.
const HEALTHY_ITEM_STEP_MS = 80;
const HEALTHY_ROW_ENTRY_DURATION = 550;

// Each healthy row slides up with the SAME kinematics as UrgentCard
// (opacity 0→1 + translateY 18→0, 550ms ease-out). UrgentCard works
// because the eye tracks its baked-in content rising — we replicate that
// here by animating the row content, not an empty container.
function HealthyItemRow({
  item,
  showSeparator,
  entryDelay,
  onAnswerRecency,
}: {
  item: MaintenanceItem;
  showSeparator: boolean;
  entryDelay: number;
  onAnswerRecency?: (item: MaintenanceItem) => void;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(18);
  useEffect(() => {
    opacity.value = withDelay(
      entryDelay,
      withTiming(1, { duration: HEALTHY_ROW_ENTRY_DURATION, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
    translateY.value = withDelay(
      entryDelay,
      withTiming(0, { duration: HEALTHY_ROW_ENTRY_DURATION, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const rowStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={rowStyle}>
      <View style={summaryStyles.itemRow}>
        <View style={summaryStyles.itemIcon}>
          {getServiceIcon(item.id, 20, '#5299FE')}
        </View>
        <View style={summaryStyles.itemContent}>
          <Text weight="semiBold" style={summaryStyles.itemName}>{item.serviceName}</Text>
          <Text style={summaryStyles.itemDesc}>{item.description}</Text>
          {/* Same provenance line UrgentCard carries. A graded item can land in
              any tier — a yellow eye-check grade shows up under "on the
              horizon", not "now" — and the driver deserves the source wherever
              it appears, not only when it is urgent. */}
          {item.mechanicFlag && item.status !== 'on_time' && (
            <Text style={summaryStyles.itemProvenance}>
              {formatMechanicFlag(item.mechanicFlag)}
            </Text>
          )}
        </View>
        {/* An unknown row is a question we can just ask. The driver often
            knows when this was last done, and answering is faster than
            booking a scan — so the row offers it rather than only showing a
            neutral outline. Optional: nothing here is required.
            Every unknown row gets one, core tiles included. This used to be
            gated on `serviceSlug` — catalog rows only — because the sheet
            behind it asked recency and nothing else, and writing a bare
            recency over a brake record (which also wants brake feel) would
            have been a worse answer than none. That sheet is gone: the tracker
            now opens the same QuickCheckSheet the stepper does, with the
            per-type spec when the row is a core tile. The objection went with
            it, and "no answer on file" with no way to give one was always the
            odder half of the pair. */}
        {item.status === 'unknown' && onAnswerRecency ? (
          <Pressable
            onPress={() => onAnswerRecency(item)}
            hitSlop={10}
            style={({ pressed }) => [summaryStyles.answerBtn, pressed && { opacity: 0.7 }]}
          >
            <Text weight="semiBold" style={summaryStyles.answerBtnText}>Add info</Text>
          </Pressable>
        ) : item.status === 'unknown' ? (
          <Ionicons name="ellipse-outline" size={18} color="#C7C7CC" />
        ) : (
          <Ionicons name="checkmark-circle" size={18} color="#5299FE" />
        )}
      </View>
      {showSeparator && <View style={summaryStyles.separator} />}
    </Animated.View>
  );
}

// Container card itself doesn't translate — only fades in softly so the
// white shell materializes around the rising rows. The visible motion
// the user wants comes from the rows, exactly like UrgentCard's content
// rising inside its shell.
function HealthyItemsCard({
  items,
  cascadeStartDelay,
  onAnswerRecency,
}: {
  items: MaintenanceItem[];
  cascadeStartDelay: number;
  onAnswerRecency?: (item: MaintenanceItem) => void;
}) {
  const shellOpacity = useSharedValue(0);
  useEffect(() => {
    shellOpacity.value = withDelay(
      cascadeStartDelay,
      withTiming(1, { duration: HEALTHY_ROW_ENTRY_DURATION, easing: REasing.bezier(0.16, 1, 0.3, 1) }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shellStyle = useAnimatedStyle(() => ({
    opacity: shellOpacity.value,
  }));

  return (
    <Animated.View style={[summaryStyles.card, shellStyle]}>
      {items.map((item, index) => (
        <HealthyItemRow
          key={item.id}
          item={item}
          showSeparator={index < items.length - 1}
          entryDelay={cascadeStartDelay + (index + 1) * HEALTHY_ITEM_STEP_MS}
          onAnswerRecency={onAnswerRecency}
        />
      ))}
    </Animated.View>
  );
}

function HealthySection({
  items,
  variant,
  cascadeStartDelay = 0,
  onAnswerRecency,
}: {
  items: MaintenanceItem[];
  /** 'healthy' = observed fine (green). 'unknown' = no record on file
   *  (grey). Separate sections on purpose — see healthySectionChip. */
  variant: QuietSectionVariant;
  cascadeStartDelay?: number;
  onAnswerRecency?: (item: MaintenanceItem) => void;
}) {
  // Expanded by default — Ahmad prefers these visible on first paint.
  // Chevron still lets users collapse if they want.
  const [expanded, setExpanded] = useState(true);
  const chevronRotation = useSharedValue(1);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value * 90}deg` }],
  }));

  // Every hook runs before this bails. The early return used to sit above
  // useAnimatedStyle, which was fine while there was one HealthySection whose
  // emptiness never changed — but the split into HEALTHY and UNKNOWN gives us
  // two, and either can flip between empty and non-empty as items load. React
  // then sees a different number of hooks between renders and throws
  // "Rendered more hooks than during the previous render", taking the whole
  // Cars tab down. This was the standing react-hooks/rules-of-hooks lint
  // error in this file; it was latent, not harmless.
  if (items.length === 0) return null;

  const isUnknown = variant === 'unknown';

  const toggle = () => {
    setExpanded(prev => !prev);
    chevronRotation.value = withTiming(expanded ? 0 : 1, { duration: 200 });
  };

  return (
    <View>
      <Animated.View entering={FadeInUp.duration(450).delay(cascadeStartDelay)}>
        <Pressable onPress={toggle} style={({ pressed }) => pressed && { opacity: 0.7 }}>
          {/* Header treatment matches the NOW / SOON labels above: tiny dot +
              bold uppercase text + count. Green for observed-healthy, grey
              for unknown — green is the app's "we checked and it's fine"
              colour and an absence of data has not earned it. */}
          <View style={summaryStyles.headerRow}>
            <View style={[summaryStyles.chip, isUnknown && summaryStyles.chipNeutral]}>
              <View style={[summaryStyles.dot, isUnknown && summaryStyles.dotNeutral]} />
              <Text
                weight="bold"
                style={[summaryStyles.chipText, isUnknown && summaryStyles.chipTextNeutral]}
              >
                {healthySectionChip(variant, items.length)}
              </Text>
            </View>
            <View style={{ flex: 1 }} />
            <Animated.View style={chevronStyle}>
              <Ionicons name="chevron-forward" size={16} color="#C7C7CC" />
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>

      {expanded && (
        <HealthyItemsCard
          items={items}
          cascadeStartDelay={cascadeStartDelay}
          onAnswerRecency={onAnswerRecency}
        />
      )}
    </View>
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

// Cap visible items in NOW / SOON to keep the initial paint focused
// on the top-of-mind repairs. Extra items reveal via "Show N more".
// Resets naturally on car swap (tracker keyed by VIN in cars/index.tsx).
const CAP_PER_URGENT_TIER = 3;

export function MaintenanceTracker({ items, vehicleCondition, healthScoreInput, vehicleLabel, onBookNow, onTakeAction, onMarkDone, onAnswerRecency, onAddInfo, onEditPressed, isDarkBg = false, tieredItems, openItemId, isEnriching = false, bookableSlugs }: MaintenanceTrackerProps) {
  const [selectedItem, setSelectedItem] = useState<MaintenanceItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [showAllNow, setShowAllNow] = useState(false);
  const [showAllSoon, setShowAllSoon] = useState(false);

  const handleCardPress = (item: MaintenanceItem) => {
    setSelectedItem(item);
    setModalVisible(true);
  };

  // Deep-link from Home's NowTierCallout. Fires once per mount when
  // `openItemId` resolves to a known item — opens the detail modal
  // immediately so the user lands on the urgent item's full view
  // instead of just the cars page.
  //
  // Home's nowItems use ids like `<type>-<ownershipId>` (e.g.
  // `oil-abc123`), while this tracker's items use `user-<type>` /
  // `unknown-<type>`. Both forms reduce to the same bare type via
  // extractMaintenanceType, so we match on the normalized type.
  const openItemFiredRef = useRef(false);
  useEffect(() => {
    if (!openItemId || openItemFiredRef.current) return;
    const wanted = extractMaintenanceType(openItemId);
    const match = items.find((i) => extractMaintenanceType(i.id) === wanted);
    if (match) {
      openItemFiredRef.current = true;
      setSelectedItem(match);
      setModalVisible(true);
    }
  }, [openItemId, items]);

  const handleModalClosed = () => {
    setModalVisible(false);
    setSelectedItem(null);
  };

  const overdueItems = items
    .filter(i => i.status === 'overdue')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

  const urgentItems = items
    .filter(i => i.status === 'due_soon' || i.status === 'needs_attention')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);

  const healthyItems = items
    .filter(i => i.status === 'on_time' || i.status === 'unknown')
    .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status]);
  const { healthy: legacyHealthy, unknown: legacyUnknown } = splitQuietItems(healthyItems);

  // Cascade-in: each visible section gets its own delay slot so the tracker
  // animates in top-to-bottom on mount. Missing sections (no overdue / no
  // urgent) collapse out of the cascade so there's no dead beat.
  const STEP_MS = 80;
  const ENTRY_DURATION = 450;
  let cascadeStep = 0;
  const titleDelay = cascadeStep++ * STEP_MS;
  const hasOverdue = overdueItems.length > 0;
  const overdueLabelDelay = hasOverdue ? cascadeStep++ * STEP_MS : 0;
  const overdueBaseDelay = hasOverdue ? cascadeStep * STEP_MS : 0;
  if (hasOverdue) cascadeStep += overdueItems.length;
  const hasUrgent = urgentItems.length > 0;
  const urgentLabelDelay = hasUrgent ? cascadeStep++ * STEP_MS : 0;
  const urgentBaseDelay = hasUrgent ? cascadeStep * STEP_MS : 0;
  if (hasUrgent) cascadeStep += urgentItems.length;
  const healthyDelay = healthyItems.length > 0 ? cascadeStep * STEP_MS : 0;

  // Tier-path cascade (Yassin v1.1 §3.2). Mirrors the legacy cascade above
  // but slotted for Now / Soon / Resting in render order. Only consumed
  // when `tieredItems` is provided.
  const nowCount = tieredItems?.now.length ?? 0;
  const soonCount = tieredItems?.soon.length ?? 0;
  let tierStep = 1; // title consumed slot 0
  const nowLabelDelay = nowCount > 0 ? tierStep++ * STEP_MS : 0;
  const nowBaseDelay = nowCount > 0 ? tierStep * STEP_MS : 0;
  tierStep += nowCount;
  const soonLabelDelay = soonCount > 0 ? tierStep++ * STEP_MS : 0;
  const soonBaseDelay = soonCount > 0 ? tierStep * STEP_MS : 0;
  tierStep += soonCount;
  // RECOMMENDED sits between SOON and the quiet sections, so it takes its
  // cascade slots there; HEALTHY and UNKNOWN each get their own.
  const { healthy: restingHealthy, unknown: restingUnknown } = splitQuietItems(
    (tieredItems?.resting ?? []).map((r) => r.item),
  );
  const hasRecommended = restingUnknown.length > 0;
  const recommendedLabelDelay = hasRecommended ? tierStep++ * STEP_MS : 0;
  const recommendedCardDelay = hasRecommended ? tierStep++ * STEP_MS : 0;
  const healthyRestDelay = restingHealthy.length > 0 ? tierStep++ * STEP_MS : 0;
  const unknownRestDelay = restingUnknown.length > 0 ? tierStep++ * STEP_MS : 0;


  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Animated.View
        style={styles.headerRow}
        entering={FadeInUp.duration(ENTRY_DURATION).delay(titleDelay)}
      >
        <Text weight="bold" color={isDarkBg ? "#FFFFFF" : "#0F172A"} style={{ fontSize: moderateScale(22) }}>
          Maintenance Tracker
        </Text>
        {onEditPressed && (
          isLiquidGlassEnabled && LiquidGlassView ? (
            // Native iOS 26 liquid glass — Pressable carries no chrome
            // so the glass effect renders pure. Matches the Oto pill on
            // the AI chat header.
            <Pressable onPress={onEditPressed} style={({ pressed }) => pressed && { opacity: 0.7 }}>
              <LiquidGlassView interactive effect="regular" style={styles.editHeaderButtonGlass}>
                <Text weight="bold" style={styles.editHeaderButtonText}>Update Info</Text>
              </LiquidGlassView>
            </Pressable>
          ) : (
            <Pressable
              onPress={onEditPressed}
              style={({ pressed }) => [
                styles.editHeaderButton,
                pressed && { opacity: 0.75 },
              ]}
            >
              <Text weight="bold" style={styles.editHeaderButtonText}>
                Update Info
              </Text>
            </Pressable>
          )
        )}
      </Animated.View>

      {/* Empty state */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text weight="medium" size="md" color="#829BAD">
            No maintenance items yet.
          </Text>
          <Text size="sm" color="#829BAD" style={{ opacity: 0.7 }}>
            We&apos;ll show your services here once you add them.
          </Text>
        </View>
      ) : tieredItems ? (
        // Action Engine tier path (Yassin v1.1 §3.2). Sections render in
        // urgency order: Now → Soon → Soon-ish → Resting. Each section's
        // cascade delay is precomputed above so missing tiers collapse
        // out of the rhythm — no dead beats.
        <>
          {/* Now — assertive */}
          {nowCount > 0 && (
            <>
              <Animated.View entering={FadeInUp.duration(ENTRY_DURATION).delay(nowLabelDelay)}>
                <NowLabel />
              </Animated.View>
              <View style={styles.urgentGroup}>
                {(showAllNow ? tieredItems.now : tieredItems.now.slice(0, CAP_PER_URGENT_TIER)).map((r, index) => (
                  <UrgentCard
                    key={r.item.id}
                    item={r.item}
                    entryDelay={nowBaseDelay + index * STEP_MS}
                    vehicleCondition={vehicleCondition ?? 0}
                    healthScoreInput={healthScoreInput}
                    onBookNow={onBookNow}
                    onTakeAction={onTakeAction}
                    onMarkDone={onMarkDone}
                    onAddInfo={onAddInfo}
                    onCardPress={handleCardPress}
                    isEnriching={isEnriching}
                    bookableSlugs={bookableSlugs}
                  />
                ))}
                {nowCount > CAP_PER_URGENT_TIER && (
                  <ShowMoreButton
                    hidden={nowCount - CAP_PER_URGENT_TIER}
                    expanded={showAllNow}
                    color="#C0392B"
                    onPress={() => setShowAllNow((v) => !v)}
                  />
                )}
              </View>
            </>
          )}

          {/* Soon — calmer nudge, same assertive card structure */}
          {soonCount > 0 && (
            <>
              <Animated.View entering={FadeInUp.duration(ENTRY_DURATION).delay(soonLabelDelay)}>
                <SoonLabel />
              </Animated.View>
              <View style={styles.urgentGroup}>
                {(showAllSoon ? tieredItems.soon : tieredItems.soon.slice(0, CAP_PER_URGENT_TIER)).map((r, index) => (
                  <UrgentCard
                    key={r.item.id}
                    item={r.item}
                    entryDelay={soonBaseDelay + index * STEP_MS}
                    vehicleCondition={vehicleCondition ?? 0}
                    healthScoreInput={healthScoreInput}
                    onBookNow={onBookNow}
                    onTakeAction={onTakeAction}
                    onMarkDone={onMarkDone}
                    onAddInfo={onAddInfo}
                    onCardPress={handleCardPress}
                    isEnriching={isEnriching}
                    bookableSlugs={bookableSlugs}
                  />
                ))}
                {soonCount > CAP_PER_URGENT_TIER && (
                  <ShowMoreButton
                    hidden={soonCount - CAP_PER_URGENT_TIER}
                    expanded={showAllSoon}
                    color="#B45309"
                    onPress={() => setShowAllSoon((v) => !v)}
                  />
                )}
              </View>
            </>
          )}

          {/* RECOMMENDED — the scan that closes the UNKNOWN list. A full card
              with the same weight as NOW / SOON because it asks for the same
              kind of action; it sits above the quiet sections so the one
              actionable thing here is not buried under them. */}
          {restingUnknown.length > 0 && onBookNow && (
            <>
              <Animated.View entering={FadeInUp.duration(450).delay(recommendedLabelDelay)}>
                <RecommendedLabel />
              </Animated.View>
              {/* Same wrapper the NOW / SOON tiers use — it carries the
                  20pt horizontal inset, without which this card runs 40pt
                  wider than every other card in the tracker. */}
              <View style={styles.urgentGroup}>
                <DiagnosticScanCard
                  unknownCount={restingUnknown.length}
                  entryDelay={recommendedCardDelay}
                  onBookNow={onBookNow}
                  isEnriching={isEnriching}
                  bookableSlugs={bookableSlugs}
                />
              </View>
            </>
          )}

          {/* Two quiet sections, never merged: "healthy" is a claim we can
              back, "unknown" is the absence of one. */}
          <HealthySection
            items={restingHealthy}
            variant="healthy"
            cascadeStartDelay={healthyRestDelay}
          />
          <HealthySection
            items={restingUnknown}
            variant="unknown"
            cascadeStartDelay={unknownRestDelay}
            onAnswerRecency={onAnswerRecency}
          />
        </>
      ) : (
        <>
          {/* Overdue items */}
          {overdueItems.length > 0 && (
            <>
              <Animated.View entering={FadeInUp.duration(ENTRY_DURATION).delay(overdueLabelDelay)}>
                <OverdueLabel />
              </Animated.View>
              <View style={styles.urgentGroup}>
                {overdueItems.map((item, index) => (
                  <UrgentCard
                    key={item.id}
                    item={item}
                    entryDelay={overdueBaseDelay + index * STEP_MS}
                    vehicleCondition={vehicleCondition ?? 0}
                    healthScoreInput={healthScoreInput}
                    onBookNow={onBookNow}
                    onTakeAction={onTakeAction}
                    onMarkDone={onMarkDone}
                    onAddInfo={onAddInfo}
                    onCardPress={handleCardPress}
                    isEnriching={isEnriching}
                    bookableSlugs={bookableSlugs}
                  />
                ))}
              </View>
            </>
          )}

          {/* Needs attention / due soon items */}
          {urgentItems.length > 0 && (
            <>
              <Animated.View entering={FadeInUp.duration(ENTRY_DURATION).delay(urgentLabelDelay)}>
                <NeedsAttentionLabel />
              </Animated.View>
              <View style={styles.urgentGroup}>
                {urgentItems.map((item, index) => (
                  <UrgentCard
                    key={item.id}
                    item={item}
                    entryDelay={urgentBaseDelay + index * STEP_MS}
                    vehicleCondition={vehicleCondition ?? 0}
                    healthScoreInput={healthScoreInput}
                    onBookNow={onBookNow}
                    onTakeAction={onTakeAction}
                    onMarkDone={onMarkDone}
                    onAddInfo={onAddInfo}
                    onCardPress={handleCardPress}
                    isEnriching={isEnriching}
                    bookableSlugs={bookableSlugs}
                  />
                ))}
              </View>
            </>
          )}

          {/* Healthy items (expandable). Always expanded by default; user
              can collapse with the chevron. The section handles its own
              per-item cascade animation internally. */}
          {legacyUnknown.length > 0 && onBookNow && (
            <>
              <Animated.View entering={FadeInUp.duration(ENTRY_DURATION).delay(healthyDelay)}>
                <RecommendedLabel />
              </Animated.View>
              <View style={styles.urgentGroup}>
                <DiagnosticScanCard
                  unknownCount={legacyUnknown.length}
                  entryDelay={healthyDelay + STEP_MS}
                  onBookNow={onBookNow}
                  isEnriching={isEnriching}
                  bookableSlugs={bookableSlugs}
                />
              </View>
            </>
          )}
          <HealthySection
            items={legacyHealthy}
            variant="healthy"
            cascadeStartDelay={healthyDelay + STEP_MS * 2}
          />
          <HealthySection
            items={legacyUnknown}
            variant="unknown"
            cascadeStartDelay={healthyDelay + STEP_MS * 3}
            onAnswerRecency={onAnswerRecency}
          />
        </>
      )}

      {/* Detail modal for urgent cards */}
      {selectedItem && (
        <MaintenanceDetailView
          item={selectedItem}
          visible={modalVisible}
          currentHealthScore={vehicleCondition ?? 0}
          projectedHealthScore={
            healthScoreInput
              ? computeProjectedHealthScore(healthScoreInput, selectedItem.id)
              : (vehicleCondition ?? 0) + 8
          }
          vehicleLabel={vehicleLabel}
          onClose={handleModalClosed}
          bookingDisabled={isEnriching && !selectedItem.sourceRecommendationId}
          onBookService={() => {
            if (isEnriching && !selectedItem.sourceRecommendationId) return;
            handleModalClosed();
            onBookNow?.(selectedItem.id);
          }}
        />
      )}
    </View>
  );
}


// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: scale(24),
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
    paddingHorizontal: scale(20),
  },
  emptyState: {
    paddingVertical: scale(24),
    paddingHorizontal: scale(16),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    gap: scale(4),
    backgroundColor: 'rgba(255,255,255,0.65)',
    shadowColor: 'rgba(0, 0, 0, 0.1)',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 4,
    overflow: 'hidden',
  },
  urgentGroup: {
    paddingHorizontal: scale(20),
    gap: scale(12),
  },
  editHeaderButton: {
    // Solid white pill per PM spec so it reads on any background
    // tint. Neutral 1pt border + soft shadow, matching the vehicle
    // switcher / "740" pill treatment on the same screen.
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(5),
    justifyContent: 'center',
    minHeight: scale(34),
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
    paddingVertical: scale(6),
    paddingHorizontal: scale(13),
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  // Liquid-glass variant: no background, no border, no shadow — just
  // the radius + padding for the LiquidGlassView to wrap around. iOS 26
  // does the entire chrome natively.
  editHeaderButtonGlass: {
    borderRadius: moderateScale(15),
    paddingVertical: scale(7),
    paddingHorizontal: scale(14),
  },
  editButtonGloss: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '100%',
    borderRadius: moderateScale(14),
  },
  editHeaderButtonText: {
    color: '#5299FE',
    fontSize: moderateScale(12),
    lineHeight: moderateScale(16),
    zIndex: 1,
  },
});

// ============================================================================
// CARD STYLES
// ============================================================================

const cardStyles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(24),
    padding: scale(20),
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(14),
  },
  iconContainer: {
    width: scale(46),
    height: scale(46),
    borderRadius: moderateScale(16),
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
  },
  title: {
    fontSize: moderateScale(16),
    color: '#2d3435',
  },
  subtitle: {
    fontSize: moderateScale(12),
    color: '#757c7d',
    marginTop: 1,
  },
  provenance: {
    fontSize: moderateScale(11),
    color: '#5299FE',
    marginTop: 2,
  },
  // Attribution above an advisory's title — same blue as `provenance` so the
  // two read as one family, but sized and spaced as an eyebrow since here it
  // leads rather than trails.
  advisoryAuthor: {
    fontSize: moderateScale(10.5),
    color: '#5299FE',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  // The fixed disclaimer. Deliberately quiet — it qualifies the card, it
  // isn't the message.
  advisoryNote: {
    fontSize: moderateScale(10.5),
    lineHeight: moderateScale(14),
    color: '#8A94A6',
    marginTop: 4,
  },
  scoreColumn: {
    alignItems: 'flex-end',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    fontSize: moderateScale(20),
    fontWeight: '300',
    color: '#34C759',
  },
  scorePercent: {
    fontSize: moderateScale(13),
    fontWeight: '300',
    color: '#34C759',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: scale(8),
    marginTop: scale(16),
  },
  bookServiceBtn: {
    flex: 1,
    backgroundColor: '#5299FE',
    paddingVertical: scale(12),
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookServiceBtnDisabled: {
    backgroundColor: '#E4E9EA',
  },
  bookServiceText: {
    fontSize: moderateScale(14),
    color: '#FFFFFF',
  },
  bookServiceTextDisabled: {
    color: '#9CA3AF',
  },
  viewDetailsBtn: {
    paddingVertical: scale(12),
    paddingHorizontal: scale(22),
    backgroundColor: '#E4E9EA',
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewDetailsText: {
    fontSize: moderateScale(14),
    color: '#2d3435',
  },
});

// ============================================================================
// GROUP LABEL STYLES
// ============================================================================

const groupLabelStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingLeft: scale(20),
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  overdueDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#EF4444',
  },
  overdueText: {
    fontSize: moderateScale(11),
    color: '#EF4444',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  needsAttentionDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#F5C623',
  },
  needsAttentionText: {
    fontSize: moderateScale(11),
    color: '#B8A300',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Chip variant used by SOON per PM spec — pill sits inside the
  // row's indent, groups the pulsing dot + label so the whole thing
  // reads on any background tint (previously raw text was nearly
  // invisible over the tan hero).
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  chipSoon: {
    backgroundColor: '#FFFBEB',
  },
  // RECOMMENDED — blue, matching the diagnostic-scan card's accent. Static,
  // never pulsing: a suggestion, not an alarm.
  recommendedDot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#5299FE',
  },
  chipRecommended: {
    backgroundColor: '#EFF6FF',
  },
  chipTextRecommended: {
    fontSize: moderateScale(11),
    color: '#1D4ED8',
    letterSpacing: 0.66,
    textTransform: 'uppercase',
  },
  chipTextSoon: {
    fontSize: moderateScale(11),
    color: '#B45309',
    letterSpacing: 0.66, // ≈ 0.06em at 11pt
    textTransform: 'uppercase',
  },
  // NOW / OVERDUE chip variant — red-50 bg with red-700 text so the
  // label reads on any hero tint (previously raw red on the tan was
  // hard to see, same problem SOON / HEALTHY had before the chip pass).
  chipNow: {
    backgroundColor: '#FEF2F2',
  },
  chipTextNow: {
    fontSize: moderateScale(11),
    color: '#B91C1C',
    letterSpacing: 0.66,
    textTransform: 'uppercase',
  },
});

// ============================================================================
// "SHOW N MORE" BUTTON STYLES
// ============================================================================

const showMoreStyles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-end',
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: -4, // pull tight to the last card
  },
  text: {
    fontSize: 12,
    letterSpacing: 0.2,
  },
});

// ============================================================================
// HEALTHY SUMMARY STYLES
// ============================================================================

const summaryStyles = StyleSheet.create({
  // Matches groupLabelStyles.row (NOW / SOON / ON THE HORIZON
  // headers) so the Healthy label sits at the same horizontal
  // position and uses the same gap as the others.
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingLeft: scale(20),
    paddingRight: scale(24),
    marginTop: scale(16),
    marginBottom: scale(8),
  },
  dot: {
    width: scale(8),
    height: scale(8),
    borderRadius: moderateScale(4),
    backgroundColor: '#059669',
  },
  // Chip variant per PM spec (bg #ECFDF5, text #059669, 8pt radius,
  // 8/4 padding). Wraps dot + label so it reads as a proper pill on
  // any background tint.
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(6),
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#ECFDF5',
  },
  chipText: {
    fontSize: moderateScale(11),
    color: '#059669',
    letterSpacing: 0.66, // ≈ 0.06em at 11pt
    textTransform: 'uppercase',
  },
  // Neutral grey variant, used when the section holds only items with no
  // record on file. Green is the app's "we checked and it's fine" colour;
  // spending it on an absence of data would be the same overclaim the chip
  // copy is there to avoid.
  chipNeutral: {
    backgroundColor: '#F3F4F6',
  },
  answerBtn: {
    paddingHorizontal: scale(10),
    paddingVertical: scale(6),
    borderRadius: moderateScale(999),
    backgroundColor: '#EFF6FF',
  },
  answerBtnText: {
    fontSize: moderateScale(12),
    color: '#5299FE',
  },
  dotNeutral: {
    backgroundColor: '#9CA3AF',
  },
  chipTextNeutral: {
    color: '#6B7280',
  },
  // Kept for backwards-compat with any leftover references; the
  // chip variants above are what render on the Cars screen now.
  healthyText: {
    flex: 1,
    fontSize: moderateScale(11),
    color: '#059669',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  // Legacy keys kept so older call sites (if any) don't fail
  // type lookups while we transition. Unused after this commit.
  headerText: {
    flex: 1,
    fontSize: moderateScale(15),
    color: '#2d3435',
  },
  headerTextOnDark: {
    color: '#FFFFFF',
  },
  // Visual values mirror cardStyles.container (UrgentCard) so the
  // healthy items card reads as the SAME card shape as the
  // needs-attention/overdue cards above it — same corner radius, same
  // horizontal padding, same breathing room. Inner item rows keep
  // their own paddingVertical so we don't double-pad here.
  card: {
    marginHorizontal: scale(20),
    marginTop: scale(12),
    backgroundColor: '#FFFFFF',
    borderRadius: moderateScale(24),
    paddingVertical: scale(6),
    paddingHorizontal: scale(20),
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: scale(12),
    paddingVertical: scale(12),
  },
  itemIcon: {
    width: scale(36),
    height: scale(36),
    borderRadius: moderateScale(12),
    backgroundColor: 'rgba(52, 199, 89, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
  },
  itemName: {
    fontSize: moderateScale(14),
    color: '#2d3435',
  },
  itemProvenance: {
    fontFamily: 'Urbanist-Medium',
    fontSize: scale(11),
    color: '#9CA3AF',
    marginTop: scale(2),
  },
  itemDesc: {
    fontSize: moderateScale(11),
    color: '#757c7d',
    marginTop: 1,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(0,0,0,0.06)',
    marginLeft: scale(48),
  },
});

export default MaintenanceTracker;
