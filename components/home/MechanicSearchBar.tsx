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
 *     onMapPress={() => router.push('/home/map')}
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
import { BrandColors, FontFamily, FontSize, Spacing } from '@/constants/theme';

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
            {/* Search Section */}
            <View style={styles.searchSection}>
                <Search
                    size={20}
                    color="#000000"
                    strokeWidth={2}
                />
                <TextInput
                    style={styles.input}
                    placeholder={placeholder}
                    placeholderTextColor="#9CA3AF"
                    value={searchValue}
                    onChangeText={handleChangeText}
                    onFocus={() => setIsFocused(true)}
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
                        <X size={18} color="#9CA3AF" strokeWidth={2} />
                    </Pressable>
                )}
            </View>

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
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 16,
        shadowColor: '#000',
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
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    input: {
        flex: 1,
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: '#141C24',
        padding: 0,
        margin: 0,
    },
    clearButton: {
        padding: 4,
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: '#E5E7EB',
        marginHorizontal: Spacing.md,
    },
    mapButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 8,
    },
    mapButtonPressed: {
        opacity: 0.7,
        backgroundColor: 'rgba(82, 153, 254, 0.1)',
    },
});

export default MechanicSearchBar;

