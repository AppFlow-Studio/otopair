/**
 * HeroCardClosestShop — Screen 1 hero card showing the user's
 * nearest shop. Tap opens that shop's detail page; long-press could
 * be reserved for "show on map".
 */

import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { BlurView } from "expo-blur";
import { useGuardedRouter as useRouter } from "@/hooks/useGuardedRouter";
import { MapPin } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CardShadow } from "@/constants/theme";
import { useClosestShop } from "@/hooks/useClosestShop";

export function HeroCardClosestShop() {
  const router = useRouter();
  const { result, isLoading } = useClosestShop();

  const onPress = () => {
    if (!result) return;
    router.push({
      pathname: "/booking/shop/[id]",
      params: { id: result.shop.id },
    });
  };

  return (
    <Pressable
      style={styles.card}
      onPress={onPress}
      disabled={!result}
      hitSlop={4}
      accessibilityRole="button"
      accessibilityLabel={
        result ? `Closest shop ${result.shop.name}` : "Loading closest shop"
      }
    >
      {Platform.OS === "ios" ? (
        <BlurView intensity={25} tint="light" style={StyleSheet.absoluteFill} />
      ) : null}
      <View style={styles.iconWrap}>
        <MapPin size={20} color="#4B5563" strokeWidth={2} />
      </View>
      <Text size="xs" weight="semiBold" color="#6B7280" style={styles.eyebrow}>
        CLOSEST SHOP
      </Text>
      <Text
        size="lg"
        weight="bold"
        color="#0F172A"
        style={styles.title}
        numberOfLines={2}
      >
        {result?.shop.name ?? (isLoading ? "Finding nearby shops..." : "Location needed")}
      </Text>
      {result ? (
        <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
          {formatMiles(result.distanceMi)} miles away
        </Text>
      ) : (
        <Text size="sm" weight="regular" color="#6B7280" style={styles.subtitle}>
          {isLoading ? "Updating distance..." : "Enable location"}
        </Text>
      )}
    </Pressable>
  );
}

function formatMiles(miles: number): string {
  if (miles < 0.1) return "<0.1";
  if (miles < 10) return miles.toFixed(1);
  return Math.round(miles).toString();
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: 16,
    backgroundColor: "rgba(255, 255, 255, 0.55)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.85)",
    minHeight: 160,
    // overflow clips the BlurView child to the rounded corners.
    // boxShadow renders outside the bounds so it survives the clip.
    overflow: "hidden",
    boxShadow: CardShadow.default,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.7)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  eyebrow: {
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    lineHeight: 22,
    marginBottom: 6,
  },
  subtitle: {
    marginTop: 2,
  },
});
