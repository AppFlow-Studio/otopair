/**
 * PaymentsScreen
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
    ScrollView,
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
    ChevronRight 
} from 'lucide-react-native';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
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
} from '@/components/shared-ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.98;
const CARD_HEIGHT = 380;

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

export function PaymentsScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const bgProgress = useSharedValue(1);
    const [cards, setCards] = useState(INITIAL_CARDS);
    const [currentDotIndex, setCurrentDotIndex] = useState(0);

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
            {/* Background Gradient */}
            <View style={StyleSheet.absoluteFill}>
                <AnimatedGradientBackground 
                    progress={bgProgress} 
                    fromIndex={13} 
                    toIndex={13} 
                />
            </View>

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <ArrowLeft size={24} color="#FFF" />
                </TouchableOpacity>
                <Text weight="semiBold" size="xl" color="#FFF" style={styles.headerTitle}>
                    Payment Methods
                </Text>
                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.headerPill}>
                        <Plus size={20} color="#000" />
                        <View style={styles.pillDivider} />
                        <MoreHorizontal size={20} color="#000" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView 
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
                    <Text weight="bold" size="lg" color="#FFF" style={styles.sectionTitle}>
                        Recent Activity
                    </Text>
                    
                    <View style={styles.activityList}>
                        {RECENT_ACTIVITY.map((item, index) => (
                            <View key={item.id} style={[
                                styles.activityItem,
                                index === RECENT_ACTIVITY.length - 1 && styles.lastItem
                            ]}>
                                <View style={[styles.iconBox, { backgroundColor: 'rgba(255,255,255,0.1)' }]}>
                                    <item.icon size={20} color={item.iconColor} />
                                </View>
                                
                                <View style={styles.activityInfo}>
                                    <Text weight="semiBold" size="md" color="#FFF">{item.title}</Text>
                                    <Text size="sm" color="rgba(255,255,255,0.6)">{item.shop}</Text>
                                </View>
                                
                                <View style={styles.activityRight}>
                                    <Text weight="semiBold" size="md" color="#FFF">{item.amount}</Text>
                                    <Text size="xs" color="rgba(255,255,255,0.6)">{item.date}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Rewards */}
                <View style={styles.section}>
                    <View style={styles.rewardsHeader}>
                        <Text weight="bold" size="lg" color="#FFF">Rewards</Text>
                        <Text size="sm" color="rgba(255,255,255,0.8)">{CURRENT_POINTS} pts / {MAX_POINTS} pts</Text>
                    </View>
                    
                    <SolidProgressBar 
                        current={CURRENT_POINTS} 
                        max={MAX_POINTS} 
                        height={10}
                        filledColor="#60A5FA"
                        unfilledColor="rgba(255,255,255,0.15)"
                        borderRadius={5}
                        style={styles.rewardsProgress}
                    />
                    
                    <View style={styles.rewardsList}>
                        {REWARDS.map((reward) => (
                            <TouchableOpacity key={reward.id} style={styles.rewardItem}>
                                <View style={styles.rewardLeft}>
                                    <reward.icon size={18} color={reward.iconColor} />
                                    <Text weight="medium" size="md" color="#FFF" style={{ marginLeft: 12 }}>
                                        {reward.title}
                                    </Text>
                                </View>
                                <View style={styles.rewardRight}>
                                    <Text size="sm" color="#FFF" style={{ marginRight: 4 }}>
                                        {reward.points}
                                    </Text>
                                    <ChevronRight size={16} color="rgba(255,255,255,0.6)" />
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            </ScrollView>
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
        // Space for pill
    },
    headerPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFF',
        borderRadius: 20,
        paddingHorizontal: 12,
        paddingVertical: 6,
        gap: 8,
    },
    pillDivider: {
        width: 1,
        height: 16,
        backgroundColor: '#E5E7EB',
    },
    scrollContent: {
        paddingTop: 10,
    },
    cardSection: {
        marginBottom: 40,
        height: 460,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cardStackContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
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
        flexDirection: 'row',
        justifyContent: 'center',
        marginTop: 20,
        gap: 6,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255,255,255,0.3)',
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
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16,
        padding: 4,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
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
        borderBottomColor: 'rgba(255,255,255,0.1)',
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

export default PaymentsScreen;
