/**
 * ServiceHistory
 *
 * PURPOSE: Displays a "Service History" section that, when pressed, expands into
 *          a full-screen modal with a shared element transition and glassy blur effect.
 *
 * USED IN: app/(main-tabs)/cars/index.tsx (below MaintenanceTracker on My Car page)
 *
 * PROPS:
 *   - records (ServiceRecord[]): Array of past service records to display
 *   - onAddNotes ((id: string) => void): Called when "Add Notes" is pressed [optional]
 *   - onDownloadReceipt ((id: string) => void): Called when "Download Receipt" is pressed [optional]
 *
 * EXAMPLE:
 *   <ServiceHistory
 *     records={serviceRecords}
 *     onAddNotes={(id) => openNotesModal(id)}
 *     onDownloadReceipt={(id) => downloadPdf(id)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { Ionicons } from '@expo/vector-icons';

// 3. Shared UI
import { Button, Text } from '@/components/shared-ui';

// 4. Flow-specific components
import SharedElementModal, { LayoutInfo } from './SharedElementModal';

// 5. Constants, hooks, types
import { BorderRadius, BrandColors, Colors, Shadows, Spacing } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceRecord {
  id: string;
  date: string;
  facilityName: string;
  services: string[];
  totalCost: number;
}

interface ServiceHistoryProps {
  records: ServiceRecord[];
  onAddNotes?: (id: string) => void;
  onDownloadReceipt?: (id: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceHistory({
  records,
  onAddNotes,
  onDownloadReceipt,
}: ServiceHistoryProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [layoutInfo, setLayoutInfo] = useState<LayoutInfo | null>(null);
  const cardRef = useRef<View>(null);

  // Measure the card position and open modal
  const handlePress = () => {
    cardRef.current?.measureInWindow((x, y, width, height) => {
      setLayoutInfo({ x, y, width, height });
      setModalVisible(true);
    });
  };

  // Close modal
  const handleClose = () => {
    setModalVisible(false);
  };

  // Format cost as currency string
  const formatCost = (cost: number) => {
    return `$${cost.toLocaleString()}`;
  };

  // Format services list as comma-separated string
  const formatServices = (services: string[]) => {
    return services.join(', ');
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.sectionHeader}>
        <Text weight="semiBold" size="lg" color={Colors.light.text}>
          Service History
        </Text>
      </View>

      {/* Pressable Card - triggers modal */}
      <Pressable
        ref={cardRef}
        onPress={handlePress}
        style={({ pressed }) => [
          styles.collapsibleCard,
          pressed && styles.cardPressed,
        ]}
      >
        {/* Preview Header */}
        <View style={styles.headerSection}>
          <View style={styles.collapsibleHeader}>
            <View style={styles.headerTextContainer}>
              <Text weight="semiBold" size="xl" color={Colors.light.text}>
                Your Service History
              </Text>
              <Text size="sm" color={BrandColors.secondary}>
                {records.length} past service{records.length !== 1 ? 's' : ''}
              </Text>
            </View>

            {/* Arrow indicator */}
            <Ionicons
              name="chevron-forward"
              size={24}
              color="#9CA3AF"
            />
          </View>
        </View>
      </Pressable>

      {/* Expanded Modal */}
      <SharedElementModal
        visible={modalVisible}
        layoutInfo={layoutInfo}
        onClose={handleClose}
        title="Service History"
      >
        {/* Empty State */}
        {records.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={48} color="#9CA3AF" />
            <Text weight="medium" size="md" color="#6B7280" style={styles.emptyStateText}>
              No service history yet.
            </Text>
            <Text size="sm" color="#9CA3AF">
              Your past services will appear here.
            </Text>
          </View>
        ) : (
          // Service Records List
          records.map((record, index) => (
            <View
              key={record.id}
              style={[
                styles.recordCard,
                index < records.length - 1 && styles.recordCardWithBorder,
              ]}
            >
              {/* Top Row: Date and Facility */}
              <View style={styles.recordTopRow}>
                <Text weight="medium" size="md" color={Colors.light.text}>
                  {record.date}
                </Text>
                <Text weight="medium" size="md" color={Colors.light.text}>
                  {record.facilityName}
                </Text>
              </View>

              {/* Middle Row: Services and Cost */}
              <View style={styles.recordMiddleRow}>
                <Text size="sm" color={Colors.light.text} style={styles.servicesText}>
                  {formatServices(record.services)}
                </Text>
                <Text weight="semiBold" size="md" color={BrandColors.secondary}>
                  {formatCost(record.totalCost)}
                </Text>
              </View>

              {/* Bottom Row: Action Buttons */}
              <View style={styles.recordBottomRow}>
                <Button
                  variant="ghost"
                  onPress={() => onAddNotes?.(record.id)}
                  style={styles.outlinedButton}
                >
                  <Text weight="medium" size="xs" color={Colors.light.text}>
                    Add Notes
                  </Text>
                </Button>

                <Button
                  variant="primary"
                  onPress={() => onDownloadReceipt?.(record.id)}
                  style={styles.primaryButton}
                >
                  <Text weight="medium" size="xs" color="#FFFFFF">
                    Download Receipt
                  </Text>
                </Button>
              </View>
            </View>
          ))
        )}
      </SharedElementModal>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  collapsibleCard: {
    backgroundColor: '#f9fafc',
    borderRadius: BorderRadius.lg,
    ...Shadows.sm,
    overflow: 'hidden',
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  headerSection: {
    backgroundColor: '#ffffff',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  headerTextContainer: {
    flex: 1,
    gap: 4,
  },
  // Expanded modal content styles
  emptyState: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyStateText: {
    marginTop: 8,
  },
  recordCard: {
    paddingVertical: Spacing.lg,
  },
  recordCardWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  servicesText: {
    flex: 1,
    marginRight: 16,
  },
  recordBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outlinedButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  primaryButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
});

export default ServiceHistory;
