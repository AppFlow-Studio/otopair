/**
 * serviceIcons — slug → lucide icon mapping shared between the
 * Screen 2 row cards and the SelectedServicesSheet review surface.
 *
 * Single source of truth so the same service shows the same glyph
 * whether the user is looking at it on the category list or in
 * the cart review sheet.
 */

import {
  Battery,
  BatteryCharging,
  ClipboardCheck,
  Disc,
  Droplet,
  Filter,
  Gauge,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react-native";

export const SLUG_ICONS: Record<string, LucideIcon> = {
  oil_change: Droplet,
  filter_replacement: Filter,
  battery_test: Battery,
  battery_replacement: BatteryCharging,
  state_inspection: ClipboardCheck,
  emissions_test: ShieldCheck,
  check_engine_light: Zap,
  diagnostic_scan: Search,
  pre_purchase_inspection: ClipboardCheck,
  tire_rotation: Disc,
  tire_balance: Gauge,
  wheel_alignment: Settings,
  tire_replacement: Disc,
  brake_pad_replacement: Disc,
  rotor_replacement: Disc,
  brake_fluid_flush: Droplet,
  spark_plugs: Sparkles,
  timing_belt: Wrench,
  coolant_flush: Droplet,
  transmission_service: Droplet,
  power_steering_flush: Droplet,
  differential_service: Droplet,
  fuel_system_cleaning: Sparkles,
};

/** Lookup an icon for a service slug. Falls back to `Wrench` when
 *  the slug isn't in the map (defensive — keeps the UI from
 *  rendering a blank tile if the catalog adds a slug we haven't
 *  mapped yet). */
export function getServiceIcon(slug: string | undefined | null): LucideIcon {
  if (!slug) return Wrench;
  return SLUG_ICONS[slug] ?? Wrench;
}
