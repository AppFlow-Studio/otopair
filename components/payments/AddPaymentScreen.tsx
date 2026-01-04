/**
 * AddPaymentScreen
 *
 * PURPOSE: Component for adding a new payment method.
 *          Stylized with a static card preview and a modern form.
 *
 * USED IN: app/add-payment.tsx
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React, { useState, useEffect } from 'react';
import {
    Dimensions,
    StyleSheet,
    TouchableOpacity,
    View,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { 
    ArrowLeft, 
    Check
} from 'lucide-react-native';
import { 
    useSharedValue, 
} from 'react-native-reanimated';
import { 
    Text, 
    BrandColors, 
    Spacing, 
    AnimatedGradientBackground,
    GlassCircleButton,
    Input,
    PrimaryButton,
} from '@/components/shared-ui';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { PaymentIcon } from 'react-native-payment-icons'
import creditCardType from 'credit-card-type';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.9;
const CARD_HEIGHT = 220;

export function AddPaymentScreen() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    
    // Background animation progress (static for this screen)
    const bgProgress = useSharedValue(0);
    
    // Form state
    const [fullName, setFullName] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [expiryDate, setExpiryDate] = useState('');
    const [cvv, setCvv] = useState('');
    const [saveCard, setSaveCard] = useState(true);
    const [agreeTerms, setAgreeTerms] = useState(false);
    
    // Card brand detection state
    const [cardBrand, setCardBrand] = useState<string>('generic');
    const [cardNiceType, setCardNiceType] = useState<string>('');
    const [cvvLength, setCvvLength] = useState<number>(3);

    // Initial detection for prepopulated card numbers
    useEffect(() => {
        if (cardNumber) {
            handleCardNumberChange(cardNumber);
        }
    }, []);

    // Detect card type when number changes
    const handleCardNumberChange = (text: string) => {
        // Remove all non-digits for detection
        const normalized = text.replace(/\D/g, '');
        
        // Detect type
        const results = creditCardType(normalized);
        const detected = results.length === 1 ? results[0] : null;
        
        // Determine max length (default to 19 if no type detected)
        const maxLength = detected ? detected.lengths[detected.lengths.length - 1] : 19;
        const trimmed = normalized.slice(0, maxLength);
        
        if (detected) {
            // Map detected type to PaymentIcon keys
            let mappedBrand = detected.type;
            if (mappedBrand === 'american-express') mappedBrand = 'amex';
            if (mappedBrand === 'diners-club') mappedBrand = 'diners';
            if (mappedBrand === 'mastercard') mappedBrand = 'mastercard';
            
            setCardBrand(mappedBrand);
            setCardNiceType(detected.niceType);
            setCvvLength(detected.code.size);
            
            // Format with gaps
            let formatted = '';
            let lastGap = 0;
            const gaps = detected.gaps;
            
            gaps.forEach((gap) => {
                if (trimmed.length > gap) {
                    formatted += trimmed.slice(lastGap, gap) + ' ';
                    lastGap = gap;
                }
            });
            formatted += trimmed.slice(lastGap);
            setCardNumber(formatted.trim());
        } else {
            // Ambiguous or no match
            setCardBrand('generic');
            setCardNiceType('');
            setCvvLength(3);
            
            // Simple 4-4-4-4 formatting for generic
            const genericFormatted = trimmed.replace(/(.{4})/g, '$1 ').trim();
            setCardNumber(genericFormatted);
        }
    };

    // Format expiry date as MM/YYYY
    const handleExpiryDateChange = (text: string) => {
        // Remove all non-digits
        const cleanText = text.replace(/\D/g, '');
        
        // If user is deleting (new text is shorter than old state), just set it
        if (text.length < expiryDate.length) {
            setExpiryDate(text);
            return;
        }

        let formatted = cleanText;

        // 1. Month Validation (01-12)
        if (cleanText.length === 1) {
            const digit = parseInt(cleanText);
            if (digit > 1) {
                // If user types 2-9, auto-format to 02-09
                formatted = `0${digit}/`;
            }
        } else if (cleanText.length >= 2) {
            let mm = parseInt(cleanText.slice(0, 2));
            if (mm > 12) mm = 12;
            if (mm === 0) mm = 1; // Don't allow 00
            
            const mmStr = mm.toString().padStart(2, '0');
            const yyyyPart = cleanText.slice(2, 6);

            // 2. Year Validation (current year or later)
            if (yyyyPart.length === 4) {
                const currentYear = new Date().getFullYear();
                let yyyy = parseInt(yyyyPart);
                if (yyyy < currentYear) yyyy = currentYear;
                formatted = `${mmStr}/${yyyy}`;
            } else {
                formatted = `${mmStr}/${yyyyPart}`;
            }
        }

        setExpiryDate(formatted);
    };

    return (
        <View style={styles.container}>
            {/* Background Gradient */}
            <View style={StyleSheet.absoluteFill}>
                <AnimatedGradientBackground 
                    progress={bgProgress} 
                    fromIndex={0} 
                    toIndex={0}
                    colors={[BrandColors.secondary, BrandColors.secondary, '#f4f1f8']}
                />
            </View>

            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <GlassCircleButton 
                    size={40} 
                    onPress={() => router.back()}
                >
                    <ArrowLeft size={20} color="#FFF" strokeWidth={2.5} />
                </GlassCircleButton>
                <Text weight="semiBold" size="xl" color="#FFF" style={styles.headerTitle}>Add New Payment</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={{ flex: 1 }}
            >
                <ScrollView 
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
                >
                    {/* Card Preview */}
                    <View style={styles.cardPreviewContainer}>
                        <LinearGradient
                            colors={['#374151', '#111827']}
                            start={{ x: 1, y: 0 }}
                            end={{ x: 0, y: 0 }}
                            style={StyleSheet.absoluteFill}
                        />
                        <View style={styles.cardOverlay}>
                            <Text weight="bold" size="xl" color="#FFF" style={styles.cardBrand}>Vital</Text>
                            
                            <View style={styles.chipContainer}>
                                <MaterialCommunityIcons name="credit-card-chip" size={36} color={'white'} />
                            </View>

                            <View style={styles.cardBottom}>
                                <Text weight="medium" size="md" color="#FFF">{fullName || 'John Doe'}</Text>
                                <PaymentIcon type={cardBrand as any} width={50}/>
                            </View>
                        </View>
                    </View>

                    {/* Form Container */}
                    <View style={styles.formContainer}>
                        <View style={styles.inputSpacing}>
                            <Text weight="medium" size="sm" color="#1F2937" style={styles.label}>Full Name</Text>
                            <Input
                                value={fullName}
                                onChangeText={setFullName}
                                placeholder="John Doe"
                            />
                        </View>

                        <View style={styles.inputSpacing}>
                            <Text weight="medium" size="sm" color="#1F2937" style={styles.label}>Card Number</Text>
                            <Input
                                value={cardNumber}
                                onChangeText={handleCardNumberChange}
                                placeholder="0000 0000 0000 0000"
                                keyboardType="numeric"
                                rightElement={cardNiceType ? <Text weight="bold" color="#2563EB" style={{ marginRight: 8 }}>{cardNiceType.toUpperCase()}</Text> : undefined}
                            />
                        </View>

                        <View style={styles.row}>
                            <View style={[styles.inputSpacing, { flex: 1 }]}>
                                <Text weight="medium" size="sm" color="#1F2937" style={styles.label}>Expiry Date</Text>
                                <Input
                                    value={expiryDate}
                                    onChangeText={handleExpiryDateChange}
                                    placeholder="MM/YYYY"
                                    keyboardType="numeric"
                                    maxLength={7}
                                />
                            </View>
                            <View style={{ width: 16 }} />
                            <View style={[styles.inputSpacing, { flex: 1 }]}>
                                <Text weight="medium" size="sm" color="#1F2937" style={styles.label}>CVV</Text>
                                <Input
                                    value={cvv}
                                    onChangeText={(text) => setCvv(text.replace(/\D/g, '').slice(0, cvvLength))}
                                    placeholder={'0'.repeat(cvvLength)}
                                    keyboardType="numeric"
                                    maxLength={cvvLength}
                                />
                            </View>
                        </View>

                        {/* Checkboxes */}
                        <TouchableOpacity 
                            style={styles.checkboxRow}
                            onPress={() => setSaveCard(!saveCard)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, saveCard ? styles.checkboxActive : null]}>{saveCard ? <Check size={12} color="#FFF" strokeWidth={3} /> : null}</View><Text size="sm" color="#4B5563">Save card info</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={styles.checkboxRow}
                            onPress={() => setAgreeTerms(!agreeTerms)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.checkbox, agreeTerms ? styles.checkboxActive : null]}>{agreeTerms ? <Check size={12} color="#FFF" strokeWidth={3} /> : null}</View><Text size="sm" color="#4B5563">Agree to <Text color="#3B82F6" weight="medium">terms and conditions</Text></Text>
                        </TouchableOpacity>

                        {/* Submit Button */}
                        <PrimaryButton 
                            style={styles.submitButton}
                            onPress={() => console.log('Add Card')}
                        >
                            Add Card
                        </PrimaryButton>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#1E3A8A',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        height: 100,
        zIndex: 10,
    },
    headerTitle: {
        flex: 1,
        textAlign: 'center',
    },
    scrollContent: {
        paddingHorizontal: 20,
        paddingTop: 20,
    },
    cardPreviewContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        alignSelf: 'center',
        marginBottom: 30,
        borderRadius: 24, // More rounded like a credit card
        overflow: 'hidden',
        // Shadow for the card preview
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15,
        elevation: 10,
    },
    cardOverlay: {
        ...StyleSheet.absoluteFillObject,
        padding: 24,
        justifyContent: 'space-between',
    },
    cardBrand: {
        fontSize: 28,
    },
    chipContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    formContainer: {
        // Transparent white container similar to ActivityRewardsScreen
        backgroundColor: 'rgba(255, 255, 255, 0.85)',
        borderRadius: 24,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
    },
    label: {
        marginBottom: 4, // Spacing between label and input
    },
    inputSpacing: {
        marginBottom: 20,
    },
    row: {
        flexDirection: 'row',
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        borderWidth: 2,
        borderColor: '#3B82F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxActive: {
        backgroundColor: '#3B82F6',
    },
    submitButton: {
        marginTop: 10,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#111827', // Very dark blue/black like in the screenshot
    },
});

export default AddPaymentScreen;
