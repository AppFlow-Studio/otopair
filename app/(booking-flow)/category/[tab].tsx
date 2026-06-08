/**
 * Screen 2 stub — Category detail. Replaced in Phase 2 of the
 * booking-flow redesign. For now just renders the route param so
 * navigation from Screen 1 / Quick Book is verifiable.
 */

import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";

import { Text } from "@/components/shared-ui";

export default function CategoryDetailStub() {
  const { tab } = useLocalSearchParams<{ tab: string }>();
  const router = useRouter();

  return (
    <View style={styles.root}>
      <Text size="xl" weight="bold" color="#0F172A">
        Category detail — Phase 2
      </Text>
      <Text size="md" weight="regular" color="#374151" style={styles.body}>
        Route param: <Text weight="bold">{tab ?? "(none)"}</Text>
      </Text>
      <Pressable
        style={styles.cta}
        onPress={() => router.push("/(booking-flow)/choose-mechanic")}
      >
        <Text size="md" weight="semiBold" color="#FFFFFF">
          Continue → Choose Mechanic
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
  body: {
    marginBottom: 16,
  },
  cta: {
    alignSelf: "flex-start",
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: "#0F172A",
  },
});
