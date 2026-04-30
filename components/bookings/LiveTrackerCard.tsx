/**
 * LiveTrackerCard
 *
 * PURPOSE: Displays real-time service progress with vehicle info, mechanic details, progress bar, expandable service status timeline, and action buttons
 *
 * USED IN: app/(main-tabs)/bookings/index.tsx
 *
 * PROPS:
 *   - tracking (LiveTracking): The live tracking object containing service progress and details
 *   - onReschedule (() => void): Called when "Reschedule" button is pressed [optional]
 *   - onContactShop (() => void): Called when "Contact Shop" button is pressed [optional]
 *
 * EXAMPLE:
 *   <LiveTrackerCard
 *     tracking={liveTrackingData}
 *     onReschedule={() => router.push('/reschedule')}
 *     onContactShop={() => Linking.openURL(`tel:${shopPhone}`)}
 *   />
 *
 * OWNER: Ahmad Hamoudeh
 */

// 1. React & React Native
import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Switch, View } from "react-native";

// 2. Expo & Third-party
import { Car, Check, ChevronDown, ChevronUp, Clock, Phone, User } from "lucide-react-native";

// 3. Shared UI
import { Text } from "@/components/shared-ui";

// ============================================================================
// TYPES
// ============================================================================

export interface ServiceStage {
  id: string;
  title: string;
  description: string;
  status: "completed" | "current" | "pending";
}

export interface LiveTracking {
  id: string;
  // Car info
  carModel: string;
  carYear: string;
  licensePlate: string;
  /** Make logo URL from cdn_assets (content); used as car thumbnail when no vehicle image */
  makeLogoUrl?: string;
  // Mechanic info
  mechanicName: string;
  shopName: string;
  mechanicImage?: string;
  shopPhone?: string;
  // Progress
  currentStage: string;
  progressPercent: number;
  stages: ServiceStage[];
  // Delay info
  delayMinutes?: number;
}

