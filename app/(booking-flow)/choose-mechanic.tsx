/**
 * Screen 3 stub — Choose Mechanic. Replaced in Phase 3 of the
 * booking-flow redesign.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";

import { Text } from "@/components/shared-ui";

export default function ChooseMechanicStub() {
  const router = useRouter();
  return (
    <View style={styles.root}>
      <Text size="xl" weight="bold" color="#0F172A">
        Choose Mechanic — Phase 3
      </Text>
      <Pressable
        style={styles.cta}
        onPress={() => router.push("/(booking-flow)/pick-datetime")}
      >
        <Text size="md" weight="semiBold" color="#FFFFFF">
          Continue → Pick date & time
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#E8EEF3",
    padding: 24,
    paddingTop: 80,
    gap: 12,
  },
  cta: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#0F172A",
  },
});
