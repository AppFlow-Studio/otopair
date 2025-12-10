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
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Modal,
    Platform,
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
    const [vin, setVin] = useState('');
    const [mileage, setMileage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [scannerVisible, setScannerVisible] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const [scanned, setScanned] = useState(false);

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

        setError(null);
        setLoading(true);
        try {
            const mileageVal = parseMileage();
            const finalVin = vinTrimmed || null;
            
            updateData({
                vehicleVin: finalVin,
                vehicleMileage: mileageVal,
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

    // Allow continue if: (VIN is empty OR valid) AND (mileage is empty OR valid)
    const canContinue = (() => {
        const vinTrimmed = vin.trim();
        const mileageTrimmed = mileage.trim();
        
        const vinValid = vinTrimmed === '' || isValidVin(vinTrimmed);
        const mileageValid = mileageTrimmed === '' || !mileageError;
        
        return vinValid && mileageValid && !loading;
    })();

    return (
        <View
            style={[
                styles.container,
                { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg },
            ]}
        >
            <OnboardingBackButton noHorizontalPadding />
            <View style={styles.content}>
                <Text style={styles.title}>VIN</Text>
                <TextInput
                    style={[styles.input, vinDisplayError && styles.inputError]}
                    placeholder="Enter VIN"
                    placeholderTextColor="#7a7f89"
                    value={vin}
                    onChangeText={(text) => setVin(normalizeVin(text).slice(0, VIN_LENGTH))}
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={VIN_LENGTH}
                />
                {vinDisplayError && <Text style={styles.error}>{vinDisplayError}</Text>}

                <TextInput
                    style={[styles.input, mileageError && styles.inputError]}
                    placeholder="Current Mileage (optional)"
                    placeholderTextColor="#7a7f89"
                    value={mileage}
                    onChangeText={(text) => setMileage(text.replace(/[^0-9]/g, ''))}
                    keyboardType="number-pad"
                    maxLength={6}
                />
                {mileageError && <Text style={styles.error}>{mileageError}</Text>}

                <OnboardingFooterButton
                    label="Scan Barcode"
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
            </View>

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
        paddingHorizontal: Spacing['2xl'],
    },
    content: {
        flex: 1,
        gap: Spacing.md,
    },
    title: {
        fontSize: FontSize['2xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.primary,
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

