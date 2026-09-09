/**
 * ShopDetailLayout
 *
 * PURPOSE: Stack navigator layout for the shop detail screens
 *
 * USED IN: app/(booking)/shop/[id]
 *
 * OWNER: Waleed Mansour
 */

import { Stack } from "expo-router";

export default function ShopDetailLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
    </Stack>
  );
}
