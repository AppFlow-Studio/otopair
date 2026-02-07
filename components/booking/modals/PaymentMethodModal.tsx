/**
 * PaymentMethodModal
 *
 * PURPOSE: Bottom sheet modal for selecting payment method
 *          Shows Apple Pay, Google Pay, saved cards, and add new card option
 *          Dismisses when tapping outside the modal
 *
 * USED IN: components/booking/sheets/ReviewPayContent.tsx
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useCallback } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

// 2. Third-party libraries
import { Check, ChevronRight, CreditCard, Lock, Plus, Smartphone, Wallet } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// 3. Shared UI (design system)
import { BrandColors, Spacing, Text } from "@/components/shared-ui";

// 4. Constants, hooks, types, stores
import { BorderRadius, Shadows } from "@/constants/theme";
import { usePaymentStore } from "@/stores/usePaymentStore";
import type { PaymentMethod } from "@/stores/types/store.types";

// ============================================================================
// TYPES
// ============================================================================

interface PaymentMethodModalProps {
  /** Whether the modal is visible */
  visible: boolean;
  /** Called when modal should close */
  onClose: () => void;
  /** Total amount to display */
  totalAmount: number;
  /** Service name/summary to display */
  serviceSummary: string;
  /** Mechanic name to display */
  mechanicName: string;
}

type WalletType = "apple_pay" | "google_pay";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getBrandLabel = (brand: PaymentMethod["brand"]) => {
  switch (brand) {
    case "visa":
      return "Visa";
    case "mastercard":
      return "Mastercard";
    case "amex":
      return "Amex";
    case "discover":
      return "Discover";
    default:
      return "Card";
  }
};

// ============================================================================
// COMPONENT
// ============================================================================

