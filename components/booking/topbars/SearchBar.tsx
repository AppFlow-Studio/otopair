/**
 * SearchBar
 *
 * PURPOSE: Search bar for discovering mechanics/services (bottom portion of TopBar)
 *          Allows users to search for services, mechanics, or shops
 *
 * USED IN: TopBar (discovery mode)
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

// 2. Third-party libraries
import { Search, X } from "lucide-react-native";
import Animated, { SharedValue, useAnimatedStyle } from "react-native-reanimated";

// 3. Shared UI (design system)
import { BrandColors, Spacing } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { SheetDrivenAnimation } from "@/constants/animations";
import { BorderRadius, FontFamily } from "@/constants/theme";

// ============================================================================
// CONSTANTS
// ============================================================================

const SEARCH_BAR_HEIGHT = 56;

// ============================================================================
// TYPES
// ============================================================================

export interface SearchBarProps {
  /** Current search query value */
  value: string;
  /** Called when the search query changes */
  onChangeText: (text: string) => void;
  /** Called when search is submitted */
  onSubmit?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Animated index from bottom sheet */
  sheetAnimatedIndex?: SharedValue<number>;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder = "Search for services or mechanics...",
  sheetAnimatedIndex,
}: SearchBarProps) {
  // Animation for search bar (sheet-driven: fade out when expanded)
  const searchBarAnimatedStyle = useAnimatedStyle(() => {
    if (!sheetAnimatedIndex) {
      return { opacity: 1, height: SEARCH_BAR_HEIGHT };
    }

    const opacity = SheetDrivenAnimation.fadeOut(sheetAnimatedIndex.value);
    const height = SheetDrivenAnimation.heightCollapse(sheetAnimatedIndex.value, SEARCH_BAR_HEIGHT);

    return { opacity, height, overflow: "hidden" };
  }, [sheetAnimatedIndex]);

  const handleClear = () => {
    onChangeText("");
  };

  return (
    <Animated.View style={searchBarAnimatedStyle}>
      <View style={styles.container}>
        <View style={styles.searchContainer}>
          <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor="#9CA3AF"
            value={value}
            onChangeText={onChangeText}
            onSubmitEditing={onSubmit}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {value.length > 0 && (
            <TouchableOpacity
              onPress={handleClear}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.clearButton}
            >
              <X size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F3F4F6",
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    height: 44,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: BrandColors.primary,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
});
