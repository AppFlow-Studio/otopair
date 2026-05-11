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
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

// 2. Expo & Third-party
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

// 3. Shared UI
import { Button, Text } from '@/components/shared-ui';

// 4. Flow-specific components
import SharedElementModal, { LayoutInfo } from './SharedElementModal';

// 5. Constants, hooks, types
import { BrandColors, Colors, Spacing } from '@/constants/theme';
import { scale, moderateScale } from '@/utils/responsive';
import DocumentThumbnail from './DocumentThumbnail';

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

export interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
  size?: number;
}

interface ServiceHistoryProps {
  records: ServiceRecord[];
  onAddNotes?: (id: string) => void;
  onDownloadReceipt?: (id: string) => void;
  onAddServiceHistory?: () => void;
  documents?: PickedDocument[];
  onRemoveDocument?: (index: number) => void;
  onOpenDocument?: (document: PickedDocument) => void;
  /** Page bg is dark — flip the section header to white. */
  isDarkBg?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ServiceHistory({
  records,
  onAddNotes,
  onDownloadReceipt,
  onAddServiceHistory,
  documents,
  onRemoveDocument,
  onOpenDocument,
  isDarkBg = false,
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
        <Text weight="semiBold" size="lg" color={isDarkBg ? "#FFFFFF" : Colors.light.text}>
          Service History
        </Text>
      </View>

      {/* Always show Add button */}
      {onAddServiceHistory && (
        <Pressable
          onPress={onAddServiceHistory}
          style={({ pressed }) => [
            styles.addHistoryBtn,
            pressed && styles.addHistoryBtnPressed,
          ]}
        >
          <Ionicons name="add-circle-outline" size={22} color="#5299FE" />
          <Text weight="semiBold" size="md" color="#5299FE">
            Add Service History
          </Text>
        </Pressable>
      )}

      {/* Document thumbnails row */}
      {documents && documents.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbnailRow}
          style={styles.thumbnailScroll}
        >
          {documents.map((doc, index) => (
            <DocumentThumbnail
              key={`${doc.name}-${index}`}
              document={doc}
              onRemove={() => onRemoveDocument?.(index)}
              onPress={() => onOpenDocument?.(doc)}
            />
          ))}
        </ScrollView>
      )}

      {/* Records card */}
      {records.length > 0 && (
        <Pressable
          ref={cardRef}
          onPress={handlePress}
          style={({ pressed }) => [
            styles.cardOuter,
            pressed && styles.cardPressed,
            (onAddServiceHistory || (documents && documents.length > 0)) && styles.cardWithTopMargin,
          ]}
        >
          <BlurView intensity={22} tint="light" style={styles.blurContainer}>
            <View style={styles.whiteOverlay} />
          </BlurView>
          <View style={styles.collapsibleCard}>
            <View style={styles.headerSection}>
              <View style={styles.collapsibleHeader}>
                <View style={styles.headerTextContainer}>
                  <Text weight="semiBold" size="xl" color={Colors.light.text}>
                    Your Service History
                  </Text>
                  <Text size="sm" color={Colors.light.text}>
                    {records.length} past service{records.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color="#D1D5DB"
                />
              </View>
            </View>
          </View>
        </Pressable>
      )}

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
    marginTop: scale(24),
    paddingHorizontal: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: scale(12),
  },
  addHistoryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: scale(8),
    paddingVertical: scale(16),
    borderRadius: moderateScale(16),
    borderWidth: 1.5,
    borderColor: 'rgba(82, 153, 254, 0.25)',
    borderStyle: 'dashed',
    backgroundColor: 'rgba(82, 153, 254, 0.04)',
  },
  addHistoryBtnPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  thumbnailScroll: {
    marginTop: scale(12),
  },
  thumbnailRow: {
    gap: scale(8),
    paddingRight: scale(4),
  },
  cardWithTopMargin: {
    marginTop: scale(12),
  },
  cardOuter: {
    borderRadius: moderateScale(16),
    overflow: 'hidden',
    position: 'relative',
    // Frosted glass border
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    // Soft diffused shadow
    shadowColor: 'rgba(0, 0, 0, 0.06)',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 2,
  },
  blurContainer: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: moderateScale(16),
  },
  whiteOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 255, 255, 0.68)',
  },
  collapsibleCard: {
    overflow: 'hidden',
    backgroundColor: 'transparent',
    borderRadius: moderateScale(16),
  },
  cardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  headerSection: {
    backgroundColor: 'transparent',
  },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: scale(12),
    paddingVertical: scale(10),
  },
  headerTextContainer: {
    flex: 1,
    gap: scale(6),
  },
  // Expanded modal content styles
  emptyState: {
    paddingVertical: scale(48),
    alignItems: 'center',
    gap: scale(8),
  },
  emptyStateText: {
    marginTop: scale(8),
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
    marginBottom: scale(12),
  },
  recordMiddleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: scale(16),
  },
  servicesText: {
    flex: 1,
    marginRight: scale(16),
  },
  recordBottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  outlinedButton: {
    paddingHorizontal: scale(18),
    paddingVertical: scale(10),
    borderRadius: moderateScale(14),
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.8)',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  primaryButton: {
    paddingHorizontal: scale(18),
    paddingVertical: scale(10),
    borderRadius: moderateScale(14),
    backgroundColor: 'rgba(20, 28, 36, 0.9)',
    shadowColor: 'rgba(0, 0, 0, 0.2)',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 8,
  },
});

export default ServiceHistory;
