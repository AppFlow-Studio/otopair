/**
 * EmailVerificationStep
 *
 * PURPOSE: 6-digit code verification for email signup via Clerk.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 */

import { useState, useEffect, useRef } from 'react';
import { useSignUp } from '@clerk/clerk-expo';
import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
} from '@/components/shared-ui';
import { ProgressBar } from '@/components/shared-ui/ProgressBar';
import { BackButton } from '@/components/shared-ui/BackButton';
import {
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    View,
    useWindowDimensions,
    Pressable,
    Modal,
    TouchableOpacity,
    Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnboardingStore } from '@/stores/useOnboardingStore';
import { useEnsureConvexUser } from '@/hooks/useEnsureConvexUser';
import { X } from 'lucide-react-native';

interface EmailVerificationStepProps {
    onNext: () => void;
    onBack: () => void;
    progress: { total: number; filled: number };
}

export function EmailVerificationStep({ onNext, onBack, progress }: EmailVerificationStepProps) {
    const insets = useSafeAreaInsets();
    const { height, width } = useWindowDimensions();
    const { data } = useOnboardingStore();
    const { signUp, setActive, isLoaded } = useSignUp();
    const ensureConvexUser = useEnsureConvexUser();

    const [code, setCode] = useState(['', '', '', '', '', '']);
    const [focusedIndex, setFocusedIndex] = useState(0);
    const [showErrorModal, setShowErrorModal] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [verifying, setVerifying] = useState(false);
    const inputRefs = useRef<(TextInput | null)[]>([]);
    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
        return () => sub.remove();
    }, [onBack]);

    useEffect(() => {
        if (showErrorModal) {
            slideAnim.setValue(height);
            requestAnimationFrame(() => {
                Animated.spring(slideAnim, {
                    toValue: 0,
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
        }
    }, [showErrorModal, slideAnim, height]);

    useEffect(() => {
        const fullCode = code.join('');
        if (fullCode.length === 6 && !verifying) {
            verifyCode(fullCode);
        }
    }, [code]);

    const verifyCode = async (fullCode: string) => {
        if (!isLoaded || !signUp) return;
        setVerifying(true);

        try {
            const result = await signUp.attemptEmailAddressVerification({
                code: fullCode,
            });

            if (result.status === 'complete' && result.createdSessionId) {
                await setActive?.({ session: result.createdSessionId });

                try {
                    await ensureConvexUser();
                } catch (e) {
                    console.error('Failed to ensure Convex user', e);
                }

                onNext();
            } else if (result.status === 'missing_requirements') {
                // Email verified but sign-up needs more steps (e.g. phone).
                // If a session was created, activate it first.
                if (result.createdSessionId) {
                    await setActive?.({ session: result.createdSessionId });
                    try {
                        await ensureConvexUser();
                    } catch (e) {
                        console.error('Failed to ensure Convex user', e);
                    }
                }
                // Proceed to next onboarding step (phone number)
                onNext();
            } else {
                setErrorMessage('Verification incomplete. Please try again.');
                setShowErrorModal(true);
                resetCode();
            }
        } catch (err: any) {
            const message = err?.errors?.[0]?.longMessage
                || err?.errors?.[0]?.message
                || 'Invalid verification code';
            setErrorMessage(message);
            setShowErrorModal(true);
            resetCode();
        } finally {
            setVerifying(false);
        }
    };

    const resetCode = () => {
        setCode(['', '', '', '', '', '']);
        setFocusedIndex(0);
        inputRefs.current[0]?.focus();
    };

    const handleCodeChange = (value: string, index: number) => {
        const digit = value.replace(/\D/g, '');
        if (digit.length > 1) return;

        const newCode = [...code];
        newCode[index] = digit;
        setCode(newCode);

        if (digit && index < 5) {
            setFocusedIndex(index + 1);
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyPress = (e: any, index: number) => {
        if (e.nativeEvent.key === 'Backspace') {
            const newCode = [...code];
            if (newCode[index]) {
                newCode[index] = '';
                setCode(newCode);
            } else if (index > 0) {
                newCode[index - 1] = '';
                setCode(newCode);
                setFocusedIndex(index - 1);
                inputRefs.current[index - 1]?.focus();
            }
        }
    };

    const handleResend = async () => {
        if (!isLoaded || !signUp) return;
        try {
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            resetCode();
        } catch (err) {
            console.error('Failed to resend code:', err);
        }
    };

    const containerPadding = Spacing['2xl'] * 2;
    const boxMargin = Spacing.sm * 2;
    const totalMarginSpace = 6 * boxMargin;
    const availableWidth = width - containerPadding;
    const calculatedBoxWidth = Math.max(40, Math.floor((availableWidth - totalMarginSpace) / 6));

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        codeInput: { width: calculatedBoxWidth },
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                <ProgressBar
                    total={progress.total}
                    filled={progress.filled}
                    leftElement={<BackButton onBack={onBack} alwaysShow />}
                />

                <View style={styles.headerContent}>
                    <Text style={styles.title}>Verify your email</Text>
                    <Text style={styles.subtitle}>
                        Enter the code sent to {data.email || 'your email'}
                    </Text>
                </View>

                <View style={styles.codeContainer}>
                    {code.map((digit, index) => (
                        <View key={index} style={styles.codeInputWrapper}>
                            {index === 3 && <Text style={styles.codeSeparator}>-</Text>}
                            <TextInput
                                ref={(ref) => { inputRefs.current[index] = ref; }}
                                style={[
                                    styles.codeInput,
                                    dynamicStyles.codeInput,
                                    focusedIndex === index && styles.codeInputFocused,
                                ]}
                                value={digit}
                                onChangeText={(value) => handleCodeChange(value, index)}
                                onKeyPress={(e) => handleKeyPress(e, index)}
                                onFocus={() => setFocusedIndex(index)}
                                keyboardType="number-pad"
                                maxLength={1}
                                selectTextOnFocus
                                autoFocus={index === 0}
                            />
                        </View>
                    ))}
                </View>

                <View style={styles.resendContainer}>
                    <Pressable onPress={handleResend}>
                        <Text style={styles.resendButton}>Resend code</Text>
                    </Pressable>
                </View>

                <View style={{ flex: 1 }} />
            </View>

            <Modal
                visible={showErrorModal}
                transparent
                animationType="none"
                onRequestClose={() => setShowErrorModal(false)}
            >
                <Pressable
                    style={styles.errorModalBackdrop}
                    onPress={() => setShowErrorModal(false)}
                >
                    <Animated.View
                        style={[
                            styles.errorModal,
                            { transform: [{ translateY: slideAnim }] },
                        ]}
                        onStartShouldSetResponder={() => true}
                    >
                        <View style={styles.errorModalHandle} />
                        <View style={styles.errorIconContainer}>
                            <X size={48} color="#EF4444" strokeWidth={3} />
                        </View>
                        <Text style={styles.errorTitle}>Verification failed</Text>
                        <Text style={styles.errorMessage}>{errorMessage}</Text>
                        <TouchableOpacity
                            style={styles.errorButton}
                            onPress={() => setShowErrorModal(false)}
                        >
                            <Text style={styles.errorButtonText}>Got it</Text>
                        </TouchableOpacity>
                    </Animated.View>
                </Pressable>
            </Modal>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    container: { flex: 1 },
    headerContent: {
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing['3xl'],
    },
    title: {
        fontSize: FontSize['4xl'],
        fontFamily: FontFamily.bold,
        color: '#0F172A',
        marginBottom: Spacing.md,
        lineHeight: Spacing['5xl'],
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: '#0F172A',
        opacity: 0.9,
        lineHeight: Spacing['2xl'],
    },
    codeContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: Spacing['2xl'],
        marginBottom: Spacing.xl,
    },
    codeInputWrapper: { position: 'relative', marginHorizontal: Spacing.sm },
    codeSeparator: {
        position: 'absolute',
        left: -Spacing.lg + 2.5,
        top: '50%',
        marginTop: -12,
        fontSize: FontSize['2xl'],
        fontFamily: FontFamily.bold,
        color: '#0F172A',
        opacity: 0.5,
    },
    codeInput: {
        width: 50,
        height: 60,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        fontSize: FontSize['2xl'],
        fontFamily: FontFamily.bold,
        color: '#0F172A',
        textAlign: 'center',
        padding: 0,
    },
    codeInputFocused: {
        borderColor: BrandColors.white,
        borderWidth: 2,
        backgroundColor: '#5299FE',
    },
    resendContainer: { alignItems: 'center', paddingHorizontal: Spacing['2xl'] },
    resendButton: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        color: '#1E40AF',
    },
    errorModalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    errorModal: {
        backgroundColor: '#1F2937',
        borderRadius: 50,
        padding: Spacing['2xl'],
        paddingBottom: Spacing['3xl'],
        alignItems: 'center',
        width: '95%',
        alignSelf: 'center',
        marginBottom: Spacing.lg,
    },
    errorModalHandle: {
        width: 40,
        height: 4,
        backgroundColor: '#6B7280',
        borderRadius: 2,
        marginBottom: Spacing.xs,
    },
    errorIconContainer: { marginBottom: Spacing.lg },
    errorTitle: {
        fontSize: FontSize['2xl'],
        fontFamily: FontFamily.bold,
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    errorMessage: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: '#9CA3AF',
        textAlign: 'center',
        marginBottom: Spacing['2xl'],
        lineHeight: 22,
    },
    errorButton: {
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing['2xl'],
        width: '100%',
        alignItems: 'center',
    },
    errorButtonText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semiBold,
        color: '#000000',
    },
});
