/**
 * PhoneNumber
 *
 * PURPOSE: Display the phone number entry screen for account creation.
 *
 * USED IN: app/(onboarding)/phone-number.tsx
 *
 * PROPS:
 *   - None (self-contained screen component)
 *
 * OWNER: Daniel Chelala
 */

// TODO: Fix choppiness of bottom sheet when dragging

import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { GradientBackground } from './GradientBackground';
import { useState } from 'react';
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
    PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler';
import { OnboardingProgress } from './OnboardingProgress';
import { OnboardingFooterButton } from './OnboardingFooterButton';
import { OnboardingBackButton } from './OnboardingBackButton';
import CountryPicker, { Country } from 'react-native-country-picker-modal';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
// Try to import getAllCountries from the library
let getAllCountries: ((locale?: string) => Promise<Country[]>) | undefined;
try {
    const countryPickerModule = require('react-native-country-picker-modal');
    getAllCountries = countryPickerModule.getAllCountries;
} catch (e) {
    // getAllCountries might not be exported
    console.log('getAllCountries not available in library');
}
import { Search } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';

export function PhoneNumber() {
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
    
    // Snap points: collapsed (85% height), expanded (0), dismissed (100% height)
    const COLLAPSED_POSITION = height * 0.15; // 15% from top = 85% height
    const EXPANDED_POSITION = 0;
    const DISMISSED_POSITION = height;
    
    // Load all countries from the library
    useEffect(() => {
        const loadCountries = async () => {
            try {
                // Try to use getAllCountries if available
                if (getAllCountries) {
                    const countries = await getAllCountries('en');
                    if (countries && Array.isArray(countries) && countries.length > 0) {
                        // Filter out countries without valid calling codes
                        const validCountries = countries.filter((c: Country) => 
                            c.callingCode && 
                            Array.isArray(c.callingCode) && 
                            c.callingCode.length > 0 && 
                            c.callingCode[0] && 
                            c.callingCode[0].trim() !== ''
                        );
                        setAllCountries(validCountries);
                        console.log('Loaded', validCountries.length, 'countries from library (filtered from', countries.length, ')');
                        return;
                    }
                }
                
                // Fallback: Use CountryPicker's internal data by creating a temporary instance
                // or use a comprehensive hardcoded list
                console.warn('Using comprehensive country list fallback');
                
                // Comprehensive list of countries with their calling codes
                const comprehensiveCountries = [
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
                    { cca2: 'IN', callingCode: ['91'], name: { common: 'India' } },
                    { cca2: 'CN', callingCode: ['86'], name: { common: 'China' } },
                    { cca2: 'JP', callingCode: ['81'], name: { common: 'Japan' } },
                    { cca2: 'KR', callingCode: ['82'], name: { common: 'South Korea' } },
                    { cca2: 'NL', callingCode: ['31'], name: { common: 'Netherlands' } },
                    { cca2: 'RU', callingCode: ['7'], name: { common: 'Russia' } },
                    { cca2: 'SA', callingCode: ['966'], name: { common: 'Saudi Arabia' } },
                    { cca2: 'AE', callingCode: ['971'], name: { common: 'United Arab Emirates' } },
                    { cca2: 'EG', callingCode: ['20'], name: { common: 'Egypt' } },
                    { cca2: 'ZA', callingCode: ['27'], name: { common: 'South Africa' } },
                    { cca2: 'NG', callingCode: ['234'], name: { common: 'Nigeria' } },
                    { cca2: 'KE', callingCode: ['254'], name: { common: 'Kenya' } },
                    { cca2: 'AR', callingCode: ['54'], name: { common: 'Argentina' } },
                    { cca2: 'CL', callingCode: ['56'], name: { common: 'Chile' } },
                    { cca2: 'CO', callingCode: ['57'], name: { common: 'Colombia' } },
                    { cca2: 'PE', callingCode: ['51'], name: { common: 'Peru' } },
                    { cca2: 'VE', callingCode: ['58'], name: { common: 'Venezuela' } },
                    { cca2: 'PL', callingCode: ['48'], name: { common: 'Poland' } },
                    { cca2: 'TR', callingCode: ['90'], name: { common: 'Turkey' } },
                    { cca2: 'GR', callingCode: ['30'], name: { common: 'Greece' } },
                    { cca2: 'PT', callingCode: ['351'], name: { common: 'Portugal' } },
                    { cca2: 'BE', callingCode: ['32'], name: { common: 'Belgium' } },
                    { cca2: 'CH', callingCode: ['41'], name: { common: 'Switzerland' } },
                    { cca2: 'AT', callingCode: ['43'], name: { common: 'Austria' } },
                    { cca2: 'SE', callingCode: ['46'], name: { common: 'Sweden' } },
                    { cca2: 'NO', callingCode: ['47'], name: { common: 'Norway' } },
                    { cca2: 'DK', callingCode: ['45'], name: { common: 'Denmark' } },
                    { cca2: 'FI', callingCode: ['358'], name: { common: 'Finland' } },
                    { cca2: 'IE', callingCode: ['353'], name: { common: 'Ireland' } },
                    { cca2: 'NZ', callingCode: ['64'], name: { common: 'New Zealand' } },
                    { cca2: 'SG', callingCode: ['65'], name: { common: 'Singapore' } },
                    { cca2: 'MY', callingCode: ['60'], name: { common: 'Malaysia' } },
                    { cca2: 'TH', callingCode: ['66'], name: { common: 'Thailand' } },
                    { cca2: 'PH', callingCode: ['63'], name: { common: 'Philippines' } },
                    { cca2: 'ID', callingCode: ['62'], name: { common: 'Indonesia' } },
                    { cca2: 'VN', callingCode: ['84'], name: { common: 'Vietnam' } },
                    { cca2: 'PK', callingCode: ['92'], name: { common: 'Pakistan' } },
                    { cca2: 'BD', callingCode: ['880'], name: { common: 'Bangladesh' } },
                    { cca2: 'LK', callingCode: ['94'], name: { common: 'Sri Lanka' } },
                    { cca2: 'IL', callingCode: ['972'], name: { common: 'Israel' } },
                    { cca2: 'IR', callingCode: ['98'], name: { common: 'Iran' } },
                    { cca2: 'IQ', callingCode: ['964'], name: { common: 'Iraq' } },
                    { cca2: 'JO', callingCode: ['962'], name: { common: 'Jordan' } },
                    { cca2: 'LB', callingCode: ['961'], name: { common: 'Lebanon' } },
                    { cca2: 'KW', callingCode: ['965'], name: { common: 'Kuwait' } },
                    { cca2: 'QA', callingCode: ['974'], name: { common: 'Qatar' } },
                    { cca2: 'BH', callingCode: ['973'], name: { common: 'Bahrain' } },
                    { cca2: 'OM', callingCode: ['968'], name: { common: 'Oman' } },
                    { cca2: 'YE', callingCode: ['967'], name: { common: 'Yemen' } },
                    { cca2: 'AF', callingCode: ['93'], name: { common: 'Afghanistan' } },
                    { cca2: 'KZ', callingCode: ['7'], name: { common: 'Kazakhstan' } },
                    { cca2: 'UZ', callingCode: ['998'], name: { common: 'Uzbekistan' } },
                    { cca2: 'UA', callingCode: ['380'], name: { common: 'Ukraine' } },
                    { cca2: 'RO', callingCode: ['40'], name: { common: 'Romania' } },
                    { cca2: 'HU', callingCode: ['36'], name: { common: 'Hungary' } },
                    { cca2: 'CZ', callingCode: ['420'], name: { common: 'Czech Republic' } },
                    { cca2: 'SK', callingCode: ['421'], name: { common: 'Slovakia' } },
                    { cca2: 'BG', callingCode: ['359'], name: { common: 'Bulgaria' } },
                    { cca2: 'HR', callingCode: ['385'], name: { common: 'Croatia' } },
                    { cca2: 'RS', callingCode: ['381'], name: { common: 'Serbia' } },
                    { cca2: 'SI', callingCode: ['386'], name: { common: 'Slovenia' } },
                    { cca2: 'EE', callingCode: ['372'], name: { common: 'Estonia' } },
                    { cca2: 'LV', callingCode: ['371'], name: { common: 'Latvia' } },
                    { cca2: 'LT', callingCode: ['370'], name: { common: 'Lithuania' } },
                    { cca2: 'IS', callingCode: ['354'], name: { common: 'Iceland' } },
                    { cca2: 'LU', callingCode: ['352'], name: { common: 'Luxembourg' } },
                    { cca2: 'MT', callingCode: ['356'], name: { common: 'Malta' } },
                    { cca2: 'CY', callingCode: ['357'], name: { common: 'Cyprus' } },
                    { cca2: 'CR', callingCode: ['506'], name: { common: 'Costa Rica' } },
                    { cca2: 'PA', callingCode: ['507'], name: { common: 'Panama' } },
                    { cca2: 'GT', callingCode: ['502'], name: { common: 'Guatemala' } },
                    { cca2: 'HN', callingCode: ['504'], name: { common: 'Honduras' } },
                    { cca2: 'SV', callingCode: ['503'], name: { common: 'El Salvador' } },
                    { cca2: 'NI', callingCode: ['505'], name: { common: 'Nicaragua' } },
                    { cca2: 'DO', callingCode: ['1'], name: { common: 'Dominican Republic' } },
                    { cca2: 'CU', callingCode: ['53'], name: { common: 'Cuba' } },
                    { cca2: 'JM', callingCode: ['1'], name: { common: 'Jamaica' } },
                    { cca2: 'TT', callingCode: ['1'], name: { common: 'Trinidad and Tobago' } },
                    { cca2: 'EC', callingCode: ['593'], name: { common: 'Ecuador' } },
                    { cca2: 'BO', callingCode: ['591'], name: { common: 'Bolivia' } },
                    { cca2: 'PY', callingCode: ['595'], name: { common: 'Paraguay' } },
                    { cca2: 'UY', callingCode: ['598'], name: { common: 'Uruguay' } },
                    { cca2: 'GH', callingCode: ['233'], name: { common: 'Ghana' } },
                    { cca2: 'ET', callingCode: ['251'], name: { common: 'Ethiopia' } },
                    { cca2: 'TZ', callingCode: ['255'], name: { common: 'Tanzania' } },
                    { cca2: 'UG', callingCode: ['256'], name: { common: 'Uganda' } },
                    { cca2: 'AO', callingCode: ['244'], name: { common: 'Angola' } },
                    { cca2: 'MZ', callingCode: ['258'], name: { common: 'Mozambique' } },
                    { cca2: 'ZM', callingCode: ['260'], name: { common: 'Zambia' } },
                    { cca2: 'ZW', callingCode: ['263'], name: { common: 'Zimbabwe' } },
                    { cca2: 'MA', callingCode: ['212'], name: { common: 'Morocco' } },
                    { cca2: 'DZ', callingCode: ['213'], name: { common: 'Algeria' } },
                    { cca2: 'TN', callingCode: ['216'], name: { common: 'Tunisia' } },
                    { cca2: 'LY', callingCode: ['218'], name: { common: 'Libya' } },
                    { cca2: 'SD', callingCode: ['249'], name: { common: 'Sudan' } },
                    { cca2: 'MM', callingCode: ['95'], name: { common: 'Myanmar' } },
                    { cca2: 'KH', callingCode: ['855'], name: { common: 'Cambodia' } },
                    { cca2: 'LA', callingCode: ['856'], name: { common: 'Laos' } },
                    { cca2: 'MN', callingCode: ['976'], name: { common: 'Mongolia' } },
                    { cca2: 'NP', callingCode: ['977'], name: { common: 'Nepal' } },
                    { cca2: 'BT', callingCode: ['975'], name: { common: 'Bhutan' } },
                    { cca2: 'MV', callingCode: ['960'], name: { common: 'Maldives' } },
                    { cca2: 'BN', callingCode: ['673'], name: { common: 'Brunei' } },
                    { cca2: 'FJ', callingCode: ['679'], name: { common: 'Fiji' } },
                    { cca2: 'PG', callingCode: ['675'], name: { common: 'Papua New Guinea' } },
                    { cca2: 'NC', callingCode: ['687'], name: { common: 'New Caledonia' } },
                    { cca2: 'PF', callingCode: ['689'], name: { common: 'French Polynesia' } },
                ];
                setAllCountries(comprehensiveCountries as Country[]);
            } catch (error) {
                console.error('Error loading countries:', error);
                // Ultimate fallback to common countries
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
            }
        };
        loadCountries();
    }, []);
    
    // Filter countries based on search
    const filteredCountries = useMemo(() => {
        if (allCountries.length === 0) return [];
        
        // Filter out countries without valid calling codes
        const validCountries = allCountries.filter((c: Country) => 
            c.callingCode && 
            Array.isArray(c.callingCode) && 
            c.callingCode.length > 0 && 
            c.callingCode[0] && 
            c.callingCode[0].trim() !== ''
        );
        
        if (validCountries.length === 0) return [];
        
        if (!searchQuery.trim()) {
            // Put US first, then rest
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
    
    // Animate bottom sheet to initial position
    useEffect(() => {
        if (showCountryPicker) {
            // Reset to off-screen position first, then animate to collapsed position
            slideAnim.setValue(height);
            panY.setValue(0);
            setSheetPosition('collapsed');
            // Use requestAnimationFrame to ensure the reset happens before animation
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
    
    // Handle gesture for dragging the sheet
    const handleGestureEvent = Animated.event(
        [{ nativeEvent: { translationY: panY } }],
        { useNativeDriver: true }
    );
    
    const handleGestureStateChange = (event: any) => {
        if (event.nativeEvent.oldState === State.ACTIVE) {
            const { translationY, velocityY } = event.nativeEvent;
            
            // Get the current visual position (where the sheet actually is right now)
            // Use the tracked current position plus the translation
            const currentVisualPosition = currentSlidePosition.current + translationY;
            
            // Determine target position based on drag distance and velocity
            let targetPosition = COLLAPSED_POSITION;
            let newPosition: 'collapsed' | 'expanded' | 'dismissed' = 'collapsed';
            
            if (velocityY < -500 || (translationY < -100 && currentVisualPosition < COLLAPSED_POSITION / 2)) {
                // Drag up: expand to full screen
                targetPosition = EXPANDED_POSITION;
                newPosition = 'expanded';
            } else if (velocityY > 500 || (translationY > 100 && currentVisualPosition > COLLAPSED_POSITION + 50)) {
                // Drag down: dismiss
                targetPosition = DISMISSED_POSITION;
                newPosition = 'dismissed';
                handleClosePicker();
            } else {
                // Snap back to collapsed
                targetPosition = COLLAPSED_POSITION;
                newPosition = 'collapsed';
            }
            
            // Update slideAnim to the current visual position before resetting panY
            // This prevents the jump back
            slideAnim.setValue(currentVisualPosition);
            panY.setValue(0);
            setSheetPosition(newPosition);
            
            // Now animate from the current position to the target
            Animated.spring(slideAnim, {
                toValue: targetPosition,
                useNativeDriver: true,
                tension: 40,
                friction: 8,
            }).start();
        }
    };
    
    // Combine slideAnim and panY for smooth dragging
    const translateY = Animated.add(
        slideAnim,
        panY
    );

    // Dynamic styles (safe area insets are device-specific and must be computed at runtime)
    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    const handleCreateAccount = () => {
        // Show confirmation modal
        setShowConfirmationModal(true);
    };
    
    const handleConfirmPhoneNumber = () => {
        // Store phone number in onboarding store
        const fullPhoneNumber = `+${getCallingCode()}${phoneNumber.replace(/\D/g, '')}`;
        updateData({ phoneNumber: fullPhoneNumber });
        
        setShowConfirmationModal(false);
        // Navigate to confirmation screen
        router.push('/(onboarding)/confirm-phone-number');
    };
    
    const handleGoBack = () => {
        setShowConfirmationModal(false);
    };
    
    // Format phone number for display (e.g., "+1 650 213 7390")
    const formatPhoneNumberForDisplay = () => {
        const callingCode = getCallingCode();
        const cleaned = phoneNumber.replace(/\D/g, ''); // Remove non-digits
        if (cleaned.length === 0) return `+${callingCode}`;
        
        // Format US/Canada numbers: +1 650 213 7390
        if (callingCode === '1' && cleaned.length === 10) {
            return `+${callingCode} ${cleaned.slice(0, 3)} ${cleaned.slice(3, 6)} ${cleaned.slice(6)}`;
        }
        // For other countries, just add spaces every 3-4 digits
        const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
        return `+${callingCode} ${formatted}`;
    };

    const handleLogIn = () => {
        // TODO: Navigate to login screen
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
                style={[
                    styles.countryItem,
                    isSelected && styles.countryItemSelected,
                ]}
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

    // Get flag emoji from country code
    const getFlagEmoji = (code: string) => {
        // Convert country code to flag emoji (e.g., 'US' -> 🇺🇸)
        // Regional Indicator Symbols: A=0x1F1E6, Z=0x1F1FF
        if (code && code.length === 2) {
            try {
                const codePoints = code
                    .toUpperCase()
                    .split('')
                    .map(char => 0x1F1E6 + (char.charCodeAt(0) - 65));
                return String.fromCodePoint(...codePoints);
            } catch (e) {
                // Fallback to default if conversion fails
                return '🇺🇸';
            }
        }
        // Default to US flag
        return '🇺🇸';
    };

    // Get calling code from country
    const getCallingCode = () => {
        if (country?.callingCode && country.callingCode.length > 0) {
            return country.callingCode[0];
        }
        return '1';
    };

    const canCreateAccount = phoneNumber.trim().length > 0;

    return (
        <GradientBackground>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardView}
            >
                <View style={[styles.container, dynamicStyles.container]}>
                    

                    <OnboardingProgress total={4} filled={1} leftElement={<OnboardingBackButton />} />
                    {/* Header Content */}
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>
                            Let's get started!
                        </Text>
                        <Text style={styles.subtitle}>
                            Enter your phone number. We will send you a confirmation code there
                        </Text>
                    </View>

                    {/* Phone Number Input */}
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
                                        {/* Handle bar - draggable area */}
                                        <View style={styles.handleContainer}>
                                            <View style={styles.bottomSheetHandle} />
                                        </View>
                                        
                                        {/* Header with search */}
                                        <View style={styles.bottomSheetHeader}>
                                            <View style={styles.searchContainer}>
                                                <Search
                                                    size={20}
                                                    color="#9CA3AF"
                                                    style={styles.searchIcon}
                                                />
                                                <TextInput
                                                    style={styles.searchInput}
                                                    placeholder="Search country / region"
                                                    placeholderTextColor="#9CA3AF"
                                                    value={searchQuery}
                                                    onChangeText={setSearchQuery}
                                                    autoFocus={false}
                                                />
                                            </View>
                                            <TouchableOpacity
                                                onPress={handleClosePicker}
                                                style={styles.cancelButton}
                                            >
                                                <Text style={styles.cancelButtonText}>
                                                    Cancel
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                        
                                        {/* Country list */}
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
                                                    <Text style={styles.emptyText}>
                                                        No countries found
                                                    </Text>
                                                </View>
                                            }
                                        />
                                    </Animated.View>
                                </PanGestureHandler>
                            </Pressable>
                        </GestureHandlerRootView>
                    </Modal>

                    {/* Phone Number Confirmation Modal */}
                    <Modal
                        visible={showConfirmationModal}
                        transparent
                        animationType="fade"
                        onRequestClose={handleGoBack}
                    >
                        <Pressable
                            style={styles.confirmationModalBackdrop}
                            onPress={handleGoBack}
                        >
                            <Pressable
                                style={styles.confirmationModal}
                                onPress={(e) => e.stopPropagation()}
                            >
                                {/* Phone Number Display */}
                                <Text style={styles.confirmationPhoneNumber}>
                                    {getFlagEmoji(countryCode)} {formatPhoneNumberForDisplay()}
                                </Text>
                                
                                {/* Confirmation Question */}
                                <Text style={styles.confirmationQuestion}>
                                    Is this number correct? We'll send you a confirmation code there
                                </Text>
                                
                                {/* Action Buttons */}
                                <View style={styles.confirmationButtons}>
                                    <TouchableOpacity
                                        style={styles.confirmButton}
                                        onPress={handleConfirmPhoneNumber}
                                    >
                                        <Text style={styles.confirmButtonText}>
                                            Confirm
                                        </Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity
                                        style={styles.goBackButton}
                                        onPress={handleGoBack}
                                    >
                                        <Text style={styles.goBackButtonText}>
                                            Go back
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            </Pressable>
                        </Pressable>
                    </Modal>

                    {/* Login Link */}
                    <View style={styles.loginLinkContainer}>
                        <Text style={styles.loginLinkText}>
                            Already have an account?{' '}
                            <Text style={styles.loginLinkButton} onPress={handleLogIn}>
                                Log in
                            </Text>
                        </Text>
                    </View>

                    {/* Spacer */}
                    <View style={{ flex: 1 }} />

                    {/* Create Account Button */}
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
        </GradientBackground>
    );
}

const styles = StyleSheet.create({
    keyboardView: {
        flex: 1,
    },
    container: {
        flex: 1,
    },
    backButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    headerContent: {
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing['3xl'],
    },
    title: {
        fontSize: FontSize['4xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.white,
        marginBottom: Spacing.md,
        lineHeight: 48,
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.9,
        lineHeight: 24,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        marginBottom: Spacing.lg,
        marginHorizontal: Spacing['2xl'],
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
        overflow: 'hidden',
    },
    countryCodeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginRight: Spacing.md,
        paddingRight: Spacing.md,
        paddingLeft: Spacing.xs,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255, 255, 255, 0.2)',
        overflow: 'hidden',
    },
    flagContainer: {
        width: 28,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.xs,
        overflow: 'hidden',
    },
    countryCodeText: {
        fontSize: FontSize.lg,
        includeFontPadding: false,
        textAlignVertical: 'center',
        lineHeight: FontSize.lg,
    },
    countryCodeNumber: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.medium,
        color: BrandColors.white,
    },
    phoneInput: {
        flex: 1,
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        paddingVertical: 0,
    },
    loginLinkContainer: {
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing.xl,
    },
    loginLinkText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.8,
    },
    loginLinkButton: {
        fontFamily: FontFamily.semiBold,
        color: '#60A5FA', // Light blue for link
        opacity: 1,
    },
    bottomContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
    },
    bottomSheetBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    bottomSheet: {
        backgroundColor: '#1F2937',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '100%',
        paddingTop: Spacing.md,
    },
    handleContainer: {
        paddingVertical: Spacing.sm,
        alignItems: 'center',
    },
    bottomSheetHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#6B7280',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: Spacing.md,
    },
    bottomSheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingBottom: Spacing.md,
        gap: Spacing.md,
    },
    searchContainer: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#374151',
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        borderWidth: 1,
        borderColor: '#4B5563',
    },
    searchIcon: {
        marginRight: Spacing.xs,
    },
    searchInput: {
        flex: 1,
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        paddingVertical: 0,
    },
    cancelButton: {
        paddingVertical: Spacing.sm,
        paddingHorizontal: Spacing.sm,
    },
    cancelButtonText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.medium,
        color: BrandColors.white,
    },
    countryList: {
        flex: 1,
    },
    countryListContent: {
        paddingBottom: Spacing.lg,
    },
    countryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: '#374151',
    },
    countryItemSelected: {
        backgroundColor: '#374151',
    },
    countryItemFlag: {
        width: 32,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: Spacing.md,
    },
    countryItemFlagText: {
        fontSize: 24,
    },
    countryItemCode: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.medium,
        color: BrandColors.white,
        marginRight: Spacing.md,
        minWidth: 50,
    },
    countryItemName: {
        flex: 1,
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
    },
    emptyContainer: {
        padding: Spacing['2xl'],
        alignItems: 'center',
    },
    emptyText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: '#9CA3AF',
    },
    confirmationModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
    },
    confirmationModal: {
        backgroundColor: '#374151',
        borderRadius: 20,
        padding: Spacing['2xl'],
        width: '100%',
        maxWidth: 400,
    },
    confirmationPhoneNumber: {
        fontSize: FontSize['2xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.white,
        textAlign: 'center',
        marginBottom: Spacing.lg,
    },
    confirmationQuestion: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: Spacing['2xl'],
        lineHeight: 22,
    },
    confirmationButtons: {
        gap: Spacing.md,
    },
    confirmButton: {
        backgroundColor: BrandColors.white,
        borderRadius: 12,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
    },
    confirmButtonText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semiBold,
        color: '#000000',
    },
    goBackButton: {
        backgroundColor: '#374151',
        borderRadius: 12,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.lg,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#4B5563',
    },
    goBackButtonText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semiBold,
        color: BrandColors.white,
    },
});

