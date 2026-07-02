/**
 * Bookings → Recommended services (standalone).
 *
 * Kept as a routable screen so deep links (notifications, "view details"
 * out of a rec-history row, etc.) still land somewhere sensible. The
 * Bookings tab now surfaces the same content as a third segment in the
 * top pill — both paths render the shared
 * `RecommendedServicesContent` component.
 */

import React, { useLayoutEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "expo-router";
import { guardedRouter as router } from "@/lib/navigationLock";
import { ChevronLeft } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { RecommendedServicesContent } from "@/components/bookings/RecommendedServicesContent";
import { moderateScale, scale } from "@/utils/responsive";

export default function RecommendedHistoryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (parent) parent.setOptions({ tabBarStyle: { display: "none" } });
    return () => {
      if (parent) parent.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation]);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backChip}
          hitSlop={12}
        >
          <ChevronLeft size={moderateScale(22)} color="#141C24" />
        </Pressable>
        <Text weight="bold" style={styles.headerTitle}>
          Recommended services
        </Text>
        <View style={styles.backChipSpacer} />
      </View>

      <RecommendedServicesContent withScrollPadding />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F6F7F9",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: scale(16),
    paddingTop: scale(8),
    paddingBottom: scale(8),
  },
  backChip: {
    width: scale(40),
    height: scale(40),
    borderRadius: moderateScale(20),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.06)",
  },
  backChipSpacer: {
    width: scale(40),
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    fontSize: moderateScale(16),
    color: "#141C24",
  },
});
