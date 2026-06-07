/**
 * MechanicSearchBar
 *
 * PURPOSE: Provides a search input field for finding mechanics/shops with map and clear actions
 *
 * USED IN: app/(main-tabs)/home/search.tsx
 *
 * PROPS:
 *   - value (string): The current search query value
 *   - onChangeText ((text: string) => void): Called when search text changes
 *   - onMapPress (() => void): Called when map icon is pressed [optional]
 *   - placeholder (string): Placeholder text for the input [optional]
 *   - style (ViewStyle): Custom container style [optional]
 *
 * EXAMPLE:
 *   <MechanicSearchBar
 *     value={searchQuery}
 *     onChangeText={setSearchQuery}
 *     onMapPress={() => router.push('/booking/map')}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useState } from 'react';
import {
    Pressable,
    StyleSheet,
    TextInput,
    View,
    type ViewStyle,
} from 'react-native';

// 2. Expo & Third-party
import { Map, Search, X } from 'lucide-react-native';

// 3. Shared UI
import { Text } from '../shared-ui';

// 4. Constants, hooks, types
import { BrandColors, FontFamily, FontSize, SemanticColors, Spacing } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

interface MechanicSearchBarProps {
    /** Current search value */
    value?: string;
    /** Called when search value changes */
    onChangeText?: (text: string) => void;
    /** Called when search is submitted (Enter key) */
    onSubmit?: (text: string) => void;
    /** Called when Map button is pressed */
    onMapPress?: () => void;
    /** Called when search input is focused */
    onFocus?: () => void;
    /** When provided, the search field becomes non-editable and a tap
     *  anywhere on it fires this handler instead of focusing the input.
     *  Used on Home to make the search bar a shortcut to the map flow. */
    onPress?: () => void;
    /** Container style */
    style?: ViewStyle;
    /** Placeholder text */
    placeholder?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function MechanicSearchBar({
    value,
    onChangeText,
    onSubmit,
    onMapPress,
    onFocus,
    onPress,
    style,
    placeholder = 'Search for mechanics...',
}: MechanicSearchBarProps) {
    const [internalValue, setInternalValue] = useState('');
    const [isFocused, setIsFocused] = useState(false);

    // Use controlled or uncontrolled value
    const searchValue = value !== undefined ? value : internalValue;
    const hasValue = searchValue.length > 0;

    const handleChangeText = (text: string) => {
        if (value === undefined) {
            setInternalValue(text);
        }
        onChangeText?.(text);
    };

    const handleClear = () => {
        handleChangeText('');
    };

    const handleSubmit = () => {
        onSubmit?.(searchValue);
    };

    return (
        <View
            style={[
                styles.container,
                isFocused && styles.containerFocused,
                style,
            ]}
        >
            {/* Search Section. When `onPress` is provided, the input is
                read-only and the entire row acts as a button (used on
                Home to launch the map flow). Otherwise the TextInput
                behaves normally. */}
            {onPress ? (
                <Pressable
                    onPress={onPress}
                    style={({ pressed }) => [
                        styles.searchSection,
                        pressed && styles.searchSectionPressed,
                    ]}
                >
                    <Search size={20} color={BrandColors.black} strokeWidth={2} />
                    <Text
                        size="md"
                        weight="regular"
                        color={SemanticColors.textDisabled}
                        numberOfLines={1}
                        adjustsFontSizeToFit
                        minimumFontScale={0.72}
                        style={styles.placeholderText}
                    >
                        {placeholder}
                    </Text>
                </Pressable>
            ) : (
                <View style={styles.searchSection}>
                    <Search size={20} color={BrandColors.black} strokeWidth={2} />
                    <TextInput
                        style={styles.input}
                        placeholder={placeholder}
                        placeholderTextColor={SemanticColors.textDisabled}
                        value={searchValue}
                        onChangeText={handleChangeText}
                        onFocus={() => {
                            setIsFocused(true);
                            onFocus?.();
                        }}
                        onBlur={() => setIsFocused(false)}
                        onSubmitEditing={handleSubmit}
                        returnKeyType="search"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                    {hasValue && (
                        <Pressable
                            onPress={handleClear}
                            hitSlop={8}
                            style={styles.clearButton}
                        >
                            <X size={18} color={SemanticColors.textDisabled} strokeWidth={2} />
                        </Pressable>
                    )}
                </View>
            )}

            {/* Divider */}
            <View style={styles.divider} />

            {/* Map Button */}
            <Pressable
                onPress={onMapPress}
                style={({ pressed }) => [
                    styles.mapButton,
                    pressed && styles.mapButtonPressed,
                ]}
            >
                <Map
                    size={20}
                    color={BrandColors.secondary}
                    strokeWidth={2}
                />
                <Text
                    weight="semiBold"
                    size="sm"
                    color={BrandColors.secondary}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                    style={styles.mapLabel}
                >
                    Map
                </Text>
            </Pressable>
        </View>
    );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: BrandColors.white,
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 16,
        shadowColor: BrandColors.black,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    containerFocused: {
        shadowOpacity: 0.1,
        shadowRadius: 12,
    },
    searchSection: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    searchSectionPressed: {
        opacity: 0.6,
    },
    placeholderText: {
        flex: 1,
        flexShrink: 1,
        minWidth: 0,
    },
    input: {
        flex: 1,
        minWidth: 0,
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: BrandColors.primary,
        padding: 0,
        margin: 0,
    },
    clearButton: {
        padding: 4,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: SemanticColors.border,
        marginHorizontal: Spacing.md,
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        flexShrink: 0,
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    mapLabel: {
        flexShrink: 1,
    },
    mapButtonPressed: {
        opacity: 0.7,
        backgroundColor: 'rgba(82, 153, 254, 0.1)',
    },
});

export default MechanicSearchBar;

