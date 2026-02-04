/**
 * LoginStep
 *
 * PURPOSE: Full login screen with Google, Apple, and Email/Password options.
 *
 * USED IN: components/onboarding/OnboardingFlow.tsx
 */

import { useState } from 'react';
import { useSignIn, useAuth, useSSO } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import {
    BrandColors,
    FontFamily,
    FontSize,
    Spacing,
    Text,
    BorderRadius,
} from '@/components/shared-ui';
import { FooterButton } from '@/components/shared-ui/FooterButton';
import { BackButton } from '@/components/shared-ui/BackButton';
import {
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    TextInput,
    View,
    useWindowDimensions,
    Pressable,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Mail } from 'lucide-react-native';

WebBrowser.maybeCompleteAuthSession();

interface LoginStepProps {
    onNext: () => void;
    onBack: () => void;
}

export function LoginStep({ onNext, onBack }: LoginStepProps) {
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();
    const { signIn, setActive: setSignInActive, isLoaded } = useSignIn();
    const { signOut, isSignedIn } = useAuth();
    const ensureConvexUser = useMutation(api.users.getOrCreateMe);
    const { startSSOFlow } = useSSO();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState<'google' | 'apple' | 'email' | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [showEmailForm, setShowEmailForm] = useState(false);

    const dynamicStyles = {
        container: { paddingTop: insets.top + Spacing.lg },
        bottomContainer: { paddingBottom: insets.bottom + Spacing.lg },
    };

    const isCompact = height < 720;
    const buttonSize: 'md' | 'lg' = isCompact ? 'md' : 'lg';
    const buttonPaddingVertical = isCompact ? Spacing.sm : Spacing.lg;

    // Retry helper to wait for Clerk JWT to propagate to Convex
    const ensureConvexUserWithRetry = async (retries = 3, delay = 1500) => {
        // Small delay to let Clerk JWT propagate
        await new Promise(r => setTimeout(r, 1000));
        for (let i = 0; i <= retries; i++) {
            try {
                await ensureConvexUser();
                return;
            } catch (e) {
                if (i === retries) throw e;
                await new Promise(r => setTimeout(r, delay * Math.pow(2, i)));
            }
        }
    };

    const handleOAuthLogin = async (strategy: 'google' | 'apple') => {
        if (loading) return;
        setLoading(strategy);
        setError(null);

        try {
            const ssoStrategy = strategy === 'google' ? 'oauth_google' : 'oauth_apple';

            const { createdSessionId, setActive } = await startSSOFlow({
                strategy: ssoStrategy,
                redirectUrl: 'otopair://oauth-callback',
                redirectUrlComplete: 'otopair://oauth-callback',
            });

            if (createdSessionId && setActive) {
                await setActive({ session: createdSessionId });

                try {
                    await ensureConvexUserWithRetry();
                } catch (e) {
                    console.error('Failed to ensure Convex user', e);
                }

                onNext();
            }
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Authentication failed';
            setError(message);
        } finally {
            setLoading(null);
        }
    };

    const handleEmailLogin = async () => {
        if (!isLoaded || !signIn || loading) return;
        setLoading('email');
        setError(null);

        try {
            await signIn.create({
                identifier: email.trim(),
            });

            const result = await signIn.attemptFirstFactor({
                strategy: 'password',
                password,
            });

            if (result.status !== 'complete' || !result.createdSessionId) {
                throw new Error('Unable to create a session.');
            }

            await setSignInActive?.({ session: result.createdSessionId });

            try {
                await ensureConvexUserWithRetry();
            } catch (e) {
                console.error('Failed to ensure Convex user', e);
            }

            onNext();
        } catch (err: any) {
            const message = err?.errors?.[0]?.longMessage
                || err?.errors?.[0]?.message
                || err?.message
                || 'Unable to sign in';
            setError(message);
        } finally {
            setLoading(null);
        }
    };

    const canSubmitEmail = email.trim().length > 0 && password.length > 0;

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
        >
            <View style={[styles.container, dynamicStyles.container]}>
                <View style={styles.backButtonRow}>
                    <BackButton onBack={onBack} alwaysShow />
                </View>

                <ScrollView
                    style={styles.scrollView}
                    contentContainerStyle={styles.scrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.headerContent}>
                        <Text style={styles.title}>Welcome back</Text>
                        <Text style={styles.subtitle}>
                            Log in to your Otopair account
                        </Text>
                    </View>

                    {!showEmailForm ? (
                        <View style={styles.buttonsContainer}>
                            {/* Google */}
                            <Pressable
                                style={[styles.oauthButton, styles.googleButton]}
                                onPress={() => handleOAuthLogin('google')}
                                disabled={loading !== null}
                            >
                                {loading === 'google' ? (
                                    <ActivityIndicator size="small" color="#000" />
                                ) : (
                                    <>
                                        <Text style={styles.googleIcon}>G</Text>
                                        <Text style={styles.googleText}>Continue with Google</Text>
                                    </>
                                )}
                            </Pressable>

                            {/* Apple */}
                            <Pressable
                                style={[styles.oauthButton, styles.appleButton]}
                                onPress={() => handleOAuthLogin('apple')}
                                disabled={loading !== null}
                            >
                                {loading === 'apple' ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <>
                                        <Text style={styles.appleIcon}></Text>
                                        <Text style={styles.appleText}>Continue with Apple</Text>
                                    </>
                                )}
                            </Pressable>

                            {/* Email */}
                            <Pressable
                                style={[styles.oauthButton, styles.emailButton]}
                                onPress={() => setShowEmailForm(true)}
                                disabled={loading !== null}
                            >
                                <Mail size={20} color={BrandColors.white} />
                                <Text style={styles.emailText}>Continue with Email</Text>
                            </Pressable>
                        </View>
                    ) : (
                        <View style={styles.inputsContainer}>
                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Email address"
                                    placeholderTextColor="#9CA3AF"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    textContentType="emailAddress"
                                    keyboardType="email-address"
                                    autoFocus
                                />
                            </View>

                            <View style={styles.inputWrapper}>
                                <TextInput
                                    style={styles.input}
                                    placeholder="Password"
                                    placeholderTextColor="#9CA3AF"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                    autoComplete="current-password"
                                    textContentType="password"
                                />
                            </View>

                            <Pressable onPress={() => setShowEmailForm(false)}>
                                <Text style={styles.backToOptionsText}>
                                    Back to other options
                                </Text>
                            </Pressable>
                        </View>
                    )}

                    {error ? (
                        <Text style={styles.errorText}>{error}</Text>
                    ) : null}

                    {/* DEBUG: Logout button */}
                    {isSignedIn && (
                        <View style={{ paddingHorizontal: Spacing['2xl'], marginTop: Spacing['2xl'] }}>
                            <Pressable
                                style={[styles.oauthButton, { backgroundColor: '#EF4444' }]}
                                onPress={() => signOut()}
                            >
                                <Text style={styles.appleText}>DEBUG: Sign Out</Text>
                            </Pressable>
                        </View>
                    )}
                </ScrollView>

                {showEmailForm && (
                    <View style={[styles.bottomContainer, dynamicStyles.bottomContainer]}>
                        <FooterButton
                            label={loading === 'email' ? 'Logging In...' : 'Log In'}
                            onPress={handleEmailLogin}
                            disabled={!canSubmitEmail || loading !== null}
                            size={buttonSize}
                            paddingVertical={buttonPaddingVertical}
                            variant={canSubmitEmail ? 'primary' : undefined}
                            backgroundColor={canSubmitEmail ? undefined : '#6B7280'}
                            textColor={canSubmitEmail ? undefined : BrandColors.white}
                        />
                    </View>
                )}
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    keyboardView: { flex: 1 },
    container: { flex: 1 },
    backButtonRow: {
        paddingHorizontal: Spacing['2xl'],
        paddingBottom: Spacing.sm,
    },
    scrollView: { flex: 1 },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: Spacing.xl,
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
        lineHeight: Spacing['5xl'],
    },
    subtitle: {
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        opacity: 0.9,
        lineHeight: Spacing['2xl'],
    },
    buttonsContainer: {
        paddingHorizontal: Spacing['2xl'],
        gap: Spacing.md,
    },
    oauthButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.md,
        borderRadius: BorderRadius.lg,
        gap: Spacing.sm,
    },
    googleButton: {
        backgroundColor: BrandColors.white,
    },
    googleIcon: {
        fontSize: FontSize.xl,
        fontFamily: FontFamily.bold,
        color: '#4285F4',
    },
    googleText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        color: '#000000',
    },
    appleButton: {
        backgroundColor: '#000000',
    },
    appleIcon: {
        fontSize: FontSize.xl,
        color: BrandColors.white,
    },
    appleText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        color: BrandColors.white,
    },
    emailButton: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
    },
    emailText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        color: BrandColors.white,
    },
    inputsContainer: { paddingHorizontal: Spacing['2xl'], gap: Spacing.lg },
    inputWrapper: { marginBottom: Spacing.md },
    input: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
        fontSize: FontSize.lg,
        fontFamily: FontFamily.regular,
        color: BrandColors.white,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    backToOptionsText: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        color: '#60A5FA',
        textAlign: 'center',
    },
    errorText: {
        textAlign: 'center',
        color: '#FCA5A5',
        fontSize: FontSize.sm,
        fontFamily: FontFamily.medium,
        marginTop: Spacing.md,
        paddingHorizontal: Spacing['2xl'],
    },
    bottomContainer: {
        paddingTop: Spacing.sm,
        paddingHorizontal: Spacing['2xl'],
        backgroundColor: 'transparent',
    },
});
