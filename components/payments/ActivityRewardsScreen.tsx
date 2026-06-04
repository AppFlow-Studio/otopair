/**
 * ActivityRewardsScreen
 *
 * PURPOSE: Main screen for managing payment methods, viewing transaction history, and tracking rewards.
 *          Features a Tinder-style swipeable card stack and a scroll-driven background gradient.
 *
 * USED IN: app/payments.tsx
 *
 * EXAMPLE:
 *   <ActivityRewardsScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import {
  Dimensions,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
  Modal,
  TouchableWithoutFeedback,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Droplet,
  Percent,
  Target,
  Wrench,
  Car,
  ChevronRight,
  Bell,
  Receipt,
  Ellipsis,
  Star,
  Trash2,
  Clock,
} from "lucide-react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedScrollHandler,
  interpolate,
  Extrapolation,
  withSpring,
  withTiming,
  withDecay,
  runOnJS,
  SharedValue,
} from "react-native-reanimated";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { useShallow } from "zustand/react/shallow";
import { useAction } from "convex/react";
import {
  Text,
  BrandColors,
  Spacing,
  ScrollDrivenGradientBackground,
  SolidProgressBar,
  FooterButton,
  BlurHeaderOverlay,
} from "@/components/shared-ui";
import { usePaymentStore } from "@/stores/usePaymentStore";
import { api } from "@/convex/_generated/api";
import { BrandedCardVisual } from "@/components/payments/BrandedCardVisual";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
// Parallax carousel layout (mirrors @g:\GitHub\animation\src\animation-parallax-carousel)
const OFFSET = 40; // side spacing so adjacent card peeks in
const ITEM_WIDTH = SCREEN_WIDTH - OFFSET * 2;
const PEEK_OVERLAP = 40; // how much the next card tucks behind the current card (keeps rounded corners visible)
const SNAP_INTERVAL = ITEM_WIDTH - PEEK_OVERLAP;
// BrandedCardVisual uses aspectRatio 1.586 (standard card). Container adds
// breathing room above and a strip below for the pagination dots.
const CARD_HEIGHT = ITEM_WIDTH / 1.586;
const CARD_CONTAINER_HEIGHT = CARD_HEIGHT + 40;

const SPRING_CONFIG = {
  damping: 20,
  stiffness: 150,
  mass: 1,
};

// ============================================================================
// DUMMY DATA
// ============================================================================

const INITIAL_CARDS = [
  {
    id: "1",
    image: require("@/assets/images/payments/realistic-monochromatic-credit-card.png"),
  },
  {
    id: "2",
    image: require("@/assets/images/payments/realistic-monochromatic-credit-card.png"),
  },
  {
    id: "3",
    image: require("@/assets/images/payments/realistic-monochromatic-credit-card.png"),
  },
];

const REWARDS = [
  {
    id: "1",
    title: "Free Oil Change",
    points: "320 pts",
    icon: Droplet,
    iconColor: "#FACC15",
  },
  {
    id: "2",
    title: "Free Diagnostic",
    points: "150 pts",
    icon: Wrench,
    iconColor: "#9CA3AF",
  },
  {
    id: "3",
    title: "Car Wash",
    points: "80 pts",
    icon: Car,
    iconColor: "#9CA3AF",
  },
];

const CURRENT_POINTS = 420;
const MAX_POINTS = 500;

// ============================================================================
// HELPERS
// ============================================================================

const getIconComponent = (name: string) => {
  switch (name) {
    case "droplet":
      return Droplet;
    case "percent":
      return Percent;
    case "target":
      return Target;
    case "car":
      return Car;
    case "wrench":
      return Wrench;
    default:
      return Receipt;
  }
};

// ============================================================================
// CAROUSEL CARD ITEM
// ============================================================================

interface CardProps {
  card: any;
  index: number;
  scrollX: SharedValue<number>;
  total: number;
}

const CardItem = ({ card, index, scrollX, total }: CardProps) => {
  // Input range for smooth transitions between cards (parallax style)
  const inputRange = [
    (index - 1) * SNAP_INTERVAL,
    index * SNAP_INTERVAL,
    (index + 1) * SNAP_INTERVAL,
  ];

  const animatedStyle = useAnimatedStyle(() => {
    const distanceFromCenter = Math.abs(scrollX.value - index * SNAP_INTERVAL);

    const scale = interpolate(
      scrollX.value,
      inputRange,
      [0.94, 1, 0.94], // Adjacent cards slightly larger to reduce visible gap
      Extrapolation.CLAMP
    );

    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.6, 1, 0.6], // Adjacent cards faded but still visible
      Extrapolation.CLAMP
    );

    // Android-friendly draw order: use zIndex ONLY (no elevation) to avoid rectangular shadows.
    // Center card should always be on top, neighbors underneath.
    const zIndex = Math.round(
      interpolate(
        distanceFromCenter,
        [0, SNAP_INTERVAL],
        [10, 0],
        Extrapolation.CLAMP
      )
    );

    return {
      opacity,
      transform: [{ scale }],
      zIndex,
    };
  });

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        animatedStyle,
        {
          marginLeft: index === 0 ? OFFSET : 0,
          marginRight: index === total - 1 ? OFFSET : -PEEK_OVERLAP,
        },
      ]}
    >
      <BrandedCardVisual
        brand={card.brand ?? "generic"}
        last4={card.last4}
        expMonth={card.expMonth}
        expYear={card.expYear}
        cardholderName={card.cardholderName}
        isDefault={!!card.isDefault}
      />
    </Animated.View>
  );
};

// ============================================================================
// PARALLAX PAGINATION (demo-style)
// ============================================================================

const PaginationDot = ({
  index,
  scrollX,
}: {
  index: number;
  scrollX: SharedValue<number>;
}) => {
  const animatedDotStyle = useAnimatedStyle(() => {
    const widthAnimation = interpolate(
      scrollX.value,
      [
        (index - 1) * SNAP_INTERVAL,
        index * SNAP_INTERVAL,
        (index + 1) * SNAP_INTERVAL,
      ],
      [8, 18, 8],
      Extrapolation.CLAMP
    );

    const opacityAnimation = interpolate(
      scrollX.value,
      [
        (index - 1) * SNAP_INTERVAL,
        index * SNAP_INTERVAL,
        (index + 1) * SNAP_INTERVAL,
      ],
      [0.45, 1, 0.45],
      Extrapolation.CLAMP
    );

    return {
      width: widthAnimation,
      opacity: opacityAnimation,
    };
  });

  return <Animated.View style={[styles.dot, animatedDotStyle]} />;
};

const ParallaxCarouselPagination = ({
  count,
  scrollX,
}: {
  count: number;
  scrollX: SharedValue<number>;
}) => {
  return (
    <View style={styles.pagination}>
      {Array.from({ length: count }).map((_, index) => (
        <PaginationDot key={index} index={index} scrollX={scrollX} />
      ))}
    </View>
  );
};

export function ActivityRewardsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Carousel and Activity sync
  const cardScrollX = useSharedValue(0);
  const cardScrollRef = useRef<any>(null);
  const pendingDefaultScrollX = useRef<number | null>(null);

  const {
    paymentMethods,
    removePaymentMethod,
    setDefaultPaymentMethod,
    transactions,
    bumpPaymentMethodsRefresh,
  } = usePaymentStore(
    useShallow((state) => ({
      paymentMethods: state.paymentMethods,
      removePaymentMethod: state.removePaymentMethod,
      setDefaultPaymentMethod: state.setDefaultPaymentMethod,
      transactions: state.transactions,
      bumpPaymentMethodsRefresh: state.bumpPaymentMethodsRefresh,
    }))
  );

  const detachPaymentMethodAction = useAction(
    api.payments_stripe.detachPaymentMethod
  );
  const setDefaultPaymentMethodAction = useAction(
    api.payments_stripe.setDefaultPaymentMethod
  );

  const activeCards = paymentMethods;
  const hasCards = activeCards.length > 0;

  const [currentDotIndex, setCurrentDotIndex] = useState(0);
  const defaultCardIndex = useMemo(() => {
    const idx = activeCards.findIndex((c) => c.isDefault);
    return idx >= 0 ? idx : 0;
  }, [activeCards]);

  const defaultCardId = useMemo(() => {
    return activeCards[defaultCardIndex]?.id ?? null;
  }, [activeCards, defaultCardIndex]);

  const didInitialDefaultScroll = useRef(false);
  const prevDefaultId = useRef<string | null>(null);

  const scrollToCardX = useCallback(
    (x: number) => {
      cardScrollX.value = x;
      requestAnimationFrame(() => {
        cardScrollRef.current?.scrollTo?.({ x, y: 0, animated: false });
      });
    },
    [cardScrollX]
  );

  // On first mount (and whenever the default changes), scroll to the default card.
  useEffect(() => {
    if (!hasCards) {
      didInitialDefaultScroll.current = false;
      prevDefaultId.current = null;
      pendingDefaultScrollX.current = null;
      return;
    }

    const shouldScroll =
      !didInitialDefaultScroll.current ||
      (!!defaultCardId && defaultCardId !== prevDefaultId.current);

    if (!shouldScroll) return;

    didInitialDefaultScroll.current = true;
    prevDefaultId.current = defaultCardId;

    setCurrentDotIndex(defaultCardIndex);
    const targetX = defaultCardIndex * SNAP_INTERVAL;
    pendingDefaultScrollX.current = targetX;
    scrollToCardX(targetX);
  }, [hasCards, defaultCardId, defaultCardIndex, scrollToCardX]);

  // If a new default card was just added to the END, the first scrollTo can clamp to the old
  // max content width. Retry once the ScrollView content size updates.
  const handleCarouselContentSizeChange = useCallback(() => {
    if (pendingDefaultScrollX.current == null) return;
    const x = pendingDefaultScrollX.current;
    pendingDefaultScrollX.current = null;
    scrollToCardX(x);
  }, [scrollToCardX]);

  const [isMenuVisible, setIsMenuVisible] = useState(false);

  // Scroll handler for the CARD CAROUSEL
  const cardScrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      cardScrollX.value = event.contentOffset.x;
      const index = Math.round(event.contentOffset.x / SNAP_INTERVAL);
      runOnJS(setCurrentDotIndex)(index);
    },
  });

  // Filter transactions for the active card
  const filteredTransactions = useMemo(() => {
    const activeCard = activeCards[currentDotIndex];
    if (!activeCard) return [];
    return transactions.filter((t) => t.paymentMethodId === activeCard.id);
  }, [transactions, activeCards, currentDotIndex]);

  // ANIMATED STYLE: Recent Activity section follows the card carousel scroll
  const animatedActivityStyle = useAnimatedStyle(() => {
    // Calculate progress within current card
    const position = cardScrollX.value / SNAP_INTERVAL;
    const index = Math.floor(position);
    const progress = position - index; // 0 to 1

    // Fade out and slide when transition between cards
    const opacity = interpolate(
      progress,
      [0, 0.5, 1],
      [1, 0, 1],
      Extrapolation.CLAMP
    );

    const translateX = interpolate(
      progress,
      [0, 0.5, 1],
      [0, -30, 0],
      Extrapolation.CLAMP
    );

    return {
      opacity,
      transform: [{ translateX }],
    };
  });

  return (
    <View style={styles.container}>
      <ScrollDrivenGradientBackground>
        {(scrollHandler) => (
          <>
            {/* Ellipsis Menu Modal */}
            <Modal
              transparent={true}
              visible={isMenuVisible}
              onRequestClose={() => setIsMenuVisible(false)}
              animationType="fade"
            >
              <TouchableWithoutFeedback onPress={() => setIsMenuVisible(false)}>
                <View style={styles.menuOverlay}>
                  <View
                    style={[styles.menuContainer, { top: insets.top + 20 }]}
                  >
                    <View style={styles.menuContent}>
                      {activeCards[currentDotIndex] &&
                      !activeCards[currentDotIndex].isDefault ? (
                        <>
                          <TouchableOpacity
                            style={styles.menuItem}
                            onPress={async () => {
                              setIsMenuVisible(false);
                              const activeCard = activeCards[currentDotIndex];
                              if (!activeCard) return;
                              try {
                                await setDefaultPaymentMethodAction({
                                  paymentMethodId: activeCard.id,
                                });
                                setDefaultPaymentMethod(activeCard.id);
                                bumpPaymentMethodsRefresh();
                              } catch (err) {
                                console.warn(
                                  "[Payments] setDefaultPaymentMethod failed",
                                  err
                                );
                              }
                            }}
                          >
                            <View style={styles.menuIconBox}>
                              <Star size={18} color="#1F2937" />
                            </View>
                            <Text weight="medium" size="md" color="#1F2937">
                              Set as default
                            </Text>
                          </TouchableOpacity>
                          <View style={styles.menuSeparator} />
                        </>
                      ) : null}

                      <TouchableOpacity
                        style={styles.menuItem}
                        onPress={async () => {
                          setIsMenuVisible(false);
                          const activeCard = activeCards[currentDotIndex];
                          if (!activeCard) return;
                          try {
                            await detachPaymentMethodAction({
                              paymentMethodId: activeCard.id,
                            });
                            removePaymentMethod(activeCard.id);
                            bumpPaymentMethodsRefresh();
                          } catch (err) {
                            console.warn(
                              "[Payments] detachPaymentMethod failed",
                              err
                            );
                          }
                        }}
                      >
                        <View
                          style={[
                            styles.menuIconBox,
                            { backgroundColor: "rgba(239, 68, 68, 0.1)" },
                          ]}
                        >
                          <Trash2 size={18} color="#EF4444" />
                        </View>
                        <Text weight="medium" size="md" color="#EF4444">
                          Delete card
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </TouchableWithoutFeedback>
            </Modal>

            <Animated.ScrollView
              onScroll={scrollHandler}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                styles.scrollContent,
                { paddingTop: insets.top + 64, paddingBottom: insets.bottom + 40 },
              ]}
            >
              {/* Dynamic Stacked Cards or Empty State */}
              <View
                style={hasCards ? styles.cardSection : styles.emptyCardSection}
              >
                {hasCards ? (
                  <>
                    <Animated.ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      bounces={false}
                      ref={cardScrollRef}
                      snapToInterval={SNAP_INTERVAL}
                      disableIntervalMomentum
                      decelerationRate="fast"
                      onScroll={cardScrollHandler}
                      onContentSizeChange={handleCarouselContentSizeChange}
                      scrollEventThrottle={12}
                    >
                      {activeCards.map((card, index) => (
                        <CardItem
                          key={card.id}
                          card={card}
                          index={index}
                          scrollX={cardScrollX}
                          total={activeCards.length}
                        />
                      ))}
                    </Animated.ScrollView>

                    <ParallaxCarouselPagination
                      count={activeCards.length}
                      scrollX={cardScrollX}
                    />
                  </>
                ) : (
                  <View style={styles.emptyStateContainer}>
                    <Image
                      source={require("@/assets/images/payments/empty-wallet.png")}
                      style={styles.emptyWalletImage}
                      resizeMode="contain"
                    />
                    <Text
                      weight="bold"
                      size="xl"
                      color="#1F2937"
                      style={styles.emptyTitle}
                    >
                      No Payment Methods
                    </Text>
                    <Text
                      size="md"
                      color="#6B7280"
                      style={styles.emptySubtitle}
                    >
                      Add a credit or debit card to get started.
                    </Text>
                    <FooterButton
                      label="Add Payment Method"
                      onPress={() => router.push("/add-payment")}
                      fullWidth={false}
                      style={styles.addMethodButton}
                    />
                  </View>
                )}
              </View>

              {/* Recent Activity */}
              <Animated.View style={[styles.section, animatedActivityStyle]}>
                <Text
                  weight="bold"
                  size="lg"
                  color="#1F2937"
                  style={styles.sectionTitle}
                >
                  Recent Activity
                </Text>

                <View style={styles.activityList}>
                  {hasCards ? (
                    <>
                      {filteredTransactions.map((item, index) => {
                        const IconComponent = getIconComponent(item.iconName);
                        return (
                          <View
                            key={item.id}
                            style={[
                              styles.activityItem,
                              index === filteredTransactions.length - 1 &&
                                styles.lastItem,
                            ]}
                          >
                            <View
                              style={[
                                styles.iconBox,
                                { backgroundColor: "rgba(0,0,0,0.05)" },
                              ]}
                            >
                              <IconComponent size={20} color={item.iconColor} />
                            </View>

                            <View style={styles.activityInfo}>
                              <Text weight="semiBold" size="md" color="#1F2937">
                                {item.title}
                              </Text>
                              <Text size="sm" color="#6B7280">
                                {item.shopName}
                              </Text>
                            </View>

                            <View style={styles.activityRight}>
                              <Text weight="semiBold" size="md" color="#1F2937">
                                {item.amount}
                              </Text>
                              <Text size="xs" color="#6B7280">
                                {item.date}
                              </Text>
                            </View>
                          </View>
                        );
                      })}
                      {filteredTransactions.length === 0 && (
                        <View style={styles.emptyActivity}>
                          <Text size="sm" color="#6B7280">
                            No recent activity for this card.
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <View style={styles.noTransactionsBox}>
                      <Clock size={20} color="#9CA3AF" />
                      <Text
                        size="md"
                        color="#6B7280"
                        style={{ marginLeft: 12 }}
                      >
                        No recent transactions
                      </Text>
                    </View>
                  )}
                </View>
              </Animated.View>

              {/* Rewards */}
              <View style={styles.section}>
                <View style={styles.rewardsContainer}>
                  <View style={styles.rewardsHeader}>
                    <Text weight="bold" size="lg" color="#1F2937">
                      Rewards
                    </Text>
                    <Text size="sm" color="#6B7280">
                      {CURRENT_POINTS} pts / {MAX_POINTS} pts
                    </Text>
                  </View>

                  <SolidProgressBar
                    current={CURRENT_POINTS}
                    max={MAX_POINTS}
                    height={10}
                    filledColor="#60A5FA"
                    unfilledColor="rgba(0,0,0,0.1)"
                    borderRadius={5}
                    style={styles.rewardsProgress}
                  />

                  <View style={styles.rewardsList}>
                    {REWARDS.map((reward, index) => (
                      <TouchableOpacity
                        key={reward.id}
                        style={[
                          styles.rewardItem,
                          index === REWARDS.length - 1 && styles.lastItem,
                        ]}
                      >
                        <View style={styles.rewardLeft}>
                          <reward.icon size={18} color={reward.iconColor} />
                          <Text
                            weight="medium"
                            size="md"
                            color="#1F2937"
                            style={{ marginLeft: 12 }}
                          >
                            {reward.title}
                          </Text>
                        </View>
                        <View style={styles.rewardRight}>
                          <Text
                            size="sm"
                            color="#1F2937"
                            style={{ marginRight: 4 }}
                          >
                            {reward.points}
                          </Text>
                          <ChevronRight size={16} color="#9CA3AF" />
                        </View>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </Animated.ScrollView>
          </>
        )}
      </ScrollDrivenGradientBackground>

            <BlurHeaderOverlay
              title="Activities"
              titleColor={BrandColors.white}
              onBack={() => router.back()}
              gradientColors={[
                "rgba(82, 153, 254, 1)",
                "rgba(82, 153, 254, 0.7)",
                "rgba(82, 153, 254, 0.3)",
                "rgba(82, 153, 254, 0)",
              ]}
              rightElement={
                hasCards ? (
                  <>
                    <Pressable
                      onPress={() => router.push("/add-payment")}
                      style={styles.headerIconButton}
                      hitSlop={10}
                    >
                      <Plus size={20} color="#1F2937" strokeWidth={2.5} />
                    </Pressable>
                    <Pressable
                      onPress={() => setIsMenuVisible(true)}
                      style={styles.headerIconButton}
                      hitSlop={10}
                    >
                      <Ellipsis size={20} color="#1F2937" strokeWidth={2.5} />
                    </Pressable>
                  </>
                ) : null
              }
            />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#1E3A8A", // Fallback color
  },
  headerIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingTop: 80,
  },
  cardSection: {
    marginBottom: 10,
    height: CARD_CONTAINER_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  carouselContainer: {
    alignItems: "center",
  },
  emptyCardSection: {
    marginBottom: 40,
    paddingTop: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyStateContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyWalletImage: {
    width: 280,
    height: 200,
    marginBottom: 20,
  },
  emptyTitle: {
    textAlign: "center",
    marginBottom: 8,
  },
  emptySubtitle: {
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  addMethodButton: {
    minWidth: 200,
  },
  cardWrapper: {
    width: ITEM_WIDTH,
    height: CARD_HEIGHT,
    position: "relative",
  },
  pagination: {
    position: "absolute",
    bottom: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(107, 115, 154, 0.8)",
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    marginBottom: 16,
  },
  activityList: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 4,
  },
  emptyActivity: {
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  noTransactionsBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
  },
  activityItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  lastItem: {
    borderBottomWidth: 0,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  activityInfo: {
    flex: 1,
    gap: 2,
  },
  activityRight: {
    alignItems: "flex-end",
    gap: 2,
  },
  rewardsContainer: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 16,
    padding: 16,
  },
  rewardsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  rewardsProgress: {
    marginBottom: 20,
  },
  rewardsList: {
    gap: 12,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  menuContainer: {
    position: "absolute",
    right: 10,
    width: 180,
    borderRadius: 16,
    backgroundColor: "#FFF",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  menuContent: {
    padding: 8,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
  },
  menuIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  menuSeparator: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginHorizontal: 8,
  },
  rewardItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  rewardLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  rewardRight: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default ActivityRewardsScreen;
