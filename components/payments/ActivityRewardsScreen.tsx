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

import React, { useState, useCallback, useMemo } from 'react';
import {
    Dimensions,
    Image,
    StyleSheet,
    TouchableOpacity,
    View,
    Modal,
    TouchableWithoutFeedback,
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
    Ellipsis,
    Pencil,
    Trash2,
    Clock
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
    SharedValue,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useShallow } from 'zustand/react/shallow';
import { 
    Text, 
    BrandColors, 
    Spacing, 
    AnimatedGradientBackground,
    SolidProgressBar,
    GlassCircleButton,
    FooterButton,
} from '@/components/shared-ui';
import { usePaymentStore } from '@/stores/usePaymentStore';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const OFFSET = 40; // Peek space on each side - larger for visible peek effect
const CARD_WIDTH = SCREEN_WIDTH - OFFSET * 2; // Card takes up most of the screen with peek space
const CARD_HEIGHT = 420; 
const CARD_CONTAINER_HEIGHT = 440;

const SPRING_CONFIG = {
    damping: 20,
    stiffness: 150,
    mass: 1,
};

// ============================================================================
// DUMMY DATA
// ============================================================================

const INITIAL_CARDS = [
    { id: '1', image: require('@/assets/images/payments/realistic-monochromatic-credit-card.png') },
    { id: '2', image: require('@/assets/images/payments/realistic-monochromatic-credit-card.png') },
    { id: '3', image: require('@/assets/images/payments/realistic-monochromatic-credit-card.png') },
];

const REWARDS = [
    { id: '1', title: 'Free Oil Change', points: '320 pts', icon: Droplet, iconColor: '#FACC15' },
    { id: '2', title: 'Free Diagnostic', points: '150 pts', icon: Wrench, iconColor: '#9CA3AF' },
    { id: '3', title: 'Car Wash', points: '80 pts', icon: Car, iconColor: '#9CA3AF' },
];

const CURRENT_POINTS = 420;
const MAX_POINTS = 500;

// ============================================================================
// HELPERS
// ============================================================================