interface LiveTrackerCardProps {
  tracking: LiveTracking;
  onReschedule?: () => void;
  onContactShop?: () => void;
  /** Called when the Live Tracker toggle is flipped off. Implementer demotes the booking. */
  onToggleLiveTracker?: (bookingId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function LiveTrackerCard({ tracking, onReschedule, onContactShop, onToggleLiveTracker }: LiveTrackerCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [carImageError, setCarImageError] = useState(false);
  const showCarPlaceholder = !tracking.makeLogoUrl?.trim() || carImageError;

  const toggleExpanded = () => {
    setIsExpanded(!isExpanded);
  };

  const renderStageIcon = (status: ServiceStage["status"]) => {
    switch (status) {
      case "completed":
        return (
          <View style={styles.stageIconCompleted}>
            <Check size={14} color="#FFFFFF" strokeWidth={3} />
          </View>
        );
      case "current":
        return (
          <View style={styles.stageIconCurrent}>
            <Clock size={12} color="#FFFFFF" strokeWidth={2} />
          </View>
        );
      case "pending":
        return (
          <View style={styles.stageIconPending}>
            <Check size={14} color="#D1D5DB" strokeWidth={2} />
          </View>
        );
    }
  };

  return (
    <View style={styles.card}>
      {/* In Progress Badge */}
      <View style={styles.progressBadge}>
        <Text weight="semiBold" size="sm" color="#5299FE">
          In Progress...
        </Text>
      </View>

      {/* Car and Mechanic Info Row */}
      <View style={styles.infoRow}>
        {/* Car Info */}
        <View style={styles.carInfo}>
          {showCarPlaceholder ? (
            <View style={styles.carPlaceholder}>
              <Car size={20} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          ) : (
            <Image
              source={{ uri: tracking.makeLogoUrl! }}
              style={styles.carImage}
              resizeMode="contain"
              onError={() => setCarImageError(true)}
            />
          )}
          <View style={styles.carDetails}>
            <Text weight="bold" size="sm" color="#1F2937">
              {tracking.carModel} {tracking.carYear}
            </Text>
            <Text weight="regular" size="xs" color="#6B7280">
              {tracking.licensePlate}
            </Text>
          </View>
        </View>

        {/* Mechanic Info */}
        <View style={styles.mechanicInfo}>
          {tracking.mechanicImage ? (
            <Image source={{ uri: tracking.mechanicImage }} style={styles.mechanicImage} />
          ) : (
            <View style={styles.mechanicPlaceholder}>
              <User size={18} color="#9CA3AF" strokeWidth={1.5} />
            </View>
          )}
          <View style={styles.mechanicDetails}>
            <Text weight="bold" size="sm" color="#1F2937">
              {tracking.mechanicName}
            </Text>
            <Text weight="regular" size="xs" color="#6B7280">
              {tracking.shopName}
            </Text>
          </View>
        </View>
      </View>

      {/* Live Tracker toggle — flip off to move back to Upcoming */}
      {onToggleLiveTracker ? (
        <View style={styles.liveToggleRow}>
          <View style={styles.liveToggleLabel}>
            <View style={styles.liveDotActive} />
            <Text weight="semiBold" size="sm" color="#5299FE">
              Live Tracker On
            </Text>
          </View>
          <Switch
            value={true}
            onValueChange={() => onToggleLiveTracker(tracking.id)}
            trackColor={{ false: "#E5E5EA", true: "#5299FE" }}
            thumbColor="#FFFFFF"
            ios_backgroundColor="#E5E5EA"
          />
        </View>
      ) : null}

      {/* Progress Section */}
      <View style={styles.progressSection}>
        <View style={styles.progressHeader}>
          <Text weight="semiBold" size="sm" color="#5299FE">
            {tracking.currentStage}
          </Text>
          <Text weight="semiBold" size="sm" color="#5299FE">
            {tracking.progressPercent}%
          </Text>
        </View>
        <View style={styles.progressBarContainer}>
          <View style={[styles.progressBar, { width: `${tracking.progressPercent}%` }]} />
        </View>
      </View>

      {/* Service Status Section */}
      <View style={styles.serviceStatusContainer}>
        <Pressable onPress={toggleExpanded} style={styles.serviceStatusHeader}>
          <View style={styles.serviceStatusTitleRow}>
            <View style={styles.greenDot} />
            <Text weight="bold" size="lg" color="#1F2937">
              Service Status
            </Text>
          </View>
          {isExpanded ? <ChevronUp size={24} color="#6B7280" /> : <ChevronDown size={24} color="#6B7280" />}
        </Pressable>

        {isExpanded && (
          <View style={styles.stagesContainer}>
            {tracking.stages.map((stage, index) => (
              <View key={stage.id} style={styles.stageRow}>
                <View style={styles.stageIconColumn}>
                  {renderStageIcon(stage.status)}
                  {index < tracking.stages.length - 1 && (
                    <View style={[styles.stageLine, stage.status === "completed" && styles.stageLineCompleted]} />
                  )}
                </View>
                <View style={styles.stageContent}>
                  <Text weight="bold" size="sm" color={stage.status === "pending" ? "#9CA3AF" : "#1F2937"}>
                    {stage.title}
                  </Text>
                  <Text weight="regular" size="xs" color={stage.status === "pending" ? "#D1D5DB" : "#6B7280"}>
                    {stage.description}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Delay Notification */}
      {tracking.delayMinutes && tracking.delayMinutes > 0 && (
        <Text weight="regular" size="sm" color="#1F2937" style={styles.delayText}>
          Your service is running{" "}
          <Text weight="semiBold" size="sm" color="#EF4444">
            {tracking.delayMinutes} min late
          </Text>
        </Text>
      )}

      {/* Reschedule Button */}
      <Pressable
        onPress={onReschedule}
        style={({ pressed }) => [styles.rescheduleButton, pressed && styles.buttonPressed]}
      >
        <Text weight="semiBold" size="sm" color="#1F2937">
          Reschedule
        </Text>
      </Pressable>

      {/* Contact Shop Section */}
      <Text weight="regular" size="sm" color="#1F2937" style={styles.contactLabel}>
        Contact Shop:
      </Text>
      <Pressable
        onPress={onContactShop}
        style={({ pressed }) => [styles.contactButton, pressed && styles.buttonPressed]}
      >
        <Phone size={20} color="#FFFFFF" strokeWidth={2} />
      </Pressable>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: "#5299FE",
  },
  progressBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#DBEAFE",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  carInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  carImage: {
    width: 50,
    height: 32,
    marginRight: 8,
  },
  carPlaceholder: {
    width: 36,
    height: 36,
    marginRight: 8,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  carDetails: {
    gap: 2,
  },
  mechanicInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  mechanicImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
  mechanicPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
  },
  mechanicDetails: {
    gap: 2,
  },
  liveToggleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginBottom: 12,
  },
  liveToggleLabel: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  liveDotActive: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#5299FE",
  },
  progressSection: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#E5E7EB",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: "#5299FE",
    borderRadius: 3,
  },
  serviceStatusContainer: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  serviceStatusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  serviceStatusTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  greenDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#22C55E",
  },
  stagesContainer: {
    marginTop: 20,
  },
  stageRow: {
    flexDirection: "row",
    minHeight: 60,
  },
  stageIconColumn: {
    width: 30,
    alignItems: "center",
  },
  stageIconCompleted: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#5299FE",
    justifyContent: "center",
    alignItems: "center",
  },
  stageIconCurrent: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#5299FE",
    justifyContent: "center",
    alignItems: "center",
  },
  stageIconPending: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
  },
  stageLine: {
    width: 2,
    flex: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },
  stageLineCompleted: {
    backgroundColor: "#5299FE",
  },
  stageContent: {
    flex: 1,
    marginLeft: 12,
    paddingBottom: 16,
  },
  delayText: {
    marginBottom: 12,
  },
  rescheduleButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    marginBottom: 16,
  },
  contactLabel: {
    marginBottom: 8,
  },
  contactButton: {
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: "#1F2937",
    alignItems: "center",
  },
  buttonPressed: {
    opacity: 0.7,
  },
});

export default LiveTrackerCard;
