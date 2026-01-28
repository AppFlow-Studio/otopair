/**
 * TermsOfServiceScreen
 *
 * PURPOSE: Displays the app's terms of service.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 */

import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { BlurHeaderOverlay, BrandColors, Spacing, Text } from '@/components/shared-ui';
import { getSheetContentPadding } from '@/constants/theme';

export default function TermsOfServiceScreen() {
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
          Terms of Use
        </Text>

        <Text size="md" color="#374151" style={styles.paragraph}>
          Otopair provides a personalized subscription service that allows our members to access mobile vehicle services ("Otopair content") over the Internet to certain Internet-connected TVs, computers and other devices ("Otopair ready devices").
        </Text>

        <Text size="md" color="#374151" style={styles.paragraph}>
          These Terms of Use govern your use of our service. As used in these Terms of Use, "Otopair service", "our service" or "the service" means the personalized service provided by Otopair for discovering and accessing Otopair content, including all features and functionalities, recommendations and reviews, the website, and user interfaces, as well as all content and software associated with our service.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          1. Membership
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          1.1. Your Otopair membership will continue until terminated. To use the Otopair service you must have Internet access and a Otopair ready device, and provide us with one or more Payment Methods.
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          1.2. We may offer a number of membership plans, including special promotional plans or memberships offered by third parties in conjunction with the provision of their own products and services.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          2. Billing and Cancellation
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          2.1. Billing Cycle. The membership fee for the Otopair service and any other charges you may incur in connection with your use of the service, such as taxes and possible transaction fees, will be charged to your Payment Method on the specific payment date indicated on your "Account" page.
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          2.2. Cancellation. You can cancel your Otopair membership at any time, and you will continue to have access to the Otopair service through the end of your billing period.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          3. Otopair Service
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          3.1. You must be 18 years of age, or the age of majority in your province, territory or country, to become a member of the Otopair service.
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          3.2. The Otopair service and any content accessed through the service are for your personal and non-commercial use only and may not be shared with individuals beyond your household.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          4. Passwords and Account Access
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          The member who created the Otopair account and whose Payment Method is charged (the "Account Owner") is responsible for any activity that occurs through the Otopair account.
        </Text>

        <Text weight="bold" size="lg" color="#111827" style={styles.heading}>
          5. Miscellaneous
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          5.1. Governing Law. These Terms of Use shall be governed by and construed in accordance with the laws of the state of New York, U.S.A.
        </Text>
        <Text size="md" color="#374151" style={styles.paragraph}>
          5.2. Customer Support. To find more information about our service and its features or if you need assistance with your account, please visit the Otopair Help Center.
        </Text>
      </ScrollView>

      <BlurHeaderOverlay title="Terms of Service" onBack={() => router.back()} />
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