const getIconComponent = (name: string) => {
    switch (name) {
        case 'droplet': return Droplet;
        case 'percent': return Percent;
        case 'target': return Target;
        case 'car': return Car;
        case 'wrench': return Wrench;
        default: return Receipt;
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
        (index - 1) * CARD_WIDTH,
        index * CARD_WIDTH,
        (index + 1) * CARD_WIDTH,
    ];

    const animatedStyle = useAnimatedStyle(() => {
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

        return {
            opacity,
            transform: [{ scale }],
        };
    });

    return (
        <Animated.View 
            style={[
                styles.cardWrapper, 
                animatedStyle,
                {
                    // First card gets left margin, last card gets right margin
                    marginLeft: index === 0 ? OFFSET : 0,
                    marginRight: index === total - 1 ? OFFSET : 0,
                }
            ]}
        >
            <Image 
                source={card.image} 
                style={styles.cardImage}
                resizeMode="contain"
            />
        </Animated.View>
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
    
    // Carousel and Activity sync
    const cardScrollX = useSharedValue(0);

    const { paymentMethods, removePaymentMethod, transactions } = usePaymentStore(
        useShallow((state) => ({
            paymentMethods: state.paymentMethods,
            removePaymentMethod: state.removePaymentMethod,
            transactions: state.transactions,
        }))
    );

    const storeCards = useMemo(() => paymentMethods.map((pm) => ({
        ...pm,
        image: require('@/assets/images/payments/realistic-monochromatic-credit-card.png'), // Reuse card image for now
    })), [paymentMethods]);

    const activeCards = storeCards;
    const hasCards = activeCards.length > 0;

    const [currentDotIndex, setCurrentDotIndex] = useState(0);
    const [isMenuVisible, setIsMenuVisible] = useState(false);
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

    // Scroll handler for the MAIN page scroll
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

    // Scroll handler for the CARD CAROUSEL
    const cardScrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            cardScrollX.value = event.contentOffset.x;
            const index = Math.round(event.contentOffset.x / CARD_WIDTH);
            runOnJS(setCurrentDotIndex)(index);
        },
    });

    // Filter transactions for the active card
    const filteredTransactions = useMemo(() => {
        const activeCard = activeCards[currentDotIndex];
        if (!activeCard) return [];
        return transactions.filter(t => t.paymentMethodId === activeCard.id);
    }, [transactions, activeCards, currentDotIndex]);

    // ANIMATED STYLE: Recent Activity section follows the card carousel scroll
    const animatedActivityStyle = useAnimatedStyle(() => {
        // Calculate progress within current card
        const position = cardScrollX.value / CARD_WIDTH;
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
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <ArrowLeft size={24} color="#FFF" />
                    </TouchableOpacity>
                </View>
                
                <Text weight="semiBold" size="xl" color="#FFF" style={styles.headerTitle}>
                    Activity
                </Text>

                <View style={styles.headerRight}>
                    {hasCards && (
                        <>
                            <GlassCircleButton 
                                size={40} 
                                onPress={() => router.push('/add-payment')}
                            >
                                <Plus size={20} color="#FFF" strokeWidth={2.5} />
                            </GlassCircleButton>
                            <GlassCircleButton 
                                size={40} 
                                onPress={() => setIsMenuVisible(true)}
                            >
                                <Ellipsis size={20} color="#FFF" strokeWidth={2.5} />
                            </GlassCircleButton>
                        </>
                    )}
                </View>
            </View>

            {/* Ellipsis Menu Modal */}
            <Modal
                transparent={true}
                visible={isMenuVisible}
                onRequestClose={() => setIsMenuVisible(false)}
                animationType="fade"
            >
                <TouchableWithoutFeedback onPress={() => setIsMenuVisible(false)}>
                    <View style={styles.menuOverlay}>
                        <View style={[styles.menuContainer, { top: insets.top + 20 }]}>
                            <View style={styles.menuContent}>
                                <TouchableOpacity 
                                    style={styles.menuItem}
                                    onPress={() => {
                                        setIsMenuVisible(false);
                                        // Navigate to AddPaymentScreen in edit mode
                                        const activeCard = activeCards[currentDotIndex];
                                        router.push({
                                            pathname: '/add-payment',
                                            params: { mode: 'edit', id: activeCard.id }
                                        });
                                    }}
                                >
                                    <View style={styles.menuIconBox}>
                                        <Pencil size={18} color="#1F2937" />
                                    </View>
                                    <Text weight="medium" size="md" color="#1F2937">Edit card</Text>
                                </TouchableOpacity>

                                <View style={styles.menuSeparator} />

                                <TouchableOpacity 
                                    style={styles.menuItem}
                                    onPress={() => {
                                        setIsMenuVisible(false);
                                        const activeCard = activeCards[currentDotIndex];
                                        removePaymentMethod(activeCard.id);
                                        console.log('Delete card');
                                    }}
                                >
                                    <View style={[styles.menuIconBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                                        <Trash2 size={18} color="#EF4444" />
                                    </View>
                                    <Text weight="medium" size="md" color="#EF4444">Delete card</Text>
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
                contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
            >
                {/* Dynamic Stacked Cards or Empty State */}
                <View style={hasCards ? styles.cardSection : styles.emptyCardSection}>
                    {hasCards ? (
                        <>
                            <Animated.ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                bounces={false}
                                snapToInterval={CARD_WIDTH}
                                disableIntervalMomentum
                                decelerationRate="fast"
                                onScroll={cardScrollHandler}
                                scrollEventThrottle={16}
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
                            
                            {/* Pagination Dots */}
                            <View style={styles.pagination}>
                                {activeCards.map((_, index) => (
                                    <View 
                                        key={index} 
                                        style={[
                                            styles.dot, 
                                            index === currentDotIndex && styles.dotActive
                                        ]} 
                                    />
                                ))}
                            </View>
                        </>
                    ) : (
                        <View style={styles.emptyStateContainer}>
                            <Image 
                                source={require('@/assets/images/payments/empty-wallet.png')}
                                style={styles.emptyWalletImage}
                                resizeMode="contain"
                            />
                            <Text weight="bold" size="xl" color="#1F2937" style={styles.emptyTitle}>
                                No Payment Methods
                            </Text>
                            <Text size="md" color="#6B7280" style={styles.emptySubtitle}>
                                Add a credit or debit card to get started.
                            </Text>
                            <FooterButton 
                                label="Add Payment Method"
                                onPress={() => router.push('/add-payment')}
                                fullWidth={false}
                                style={styles.addMethodButton}
                            />
                        </View>
                    )}
                </View>

                {/* Recent Activity */}
                <Animated.View style={[styles.section, animatedActivityStyle]}>
                    <Text weight="bold" size="lg" color="#1F2937" style={styles.sectionTitle}>
                        Recent Activity
                    </Text>
                    
                    <View style={styles.activityList}>
                        {hasCards ? (
                            <>
                                {filteredTransactions.map((item, index) => {
                                    const IconComponent = getIconComponent(item.iconName);
                                    return (
                                        <View key={item.id} style={[
                                            styles.activityItem,
                                            index === filteredTransactions.length - 1 && styles.lastItem
                                        ]}>
                                            <View style={[styles.iconBox, { backgroundColor: 'rgba(0,0,0,0.05)' }]}>
                                                <IconComponent size={20} color={item.iconColor} />
                                            </View>
                                            
                                            <View style={styles.activityInfo}>
                                                <Text weight="semiBold" size="md" color="#1F2937">{item.title}</Text>
                                                <Text size="sm" color="#6B7280">{item.shopName}</Text>
                                            </View>
                                            
                                            <View style={styles.activityRight}>
                                                <Text weight="semiBold" size="md" color="#1F2937">{item.amount}</Text>
                                                <Text size="xs" color="#6B7280">{item.date}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                                {filteredTransactions.length === 0 && (
                                    <View style={styles.emptyActivity}>
                                        <Text size="sm" color="#6B7280">No recent activity for this card.</Text>
                                    </View>
                                )}
                            </>
                        ) : (
                            <View style={styles.noTransactionsBox}>
                                <Clock size={20} color="#9CA3AF" />
                                <Text size="md" color="#6B7280" style={{ marginLeft: 12 }}>
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
    headerLeft: {
        width: 100,
        alignItems: 'flex-start',
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
    headerRight: {
        width: 100,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
    },
    scrollContent: {
        paddingTop: 10,
    },
    cardSection: {
        marginBottom: 10,
        height: CARD_CONTAINER_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
    },
    carouselContainer: {
        alignItems: 'center',
    },
    emptyCardSection: {
        marginBottom: 40,
        paddingTop: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyStateContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyWalletImage: {
        width: 280,
        height: 200,
        marginBottom: 20,
    },
    emptyTitle: {
        textAlign: 'center',
        marginBottom: 8,
    },
    emptySubtitle: {
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 22,
    },
    addMethodButton: {
        minWidth: 200,
    },
    cardWrapper: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        overflow: 'hidden',
        borderRadius: 14,
    },
    cardImage: {
        width: '100%',
        height: '100%',
        // The source asset has large transparent padding; scale up to remove padding
        // while keeping the card fully visible (no cropping).
        transform: [{ scale: 1.35 }],
        borderRadius: 14,
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
    emptyActivity: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noTransactionsBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
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
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    menuContainer: {
        position: 'absolute',
        right: 10,
        width: 180,
        borderRadius: 16,
        backgroundColor: '#FFF',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
        elevation: 10,
    },
    menuContent: {
        padding: 8,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        gap: 12,
    },
    menuIconBox: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(0,0,0,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    menuSeparator: {
        height: 1,
        backgroundColor: 'rgba(0,0,0,0.05)',
        marginHorizontal: 8,
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
