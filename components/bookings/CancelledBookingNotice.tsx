/**
 * CancelledBookingNotice
 *
 * Banner under a cancelled booking on the My Bookings list. A cancelled
 * booking (by the shop, the customer, or the auto-expiry cron) stays on the
 * Bookings tab for 24h so the customer can see what happened instead of the
 * card silently vanishing; this banner says who cancelled, why (when the
 * shop picked a customer-safe reason), and when the card goes away.
 *
 * The 24h window itself is enforced by useMyBookingsWithDetails
 * (CANCELLED_CARD_TTL_MS); this only renders the countdown.
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { XCircle } from 'lucide-react-native';
import { Text } from '@/components/shared-ui';
import { CANCELLED_CARD_TTL_MS } from '@/hooks/useMyBookingsWithDetails';

interface CancelledBookingNoticeProps {
  cancelledAtMs?: number;
  cancelledByRole?: string;
  shopName?: string;
  reasonLabel?: string;
}

function formatRemaining(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h`;
}

function headline(role: string | undefined, shopName: string | undefined): string {
  if (role === 'customer') return 'You cancelled this booking';
  if (role === 'system') return "Cancelled — the shop didn't confirm in time";
  return shopName ? `Cancelled by ${shopName}` : 'Cancelled by the shop';
}

export function CancelledBookingNotice({
  cancelledAtMs,
  cancelledByRole,
  shopName,
  reasonLabel,
}: CancelledBookingNoticeProps) {
  // Minute tick so the countdown stays honest while the screen is open.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const remainingMs =
    cancelledAtMs != null ? cancelledAtMs + CANCELLED_CARD_TTL_MS - now : null;
  // The system-role headline already explains the reason.
  const showReason = !!reasonLabel && cancelledByRole !== 'system';

  return (
    <View style={styles.container}>
      <XCircle size={18} color="#DC2626" strokeWidth={2} />
      <View style={styles.textCol}>
        <Text weight="semiBold" size="sm" color="#991B1B">
          {headline(cancelledByRole, shopName)}
        </Text>
        {showReason ? (
          <Text weight="regular" size="xs" color="#7F1D1D">
            Reason: {reasonLabel}
          </Text>
        ) : null}
        {remainingMs != null && remainingMs > 0 ? (
          <Text weight="regular" size="xs" color="#6B7280" style={styles.expiry}>
            This will disappear from Bookings in {formatRemaining(remainingMs)}. You
            can still find it in Booking History.
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  textCol: {
    flex: 1,
    gap: 2,
  },
  expiry: {
    marginTop: 4,
  },
});
