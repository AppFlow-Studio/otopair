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
      <Stack.Screen
        name="index"
        options={{
          // Disable the native-stack slide-from-bottom so the
          // Reanimated shared-element transition (shop-name morph
          // from MapBrowseShopCard → ShopHeroCard) is the primary
          // motion instead of competing with it.
          animation: "none",
        }}
      />
    </Stack>
  );
}
