/**
 * ShopPortfolioSection
 *
 * PURPOSE: Displays portfolio images/gallery for a shop
 *
 * USED IN: app/(main-tabs)/home/mechanic/[id].tsx (Portfolio tab)
 *
 * PROPS:
 *   - shopId (number): The shop ID to show portfolio for
 *
 * EXAMPLE:
 *   <ShopPortfolioSection shopId={shop.id} />
 *
 * OWNER: Temurbek Sayfutdinov
 */

// 1. React & React Native
import React, { useMemo } from "react";
import { Image, StyleSheet, TouchableOpacity, View } from "react-native";

// 2. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 3. Constants
import { BorderRadius } from "@/constants/theme";

// ============================================================================
// TYPES
// ============================================================================

interface ShopPortfolioSectionProps {
    /** The shop ID to show portfolio for */
    shopId: number;
}

// ============================================================================
// MOCK DATA
// ============================================================================

// Mock portfolio images - in production, this would come from API
const MOCK_PORTFOLIO_IMAGES: Record<number, string[]> = {
    1: [
        "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1493238792000-8113da705763?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=600&fit=crop",
    ],
    2: [
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1493238792000-8113da705763?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&h=600&fit=crop",
    ],
    3: [
        "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=800&h=600&fit=crop",
        "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
    ],
};

// Default images if shop not in mock data
const DEFAULT_IMAGES = [
    "https://images.unsplash.com/photo-1486754735734-325b5831c3ad?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=800&h=600&fit=crop",
    "https://images.unsplash.com/photo-1493238792000-8113da705763?w=800&h=600&fit=crop",
];

// ============================================================================
// COMPONENT
// ============================================================================

export function ShopPortfolioSection({ shopId }: ShopPortfolioSectionProps) {
    // ═══════════════ COMPUTED VALUES ═══════════════
    const images = useMemo(() => {
        return MOCK_PORTFOLIO_IMAGES[shopId] || DEFAULT_IMAGES;
    }, [shopId]);

    // ═══════════════ HANDLERS ═══════════════
    const handleImagePress = (imageUrl: string, index: number) => {
        // TODO: Open full-screen image viewer
        console.log("View image:", imageUrl, index);
    };

    // ═══════════════ RENDER ═══════════════
    if (images.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Text size="md" weight="medium" color="#9CA3AF" center>
                    No portfolio images available
                </Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text size="lg" weight="bold" color={BrandColors.primary}>
                    Portfolio ({images.length})
                </Text>
            </View>

            <View style={styles.grid}>
                {images.map((imageUrl, index) => (
                    <TouchableOpacity
                        key={index}
                        style={styles.imageContainer}
                        onPress={() => handleImagePress(imageUrl, index)}
                        activeOpacity={0.8}
                    >
                        <Image source={{ uri: imageUrl }} style={styles.image} resizeMode="cover" />
                    </TouchableOpacity>
                ))}
            </View>
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        paddingVertical: Spacing.lg,
    },
    header: {
        marginBottom: Spacing.lg,
    },
    grid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: Spacing.sm,
    },
    imageContainer: {
        width: "48%",
        aspectRatio: 1,
        borderRadius: BorderRadius.lg,
        overflow: "hidden",
        backgroundColor: "#F3F4F6",
    },
    image: {
        width: "100%",
        height: "100%",
    },
    emptyContainer: {
        paddingVertical: Spacing.xl,
        alignItems: "center",
    },
});

