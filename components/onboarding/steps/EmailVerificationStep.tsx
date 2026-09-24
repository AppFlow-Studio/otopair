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
import { OnboardingSurfaceColors } from '../onboardingColors';

const RESEND_COOLDOWN_SECONDS = 30;

function clerkErrorMessage(err: any, fallback: string): string {
    return err?.errors?.[0]?.longMessage
        || err?.errors?.[0]?.message
        || err?.message
        || fallback;
}

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
    const [errorTitle, setErrorTitle] = useState('Verification failed');
    const [verifying, setVerifying] = useState(false);
    const [isResending, setIsResending] = useState(false);
    // The initial code was just sent by EmailSignupStep, so start on a cooldown.
    const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN_SECONDS);
    const [resendNotice, setResendNotice] = useState<string | null>(null);
    const inputRefs = useRef<(TextInput | null)[]>([]);
    const slideAnim = useRef(new Animated.Value(height)).current;

    useEffect(() => {
        const sub = BackHandler.addEventListener("hardwareBackPress", () => { onBack(); return true; });
        return () => sub.remove();
    }, [onBack]);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const id = setInterval(() => {
            setResendTimer((t) => (t > 0 ? t - 1 : 0));
        }, 1000);
        return () => clearInterval(id);
    }, [resendTimer > 0]);

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
                showError('Verification failed', 'Verification incomplete. Please try again.');
                resetCode();
            }
        } catch (err: any) {
            showError('Verification failed', clerkErrorMessage(err, 'Invalid verification code'));
            resetCode();
        } finally {
            setVerifying(false);
        }
    };

    const showError = (title: string, message: string) => {
        setErrorTitle(title);
        setErrorMessage(message);
        setShowErrorModal(true);
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
        if (resendTimer > 0 || isResending) return;
        setResendNotice(null);

        if (!isLoaded || !signUp) {
            showError("Couldn't resend code", "We couldn't reach sign-up. Please go back and try again.");
            return;
        }
        if (signUp.verifications?.emailAddress?.status === 'verified') {
            onNext();
            return;
        }
        if (!signUp.emailAddress) {
            showError(
                "Couldn't resend code",
                'Your sign-up session expired. Please go back and enter your email again.',
            );
            return;
        }

        setIsResending(true);
        try {
            await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
            resetCode();
            setResendTimer(RESEND_COOLDOWN_SECONDS);
            setResendNotice(`New code sent to ${signUp.emailAddress}. Check spam if it doesn't arrive in a minute.`);
        } catch (err: any) {
            console.error('Failed to resend code:', err);
            showError("Couldn't resend code", clerkErrorMessage(err, 'Unable to send a new code. Please try again.'));
        } finally {
            setIsResending(false);
        }
    };

    const resendDisabled = resendTimer > 0 || isResending;

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
                    <Pressable onPress={handleResend} disabled={resendDisabled}>
                        <Text style={[styles.resendButton, resendDisabled && styles.resendDisabled]}>
                            {isResending
                                ? 'Sending code…'
                                : resendTimer > 0
                                    ? `Resend code in ${resendTimer}s`
                                    : 'Resend code'}
                        </Text>
                    </Pressable>
                    {resendNotice && (
                        <Text style={styles.resendNotice}>{resendNotice}</Text>
                    )}
                </View>

                <View style={{ flex: 1 }} />
            </View>

            <Modal
                visible={showErrorModal}
                transparent
                animationType="none"
                statusBarTranslucent
                navigationBarTranslucent
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
                        <Text style={styles.errorTitle}>{errorTitle}</Text>
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
    resendDisabled: { opacity: 0.5 },
    resendNotice: {
        marginTop: Spacing.md,
        fontSize: FontSize.sm,
        fontFamily: FontFamily.regular,
        color: '#047857',
        textAlign: 'center',
    },
    errorModalBackdrop: {
        flex: 1,
        backgroundColor: OnboardingSurfaceColors.backdrop,
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    errorModal: {
        backgroundColor: OnboardingSurfaceColors.card,
        borderRadius: 28,
        padding: Spacing['2xl'],
        paddingBottom: Spacing['3xl'],
        alignItems: 'center',
        width: '95%',
        alignSelf: 'center',
        marginBottom: Spacing.lg,
        borderWidth: 1,
        borderColor: OnboardingSurfaceColors.border,
    },
    errorModalHandle: {
        width: 40,
        height: 4,
        backgroundColor: OnboardingSurfaceColors.handle,
        borderRadius: 2,
        marginBottom: Spacing.xs,
    },
    errorIconContainer: { marginBottom: Spacing.lg },
    errorTitle: {
        fontSize: FontSize['2xl'],
        fontFamily: FontFamily.bold,
        color: OnboardingSurfaceColors.text,
        textAlign: 'center',
        marginBottom: Spacing.md,
    },
    errorMessage: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.regular,
        color: OnboardingSurfaceColors.mutedText,
        textAlign: 'center',
        marginBottom: Spacing['2xl'],
        lineHeight: 22,
    },
    errorButton: {
        backgroundColor: OnboardingSurfaceColors.primaryButton,
        borderRadius: 12,
        paddingVertical: Spacing.md,
        paddingHorizontal: Spacing['2xl'],
        width: '100%',
        alignItems: 'center',
    },
    errorButtonText: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semiBold,
        color: OnboardingSurfaceColors.primaryButtonText,
    },
});
