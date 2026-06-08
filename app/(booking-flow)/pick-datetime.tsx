/**
 * Screen 4 stub — Pick date & time. Replaced in Phase 4 of the
 * booking-flow redesign.
 */

import React from "react";
import { StyleSheet, View } from "react-native";

import { Text } from "@/components/shared-ui";

export default function PickDateTimeStub() {
  return (
    <View style={styles.root}>
      <Text size="xl" weight="bold" color="#0F172A">
        Pick date & time — Phase 4
      </Text>
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
});
