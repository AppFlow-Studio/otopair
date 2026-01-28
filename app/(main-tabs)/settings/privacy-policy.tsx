/**
 * PrivacyPolicyScreen
 *
 * PURPOSE: Displays the app's privacy policy.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BlurHeaderOverlay, BrandColors, Spacing, Text } from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';

export default function PrivacyPolicyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.container,
          {
            paddingTop: insets.top + 100,
            paddingBottom: getSheetContentPadding(true, insets.bottom),
          },
        ]}
      >
        <Text weight="bold" size="3xl" color="#111827" style={styles.title}>
          Privacy Statement
        </Text>

        <Text size="md" color="#374151" style={styles.paragraph}>
          This Privacy Statement explains how we collect, use, and disclose your personal information when you use the "Otopair service" to access "Otopair content" as those terms are defined in the Otopair Terms of Use (otopair.com/terms). It also explains what privacy rights you have and how to exercise them.
        </Text>

        <Text size="md" color="#374151" style={styles.paragraph}>
          Certain functionalities or apps that are part of the Otopair service may also provide you with contextual privacy information or choices, in addition to the information and choices described in this Privacy Statement. Please note that this Privacy Statement may be easier to navigate when viewed on your web browser.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          Contacting Us
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          For questions about this Privacy Statement, or our use of your personal information, cookies and similar technologies, please contact our Data Protection Officer/Privacy Office by email at privacy@otopair.com.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          Collection of Information
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          Use of Information
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem sequi nesciunt.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          Disclosure of Information
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          Your Choices
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          At vero eos et accusamus et iusto odio dignissimos ducimus qui blanditiis praesentium voluptatum deleniti atque corrupti quos dolores et quas molestias excepturi sint occaecati cupiditate non provident.
        </Text>
      </ScrollView>

      <BlurHeaderOverlay title="Privacy Policy" onBack={() => router.back()} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BrandColors.background,
  },
  container: {
    paddingHorizontal: 24,
  },
  title: {
    marginBottom: 24,
  },
  heading: {
    marginTop: 32,
    marginBottom: 12,
  },
  paragraph: {
    lineHeight: 24,
    marginBottom: 16,
  },
});
