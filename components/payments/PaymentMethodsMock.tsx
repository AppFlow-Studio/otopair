import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, CreditCard, Plus, ChevronRight } from 'lucide-react-native';
import { Text, Button, BrandColors, Spacing, FontSize, FontFamily, Colors } from '@/components/shared-ui';

type PaymentMethod = {
    id: string;
    brand: 'visa' | 'mastercard' | 'amex' | 'discover' | 'other';
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault?: boolean;
};

const MOCK_METHODS: PaymentMethod[] = [
    { id: 'pm_1', brand: 'mastercard', last4: '5791', expMonth: 3, expYear: 2027, isDefault: true },
    { id: 'pm_2', brand: 'mastercard', last4: '2398', expMonth: 9, expYear: 2026 },
    { id: 'pm_3', brand: 'visa', last4: '1123', expMonth: 12, expYear: 2025 },
];

const brandLabel = (brand: PaymentMethod['brand']) => {
    switch (brand) {
        case 'visa':
            return 'Visa';
        case 'mastercard':
            return 'Mastercard';
        case 'amex':
            return 'Amex';
        case 'discover':
            return 'Discover';
        default:
            return 'Card';
    }
};

export function PaymentMethodsMock() {
    const insets = useSafeAreaInsets();
    const [methods, setMethods] = useState<PaymentMethod[]>(MOCK_METHODS);
    const [selected, setSelected] = useState<string | null>(MOCK_METHODS[0]?.id ?? null);

    const handleSelect = (id: string) => {
        setSelected(id);
    };

    const handleMakeDefault = (id: string) => {
        setMethods((prev) =>
            prev.map((m) => ({ ...m, isDefault: m.id === id }))
        );
        setSelected(id);
        Alert.alert('Default payment method updated');
    };

    const handleAddNew = () => {
        Alert.alert(
            'Add payment method',
            'Integrate Stripe (PaymentSheet) or another PSP here.'
        );
    };

    const handleManage = (id: string) => {
        Alert.alert('Change payment method', `Selected: ${id}`);
    };

    const hasMethods = methods.length > 0;

    return (
        <View style={[styles.container, { paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg }]}>
            <View style={styles.headerRow}>
                <ArrowLeft size={FontSize.lg} color={BrandColors.primary} />
                <Text style={styles.title}>Payment Methods</Text>
                <View style={{ width: FontSize.lg }} />
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <TouchableOpacity style={styles.addCard} onPress={handleAddNew} activeOpacity={0.8}>
                    <View style={styles.addCardIcon}>
                        <CreditCard size={24} color="#fff" />
                    </View>
                    <Text style={styles.addCardText}>Add New Payment</Text>
                    <View style={styles.addCardButton}>
                        <Plus size={18} color="#111" />
                    </View>
                </TouchableOpacity>

                {!hasMethods && (
                    <View style={styles.emptyCard}>
                        <Text style={styles.emptyLabel}>No payment method found.</Text>
                        <Button variant="secondary" size="sm" onPress={handleAddNew}>
                            Add One
                        </Button>
                    </View>
                )}

                {methods.map((m) => {
                    const isSelected = selected === m.id;
                    return (
                        <TouchableOpacity
                            key={m.id}
                            style={[
                                styles.cardRow,
                                isSelected && styles.cardRowSelected,
                            ]}
                            onPress={() => handleSelect(m.id)}
                            activeOpacity={0.9}
                        >
                            <View style={[styles.radio, isSelected && styles.radioSelected]} />
                            <View style={styles.cardInfo}>
                                <Text style={styles.cardBrand}>{brandLabel(m.brand)}</Text>
                                <Text style={styles.cardNumber}>•••• {m.last4}</Text>
                                <Text style={styles.cardExpiry}>
                                    {String(m.expMonth).padStart(2, '0')}/{String(m.expYear).slice(-2)}
                                </Text>
                                {m.isDefault && <Text style={styles.defaultTag}>Default</Text>}
                            </View>
                            <TouchableOpacity onPress={() => handleManage(m.id)} style={styles.chevronButton}>
                                <ChevronRight size={18} color={BrandColors.primary} />
                            </TouchableOpacity>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#dde1ee',
        paddingHorizontal: Spacing['2xl'],
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: Spacing.lg,
    },
    title: {
        fontSize: FontSize['2xl'],
        fontFamily: FontFamily.bold,
        color: BrandColors.primary,
    },
    scrollContent: {
        gap: Spacing.md,
        paddingBottom: Spacing['3xl'],
    },
    addCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: 20,
        backgroundColor: '#2c2f38',
        gap: Spacing.md,
    },
    addCardIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#3c404c',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addCardText: {
        flex: 1,
        color: '#f5f6fa',
        fontSize: FontSize.lg,
        fontFamily: FontFamily.semiBold,
    },
    addCardButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#f7f8fb',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyCard: {
        padding: Spacing.lg,
        borderRadius: 16,
        backgroundColor: '#f7f8fb',
        borderWidth: 1,
        borderColor: '#e2e6ef',
        gap: Spacing.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyLabel: {
        fontSize: FontSize.md,
        color: Colors.light.icon,
        fontFamily: FontFamily.medium,
    },
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: Spacing.lg,
        borderRadius: 16,
        backgroundColor: '#f7f8fb',
        borderWidth: 1,
        borderColor: '#e2e6ef',
        gap: Spacing.md,
    },
    cardRowSelected: {
        borderColor: BrandColors.secondary,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
        elevation: 3,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#c5c9d6',
    },
    radioSelected: {
        borderColor: BrandColors.secondary,
        backgroundColor: '#e8f1ff',
    },
    cardInfo: {
        flex: 1,
        gap: 2,
    },
    cardBrand: {
        fontSize: FontSize.md,
        fontFamily: FontFamily.semiBold,
        color: BrandColors.primary,
    },
    cardNumber: {
        fontSize: FontSize.md,
        color: Colors.light.icon,
        fontFamily: FontFamily.medium,
    },
    cardExpiry: {
        fontSize: FontSize.sm,
        color: Colors.light.icon,
        fontFamily: FontFamily.medium,
    },
    defaultTag: {
        fontSize: FontSize.sm,
        color: BrandColors.secondary,
        fontFamily: FontFamily.medium,
    },
    chevronButton: {
        width: 32,
        height: 32,
        borderRadius: 10,
        backgroundColor: '#eef1f6',
        alignItems: 'center',
        justifyContent: 'center',
    },
});