export function PaymentMethodModal({
  visible,
  onClose,
  totalAmount,
  serviceSummary,
  mechanicName,
}: PaymentMethodModalProps) {
  // ═══════════════ HOOKS ═══════════════
  const insets = useSafeAreaInsets();

  // ═══════════════ STORE ═══════════════
  const paymentMethods = usePaymentStore((state) => state.paymentMethods);
  const selectedPaymentMethodId = usePaymentStore((state) => state.selectedPaymentMethodId);
  const selectPaymentMethod = usePaymentStore((state) => state.selectPaymentMethod);
  const getDefaultPaymentMethod = usePaymentStore((state) => state.getDefaultPaymentMethod);

  // ═══════════════ COMPUTED ═══════════════
  const defaultMethod = getDefaultPaymentMethod();
  const currentSelectedId = selectedPaymentMethodId || defaultMethod?.id;

  // ═══════════════ HANDLERS ═══════════════
  const handleBackdropPress = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleWalletSelect = useCallback(
    (walletType: WalletType) => {
      // For now, just close the modal - wallet integration would go here
      selectPaymentMethod(null); // Clear card selection when wallet is selected
      onClose();
    },
    [selectPaymentMethod, onClose]
  );

  const handleCardSelect = useCallback(
    (paymentMethodId: string) => {
      selectPaymentMethod(paymentMethodId);
      onClose();
    },
    [selectPaymentMethod, onClose]
  );

  const handleAddNewCard = useCallback(() => {
    // Would open add card flow
    onClose();
  }, [onClose]);

  // ═══════════════ RENDER HELPERS ═══════════════
  const renderWalletOption = useCallback(
    (type: WalletType, label: string, IconComponent: React.ElementType) => {
      const isApplePay = type === "apple_pay";

      return (
        <TouchableOpacity
          key={type}
          style={[
            styles.walletOption,
            isApplePay ? styles.walletOptionApple : styles.walletOptionGoogle,
          ]}
          onPress={() => handleWalletSelect(type)}
          activeOpacity={0.8}
        >
          <IconComponent
            size={20}
            color={isApplePay ? BrandColors.white : BrandColors.primary}
          />
          <Text
            size="md"
            weight="semiBold"
            color={isApplePay ? BrandColors.white : BrandColors.primary}
          >
            {label}
          </Text>
        </TouchableOpacity>
      );
    },
    [handleWalletSelect]
  );

  const renderCardOption = useCallback(
    (method: PaymentMethod) => {
      const isSelected = currentSelectedId === method.id;
      const expiryFormatted = `${String(method.expMonth).padStart(2, "0")}/${String(
        method.expYear
      ).slice(-2)}`;

      return (
        <TouchableOpacity
          key={method.id}
          style={[styles.cardOption, isSelected && styles.cardOptionSelected]}
          onPress={() => handleCardSelect(method.id)}
          activeOpacity={0.7}
        >
          {/* Card Icon Placeholder */}
          <View style={styles.cardIconContainer}>
            <Text size="xs" weight="bold" color={BrandColors.secondary}>
              {getBrandLabel(method.brand).toUpperCase().slice(0, 4)}
            </Text>
          </View>

          {/* Card Details */}
          <View style={styles.cardDetails}>
            <Text size="md" weight="semiBold" color={BrandColors.primary}>
              {getBrandLabel(method.brand)} •••• {method.last4}
            </Text>
            <Text size="sm" weight="regular" color="#6B7280">
              Expires {expiryFormatted}
            </Text>
          </View>

          {/* Selection Indicator */}
          {isSelected && (
            <View style={styles.checkContainer}>
              <Check size={16} color={BrandColors.white} />
            </View>
          )}
        </TouchableOpacity>
      );
    },
    [currentSelectedId, handleCardSelect]
  );

  // ═══════════════ RENDER ═══════════════
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      {/* Backdrop - tap to dismiss */}
      <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
        {/* Modal Content - prevent tap propagation */}
        <Pressable
          style={[styles.modalContent, { paddingBottom: insets.bottom + Spacing.lg }]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle Bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text size="xs" weight="medium" color="#9CA3AF" style={styles.headerLabel}>
              TOTAL AMOUNT
            </Text>
            <Text size="3xl" weight="bold" color={BrandColors.primary}>
              ${totalAmount.toFixed(2)}
            </Text>
            <Text size="sm" weight="medium" color="#6B7280">
              {serviceSummary} • {mechanicName}
            </Text>
          </View>

          {/* Payment Options */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Wallet Options */}
            <View style={styles.walletSection}>
              {renderWalletOption("apple_pay", "Apple Pay", Wallet)}
              {renderWalletOption("google_pay", "Google Pay", Smartphone)}
            </View>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text size="xs" weight="medium" color="#9CA3AF" style={styles.dividerText}>
                OR PAY WITH CARD
              </Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Saved Cards */}
            {paymentMethods.length > 0 && (
              <View style={styles.cardsSection}>
                {paymentMethods.map(renderCardOption)}
              </View>
            )}

            {/* Add New Card */}
            <TouchableOpacity
              style={styles.addCardOption}
              onPress={handleAddNewCard}
              activeOpacity={0.7}
            >
              <View style={styles.addCardIcon}>
                <CreditCard size={20} color="#6B7280" />
              </View>
              <View style={styles.addCardContent}>
                <Text size="md" weight="semiBold" color={BrandColors.primary}>
                  Enter New Card
                </Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" />
            </TouchableOpacity>

            {/* Security Note */}
            <View style={styles.securityNote}>
              <Lock size={14} color="#9CA3AF" />
              <Text size="xs" weight="medium" color="#9CA3AF">
                Secured & encrypted by Stripe
              </Text>
            </View>
          </ScrollView>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text size="md" weight="semiBold" color="#6B7280">
              Cancel
            </Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: BrandColors.white,
    borderTopLeftRadius: BorderRadius["2xl"],
    borderTopRightRadius: BorderRadius["2xl"],
    maxHeight: "85%",
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: BorderRadius.full,
    alignSelf: "center",
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
  },
  header: {
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  headerLabel: {
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  scrollView: {
    maxHeight: 400,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  walletSection: {
    gap: Spacing.md,
  },
  walletOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.xl,
  },
  walletOptionApple: {
    backgroundColor: BrandColors.primary,
  },
  walletOptionGoogle: {
    backgroundColor: BrandColors.white,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    letterSpacing: 0.5,
  },
  cardsSection: {
    gap: Spacing.md,
  },
  cardOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
    gap: Spacing.md,
  },
  cardOptionSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: "#F8FBFF",
  },
  cardIconContainer: {
    width: 48,
    height: 32,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  cardDetails: {
    flex: 1,
    gap: 2,
  },
  checkContainer: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    backgroundColor: BrandColors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  addCardOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: BrandColors.white,
    gap: Spacing.md,
  },
  addCardIcon: {
    width: 48,
    height: 32,
    borderRadius: BorderRadius.sm,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  addCardContent: {
    flex: 1,
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingTop: Spacing.sm,
  },
  cancelButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
});
