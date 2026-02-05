import { Icon, Label, NativeTabs } from 'expo-router/unstable-native-tabs';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';
import { TabBar } from '@/components/navigation/TabBar';

export default function TabLayout() {
  if (Platform.OS === 'android') {
    return (
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
    );
  }

  return (
    <NativeTabs>
      <NativeTabs.Trigger name="home">
        <Label>Home</Label>
        <Icon sf="house.fill" drawable="custom_android_drawable" />
      </NativeTabs.Trigger>
      
      <NativeTabs.Trigger name="bookings">
        <Icon sf="calendar" drawable="custom_settings_drawable" />
        <Label>Bookings</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cars">
        <Icon sf="car" drawable="custom_settings_drawable" />
        <Label>My Cars</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf="gear" drawable="custom_settings_drawable" />
        <Label>Settings</Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ai-chat" role='search'>
        <Icon sf="bubble.left.and.bubble.right.fill" drawable="custom_ai_drawable" />
        <Label>AI Chat</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
