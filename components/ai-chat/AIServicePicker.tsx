/**
 * AIServicePicker
 *
 * PURPOSE: Service selector with category tabs and selectable service cards for AI chat booking
 *
 * USED IN: app/(main-tabs)/ai-chat/index.tsx (shown during service_selection stage)
 *
 * PROPS:
 *   - services (ServiceOption[]): Array of available services (default: DEFAULT_SERVICES)
 *   - onConfirm ((selectedServices: ServiceOption[]) => void): Callback with selected services
 *   - disabled (boolean): Whether selection is disabled
 *
 * EXAMPLE:
 *   <AIServicePicker
 *     onConfirm={(services) => handleServiceSelection(services)}
 *     disabled={isProcessing}
 *   />
 *
 * OWNER: Waleed Mansour
 */

// 1. React & React Native
import React, { useState, useMemo, useCallback } from 'react';
import { View, ScrollView, Pressable, StyleSheet } from 'react-native';

// 2. Expo & Third-party
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { Check } from 'lucide-react-native';

// 3. Shared UI (design system)
import { Text } from '@/components/shared-ui';

// 4. Constants, hooks, types
import { BrandColors, BorderRadius, Spacing, FontFamily } from '@/constants/theme';

// ============================================================================
// TYPES
// ============================================================================

export type ServiceCategory = 'maintenance' | 'tires' | 'brakes' | 'diagnostics';

export interface ServiceOption {
  id: string;
  name: string;
  description: string;
  category: ServiceCategory;
  price: string;
  duration: string;
}

interface AIServicePickerProps {
  services?: ServiceOption[];
  onConfirm: (selectedServices: ServiceOption[]) => void;
  disabled?: boolean;
}

// ============================================================================
// CATEGORY TABS
// ============================================================================

const CATEGORIES: { key: ServiceCategory; label: string }[] = [
  { key: 'maintenance', label: 'Maintenance' },
  { key: 'tires', label: 'Tires & Wheels' },
  { key: 'brakes', label: 'Brakes' },
  { key: 'diagnostics', label: 'Diagnostics' },
];

// ============================================================================
// DEFAULT SERVICES
// ============================================================================

export const DEFAULT_SERVICES: ServiceOption[] = [
  // Maintenance
  {
    id: 'svc_oil_change',
    name: 'Oil Change',
    description: 'Full synthetic oil & filter replacement',
    category: 'maintenance',
    price: '$45-75',
    duration: '30 min',
  },
  {
    id: 'svc_air_filter',
    name: 'Air Filter',
    description: 'Engine air filter replacement',
    category: 'maintenance',
    price: '$25-45',
    duration: '15 min',
  },
  {
    id: 'svc_fluid_check',
    name: 'Fluid Top-Off',
    description: 'Check & top off all fluids',
    category: 'maintenance',
    price: '$20-35',
    duration: '20 min',
  },
  // Tires & Wheels
  {
    id: 'svc_tire_rotation',
    name: 'Tire Rotation',
    description: 'Rotate tires for even wear',
    category: 'tires',
    price: '$25-40',
    duration: '30 min',
  },
  {
    id: 'svc_tire_balance',
    name: 'Wheel Balance',
    description: 'Balance all four wheels',
    category: 'tires',
    price: '$40-60',
    duration: '45 min',
  },
  {
    id: 'svc_tire_pressure',
    name: 'TPMS Check',
    description: 'Tire pressure sensor inspection',
    category: 'tires',
    price: '$15-30',
    duration: '15 min',
  },
  // Brakes
  {
    id: 'svc_brake_inspection',
    name: 'Brake Inspection',
    description: 'Full brake system check',
    category: 'brakes',
    price: '$50-75',
    duration: '30 min',
  },
  {
    id: 'svc_brake_pads',
    name: 'Brake Pads',
    description: 'Front or rear pad replacement',
    category: 'brakes',
    price: '$150-250',
    duration: '1-2 hrs',
  },
  {
    id: 'svc_brake_fluid',
    name: 'Brake Fluid',
    description: 'Brake fluid flush & fill',
    category: 'brakes',
    price: '$80-120',
    duration: '45 min',
  },
  // Diagnostics
  {
    id: 'svc_diagnostic_scan',
    name: 'Diagnostic Scan',
    description: 'Computer scan for error codes',
    category: 'diagnostics',
    price: '$75-125',
    duration: '30 min',
  },
  {
    id: 'svc_check_engine',
    name: 'Check Engine Light',
    description: 'Diagnose warning light cause',
    category: 'diagnostics',
    price: '$85-150',
    duration: '1 hr',
  },
  {
    id: 'svc_battery_test',
    name: 'Battery Test',
    description: 'Battery & charging system test',
    category: 'diagnostics',
    price: '$25-40',
    duration: '15 min',
  },
];

