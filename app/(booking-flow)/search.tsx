/**
 * Booking-flow search screen — opens from the 🔍 button on Screen 1.
 *
 * Uber-Eats-style empty state: a slim top row with ← back, a focused
 * search input, and a small storefront icon on the right; a centered
 * Otopair logo fills the canvas below the input while the system
 * keyboard sits at the bottom. Search behavior itself is TBD by
 * Ahmad — this commit ships the shell only.
 */

import React, { useEffect, useRef, useState } from "react";
import { Image, Pressable, StyleSheet, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft, Store } from "lucide-react-native";

const OTOPAIR_LOGO = require("@/assets/images/pin-logo-3d.png");

export default function BookingFlowSearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState("");

  // Auto-focus the input on mount so the keyboard slides up
  // immediately — same Uber-Eats / DoorDash entry feel.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const onBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(booking-flow)/select-services");
  };

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
            placeholder="Search services or shops"
            placeholderTextColor="#9CA3AF"
            returnKeyType="search"
            autoCorrect={false}
            autoCapitalize="none"
            style={styles.input}
            // Submit behavior TBD — Ahmad to spec.
          />
        </View>
        <Pressable
          style={styles.shopBtn}
          onPress={() => {
            /* TODO scope toggle (search shops vs services) — Ahmad to spec */
          }}
          hitSlop={8}
          accessibilityLabel="Switch search scope"
        >
          <Store size={18} color="#1F2937" strokeWidth={2} />
        </Pressable>
      </View>

      {/* Centered Otopair logo */}
      <View style={styles.body}>
        <Image source={OTOPAIR_LOGO} style={styles.logo} resizeMode="contain" />
      </View>
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
  body: {
    flex: 1,
    alignItems: "center",
    paddingTop: 56,
  },
  logo: {
    width: 180,
    height: 180,
  },
});
