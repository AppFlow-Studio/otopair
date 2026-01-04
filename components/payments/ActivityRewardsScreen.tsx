/**
 * ActivityRewardsScreen
 *
 * PURPOSE: Component for displaying payments, transaction history, and rewards.
 *          Redesigned with a dynamic Tinder-style swipeable card stack.
 *
 * USED IN: app/payments.tsx
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState, useCallback } from 'react';
import {
    Dimensions,
    Image,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
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
    Ellipsis
} from 'lucide-react-native';
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
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { 
    Text, 
    BrandColors, 
    Spacing, 
    AnimatedGradientBackground,
    SolidProgressBar,
    GlassCircleButton,
} from '@/components/shared-ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 1;
const CARD_HEIGHT = 420; // Visual card height (larger than container)
const CARD_CONTAINER_HEIGHT = 350; // Container height for layout (keeps section compact)

const SPRING_CONFIG = {
    damping: 15,
    stiffness: 300,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 2,
};

// ============================================================================
// DUMMY DATA
// ============================================================================

const INITIAL_CARDS = [
    { id: '1', image: require('@/assets/images/payments/realistic-monochromatic-credit-card.png') },
    { id: '2', image: require('@/assets/images/payments/realistic-monochromatic-credit-card.png') },
    { id: '3', image: require('@/assets/images/payments/realistic-monochromatic-credit-card.png') },
];

const RECENT_ACTIVITY = [
    {
        id: '1',
        title: 'Oil Change',
        shop: 'Union Square Motors',
        amount: '$129.00',
        date: 'April 24',
        icon: Droplet,
        iconColor: '#FACC15', // Yellow
    },
    {
        id: '2',
        title: 'Brake Fluid Flush',
        shop: 'Atelier Motors',
        amount: '$279.00',
        date: 'April 18',
        icon: Percent,
        iconColor: '#9CA3AF', // Gray
    },
    {
        id: '3',
        title: 'Wheel Alignment',
        shop: 'South Bay Motors',
        amount: '$279.00',
        date: 'April 12',
        icon: Target,
        iconColor: '#9CA3AF',
    },
    {
        id: '4',
        title: 'Wheel Alignment',
        shop: 'South Bay Motors',
        amount: '$279.00',
        date: 'April 4',
        icon: Target,
        iconColor: '#9CA3AF',
    },
];

const REWARDS = [
    { id: '1', title: 'Free Oil Change', points: '320 pts', icon: Droplet, iconColor: '#FACC15' },
    { id: '2', title: 'Free Diagnostic', points: '150 pts', icon: Wrench, iconColor: '#9CA3AF' },
    { id: '3', title: 'Car Wash', points: '80 pts', icon: Car, iconColor: '#9CA3AF' },
];

const CURRENT_POINTS = 420;
const MAX_POINTS = 500;

// ============================================================================
// DYNAMIC CARD ITEM
// ============================================================================

interface CardProps {
    card: typeof INITIAL_CARDS[0];
    index: number;
    totalCards: number;
    onSwipeComplete: () => void;
}

const CardItem = ({ card, index, totalCards, onSwipeComplete }: CardProps) => {
    const transformX = useSharedValue(0);
    const transformY = useSharedValue(0);
    const opacity = useSharedValue(1);
    
    const decayConfig = {
        rubberBandEffect: false,
        clamp: [-SCREEN_WIDTH * 1.5, SCREEN_WIDTH * 1.5] as [number, number],
    };

    const resetFunction = useCallback((finished?: boolean) => {
        'worklet';
        if (finished) {
            opacity.value = 0;
            transformX.value = 0;
            transformY.value = 0;
            runOnJS(onSwipeComplete)();
            opacity.value = withTiming(1, { duration: 400 });
        }
    }, [onSwipeComplete]);

    const gesture = Gesture.Pan()
        .enabled(index === 0) // Only top card is swipeable
        .onUpdate((e) => {
            transformX.value = e.translationX;
            transformY.value = e.translationY;
        })
        .onEnd((e) => {
            const isLeftSwipe = transformX.value < -100;
            const isRightSwipe = transformX.value > 100;
            
            if (isLeftSwipe || isRightSwipe) {
                const velocityX = isLeftSwipe ? -Math.max(Math.abs(e.velocityX), 1000) : Math.max(e.velocityX, 1000);
                
                opacity.value = withSpring(0, SPRING_CONFIG);
                transformX.value = withDecay(
                    {
                        velocity: velocityX,
                        ...decayConfig,
                    },
                    resetFunction
                );
            } else {
                opacity.value = withSpring(1, SPRING_CONFIG);
                transformX.value = withSpring(0, SPRING_CONFIG);
                transformY.value = withSpring(0, SPRING_CONFIG);
            }
        });

    const animatedStyle = useAnimatedStyle(() => {
        // Visual stack logic for cards behind the top one
        const stackOffset = 10;
        const stackScale = 0.05;
        
        // Dynamic rotation during swipe
        const rotateValue = transformX.value / 20;
        
        if (index === 0) {
            return {
                opacity: opacity.value,
                zIndex: 100,
                transform: [
                    { translateX: transformX.value },
                    { translateY: transformY.value },
                    { rotate: `${rotateValue}deg` },
                ],
            };
        }

        // Static stack position for background cards
        return {
            opacity: withSpring(1 - index * 0.2, SPRING_CONFIG),
            zIndex: 100 - index,
            transform: [
                { translateY: withSpring(index * stackOffset, SPRING_CONFIG) },
                { scale: withSpring(1 - index * stackScale, SPRING_CONFIG) },
            ],
        };
    });

    return (
        <GestureDetector gesture={gesture}>
            <Animated.View style={[styles.cardWrapper, animatedStyle]}>
                <Image 
                    source={card.image} 
                    style={styles.cardImage}
                    resizeMode="contain"
                />
            </Animated.View>
        </GestureDetector>
    );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

// Gradient indices to transition through while scrolling
const GRADIENT_SCROLL_INDICES = [0, 3, 6, 9];
// Scroll distance (in px) for each gradient transition
const SCROLL_PER_TRANSITION = 300;

export function ActivityRewardsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const scrollY = useSharedValue(0);
    const bgProgress = useSharedValue(0);
    const currentSegment = useSharedValue(0); // Track segment to avoid redundant updates
    const [cards, setCards] = useState(INITIAL_CARDS);
    const [currentDotIndex, setCurrentDotIndex] = useState(0);
    const [gradientIndices, setGradientIndices] = useState({
        from: GRADIENT_SCROLL_INDICES[0],
        to: GRADIENT_SCROLL_INDICES[1],
    });

    // Callback to update gradient indices when crossing segment boundaries
    const updateGradientIndices = useCallback((segmentIndex: number) => {
        const fromIdx = GRADIENT_SCROLL_INDICES[segmentIndex];
        const toIdx = GRADIENT_SCROLL_INDICES[segmentIndex + 1];
        setGradientIndices({ from: fromIdx, to: toIdx });
    }, []);

    // Track scroll position
    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const scrollOffset = event.contentOffset.y;
            scrollY.value = scrollOffset;
            
            const totalTransitions = GRADIENT_SCROLL_INDICES.length - 1;
            const maxScroll = totalTransitions * SCROLL_PER_TRANSITION;
            
            // Clamp scroll to valid range
            const clampedScroll = Math.max(0, Math.min(scrollOffset, maxScroll));
            
            // Which transition segment are we in? (0, 1, 2, ...)
            const segmentIndex = Math.min(
                Math.floor(clampedScroll / SCROLL_PER_TRANSITION),
                totalTransitions - 1
            );
            
            // Progress within current segment (0 to 1)
            const segmentStart = segmentIndex * SCROLL_PER_TRANSITION;
            bgProgress.value = interpolate(
                clampedScroll,
                [segmentStart, segmentStart + SCROLL_PER_TRANSITION],
                [0, 1],
                Extrapolation.CLAMP
            );
            
            // Only update indices when segment actually changes (avoid redundant re-renders)
            if (segmentIndex !== currentSegment.value) {
                currentSegment.value = segmentIndex;
                runOnJS(updateGradientIndices)(segmentIndex);
            }
        },
    });

    const onSwipeComplete = useCallback(() => {
        setCards((prevCards) => {
            const nextCards = [...prevCards];
            const swipedCard = nextCards.shift();
            if (swipedCard) {
                nextCards.push(swipedCard);
            }
            return nextCards;
        });
        setCurrentDotIndex((prev) => (prev + 1) % INITIAL_CARDS.length);
    }, []);

    return (
        <View style={styles.container}>
            {/* Background Gradient - transitions based on scroll position */}
            {/*colors={['#203f7dff', '#203f7dff', '#f4f1f8']}*/}
            <View style={StyleSheet.absoluteFill}>
                <AnimatedGradientBackground 
                    progress={bgProgress} 
                    fromIndex={gradientIndices.from} 
                    toIndex={gradientIndices.to}
                    colors={[BrandColors.secondary, BrandColors.secondary, '#f4f1f8']}
                />
            </View>

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text weight="semiBold" size="xl" color="#FFF" style={styles.headerTitle}>Payment Methods</Text>
                <View style={styles.headerRight}>
                    <GlassCircleButton 
                        size={40} 
                        onPress={() => router.push('/add-payment')}
                    >
                        <Plus size={20} color="#FFF" strokeWidth={2.5} />
                    </GlassCircleButton>
                    <GlassCircleButton 
                        size={40} 
                        onPress={() => console.log('More options')}
                    >
                        <Ellipsis size={20} color="#FFF" strokeWidth={2.5} />
                    </GlassCircleButton>
                </View>
            </View>

            <Animated.ScrollView 
                onScroll={scrollHandler}
                scrollEventThrottle={16}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
            >
                {/* Dynamic Stacked Cards */}
                <View style={styles.cardSection}>
                    <View style={styles.cardStackContainer}>
                        {cards.map((card, index) => (
                            <CardItem
                                key={card.id}
                                card={card}
                                index={index}
                                totalCards={cards.length}
                                onSwipeComplete={onSwipeComplete}
                            />
                        ))}
                    </View>
                    
                    {/* Pagination Dots */}
                    <View style={styles.pagination}>
                        {INITIAL_CARDS.map((_, index) => (
                            <View 
                                key={index} 
                                style={[
                                    styles.dot, 
                                    index === currentDotIndex && styles.dotActive
                                ]} 
                            />
                        ))}
                    </View>
                </View>

                {/* Recent Activity */}
                <View style={styles.section}>
                    <Text weight="bold" size="lg" color="#1F2937" style={styles.sectionTitle}>
                        Recent Activity
                    </Text>
                    
                    <View style={styles.activityList}>
                        {RECENT_ACTIVITY.map((item, index) => (
                            <View key={item.id} style={[
                                styles.activityItem,
                                index === RECENT_ACTIVITY.length - 1 && styles.lastItem
                            ]}>
                                <View style={[styles.iconBox, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                                    <item.icon size={20} color={item.iconColor} />
                                </View>
                                
                                <View style={styles.activityInfo}>
                                    <Text weight="semiBold" size="md" color="#1F2937">{item.title}</Text>
                                    <Text size="sm" color="#6B7280">{item.shop}</Text>
                                </View>
                                
                                <View style={styles.activityRight}>
                                    <Text weight="semiBold" size="md" color="#1F2937">{item.amount}</Text>
                                    <Text size="xs" color="#6B7280">{item.date}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Rewards */}
                <View style={styles.section}>
                    <View style={styles.rewardsContainer}>
                        <View style={styles.rewardsHeader}>
                            <Text weight="bold" size="lg" color="#1F2937">Rewards</Text>
                            <Text size="sm" color="#6B7280">{CURRENT_POINTS} pts / {MAX_POINTS} pts</Text>
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
                                <TouchableOpacity key={reward.id} style={[
                                    styles.rewardItem,
                                    index === REWARDS.length - 1 && styles.lastItem
                                ]}>
                                    <View style={styles.rewardLeft}>
                                        <reward.icon size={18} color={reward.iconColor} />
                                        <Text weight="medium" size="md" color="#1F2937" style={{ marginLeft: 12 }}>
                                            {reward.title}
                                        </Text>
                                    </View>
                                    <View style={styles.rewardRight}>
                                        <Text size="sm" color="#1F2937" style={{ marginRight: 4 }}>
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
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1E3A8A', // Fallback color
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 100,
        zIndex: 10,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
        marginRight: -24, // Offset for back button to center title
    },
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    scrollContent: {
        paddingTop: 10,
    },
    cardSection: {
        marginBottom: 10,
        height: 300,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    cardStackContainer: {
        width: CARD_WIDTH,
        height: CARD_CONTAINER_HEIGHT,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden', // Clip touches to container bounds
    },
    cardWrapper: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        position: 'absolute',
    },
    cardImage: {
        width: '100%',
        height: '100%',
    },
    pagination: {
        position: 'absolute',
        bottom: 10,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(107, 115, 154, 0.8)',
    },
    dotActive: {
        backgroundColor: '#FFF',
    },
    section: {
        marginBottom: 30,
        paddingHorizontal: 20,
    },
    sectionTitle: {
        marginBottom: 16,
    },
    activityList: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 16,
        padding: 4,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    lastItem: {
        borderBottomWidth: 0,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    activityInfo: {
        flex: 1,
        gap: 2,
    },
    activityRight: {
        alignItems: 'flex-end',
        gap: 2,
    },
    rewardsContainer: {
        backgroundColor: 'rgba(255,255,255,0.9)',
        borderRadius: 16,
        padding: 16,
    },
    rewardsHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    rewardsProgress: {
        marginBottom: 20,
    },
    rewardsList: {
        gap: 12,
    },
    rewardItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0,0,0,0.05)',
    },
    rewardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rewardRight: {
        flexDirection: 'row',
        alignItems: 'center',
    },
});

export default ActivityRewardsScreen;
