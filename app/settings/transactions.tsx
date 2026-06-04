/**
 * Past Services
 *
 * PURPOSE: Shop-style "Orders" feed of the user's completed bookings.
 *          Each row is a receipt; tap opens the shared <ReceiptSheet />.
 *          Replaces both the old transactions ledger and the dedicated
 *          Booking History route.
 *
 * USED IN: Settings → Past Services (My Garage section).
 */

import React, { useMemo, useRef, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import {
  Calendar,
  ChevronLeft,
  Search,
  Wrench,
} from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CardShadow, ListSpacing, SurfaceColors } from "@/constants/theme";
import { useMyBookingsWithDetails } from "@/hooks/useMyBookingsWithDetails";

const INK = "#0F172A";
const MUTED = "#86868B";

function fmtUSD(n: number | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function PastServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { historyBookings } = useMyBookingsWithDetails();

  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<TextInput>(null);

  // Past services = completed bookings only, sorted newest first.
  const completed = useMemo(
    () => historyBookings.filter((b) => b.status === "completed"),
    [historyBookings],
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return completed;
    return completed.filter((b) => {
      return (
        b.services.some((s) => s.toLowerCase().includes(q)) ||
        b.shopName.toLowerCase().includes(q) ||
        b.mechanicName.toLowerCase().includes(q)
      );
    });
  }, [completed, searchQuery]);

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(main-tabs)/home");
  };

  return (
    <View style={styles.screen}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top,
              paddingBottom: insets.bottom + 32,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {/* Back button — inside the ScrollView so it scrolls away
              with the rest of the content (no pinned chrome). */}
          <View style={styles.topBar}>
            <Pressable onPress={handleBack} hitSlop={12} style={styles.backBtn}>
              <ChevronLeft size={26} color={INK} />
            </Pressable>
            <View style={{ flex: 1 }} />
          </View>
          {/* Hero header */}
          <View style={styles.heroRow}>
            <Text weight="bold" color={INK} style={styles.heroTitle}>
              Past Services
            </Text>
          </View>

          {/* Search bar */}
          <View style={styles.searchContainer}>
            <Search size={18} color="#9CA3AF" strokeWidth={2} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Search past services..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>

          {/* List */}
          {filtered.length > 0 ? (
            <View style={styles.list}>
              {filtered.map((b) => (
                <PastServiceRow
                  key={b.id}
                  booking={b}
                />
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Calendar size={48} color="#9CA3AF" strokeWidth={1.5} />
              </View>
              <Text weight="semiBold" size="lg" color="#374151" center>
                No Past Services
              </Text>
              <Text size="sm" color="#6B7280" center style={styles.emptyText}>
                {searchQuery
                  ? "Nothing matched your search."
                  : "You haven't completed any services yet."}
              </Text>
            </View>
          )}
        </ScrollView>
      </View>
  );
}

interface RowProps {
  booking: ReturnType<typeof useMyBookingsWithDetails>["historyBookings"][number];
}

function PastServiceRow({ booking }: RowProps) {
  const subtitle = useMemo(() => {
    const services = booking.services.length;
    const itemLabel = `${services} service${services === 1 ? "" : "s"}`;
    return `${booking.shopName} · ${itemLabel} · ${fmtUSD(booking.totalCost)}`;
  }, [booking.shopName, booking.services.length, booking.totalCost]);

  return (
    <Link
      href={{
        pathname: "/settings/past-service/[bookingId]",
        params: { bookingId: booking.id },
      }}
      asChild
    >
      <Pressable>
        {({ pressed }) => (
          <View
            style={[
              styles.row,
              pressed && styles.rowPressed,
            ]}
          >
            <View style={styles.thumb}>
              {booking.makeLogoUrl ? (
                <Image
                  source={{ uri: booking.makeLogoUrl }}
                  style={styles.thumbImage}
                  resizeMode="contain"
                />
              ) : (
                <Wrench size={22} color="#5299FE" strokeWidth={1.8} />
              )}
            </View>
            <View style={styles.rowText}>
              <Text weight="bold" size="md" color={INK} numberOfLines={1}>
                Completed {booking.date}
              </Text>
              <Text size="sm" color={MUTED} style={styles.rowSubtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            </View>
            {/* Invisible AppleZoom source covering the whole row. Lets iOS
                register the row as the morph origin without the thumbnail
                (or any other visible element) appearing to be the source. */}
            <View
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            >
              <Link.AppleZoom>
                <View style={styles.zoomSource} />
              </Link.AppleZoom>
            </View>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 32,
  },
  backBtn: {
    width: 40,
    height: 40,
    marginLeft: -16,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  heroRow: {
    alignItems: "center",
    marginTop: -10,
    marginBottom: 10,
  },
  heroTitle: {
    fontSize: 28,
    lineHeight: 34,
    textAlign: "center",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F2F2F7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    marginBottom: 20,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: "#1F2937",
    fontFamily: "Urbanist-Regular",
  },
  list: {
    paddingTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: ListSpacing.rowVertical,
    gap: 12,
  },
  rowPressed: {
    opacity: 0.7,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: SurfaceColors.cardSurface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  zoomSource: {
    flex: 1,
    backgroundColor: "transparent",
  },
  thumbImage: {
    width: 56,
    height: 56,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowSubtitle: {
    marginTop: 2,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 8,
    lineHeight: 22,
  },
});
