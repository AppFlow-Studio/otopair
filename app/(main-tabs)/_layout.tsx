import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Tabs } from "expo-router";
import React from "react";
import { Platform } from "react-native";
import { TabBar } from "@/components/navigation/TabBar";
import { useBookingsFromConvex } from "@/hooks/useBookingsFromConvex";
import { useVehicleOwnershipFromConvex } from "@/hooks/useVehicleOwnershipFromConvex";

/** Hydrates vehicle and booking stores with Convex data when main tabs are active. */
function HydrateBookingData() {
  useVehicleOwnershipFromConvex();
  useBookingsFromConvex();
  return null;
}

export default function TabLayout() {
  const isIOS26OrNewer =
    Platform.OS === "ios" && parseInt(String(Platform.Version), 10) >= 26;

  // Use custom tab bar for Android and iOS <= 25.
  if (!isIOS26OrNewer) {
    return (
      <>
        <HydrateBookingData />
        <Tabs
          tabBar={(props) => <TabBar {...props} />}
          screenOptions={{
            headerShown: false,
          }}
        >
          <Tabs.Screen
            name="home"
            options={{
              title: 'Home',
            }}
          />
          <Tabs.Screen
            name="bookings"
            options={{
              title: 'Bookings',
            }}
          />
          <Tabs.Screen
            name="cars"
            options={{
              title: 'My Cars',
            }}
          />
          <Tabs.Screen
            name="settings"
            options={{
              title: 'Settings',
            }}
          />
          <Tabs.Screen
            name="ai-chat"
            options={{
              title: 'AI Chat',
            }}
          />
          <Tabs.Screen
            name="index"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </>
    );
  }

  return (
    <>
      <HydrateBookingData />
      <NativeTabs>
        <NativeTabs.Trigger name="home">
          <Label>{"Home"}</Label>
          <Icon sf="house.fill" drawable="custom_android_drawable" />
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="bookings">
          <Icon sf="calendar" drawable="custom_settings_drawable" />
          <Label>{"Book"}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="cars">
          <Icon sf="car" drawable="custom_settings_drawable" />
          <Label>{"Cars"}</Label>
        </NativeTabs.Trigger>
        <NativeTabs.Trigger name="settings">
          <Icon sf="person" drawable="custom_settings_drawable" />
          <Label>{"Profile"}</Label>
        </NativeTabs.Trigger>

        <NativeTabs.Trigger name="ai-chat">
          <Icon sf="bubble.left.and.bubble.right.fill" drawable="custom_ai_drawable" />
          <Label>{""}</Label>
        </NativeTabs.Trigger>
      </NativeTabs>
    </>
  );
}
