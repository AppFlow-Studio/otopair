/**
 * PrivacyDataScreen
 *
 * PURPOSE: Lets users manage privacy and account data actions.
 *
 * USED IN: app/(main-tabs)/settings/index.tsx
 *
 * PROPS: None (accessed via router)
 *
 * EXAMPLE:
 *   <PrivacyDataScreen />
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChevronRight, Download, Trash2 } from "lucide-react-native";

import { BrandColors, Text, BlurHeaderOverlay } from "@/components/shared-ui";
import { getSheetContentPadding } from "@/constants/theme";

export default function PrivacyDataScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { backgroundColor: BrandColors.background }]}>
      <BlurHeaderOverlay title="Settings" />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: insets.top + 80,
              paddingBottom: getSheetContentPadding(true, insets.bottom),
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroArea}>
            <Text weight="bold" style={styles.heroTitle}>
              Privacy & data
            </Text>
            <Text size="md" color="#86868b">
              Manage your information and account.
            </Text>
          </View>

          <View style={styles.glassCard}>
            <Pressable style={styles.actionRow}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: BrandColors.secondary }]}>
                  <Download size={18} color="#FFF" />
                </View>
                <Text size="md" color="#1d1d1f">
                  Download my data
                </Text>
              </View>
              <ChevronRight size={20} color="#c7c7cc" />
            </Pressable>

            <View style={styles.separator} />

            <Pressable style={styles.actionRow}>
              <View style={styles.rowLeft}>
                <View style={[styles.iconBox, { backgroundColor: "#FF3B30" }]}>
                  <Trash2 size={18} color="#FFF" />
                </View>
                <Text size="md" color="#1d1d1f">
                  Delete account
                </Text>
              </View>
              <ChevronRight size={20} color="#c7c7cc" />
            </Pressable>
          </View>

          <View style={styles.warningArea}>
            <Text size="xs" color="#86868b" style={styles.warningText}>
              Deleting your account is permanent and will remove all service history, ownership credits, and saved
              vehicles. This action cannot be undone.
            </Text>
          </View>

          <View style={{ flex: 1 }} />

          <View style={styles.submitArea}>
            <Pressable style={styles.submitButton}>
              <Text weight="semiBold" size="md" color="#FFF">
                Save changes
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  heroArea: {
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 34,
    lineHeight: 40,
    color: "#1d1d1f",
    marginBottom: 8,
  },
  glassCard: {
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  actionRow: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  separator: {
    height: 1,
    backgroundColor: "rgba(60, 60, 67, 0.10)",
    marginLeft: 58,
  },
  warningArea: {
    paddingHorizontal: 4,
    marginBottom: 24,
  },
  warningText: {
    lineHeight: 18,
  },
  submitArea: {
    marginTop: "auto",
    paddingBottom: 20,
  },
  submitButton: {
    backgroundColor: BrandColors.secondary,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: BrandColors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
});
