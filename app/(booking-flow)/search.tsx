/**
 * Booking-flow search screen — opens from the 🔍 button on Screen 1.
 *
 * Uber-Eats-style entry: focused TextInput slides in with the
 * keyboard up. Typing filters the v5 services catalog live —
 * matches taxonomy `displayLabel` + `searchAliases` (e.g. typing
 * "rotors" surfaces "Brake rotor replacement"). Empty query shows
 * the centered Otopair logo placeholder. Tap a result and the
 * service either pre-selects + routes to Choose Mechanic, or
 * hands off to the dedicated tire/rotor/diagnostic flow when the
 * slug calls for it (same rules as the Quick Book row on Screen 1).
 */

import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, ChevronRight, Store, Wrench } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { HANDOFF_SLUGS } from "@/constants/serviceTaxonomy";
import { useBookingStore } from "@/stores/useBookingStore";
import type { Service } from "@/stores/types/store.types";

const MAX_RESULTS = 12;

/** Score a service against a lowercased query. Mirrors the scoring
 *  in useSearchStore.getMatchingServices, but uncapped so a
 *  dedicated search screen can render the full match list. */
function scoreService(query: string, service: Service): number {
  const labelLower = (service.displayLabel ?? service.name).toLowerCase();
  const descLower = service.description.toLowerCase();
  const aliases = service.searchAliases ?? [];

  if (labelLower === query) return 100;
  if (aliases.some((a) => a.toLowerCase() === query)) return 95;
  if (labelLower.startsWith(query)) return 80;
  if (aliases.some((a) => a.toLowerCase().startsWith(query))) return 75;
  if (labelLower.includes(query)) return 60;
  if (aliases.some((a) => a.toLowerCase().includes(query))) return 55;
  if (descLower.includes(query)) return 40;
  return 0;
}

const OTOPAIR_LOGO = require("@/assets/images/pin-logo-3d.png");

export default function BookingFlowSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");

  const availableServices = useBookingStore((s) => s.availableServices);
  const toggleServiceSelection = useBookingStore((s) => s.toggleServiceSelection);
  const selectedServiceIds = useBookingStore((s) => s.selectedServiceIds);

  // Auto-focus the input every time the screen comes into focus so
  // the keyboard slides up immediately — `useFocusEffect` waits
  // until after the stack transition is done, so the focus
  // actually sticks on iOS (a mount-time setTimeout can race the
  // slide-from-right animation and lose).
  useFocusEffect(
    useCallback(() => {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }, []),
  );

  // Live-filter the catalog. Same alias-aware scoring as the
  // useSearchStore helper, but uncapped so a dedicated search
  // screen surfaces every match (capped at MAX_RESULTS for sanity).
  const results: Service[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    const scored = availableServices
      .map((service) => ({ service, score: scoreService(q, service) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_RESULTS);
    return scored.map((item) => item.service);
  }, [query, availableServices]);

  const handlePick = (service: Service) => {
    inputRef.current?.blur();

    // Route to the category screen for this service's tab.
    // For non-handoff services we pre-select the row (checkmark on)
    // so the user lands ready to tap Continue. Handoff services
    // (tire/rotor) intentionally don't get pre-selected — their
    // row tap opens a dedicated flow, not a toggle, and showing a
    // pre-checked card would mislead the state.
    const isHandoff = !!service.slug && HANDOFF_SLUGS.has(service.slug);
    if (!isHandoff && !selectedServiceIds.includes(service.id)) {
      toggleServiceSelection(service.id);
    }
    if (service.tab) {
      router.push({
        pathname: "/(booking-flow)/category/[tab]",
        params: { tab: service.tab },
      });
    } else {
      // Service has no v5 tab (shouldn't happen post-merge, but
      // safe fallback): just go back to Screen 1.
      router.push("/(booking-flow)/select-services");
    }
  };

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(booking-flow)/select-services");
  };

  const showResults = query.trim().length > 0;
  const showEmpty = showResults && results.length === 0;

  return (
    <View style={styles.root}>
      {/* Top control row */}
      <View style={[styles.topRow, { paddingTop: insets.top + 6 }]}>
        <Pressable
          style={styles.backBtn}
          onPress={onBack}
          hitSlop={8}
          accessibilityLabel="Back"
        >
          <ArrowLeft size={20} color="#1F2937" strokeWidth={2} />
        </Pressable>
        <View style={styles.inputWrap}>
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search services"
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            autoFocus
            style={styles.input}
          />
        </View>
        <Pressable
          style={styles.shopBtn}
          onPress={() => {
            /* TODO scope toggle — Ahmad to spec */
          }}
          hitSlop={8}
          accessibilityLabel="Switch search scope"
        >
          <Store size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Body — logo placeholder, live results, or empty state */}
      {!showResults ? (
        <View style={styles.logoBody}>
          <Image source={OTOPAIR_LOGO} style={styles.logo} resizeMode="contain" />
        </View>
      ) : showEmpty ? (
        <View style={styles.emptyBody}>
          <Text size="md" weight="medium" color="#6B7280" center>
            No services match “{query.trim()}”
          </Text>
          <Text size="sm" weight="regular" color="#9CA3AF" center style={styles.emptyHint}>
            Try “rotors”, “smog”, or “oil”.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.resultsContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {results.map((svc) => (
            <Pressable
              key={svc.id}
              style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
              onPress={() => handlePick(svc)}
              accessibilityRole="button"
              accessibilityLabel={`Book ${svc.displayLabel ?? svc.name}`}
            >
              <View style={styles.iconTile}>
                <Wrench size={18} color="#4B5563" strokeWidth={2} />
              </View>
              <View style={styles.rowText}>
                <Text size="md" weight="bold" color="#0F172A" numberOfLines={1}>
                  {svc.displayLabel ?? svc.name}
                </Text>
                {svc.subtitle ? (
                  <Text size="sm" weight="regular" color="#6B7280" numberOfLines={1}>
                    {svc.subtitle}
                  </Text>
                ) : null}
              </View>
              <ChevronRight size={18} color="#9CA3AF" strokeWidth={2} />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  inputWrap: {
    flex: 1,
    backgroundColor: "#F2F2F7",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  input: {
    fontFamily: "Urbanist-Regular",
    fontSize: 16,
    color: "#0F172A",
    padding: 0,
  },
  shopBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F2F7",
    alignItems: "center",
    justifyContent: "center",
  },
  logoBody: {
    flex: 1,
    alignItems: "center",
    paddingTop: 56,
  },
  logo: {
    width: 180,
    height: 180,
  },
  emptyBody: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyHint: {
    marginTop: 6,
  },
  resultsContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(15, 23, 42, 0.04)",
    marginBottom: 8,
  },
  rowPressed: {
    backgroundColor: "rgba(15, 23, 42, 0.08)",
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
});