// ============================================================================
// CATEGORY TAB COMPONENT
// ============================================================================

function CategoryTab({
  category,
  isActive,
  onPress,
}: {
  category: { key: ServiceCategory; label: string };
  isActive: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.categoryTab, isActive && styles.categoryTabActive]}
    >
      <Text
        style={[styles.categoryTabText, isActive && styles.categoryTabTextActive]}
        size="sm"
        weight={isActive ? 'semiBold' : 'medium'}
      >
        {category.label}
      </Text>
    </Pressable>
  );
}

// ============================================================================
// SERVICE ITEM COMPONENT
// ============================================================================

function ServiceItem({
  service,
  selected,
  onToggle,
  index,
  disabled,
}: {
  service: ServiceOption;
  selected: boolean;
  onToggle: () => void;
  index: number;
  disabled?: boolean;
}) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View
      style={animatedStyle}
      entering={FadeInUp.delay(index * 40).duration(200)}
    >
      <Pressable
        onPress={onToggle}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={({ pressed }) => [
          styles.serviceItem,
          selected && styles.serviceItemSelected,
          pressed && !disabled && styles.serviceItemPressed,
          disabled && styles.serviceItemDisabled,
        ]}
      >
        {/* Service Info */}
        <View style={styles.serviceInfo}>
          <Text style={[styles.serviceName, selected && styles.serviceNameSelected]} weight="semiBold">
            {service.name}
          </Text>
          <Text style={styles.serviceDescription} size="sm">
            {service.description}
          </Text>
        </View>

        {/* Price & Duration */}
        <View style={styles.serviceMeta}>
          <Text style={[styles.servicePrice, selected && styles.servicePriceSelected]} weight="semiBold">
            {service.price}
          </Text>
          <Text style={styles.serviceDuration} size="xs">
            {service.duration}
          </Text>
        </View>

        {/* Selection Indicator */}
        <View style={[styles.selectionCircle, selected && styles.selectionCircleSelected]}>
          {selected && <Check size={12} color={BrandColors.white} strokeWidth={3} />}
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function AIServicePicker({
  services = DEFAULT_SERVICES,
  onConfirm,
  disabled = false,
}: AIServicePickerProps) {
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory>('maintenance');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter services by category
  const filteredServices = useMemo(() => {
    return services.filter((s) => s.category === selectedCategory);
  }, [services, selectedCategory]);

  const toggleService = useCallback((serviceId: string) => {
    if (disabled) return;
    
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(serviceId)) {
        newSet.delete(serviceId);
      } else {
        newSet.add(serviceId);
      }
      return newSet;
    });
  }, [disabled]);

  const handleConfirm = useCallback(() => {
    const selectedServices = services.filter((s) => selectedIds.has(s.id));
    onConfirm(selectedServices);
  }, [services, selectedIds, onConfirm]);

  const selectedCount = selectedIds.size;

  // Get selected services summary
  const selectedSummary = useMemo(() => {
    if (selectedCount === 0) return '';
    const names = services
      .filter((s) => selectedIds.has(s.id))
      .map((s) => s.name)
      .slice(0, 2);
    if (selectedCount > 2) {
      return `${names.join(', ')} +${selectedCount - 2} more`;
    }
    return names.join(', ');
  }, [services, selectedIds, selectedCount]);

  return (
    <View style={styles.container}>
      {/* Category Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryTabs}
      >
        {CATEGORIES.map((category) => (
          <CategoryTab
            key={category.key}
            category={category}
            isActive={selectedCategory === category.key}
            onPress={() => setSelectedCategory(category.key)}
          />
        ))}
      </ScrollView>

      {/* Service List */}
      <View style={styles.serviceList}>
        {filteredServices.map((service, index) => (
          <ServiceItem
            key={service.id}
            service={service}
            selected={selectedIds.has(service.id)}
            onToggle={() => toggleService(service.id)}
            index={index}
            disabled={disabled}
          />
        ))}
      </View>

      {/* Selected Summary & Confirm */}
      <View style={styles.footer}>
        {selectedCount > 0 && (
          <Text style={styles.selectedSummary} size="sm">
            {selectedSummary}
          </Text>
        )}
        <Pressable
          onPress={handleConfirm}
          disabled={selectedCount === 0 || disabled}
          style={({ pressed }) => [
            styles.confirmButton,
            selectedCount > 0 && styles.confirmButtonEnabled,
            pressed && selectedCount > 0 && styles.confirmButtonPressed,
            (selectedCount === 0 || disabled) && styles.confirmButtonDisabled,
          ]}
        >
          <Text
            style={[
              styles.confirmButtonText,
              selectedCount > 0 && styles.confirmButtonTextEnabled,
            ]}
            weight="semiBold"
          >
            {selectedCount === 0
              ? 'Select services'
              : `Continue with ${selectedCount} service${selectedCount > 1 ? 's' : ''}`}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)', // Semi-transparent, faded like suggestion pills
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
  },
  // Category Tabs
  categoryTabs: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  categoryTab: {
    paddingVertical: Spacing.xs + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  categoryTabActive: {
    backgroundColor: BrandColors.secondary + '20',
  },
  categoryTabText: {
    color: '#4A5568', // Softer, muted dark gray
  },
  categoryTabTextActive: {
    color: BrandColors.secondary,
  },
  // Service List
  serviceList: {
    padding: Spacing.sm,
    gap: Spacing.xs,
    maxHeight: 280,
  },
  // Service Item
  serviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  serviceItemSelected: {
    borderColor: BrandColors.secondary,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  serviceItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  serviceItemDisabled: {
    opacity: 0.5,
  },
  // Service Info
  serviceInfo: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  serviceName: {
    color: '#4A5568', // Softer, muted dark gray
    fontSize: 14,
    lineHeight: 18,
  },
  serviceNameSelected: {
    color: BrandColors.secondary,
  },
  serviceDescription: {
    color: '#A0AEC0', // Softer gray
    marginTop: 2,
    lineHeight: 16,
  },
  // Service Meta
  serviceMeta: {
    alignItems: 'flex-end',
    marginRight: Spacing.sm,
  },
  servicePrice: {
    color: '#4A5568', // Softer, muted dark gray
    fontSize: 14,
  },
  servicePriceSelected: {
    color: BrandColors.secondary,
  },
  serviceDuration: {
    color: '#A0AEC0', // Softer gray
    marginTop: 2,
  },
  // Selection Circle
  selectionCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionCircleSelected: {
    backgroundColor: BrandColors.secondary,
    borderColor: BrandColors.secondary,
  },
  // Footer
  footer: {
    padding: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
    gap: Spacing.xs,
  },
  selectedSummary: {
    color: '#4A5568', // Softer, muted dark gray
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  confirmButtonEnabled: {
    backgroundColor: BrandColors.secondary,
  },
  confirmButtonPressed: {
    opacity: 0.9,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    color: '#4A5568', // Softer, muted dark gray
    fontSize: 15,
  },
  confirmButtonTextEnabled: {
    color: BrandColors.white,
  },
});
