/**
 * PhoneNumberStep
 *
 * PURPOSE: Phone number entry step for OnboardingFlow.
 *
 * OWNER: Daniel Chelala
 */

import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { useState, useEffect, useMemo, useRef } from 'react';
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    TextInput,
    View,
    useWindowDimensions,
    Modal,
    FlatList,
    Animated,
    TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { OnboardingProgress } from '../OnboardingProgress';
import { OnboardingFooterButton } from '../OnboardingFooterButton';
import { OnboardingBackButton } from '../OnboardingBackButton';
import { Country } from 'react-native-country-picker-modal';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { Search } from 'lucide-react-native';

// Try to import getAllCountries from the library
let getAllCountries: ((locale?: string) => Promise<Country[]>) | undefined;
try {
    const countryPickerModule = require('react-native-country-picker-modal');
    getAllCountries = countryPickerModule.getAllCountries;
} catch (e) {
    console.log('getAllCountries not available in library');
}

interface PhoneNumberStepProps {
    onNext: () => void;
    onBack: () => void;
}

export function PhoneNumberStep({ onNext, onBack }: PhoneNumberStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { updateData } = useOnboardingStore();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [countryCode, setCountryCode] = useState<string>('US');
    const [country, setCountry] = useState<Country | null>(null);
    const [showCountryPicker, setShowCountryPicker] = useState(false);
    const [showConfirmationModal, setShowConfirmationModal] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [allCountries, setAllCountries] = useState<Country[]>([]);
    const slideAnim = useRef(new Animated.Value(height)).current;
    const [sheetPosition, setSheetPosition] = useState<'collapsed' | 'expanded' | 'dismissed'>('collapsed');
    const panY = useRef(new Animated.Value(0)).current;
    const currentSlidePosition = useRef(height);
    
    // Track the actual position of slideAnim
    useEffect(() => {
        const listenerId = slideAnim.addListener(({ value }) => {
            currentSlidePosition.current = value;
        });
        return () => {
            slideAnim.removeListener(listenerId);
        };
    }, [slideAnim]);
    
    // Snap points
    const COLLAPSED_POSITION = height * 0.15;
    const EXPANDED_POSITION = 0;
    const DISMISSED_POSITION = height;
    
    // Load countries
    useEffect(() => {
        const loadCountries = async () => {
            try {
                if (getAllCountries) {
                    const countries = await getAllCountries('en');
                    if (countries && Array.isArray(countries) && countries.length > 0) {
                        const validCountries = countries.filter((c: Country) => 
                            c.callingCode && 
                            Array.isArray(c.callingCode) && 
                            c.callingCode.length > 0 && 
                            c.callingCode[0] && 
                            c.callingCode[0].trim() !== ''
                        );
                        setAllCountries(validCountries);
                        return;
                    }
                }
                
                // Fallback to common countries
                const commonCountries = [
                    { cca2: 'US', callingCode: ['1'], name: { common: 'United States' } },
                    { cca2: 'CA', callingCode: ['1'], name: { common: 'Canada' } },
                    { cca2: 'GB', callingCode: ['44'], name: { common: 'United Kingdom' } },
                    { cca2: 'AU', callingCode: ['61'], name: { common: 'Australia' } },
                    { cca2: 'DE', callingCode: ['49'], name: { common: 'Germany' } },
                    { cca2: 'FR', callingCode: ['33'], name: { common: 'France' } },
                    { cca2: 'IT', callingCode: ['39'], name: { common: 'Italy' } },
                    { cca2: 'ES', callingCode: ['34'], name: { common: 'Spain' } },
                    { cca2: 'MX', callingCode: ['52'], name: { common: 'Mexico' } },
                    { cca2: 'BR', callingCode: ['55'], name: { common: 'Brazil' } },
                ];
                setAllCountries(commonCountries as Country[]);
            } catch (error) {
                console.error('Error loading countries:', error);
            }
        };
        loadCountries();
    }, []);
    
    // Filter countries
    const filteredCountries = useMemo(() => {
        if (allCountries.length === 0) return [];
        
        const validCountries = allCountries.filter((c: Country) => 
            c.callingCode && 
            Array.isArray(c.callingCode) && 
            c.callingCode.length > 0 && 
            c.callingCode[0] && 
            c.callingCode[0].trim() !== ''
        );
        
        if (!searchQuery.trim()) {
            const usCountry = validCountries.find((c: Country) => c.cca2 === 'US');
            const otherCountries = validCountries.filter((c: Country) => c.cca2 !== 'US');
            return usCountry ? [usCountry, ...otherCountries] : validCountries;
        }
        const query = searchQuery.toLowerCase();
        return validCountries.filter((c: Country) => {
            const name = typeof c.name === 'string' ? c.name : (c.name as any)?.common || '';
            const nameStr = typeof name === 'string' ? name : '';
            return (
                nameStr.toLowerCase().includes(query) ||
                c.callingCode[0]?.includes(query) ||
                c.cca2.toLowerCase().includes(query)
            );
        });
    }, [searchQuery, allCountries]);
    
    // Bottom sheet animation
    useEffect(() => {
        if (showCountryPicker) {
            slideAnim.setValue(height);
            panY.setValue(0);
            setSheetPosition('collapsed');
            requestAnimationFrame(() => {
                Animated.spring(slideAnim, {
                    toValue: COLLAPSED_POSITION,
                    useNativeDriver: true,
                    tension: 40,
                    friction: 8,
                }).start();
            });
        } else {
            Animated.timing(slideAnim, {
                toValue: height,
                duration: 300,
                useNativeDriver: true,
            }).start();
            setSheetPosition('dismissed');
        }
    }, [showCountryPicker, slideAnim, height, COLLAPSED_POSITION]);
    
    const handleGestureEvent = Animated.event(
        [{ nativeEvent: { translationY: panY } }],
        { useNativeDriver: true }
    );
    
    const handleGestureStateChange = (event: any) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            const { translationY, velocityY } = event.nativeEvent;
            const currentVisualPosition = currentSlidePosition.current + translationY;
            
            let targetPosition = COLLAPSED_POSITION;
            let newPosition: 'collapsed' | 'expanded' | 'dismissed' = 'collapsed';
            
            if (velocityY < -500 || (translationY < -100 && currentVisualPosition < COLLAPSED_POSITION / 2)) {
                targetPosition = EXPANDED_POSITION;
                newPosition = 'expanded';
            } else if (velocityY > 500 || (translationY > 100 && currentVisualPosition > COLLAPSED_POSITION + 50)) {
                targetPosition = DISMISSED_POSITION;
                newPosition = 'dismissed';
                handleClosePicker();
            } else {
                targetPosition = COLLAPSED_POSITION;
                newPosition = 'collapsed';
            }
            
            slideAnim.setValue(currentVisualPosition);
            panY.setValue(0);
            setSheetPosition(newPosition);
            
            Animated.spring(slideAnim, {
                toValue: targetPosition,
                useNativeDriver: true,
                tension: 40,
                friction: 8,
            }).start();
        }
    };
    
    const translateY = Animated.add(slideAnim, panY);

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleCreateAccount = () => {
        setShowConfirmationModal(true);
    };
    
    const handleConfirmPhoneNumber = () => {
        const fullPhoneNumber = `+${getCallingCode()}${phoneNumber.replace(/\D/g, '')}`;
        updateData({ phoneNumber: fullPhoneNumber });
        setShowConfirmationModal(false);
        onNext();
    };
    
    const handleGoBack = () => {
        setShowConfirmationModal(false);
    };
    
    const formatPhoneNumberForDisplay = () => {
        const callingCode = getCallingCode();
        const cleaned = phoneNumber.replace(/\D/g, '');
        if (cleaned.length === 0) return `+${callingCode}`;
        
        if (callingCode === '1' && cleaned.length === 10) {
            return `+${callingCode} ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
        }
        const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
        return `+${callingCode} ${formatted}`;
    };

    const handleLogIn = () => {
        console.log('Navigate to login');
    };

    const handleCountrySelect = (selectedCountry: Country) => {
        setCountryCode(selectedCountry.cca2);
        setCountry(selectedCountry);
        setShowCountryPicker(false);
        setSearchQuery('');
    };
    
    const handleClosePicker = () => {
        setShowCountryPicker(false);
        setSearchQuery('');
    };
    
    const renderCountryItem = ({ item }: { item: Country }) => {
        const isSelected = item.cca2 === countryCode;
        return (
            <TouchableOpacity
                style={[styles.countryItem, isSelected && styles.countryItemSelected]}
                onPress={() => handleCountrySelect(item)}
            >
                <View style={styles.countryItemFlag}>
                    <Text style={styles.countryItemFlagText}>
                        {getFlagEmoji(item.cca2)}
                    </Text>
                </View>
                <Text style={styles.countryItemCode}>
                    +{item.callingCode[0]}
                </Text>
                <Text style={styles.countryItemName} numberOfLines={1}>
                    {typeof item.name === 'string' ? item.name : item.name?.common || item.cca2}
                </Text>
            </TouchableOpacity>
        );
    };

    const getFlagEmoji = (code: string) => {
        if (code && code.length === 2) {
            try {
                const codePoints = code
                    .toUpperCase()
                    .split('')
                    .map(char => 0x1F1E6 + (char.charCodeAt(0) - 65));
                return String.fromCodePoint(...codePoints);
            } catch (e) {
                return '🇺🇸';
            }
        }
        return '🇺🇸';
    };

    const getCallingCode = () => {
        if (country?.callingCode && country.callingCode.length > 0) {
            return country.callingCode[0];
        }
        return '1';
    };

    const canCreateAccount = phoneNumber.trim().length > 0;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                <OnboardingProgress total={4} filled={1} leftElement={<OnboardingBackButton onBack={onBack} alwaysShow />} />
                
                <View style={styles.headerContent}>
                    <Text style={styles.title}>Let's get started!</Text>
                    <Text style={styles.subtitle}>
                        Enter your phone number. We will send you a confirmation code there
                    </Text>
                </View>

                <View style={styles.inputContainer}>
                    <Pressable
                        onPress={() => setShowCountryPicker(true)}
                        style={styles.countryCodeContainer}
                    >
                        <View style={styles.flagContainer}>
                            <Text style={styles.countryCodeText}>
                                {getFlagEmoji(countryCode)}
                            </Text>
                        </View>
                        <Text style={styles.countryCodeNumber}>
                            +{getCallingCode()}
                        </Text>
                    </Pressable>
                    <TextInput
                        style={styles.phoneInput}
                        placeholder="Enter your phone"
                        placeholderTextColor="#9CA3AF"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        keyboardType="phone-pad"
                        autoComplete="tel"
                        textContentType="telephoneNumber"
                    />
                </View>

                {/* Country Picker Bottom Sheet */}
                <Modal
                    visible={showCountryPicker}
                    transparent
                    animationType="none"
                    onRequestClose={handleClosePicker}
                >
                    <GestureHandlerRootView style={{ flex: 1 }}>
                        <Pressable
                            style={styles.bottomSheetBackdrop}
                            onPress={handleClosePicker}
                        >
                            <PanGestureHandler
                                onGestureEvent={handleGestureEvent}
                                onHandlerStateChange={handleGestureStateChange}
                                activeOffsetY={[-10, 10]}
                            >
                                <Animated.View
                                    style={[
                                        styles.bottomSheet,
                                        {
                                            transform: [{ translateY: translateY }],
                                            paddingBottom: insets.bottom,
                                            height: sheetPosition === 'expanded' ? height : height * 0.85,
                                        },
                                    ]}
                                >
                                    <View style={styles.handleContainer}>
                                        <View style={styles.bottomSheetHandle} />
                                    </View>
                                    
                                    <View style={styles.bottomSheetHeader}>
                                        <View style={styles.searchContainer}>
                                            <Search size={20} color="#9CA3AF" style={styles.searchIcon} />
                                            <TextInput
                                                style={styles.searchInput}
                                                placeholder="Search country / region"
                                                placeholderTextColor="#9CA3AF"
                                                value={searchQuery}
                                                onChangeText={setSearchQuery}
                                                autoFocus={false}
                                            />
                                        </View>
                                        <TouchableOpacity onPress={handleClosePicker} style={styles.cancelButton}>
                                            <Text style={styles.cancelButtonText}>Cancel</Text>
                                        </TouchableOpacity>
                                    </View>
                                    
                                    <FlatList
                                        data={filteredCountries.length > 0 ? filteredCountries : allCountries}
                                        renderItem={renderCountryItem}
                                        keyExtractor={(item) => item.cca2}
                                        style={styles.countryList}
                                        contentContainerStyle={styles.countryListContent}
                                        showsVerticalScrollIndicator={true}
                                        keyboardShouldPersistTaps="handled"
                                        ListEmptyComponent={
                                            <View style={styles.emptyContainer}>
                                                <Text style={styles.emptyText}>No countries found</Text>
                                            </View>
                                        }
                                    />
                                </Animated.View>
                            </PanGestureHandler>
                        </Pressable>
                    </GestureHandlerRootView>
                </Modal>

                {/* Confirmation Modal */}
                <Modal
                    visible={showConfirmationModal}
                    transparent
                    animationType="fade"
                    onRequestClose={handleGoBack}
                >
                    <Pressable style={styles.confirmationModalBackdrop} onPress={handleGoBack}>
                        <Pressable style={styles.confirmationModal} onPress={(e) => e.stopPropagation()}>
                            <Text style={styles.confirmationPhoneNumber}>
                                {getFlagEmoji(countryCode)} {formatPhoneNumberForDisplay()}
                            </Text>
                            <Text style={styles.confirmationQuestion}>
                                Is this number correct? We'll send you a confirmation code there
                            </Text>
                            <View style={styles.confirmationButtons}>
                                <TouchableOpacity style={styles.confirmButton} onPress={handleConfirmPhoneNumber}>
                                    <Text style={styles.confirmButtonText}>Confirm</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={styles.goBackButton} onPress={handleGoBack}>
                                    <Text style={styles.goBackButtonText}>Go back</Text>
                                </TouchableOpacity>
                            </View>
                        </Pressable>
                    </Pressable>
                </Modal>

                <View style={styles.loginLinkContainer}>
                    <Text style={styles.loginLinkText}>
                        Already have an account?{' '}
                        <Text style={styles.loginLinkButton} onPress={handleLogIn}>Log in</Text>
                    </Text>
                </View>

                <View style={{ flex: 1 }} />

                <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                    <OnboardingFooterButton
                        label="Create account"
                        onPress={handleCreateAccount}
                        disabled={!canCreateAccount}
                        size={buttonSize}
                        paddingVertical={buttonPaddingVertical}
                        variant={canCreateAccount ? "primary" : undefined}
                        backgroundColor={canCreateAccount ? undefined : "#6B7280"}
                        textColor={canCreateAccount ? undefined : BrandColors.white}
                    />
                </View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    container: { flex: 1 },
    headerContent: { paddingHorizontal: Spacing['2xl'], marginBottom: Spacing['3xl'] },
    title: { fontSize: FontSize['4xl'], fontFamily: FontFamily.bold, color: BrandColors.white, marginBottom: Spacing.md, lineHeight: 48 },
    subtitle: { fontSize: FontSize.lg, fontFamily: FontFamily.regular, color: BrandColors.white, opacity: 0.9, lineHeight: 24 },
    inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.1)', borderRadius: 12, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, marginBottom: Spacing.lg, marginHorizontal: Spacing['2xl'], borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)', overflow: 'hidden' },
    countryCodeContainer: { flexDirection: 'row', alignItems: 'center', marginRight: Spacing.md, paddingRight: Spacing.md, paddingLeft: Spacing.xs, borderRightWidth: 1, borderRightColor: 'rgba(255, 255, 255, 0.2)', overflow: 'hidden' },
    flagContainer: { width: 28, height: 20, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.xs, overflow: 'hidden' },
    countryCodeText: { fontSize: FontSize.lg, includeFontPadding: false, textAlignVertical: 'center', lineHeight: FontSize.lg },
    countryCodeNumber: { fontSize: FontSize.lg, fontFamily: FontFamily.medium, color: BrandColors.white },
    phoneInput: { flex: 1, fontSize: FontSize.lg, fontFamily: FontFamily.regular, color: BrandColors.white, paddingVertical: 0 },
    loginLinkContainer: { alignItems: 'center', paddingHorizontal: Spacing['2xl'], marginBottom: Spacing.xl },
    loginLinkText: { fontSize: FontSize.md, fontFamily: FontFamily.regular, color: BrandColors.white, opacity: 0.8 },
    loginLinkButton: { fontFamily: FontFamily.semiBold, color: '#60A5FA', opacity: 1 },
    bottomContainer: { paddingTop: Spacing.sm, paddingHorizontal: Spacing['2xl'] },
    bottomSheetBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
    bottomSheet: { backgroundColor: '#1F2937', borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '100%', paddingTop: Spacing.md },
    handleContainer: { paddingVertical: Spacing.sm, alignItems: 'center' },
    bottomSheetHandle: { width: 40, height: 4, backgroundColor: '#6B7280', borderRadius: 2, alignSelf: 'center', marginBottom: Spacing.md },
    bottomSheetHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md, gap: Spacing.md },
    searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#374151', borderRadius: 12, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderWidth: 1, borderColor: '#4B5563' },
    searchIcon: { marginRight: Spacing.xs },
    searchInput: { flex: 1, fontSize: FontSize.md, fontFamily: FontFamily.regular, color: BrandColors.white, paddingVertical: 0 },
    cancelButton: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.sm },
    cancelButtonText: { fontSize: FontSize.md, fontFamily: FontFamily.medium, color: BrandColors.white },
    countryList: { flex: 1 },
    countryListContent: { paddingBottom: Spacing.lg },
    countryItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderBottomWidth: 1, borderBottomColor: '#374151' },
    countryItemSelected: { backgroundColor: '#374151' },
    countryItemFlag: { width: 32, height: 24, justifyContent: 'center', alignItems: 'center', marginRight: Spacing.md },
    countryItemFlagText: { fontSize: 24 },
    countryItemCode: { fontSize: FontSize.md, fontFamily: FontFamily.medium, color: BrandColors.white, marginRight: Spacing.md, minWidth: 50 },
    countryItemName: { flex: 1, fontSize: FontSize.md, fontFamily: FontFamily.regular, color: BrandColors.white },
    emptyContainer: { padding: Spacing['2xl'], alignItems: 'center' },
    emptyText: { fontSize: FontSize.md, fontFamily: FontFamily.regular, color: '#9CA3AF' },
    confirmationModalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.7)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: Spacing.lg },
    confirmationModal: { backgroundColor: '#374151', borderRadius: 20, padding: Spacing['2xl'], width: '100%', maxWidth: 400 },
    confirmationPhoneNumber: { fontSize: FontSize['2xl'], fontFamily: FontFamily.bold, color: BrandColors.white, textAlign: 'center', marginBottom: Spacing.lg },
    confirmationQuestion: { fontSize: FontSize.md, fontFamily: FontFamily.regular, color: '#9CA3AF', textAlign: 'center', marginBottom: Spacing['2xl'], lineHeight: 22 },
    confirmationButtons: { gap: Spacing.md },
    confirmButton: { backgroundColor: BrandColors.white, borderRadius: 12, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, alignItems: 'center' },
    confirmButtonText: { fontSize: FontSize.lg, fontFamily: FontFamily.semiBold, color: '#000000' },
    goBackButton: { backgroundColor: '#374151', borderRadius: 12, paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, alignItems: 'center', borderWidth: 1, borderColor: '#4B5563' },
    goBackButtonText: { fontSize: FontSize.lg, fontFamily: FontFamily.semiBold, color: BrandColors.white },
});

