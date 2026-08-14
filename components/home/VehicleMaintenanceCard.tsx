/**
 * VehicleMaintenanceCard
 *
 * PURPOSE: Displays vehicle maintenance information with swipable cards showing maintenance items, vehicle details, and mileage tracking
 *
 * USED IN: app/(main-tabs)/home/index.tsx
 *
 * PROPS:
 *   - vehicle (Vehicle): The vehicle object to display maintenance for
 *   - maintenanceItems (MaintenanceItem[]): Array of maintenance items to display
 *   - onUpdateMileage ((vehicleId: string, mileage: number) => void): Called when mileage is updated [optional]
 *   - onMaintenanceAction ((itemId: string) => void): Called when a maintenance action is triggered [optional]
 *
 * EXAMPLE:
 *   <VehicleMaintenanceCard
 *     vehicle={userVehicle}
 *     maintenanceItems={maintenanceList}
 *     onUpdateMileage={(id, miles) => updateMileage(id, miles)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useGuardedRouter as useRouter } from '@/hooks/useGuardedRouter';
import { useVehicleStore } from '@/stores/useVehicleStore';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

// 3. Shared UI
import { Text } from '@/components/shared-ui';
import { fetchVehicleImageUrl } from '@/utils/vehicleImage';
import { BrandColors, FontFamily } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

interface MaintenanceItem {
  id: string;
  serviceName: string;
  dueText: string;
  isOverdue: boolean;
}

interface Vehicle {
  id: string;
  name: string;
  vin: string;
  imageUrl: string;
  localImage?: any;
  maintenanceItems: MaintenanceItem[];
  _fetchParams?: { make: string; model: string; year?: number };
}

interface VehicleMaintenanceCardProps {
  vehicles?: Vehicle[];
  onBookNow?: (vehicleId: string, serviceId: string) => void;
  onSwipeStart?: () => void;
  onSwipeEnd?: () => void;
}

// ============================================================================
// SAMPLE DATA
// ============================================================================

const SAMPLE_VEHICLES: Vehicle[] = [
  {
    id: '1',
    name: 'Lamborghini\nAventador S',
    vin: '1N6AD06W98C406256',
    imageUrl: '',
    maintenanceItems: [
      { id: '1', serviceName: 'Oil Change', dueText: 'Due in 500 miles', isOverdue: false },
      { id: '2', serviceName: 'State Inspection', dueText: 'Due in 2 weeks', isOverdue: false },
      { id: '3', serviceName: 'Tire Rotation', dueText: 'Overdue by 200 miles', isOverdue: true },
    ],
    _fetchParams: { make: 'Lamborghini', model: 'Aventador', year: 2023 },
  },
  {
    id: '2',
    name: 'Tesla\nModel S',
    vin: '5YJSA1E26HF000316',
    imageUrl: '',
    maintenanceItems: [
      { id: '1', serviceName: 'Tire Rotation', dueText: 'Due in 1000 miles', isOverdue: false },
      { id: '2', serviceName: 'Brake Inspection', dueText: 'Due in 3 weeks', isOverdue: false },
      { id: '3', serviceName: 'Battery Check', dueText: 'Due in 6 months', isOverdue: false },
    ],
    _fetchParams: { make: 'Tesla', model: 'Model S', year: 2023 },
  },
  {
    id: '3',
    name: 'Lexus\nRX 350',
    vin: '2T2BK1BA4HC123456',
    imageUrl: '',
    maintenanceItems: [
      { id: '1', serviceName: 'Oil Change', dueText: 'Due in 800 miles', isOverdue: false },
      { id: '2', serviceName: 'Air Filter', dueText: 'Due in 1 month', isOverdue: false },
      { id: '3', serviceName: 'Coolant Flush', dueText: 'Overdue by 500 miles', isOverdue: true },
    ],
    _fetchParams: { make: 'Lexus', model: 'RX 350', year: 2023 },
  },
];

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH / 4;

// ============================================================================
// PAGINATION DOT — mirrors components/ai-chat/AIGreeting.tsx so the Home
// card stack reads as swipeable with the same visual language as Oto AI.
// ============================================================================

function PaginationDot({ index, activeIndex }: { index: number; activeIndex: number }) {
  const isActive = index === activeIndex;
  const dotWidth = useSharedValue(isActive ? 18 : 6);

  useEffect(() => {
    dotWidth.value = withSpring(isActive ? 18 : 6, { damping: 15, stiffness: 200 });
  }, [isActive, dotWidth]);

  const dotStyle = useAnimatedStyle(() => ({
    width: dotWidth.value,
    backgroundColor: isActive ? BrandColors.secondary : 'rgba(0,0,0,0.12)',
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function VehicleMaintenanceCard({
  vehicles = SAMPLE_VEHICLES,
  onBookNow,
  onSwipeStart,
  onSwipeEnd,
}: VehicleMaintenanceCardProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [backIndex, setBackIndex] = useState(vehicles.length > 1 ? 1 : 0);
  // Which vehicle is currently "promoting" from the back stack up
  // into the front slot. Null when no promotion is in flight — the
  // back card renders in its resting position instead.
  const [promotingIndex, setPromotingIndex] = useState<number | null>(null);
  const [fetchedImageUrls, setFetchedImageUrls] = useState<Record<string, string>>({});
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});

  // Animated values for the front card
  const translateX = useSharedValue(0);
  const rotation = useSharedValue(0);
  const cardOpacity = useSharedValue(1);
  // 0 → 1 drives Daniel's slide-in promotion: the back card
  // physically moves from its resting stack offset (top -8, inset 12,
  // scale .98) up to the front slot (top 0, inset 0, scale 1). This
  // replaces the old cross-fade with a real hand-off motion — the
  // card you saw peeking behind is literally the same card that's
  // now under your finger. See Daniel's commit b799c2e for source.
  const promotionProgress = useSharedValue(0);
  // Bottom section slide-down animation. Driven manually via
  // useEffect below (instead of Reanimated's `entering` prop) so
  // the direction is unambiguous: starts ABOVE final position
  // (translateY = -40) and slides DOWN to translateY = 0.
  const bottomTranslateY = useSharedValue(0);
  const bottomOpacity = useSharedValue(1);
  // Inner-press flag — set to 1 while the touch lives inside an
  // interactive child Pressable (e.g. the Book Now button), so the
  // parent's Gesture.Tap onEnd skips its "open the Cars tab" route.
  // Without this the parent's tap and the button's onPress both
  // resolve on the same touch and race; the parent's navigation was
  // winning on quick taps, sending the user to /cars instead of the
  // booking flow.
  const innerPressedSV = useSharedValue(0);

  useEffect(() => {
    vehicles.forEach((v) => {
      if (v.imageUrl || fetchedImageUrls[v.id] || !v._fetchParams) return;
      const { make, model, year } = v._fetchParams;
      fetchVehicleImageUrl(make, model, year, v.vin).then((url) => {
        if (url) setFetchedImageUrls((prev) => ({ ...prev, [v.id]: url }));
      });
    });
  }, [vehicles]);

  const handleBookNow = (vehicleId: string, serviceId: string) => {
    if (onBookNow) {
      onBookNow(vehicleId, serviceId);
    } else {
      router.push('/(booking-flow)/select-services');
    }
  };

  const finishPromotion = (nextIndex: number) => {
    // Order matters here. We reset the front card's transform +
    // opacity BEFORE we bump currentIndex so the moment React
    // re-renders with the new vehicle content, the front card is
    // already at (0, 0, 0, scale 1) and fully opaque — the promoting
    // card was visually at exactly that spot on the previous frame,
    // so the swap is seamless.
    translateX.value = 0;
    rotation.value = 0;
    cardOpacity.value = 1;
    // Pre-hide the bottom section BEFORE setCurrentIndex triggers a
    // re-render. Otherwise the shared values still read from the
    // previous curtain drop (opacity 1, translateY 0), the new front
    // card paints with the bottom visible for one frame, and only
    // then does the useEffect below hide it — a flash right at the
    // swap. Setting the values synchronously here means the very
    // first paint of the new front card already has the bottom
    // parked above at opacity 0.
    bottomTranslateY.value = -40;
    bottomOpacity.value = 0;
    setCurrentIndex(nextIndex);
    setBackIndex((nextIndex + 1) % vehicles.length);
    // Retire the promoting card on the next frame so it and the
    // front card don't both mount at the same visual position for a
    // rendered tick. Deliberately DON'T reset promotionProgress
    // here — the promoting card would visually snap back to its
    // pre-animation offset for one frame before unmounting. Next
    // promoteNextCard() resets it to 0 before mounting a fresh
    // promoting card, so leaving it at 1 between cycles is harmless.
    requestAnimationFrame(() => {
      setPromotingIndex(null);
    });
    onSwipeEnd?.();
  };

  const promoteNextCard = () => {
    const nextIndex = (currentIndex + 1) % vehicles.length;
    // Hide the outgoing front card immediately — it's already
    // flown off screen via translateX; opacity 0 protects against
    // any layout dust settling on top of the promoting card.
    cardOpacity.value = 0;
    promotionProgress.value = 0;
    setPromotingIndex(nextIndex);
    promotionProgress.value = withTiming(
      1,
      { duration: 260, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (finished) runOnJS(finishPromotion)(nextIndex);
      },
    );
  };

  // Bottom curtain drop — Ahmad's signature. Fires on every vehicle
  // change: bottom section resets ABOVE its final position (translateY
  // -40, opacity 0), sits for a short beat while the top of the
  // promoted card settles, then slides DOWN into place. Direction is
  // unambiguous: starts above, ends at 0 — clear top-to-bottom
  // curtain. Delay tightened from 400 → 200ms since we no longer wait
  // for a fade-in grow-forward on the top half.
  useEffect(() => {
    bottomTranslateY.value = -40;
    bottomOpacity.value = 0;
    bottomTranslateY.value = withDelay(
      200,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    bottomOpacity.value = withDelay(
      200,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
  }, [currentIndex]);

  const bottomAnimStyle = useAnimatedStyle(() => ({
    opacity: bottomOpacity.value,
    transform: [{ translateY: bottomTranslateY.value }],
  }));

  const panGesture = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-10, 10])
    .onStart(() => {
      if (onSwipeStart) runOnJS(onSwipeStart)();
    })
    .onUpdate((event) => {
      translateX.value = event.translationX;
      // Rotation trimmed from 10° → 6° across the full sweep for a
      // "carousel" feel rather than the previous "Tinder" feel — it's a
      // car card, not a person. Uses a viewport-relative denominator
      // so bigger phones don't get a stronger rotation curve.
      rotation.value = (event.translationX / SCREEN_WIDTH) * 6;
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > SWIPE_THRESHOLD) {
        const direction = event.translationX > 0 ? 'right' : 'left';
        const targetX = direction === 'right' ? SCREEN_WIDTH * 1.4 : -SCREEN_WIDTH * 1.4;
        // Fixed 460ms exit, no velocity awareness. The previous
        // clamp(140, 260ms) made fast flicks feel abrupt — the card
        // was gone before the eye could track it. 460ms with
        // ease-out-cubic lets the card visibly slide across the
        // screen, matching the 420ms grow-forward on the incoming
        // card so the two motions overlap as one continuous handoff.
        const exitDuration = 400;
        translateX.value = withTiming(targetX, {
          duration: exitDuration,
          easing: Easing.out(Easing.cubic),
        }, (finished) => {
          if (finished) {
            // Card is off-screen. Kick off Daniel's slide-in promotion
            // — the back card physically moves from its resting stack
            // offset into the front slot, replacing the old cross-fade
            // hand-off with a "the peek IS the next card" motion.
            runOnJS(promoteNextCard)();
          }
        });
        // Rotation lean matches the fly-off motion — 10° exit tilt.
        rotation.value = withTiming(direction === 'right' ? 10 : -10, {
          duration: exitDuration,
        });
      } else {
        // Snap-back tightened: damping 15 → 22, stiffness 150 → 220 so
        // the card returns to center in ~one bounce instead of the
        // previous mushy oscillation. Same spring on rotation keeps the
        // two axes in lockstep.
        translateX.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
        rotation.value = withSpring(0, { damping: 22, stiffness: 220, mass: 0.6 });
      }
    })
    // Re-enable the parent ScrollView whenever the gesture ends —
    // INCLUDING after a completed swipe. The threshold branch above used
    // to skip onSwipeEnd, leaving `isCardSwiping` stuck true on Home →
    // permanently dead vertical scroll. onFinalize fires for every end
    // (swipe, snap-back, or cancel), so scroll always recovers.
    .onFinalize(() => {
      if (onSwipeEnd) runOnJS(onSwipeEnd)();
    });

  const frontCardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [
      { translateX: translateX.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  // Promotion animated style — drives the back card up into the
  // front slot as `promotionProgress` climbs 0 → 1. Daniel's exact
  // math from the source commit: layout the card at the back stack
  // offset (top -8, inset 12, scale 0.98) and interpolate every
  // property to the front slot (top 0, inset 0, scale 1). The
  // vehicle-name re-layout that this used to cause is handled at
  // the renderer instead (see `flatName` param) rather than by
  // switching the motion to a transform-only version that doesn't
  // match the back card's rest shape.
  const promotingCardStyle = useAnimatedStyle(() => {
    const p = promotionProgress.value;
    return {
      top: -8 + 8 * p,
      left: 12 - 12 * p,
      right: 12 - 12 * p,
      transform: [{ scale: 0.98 + 0.02 * p }],
    };
  });

  const renderCardContent = (
    vehicle: Vehicle,
    maxItems?: number,
    hideBottom?: boolean,
    // `flatName`: skip `adjustsFontSizeToFit` on the vehicle name.
    // Passed by the promoting card during its slide-in — otherwise
    // the name's font size recomputes every animation frame as the
    // card's layout width changes, which reads as a text glitch.
    flatName?: boolean,
  ) => {
    const items = maxItems ? vehicle.maintenanceItems.slice(0, maxItems) : vehicle.maintenanceItems;
    const isPreview = maxItems != null;
    return (
    <View style={styles.card}>
      {/* Top Section - Vehicle Info (tap handled by the card's Tap gesture) */}
      <View style={styles.topSection}>
        <LinearGradient
          colors={['#FFFFFF', '#FFFFFF']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.topSectionInner}>
          <View style={styles.vehicleInfoSection}>
            <View style={styles.vehicleTextInfo}>
              <Text
                weight="bold"
                size="xl"
                color="#1F2937"
                lineHeight={1.25}
                numberOfLines={2}
                adjustsFontSizeToFit={!flatName}
                minimumFontScale={0.82}
                ellipsizeMode="clip"
                style={styles.vehicleName}
              >
                {vehicle.name}
              </Text>
              {/* iOS-only auto-shrink. `adjustsFontSizeToFit` +
                  `minimumFontScale` are honoured differently on Android: it
                  shrinks the VIN far past the 0.68 floor iOS respects — with
                  `flexShrink: 1` below it collapsed to roughly a third of
                  `size="sm"` and stopped being readable. A VIN is a fixed
                  17 characters, so Android simply renders it at its intended
                  size and clips if it ever has to. */}
              <Text
                size="sm"
                color="#9CA3AF"
                lineHeight={1.25}
                numberOfLines={1}
                adjustsFontSizeToFit={Platform.OS === 'ios' && !flatName}
                minimumFontScale={0.68}
                ellipsizeMode="clip"
                style={styles.vin}
              >
                {vehicle.vin}
              </Text>
            </View>
            <Image
              source={vehicle.localImage || { uri: fetchedImageUrls[vehicle.id] || vehicle.imageUrl }}
              style={styles.vehicleImage}
              resizeMode="contain"
            />
          </View>
        </View>
      </View>

      {/* Bottom Section - Maintenance List.
          Slides down from ABOVE its final position (translateY -40
          → 0) with a 400ms delay after the card mounts. Driven by
          `bottomAnimStyle` — a shared-value pair reset + animated
          per vehicle change in a useEffect. Reanimated's built-in
          `entering` FadeInDown was too subtle (25pt travel) and
          the perceived direction wasn't clear enough; controlling
          it explicitly makes the top-to-bottom curtain drop
          unambiguous.
          Skipped entirely when `hideBottom` is set (back card) —
          otherwise the back card's bottom would sit at full opacity
          under the front card's drop-down and the user would see
          the same content twice. */}
      {hideBottom ? null : (
      <Animated.View
        style={[styles.bottomSection, bottomAnimStyle]}
      >
        <View style={styles.maintenanceList}>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.maintenanceItem,
                index === items.length - 1 && styles.maintenanceItemLast,
              ]}
            >
              <View style={styles.maintenanceInfo}>
                <Text weight="semiBold" size="md" color="#1F2937">
                  {item.serviceName}
                </Text>
                <Text
                  size="sm"
                  color={item.isOverdue ? '#EF4444' : '#6B7280'}
                >
                  {item.dueText}
                </Text>
              </View>
              <Pressable
                onPressIn={() => {
                  // Tell the parent Gesture.Tap to skip this touch.
                  innerPressedSV.value = 1;
                }}
                onPressOut={() => {
                  // Hold the flag a beat after release so the parent's
                  // tap onEnd (which fires on touch release) still sees
                  // it before we clear.
                  setTimeout(() => {
                    innerPressedSV.value = 0;
                  }, 250);
                }}
                onPress={() => {
                  if (item.id === 'healthy') {
                    if (vehicle.vin) useVehicleStore.getState().selectVehicle(vehicle.vin);
                    router.push('/(main-tabs)/cars');
                  } else {
                    handleBookNow(vehicle.id, item.id);
                  }
                }}
                style={({ pressed }) => [
                  styles.bookButton,
                  pressed && styles.bookButtonPressed,
                ]}
              >
                <Text weight="medium" size="sm" color="#5299FE">
                  {item.id === 'healthy' ? 'View' : 'Book Now'}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      </Animated.View>
      )}
    </View>
    );
  };

  const frontVehicle = vehicles[currentIndex];
  const canSwipe = vehicles.length > 1;

  // Tap the active card → open it on the Cars tab. Implemented as an RNGH
  // Tap (not an RN Pressable) so it can be made EXCLUSIVE with the swipe
  // pan — a horizontal swipe activates the pan, which suppresses the tap,
  // so swiping no longer registers as a press.
  const handleCardPress = () => {
    const vin = vehicles[currentIndex]?.vin;
    // Drive the shared vehicle store; the Cars carousel listens to this
    // (Effect A) and rotates to the matching car, which in turn syncs the
    // page background + maintenance tracker via its onActiveIndexChange.
    if (vin) useVehicleStore.getState().selectVehicle(vin);
    router.push('/(main-tabs)/cars');
  };
  const tapGesture = Gesture.Tap()
    .maxDuration(250)
    // Fail the tap as soon as the finger travels >8px so a vertical drag
    // isn't held by the tap recognizer — that hand-off lets the parent
    // ScrollView take the gesture and scroll (kills the dead zone).
    .maxDistance(8)
    .onEnd((_e, success) => {
      'worklet';
      // Skip the parent "open Cars" route when the touch landed on an
      // inner Pressable (e.g. Book Now). The button's own onPress will
      // handle the navigation; without this guard, the parent fired
      // simultaneously and clobbered the destination.
      if (success && innerPressedSV.value === 0) {
        runOnJS(handleCardPress)();
      }
    });
  // Race (not Exclusive): whichever of pan/tap recognizes first wins, and
  // a vertical drag recognizes NEITHER (pan needs horizontal, tap fails on
  // move) so the touch falls through to the ScrollView.
  const composedGesture = Gesture.Race(panGesture, tapGesture);
  // Size the swiper container to the ACTIVE vehicle's measured card height
  // (not Math.max across all vehicles). Otherwise a short "All systems healthy"
  // card sits inside a container sized for the tallest possible card and the
  // More Services section below gets pushed down with dead air. The back-card
  // preview is `position: absolute` so it doesn't affect this measurement.
  // Falls back to max when the active vehicle's height hasn't been measured yet
  // so we never collapse the slot.
  const resolvedCardHeight = (() => {
    const heights = Object.values(measuredHeights);
    if (heights.length === 0) return undefined;
    const activeHeight = frontVehicle ? measuredHeights[frontVehicle.id] : undefined;
    return activeHeight ?? Math.max(...heights);
  })();

  // Smooth post-swipe reflow: the swipe gesture itself only transforms the
  // front card (no layout change). When the swipe settles and the active
  // card changes, we animate the container height so the downstream
  // sections slide smoothly instead of snapping.
  // Bumped 280ms → 340ms with an ease-out-cubic curve — the previous
  // default easing (inOut quad) started slow, which made the reflow read
  // as slightly delayed then abrupt. Ease-out starts fast and settles,
  // which pairs cleanly with the fade-in on the new front card.
  const animatedCardHeight = useSharedValue<number>(resolvedCardHeight ?? 0);
  useEffect(() => {
    if (resolvedCardHeight == null) return;
    // 420ms + ease-out-cubic — long enough that the staggered
    // FadeInDown cascade on the maintenance items has room to
    // finish underneath it, so height + items settle together.
    animatedCardHeight.value = withTiming(resolvedCardHeight, {
      duration: 420,
      easing: Easing.out(Easing.cubic),
    });
  }, [resolvedCardHeight, animatedCardHeight]);
  const containerHeightStyle = useAnimatedStyle(() => ({
    height: animatedCardHeight.value,
  }));

  const handleMeasureCard = (vehicleId: string, height: number) => {
    setMeasuredHeights((prev) => {
      if (prev[vehicleId] === height) {
        return prev;
      }
      return { ...prev, [vehicleId]: height };
    });
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <Text size="md" color="#000000" style={styles.sectionHeader}>
        Vehicle Maintenance
      </Text>

      {/* No onTouchStart/onTouchEnd here: those fired on EVERY touch-down
          (including a vertical scroll), flipping isCardSwiping → the home
          ScrollView's scrollEnabled went false before the gesture system
          could decide, killing vertical scroll on the card. isCardSwiping
          is driven solely by the pan gesture now (onStart / onFinalize),
          so it only disables scroll during a real horizontal swipe. */}
      <View style={styles.swiperWrapper}>
        {/* Pre-measure every card so the section keeps a stable height. */}
        <View style={styles.measurementLayer} pointerEvents="none">
          {vehicles.map((vehicle) => (
            <View
              key={`measure-${vehicle.id}`}
              style={styles.measurementCard}
              onLayout={(e) => handleMeasureCard(vehicle.id, e.nativeEvent.layout.height)}
            >
              {renderCardContent(vehicle)}
            </View>
          ))}
        </View>

        {/* Stacked card behind */}
        {canSwipe && (
          <View style={styles.stackedCard}>
            <BlurView
              intensity={40}
              tint="light"
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(245, 247, 250, 0.92)', 'rgba(241, 244, 249, 0.88)']}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.stackedCardHighlight} />
          </View>
        )}

        {/* Card area */}
        <Animated.View style={[styles.swiperContainer, resolvedCardHeight != null && containerHeightStyle]}>
          {/* Back card — renders the SAME full content as the
              front card about to arrive. Previously rendered as a
              1-item "preview" which caused a visible pop when the
              front card faded in with the real content. Full-render
              here means the back card is identical to what the
              incoming front card will show, so the fade-in is
              actually seamless. */}
          {canSwipe && promotingIndex === null && (
            <View style={styles.backCard}>
              {/* Back card renders TOP ONLY (image + name + VIN).
                  Bottom section is deliberately hidden so it doesn't
                  render at full opacity while the incoming front
                  card's bottom-section entering animation is
                  running on top — otherwise the user sees the same
                  content twice: once from the back card, then
                  again as the front card's bottom slides in. */}
              {renderCardContent(vehicles[backIndex], undefined, true)}
            </View>
          )}

          {/* Promoting card — Daniel's slide-in. Sits between back and
              front while `promotingIndex` is set: starts at back-card
              offsets and animates up into the front slot as
              `promotionProgress` climbs to 1. Top-only content so the
              bottom-curtain drop on the incoming front card doesn't
              double up under the promotion. */}
          {canSwipe && promotingIndex !== null && (
            <Animated.View
              style={[styles.backCard, styles.promotingCard, promotingCardStyle]}
            >
              {renderCardContent(vehicles[promotingIndex], undefined, true, true)}
            </Animated.View>
          )}

          {/* Front card */}
          {canSwipe ? (
            <GestureDetector gesture={composedGesture}>
              <Animated.View style={[styles.frontCard, frontCardStyle]}>
                {renderCardContent(frontVehicle)}
              </Animated.View>
            </GestureDetector>
          ) : (
            <GestureDetector gesture={tapGesture}>
              <View style={styles.frontCard}>
                {renderCardContent(frontVehicle)}
              </View>
            </GestureDetector>
          )}
        </Animated.View>

        {/* Swipe indicator — only when there's more than one vehicle. */}
        {vehicles.length > 1 && (
          <View style={styles.dotsRow}>
            {vehicles.map((_, i) => (
              <PaginationDot key={i} index={i} activeIndex={currentIndex} />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionHeader: {
    marginBottom: 28,
    fontStyle: 'italic',
  },
  swiperWrapper: {
    position: 'relative',
    paddingTop: 10,
  },
  measurementLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0,
    zIndex: -1,
  },
  measurementCard: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  stackedCard: {
    // Deepest peek in the 3-card stack — sits behind the back
    // card so the visual reads as "one more card underneath."
    // Bumped left/right inset from 17 → 30 so this peek is
    // visibly NARROWER than the back card (inset 12) and the
    // front card (inset 0). Also dropped opacity via a paler
    // border + lower shadow, so it recedes visually.
    position: 'absolute',
    top: -4,
    left: 30,
    right: 30,
    height: 44,
    borderRadius: 12,
    zIndex: 0,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(220, 225, 235, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  stackedCardHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  swiperContainer: {
    position: 'relative',
    zIndex: 1,
    overflow: 'visible',
  },
  backCard: {
    position: 'absolute',
    // Pin to both top and bottom of the swiperContainer so the back
    // card's layout height tracks the FRONT card's measured height,
    // not the back vehicle's natural content height. Without the
    // `bottom: 8`, a back vehicle with more text (e.g. an unhealthy
    // CR-V) renders taller than a healthy Porsche front card and the
    // back card bled out the bottom edge of the swiper. Now the
    // top: -8 / bottom: 8 pair makes the back card the SAME height as
    // the front, just shifted up by 8pt → after scale(0.98) it peeks
    // ~6pt above and sits ~10pt above the bottom edge (no bottom peek).
    top: -8,
    bottom: 8,
    left: 12,
    right: 12,
    zIndex: 0,
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
    // Clip any back-vehicle content that doesn't fit the constrained
    // height so the inner card's white background doesn't leak past
    // the front card's footprint.
    overflow: 'hidden',
    borderRadius: 12,
  },
  // Promoting card sits above the resting back card and just below
  // the front so its slide from the stack into the front slot is
  // uninterrupted by either. Animated top / left / right (not
  // bottom) is what actually drives the motion — the style below
  // just fixes the z-order and reveals full opacity for the ride.
  promotingCard: {
    zIndex: 1,
    opacity: 1,
  },
  // Front card z-order + relative positioning so translateX flies
  // clean across the stack. Referenced from the JSX; without this
  // the style prop resolves to `undefined` at runtime.
  frontCard: {
    position: 'relative',
    zIndex: 2,
  },
  card: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
    overflow: 'hidden',
  },
  topSection: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E8ECF2',
    position: 'relative',
    marginBottom: -12,
    // These shadow props never render. `overflow: 'hidden'` above clips the
    // layer they would draw into, so on iOS this section is flush against the
    // one below and the only thing separating them is the 1px border — the
    // hairline you see on device. Kept because they document the intent.
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    // Android draws elevation OUTSIDE the clip bounds, so `overflow: 'hidden'`
    // does not suppress it the way it does on iOS. At 6 this painted a heavy
    // drop shadow into the -12 overlap and the one card read as two stacked
    // ones. Zero keeps Android flush, matching what iOS actually renders.
    elevation: 0,
    zIndex: 2,
  },
  topSectionInner: {
    padding: 20,
    paddingTop: 28,
    paddingBottom: 16,
  },
  bottomSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    paddingTop: 10,
    paddingBottom: 2,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    zIndex: 1,
  },
  vehicleInfoSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vehicleTextInfo: {
    flex: 1,
  },
  vehicleName: {
    marginBottom: 4,
    minHeight: 50,
  },
  vin: {
    letterSpacing: 0.5,
    flexShrink: 1,
  },
  vehicleImage: {
    width: 160,
    height: 90,
    // Pull the hero image flush to the card's right edge by canceling
    // `topSectionInner`'s 20px right padding. The text column keeps its
    // padding via `topSectionInner` itself, so only the image bleeds out.
    marginRight: -20,
  },
  maintenanceList: {
    gap: 0,
  },
  maintenanceItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  maintenanceItemLast: {
    borderBottomWidth: 0,
  },
  maintenanceInfo: {
    flex: 1,
    gap: 2,
  },
  bookButton: {
    paddingHorizontal: 32,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#5299FE',
    backgroundColor: '#FFFFFF',
    minWidth: 100,
    alignItems: 'center',
  },
  bookButtonPressed: {
    backgroundColor: '#EBF4FF',
  },

  // Swipe indicator (mirrors AIGreeting's dots strip).
  dot: {
    height: 6,
    borderRadius: 3,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    // Clear the card's drop-shadow (shadowOffset.height: 4 +
    // shadowRadius: 12 ≈ 16pt of bleed below the bottom edge). At
    // marginTop: 12 the shadow's faded tail was painting over the
    // dots' top edge, making them look clipped by the card.
    marginTop: 24,
    // swiperContainer above us has zIndex: 1, so its rendered
    // stacking context (including the card's shadow) sits above any
    // sibling with the default zIndex of 0. Hoist the dots above so
    // they always paint cleanly regardless of shadow overlap.
    zIndex: 3,
  },
});

export default VehicleMaintenanceCard;
