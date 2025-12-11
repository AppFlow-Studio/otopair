/**
 * VinCapture
 *
 * PURPOSE: Collect vehicle VIN (manual or barcode) and optional mileage.
 *
 * USED IN: app/(onboarding)/vin.tsx
 *
 * PATH: Pro flow (VIN capture)
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import {
    BorderRadius,
    BrandColors,
    Colors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { OnboardingFooterButton } from './OnboardingFooterButton';
import { OnboardingBackButton } from './OnboardingBackButton';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { router } from 'expo-router';
import { Camera } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useMemo, useState, useRef, useEffect } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Keyboard,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    TextInput,
    View,
    Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const VIN_LENGTH = 17;
const VIN_INVALID_CHARS = /[IOQ]/i;

const normalizeVin = (value: string) =>
    value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();

const isValidVin = (value: string) =>
    value.length === VIN_LENGTH && !VIN_INVALID_CHARS.test(value);

export function VinCapture() {
    const insets = useSafeAreaInsets();
    const { updateData } = useOnboardingStore();
    const scrollViewRef = useRef<ScrollView>(null);
    const inputRefs = useRef<{ [key: string]: TextInput | null }>({});
    const [vin, setVin] = useState('');
    const [mileage, setMileage] = useState('');
    const [make, setMake] = useState('');
    const [model, setModel] = useState('');
    const [year, setYear] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);
    const [focusedInput, setFocusedInput] = useState<string | null>(null);

    const vinDisplayError = useMemo(() => {
        if (!vin) return null;
        if (vin.length !== VIN_LENGTH) return 'VIN must be exactly 17 characters';
        if (VIN_INVALID_CHARS.test(vin)) return 'VIN cannot contain I, O, or Q';
        return null;
    }, [vin]);

    const handleScan = ({ data }: { data: string }) => {
        if (scanned) return;
        setScanned(true);
        const normalized = normalizeVin(data);
        setVin(normalized);
        setScannerVisible(false);
    };

    const requestCamera = async () => {
        if (permission?.granted) {
            setScanned(false);
            setScannerVisible(true);
            return;
        }
        const result = await requestPermission();
        if (result.granted) {
            setScanned(false);
            setScannerVisible(true);
        } else {
            Alert.alert(
                'Camera permission needed',
                'Please enable camera access to scan your VIN.'
            );
        }
    };

    const parseMileage = () => {
        if (!mileage.trim()) return null;
        const num = Number(mileage);
        if (Number.isNaN(num)) return null;
        return num;
    };

    const mileageError = useMemo(() => {
        if (!mileage.trim()) return null;
        const num = Number(mileage);
        if (Number.isNaN(num)) return 'Mileage must be a number';
        if (num < 0 || num > 500000) return 'Mileage must be between 0 and 500,000';
        return null;
    }, [mileage]);

    const yearError = useMemo(() => {
        if (!year.trim()) return null;
        const num = Number(year);
        if (Number.isNaN(num)) return 'Year must be a number';
        const currentYear = new Date().getFullYear();
        if (num < 1900 || num > currentYear + 1) {
            return `Year must be between 1900 and ${currentYear + 1}`;
        }
        return null;
    }, [year]);

    // Scroll to input when keyboard appears
    useEffect(() => {
        const keyboardEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
        const listener = Keyboard.addListener(keyboardEvent, () => {
            scrollToFocusedInput();
        });

        return () => {
            listener.remove();
        };
    }, [focusedInput]);

    const scrollToFocusedInput = () => {
        if (!focusedInput || !inputRefs.current[focusedInput]) return;
        
        const input = inputRefs.current[focusedInput];
        input.measureLayout(
            scrollViewRef.current as any,
            (x: number, y: number) => {
                // y is the position relative to the ScrollView content
                // Scroll to show the input with padding above it (150px)
                const scrollOffset = Math.max(0, y - 150);
                scrollViewRef.current?.scrollTo({
                    y: scrollOffset,
                    animated: true,
                });
            },
            () => {
                // Fallback: if measureLayout fails, try scrollToEnd for lower inputs
                if (focusedInput === 'year' || focusedInput === 'model') {
                    scrollViewRef.current?.scrollToEnd({ animated: true });
                }
            }
        );
    };

    const handleInputFocus = (inputName: string) => {
        setFocusedInput(inputName);
        // Delay to allow layout to complete and keyboard to start appearing
        setTimeout(() => {
            scrollToFocusedInput();
        }, 300);
    };

    const callCarFax = async (vinValue: string, mileageValue: number | null) => {
        // Placeholder integration: replace with real endpoint when available.
        // Simulate network delay and success.
        await new Promise((resolve) => setTimeout(resolve, 800));
        return {
            vehicle: { vin: vinValue },
            mileage: mileageValue,
            records: [],
        };
    };

    const handleContinue = async () => {
        const normalizedVin = normalizeVin(vin);
        setVin(normalizedVin);
        
        // VIN must be either empty or valid (no partial entries)
        const vinTrimmed = normalizedVin.trim();
        if (vinTrimmed && !isValidVin(vinTrimmed)) {
            setError('Please enter a valid 17-character VIN (no I, O, or Q), or leave it empty.');
            return;
        }
        
        // Mileage must be either empty or valid (no partial/invalid entries)
        if (mileageError) {
            setError(mileageError);
            return;
        }

        // Year must be either empty or valid (no partial/invalid entries)
        if (yearError) {
            setError(yearError);
            return;
        }

        setError(null);
        setLoading(true);
        try {
            const mileageVal = parseMileage();
            const finalVin = vinTrimmed || null;
            const makeTrimmed = make.trim() || null;
            const modelTrimmed = model.trim() || null;
            const yearTrimmed = year.trim();
            const yearVal = yearTrimmed ? Number(yearTrimmed) : null;
            
            updateData({
                vehicleVin: finalVin,
                vehicleMileage: mileageVal,
                vehicleMake: makeTrimmed,
                vehicleModel: modelTrimmed,
                vehicleYear: yearVal,
            });

            // Call CarFax only if VIN is provided
            if (finalVin) {
                await callCarFax(finalVin, mileageVal);
            }

            router.replace('/(main-tabs)');
        } catch (err: any) {
            setError(
                err?.message ||
                    'Unable to retrieve service history. You can continue without history.'
            );
        } finally {
            setLoading(false);
        }
    };

    // Allow continue if: (VIN is empty OR valid) AND (mileage is empty OR valid) AND (year is empty OR valid)
    const canContinue = (() => {
        const vinTrimmed = vin.trim();
        const mileageTrimmed = mileage.trim();
        const yearTrimmed = year.trim();
        
        const vinValid = vinTrimmed === '' || isValidVin(vinTrimmed);
        const mileageValid = mileageTrimmed === '' || !mileageError;
        const yearValid = yearTrimmed === '' || !yearError;
        
        return vinValid && mileageValid && yearValid && !loading;
    })();

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg },
            ]}
        >
            <View style={styles.backButtonContainer}>
                <OnboardingBackButton />
            </View>
            <KeyboardAvoidingView
                style={styles.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <ScrollView
                    ref={scrollViewRef}
                    style={styles.flex}
                    contentContainerStyle={[
                        styles.scrollContent,
                        { paddingBottom: insets.bottom + Spacing['3xl'] },
                    ]}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={true}
                >
                    <Text style={styles.title}>Vehicle Information</Text>
                    <Text style={styles.label}>VIN (optional)</Text>
                    <TextInput
                        ref={(ref) => { inputRefs.current['vin'] = ref; }}
                        style={[styles.input, vinDisplayError && styles.inputError]}
                        placeholder="Enter VIN"
                        placeholderTextColor="#7a7f89"
                        value={vin}
                        onChangeText={(text) => setVin(normalizeVin(text).slice(0, VIN_LENGTH))}
                        onFocus={() => handleInputFocus('vin')}
                        autoCapitalize="characters"
                        autoCorrect={false}
                        maxLength={VIN_LENGTH}
                    />
                    {vinDisplayError && <Text style={styles.error}>{vinDisplayError}</Text>}

                    <Text style={styles.label}>Current Mileage (optional)</Text>
                    <TextInput
                        ref={(ref) => { inputRefs.current['mileage'] = ref; }}
                        style={[styles.input, mileageError && styles.inputError]}
                        placeholder="Enter vehicle mileage"
                        placeholderTextColor="#7a7f89"
                        value={mileage}
                        onChangeText={(text) => setMileage(text.replace(/[^0-9]/g, ''))}
                        onFocus={() => handleInputFocus('mileage')}
                        keyboardType="number-pad"
                        maxLength={6}
                    />
                    {mileageError && <Text style={styles.error}>{mileageError}</Text>}

                    <Text style={styles.label}>Make (optional)</Text>
                    <TextInput
                        ref={(ref) => { inputRefs.current['make'] = ref; }}
                        style={styles.input}
                        placeholder="Enter vehicle make"
                        placeholderTextColor="#7a7f89"
                        value={make}
                        onChangeText={setMake}
                        onFocus={() => handleInputFocus('make')}
                        autoCapitalize="words"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Model (optional)</Text>
                    <TextInput
                        ref={(ref) => { inputRefs.current['model'] = ref; }}
                        style={styles.input}
                        placeholder="Enter vehicle model"
                        placeholderTextColor="#7a7f89"
                        value={model}
                        onChangeText={setModel}
                        onFocus={() => handleInputFocus('model')}
                        autoCapitalize="words"
                        autoCorrect={false}
                    />

                    <Text style={styles.label}>Year (optional)</Text>
                    <TextInput
                        ref={(ref) => { inputRefs.current['year'] = ref; }}
                        style={[styles.input, yearError && styles.inputError]}
                        placeholder="Enter vehicle year"
                        placeholderTextColor="#7a7f89"
                        value={year}
                        onChangeText={(text) => setYear(text.replace(/[^0-9]/g, '').slice(0, 4))}
                        onFocus={() => handleInputFocus('year')}
                        keyboardType="number-pad"
                        maxLength={4}
                    />
                    {yearError && <Text style={styles.error}>{yearError}</Text>}

                    <OnboardingFooterButton
                        label="Scan VIN Barcode"
                        onPress={requestCamera}
                        rightIcon={<Camera size={18} color={BrandColors.white} />}
                        disabled={loading}
                        size="lg"
                        paddingVertical={Spacing.md}
                    />

                    <View style={styles.spacer} />

                    <OnboardingFooterButton
                        label={loading ? 'Retrieving service history...' : 'Continue'}
                        onPress={handleContinue}
                        disabled={!canContinue}
                        size="lg"
                        paddingVertical={Spacing.lg}
                        rightIcon={
                            loading ? <ActivityIndicator color={BrandColors.white} /> : undefined
                        }
                    />

                    {error && <Text style={styles.error}>{error}</Text>}
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={scannerVisible} animationType="slide">
                <View style={styles.scannerContainer}>
                    <CameraView
                        style={StyleSheet.absoluteFillObject}
                        facing="back"
                        barcodeScannerSettings={{
                            // Include common retail/product formats (UPC/EAN) plus QR/Code128
                            barcodeTypes: [
                                'qr',
                                'code39',
                                'code93',
                                'code128',
                                'codabar',
                                'itf14',
                                'datamatrix',
                                'pdf417',
                                'aztec',
                                'ean13',
                                'ean8',
                                'upc_a',
                                'upc_e',
                            ],
                        }}
                        onBarcodeScanned={scanned ? undefined : handleScan}
                    />
                    <View style={[styles.scannerFooter, { paddingBottom: insets.bottom + Spacing.md }]}>
                        <OnboardingFooterButton
                            label="Cancel"
                            onPress={() => setScannerVisible(false)}
                            size="md"
                            paddingVertical={Spacing.md}
                        />
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dee2ee',
    },
    backButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
        marginBottom: Spacing.xl,
    },
    content: {
        flex: 1,
    },
    flex: {
        flex: 1,
    },
    scrollContent: {
        gap: Spacing.md,
        paddingHorizontal: Spacing['2xl'],
    },
    title: {
        fontSize: FontSize['2xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.primary,
    },
    label: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.medium,
        color: BrandColors.primary,
        marginTop: Spacing.xs,
    },
    input: {
        width: '100%',
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing.md,
        borderRadius: BorderRadius.lg,
        borderWidth: 1,
        borderColor: '#e1e4ec',
        backgroundColor: '#f4f5f9',
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.primary,
    },
    inputError: {
        borderColor: '#d93025',
    },
    error: {
        color: '#d93025',
        fontSize: FontSize.sm,
        fontFamily: FontFamily.regular,
    },
    spacer: {
        flex: 1,
        minHeight: Spacing['2xl'],
    },
    scannerContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    scannerFallback: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    scannerFooter: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: Spacing['2xl'],
        paddingTop: Spacing.sm,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    icon: {
        width: 180,
        height: 180,
    },
});

