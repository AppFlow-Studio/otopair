/**
 * SavedAddressesScreen
 *
 * PURPOSE: UberEats-style list of the user's saved Home / Work / Other
 *          addresses. Tap a row to edit, swipe / use the in-sheet
 *          Delete button to remove, tap Add Address to create a new
 *          one. Persisted via `convex/userAddresses.ts`.
 *
 * USED IN: Reached from the SettingsOverlay row "Saved Addresses".
 *
 * OWNER: Ahmad Hamoudeh
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useMutation, useQuery } from "convex/react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Briefcase, ChevronRight, Home, MapPin, Plus, X } from "lucide-react-native";
import SegmentedControl from "@react-native-segmented-control/segmented-control";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useUserFromConvex } from "@/hooks/useUserFromConvex";
import {
  BlurHeaderOverlay,
  BrandColors,
  Spacing,
  Text,
} from "@/components/shared-ui";
import {
  FloatingSheet,
  type FloatingSheetRef,
} from "@/components/shared-ui/FloatingSheet";

type AddressType = "home" | "work" | "other";

interface AddressRow {
  _id: Id<"user_saved_addresses">;
  type: AddressType;
  label: string;
  address: string;
  notes?: string;
  is_primary?: boolean;
}

const TYPE_LABELS: AddressType[] = ["home", "work", "other"];
const TYPE_DEFAULT_LABEL: Record<AddressType, string> = {
  home: "Home",
  work: "Work",
  other: "Other",
};

function iconForType(type: AddressType, color: string, size = 20) {
  if (type === "home") return <Home size={size} color={color} strokeWidth={2} />;
  if (type === "work") return <Briefcase size={size} color={color} strokeWidth={2} />;
  return <MapPin size={size} color={color} strokeWidth={2} />;
}

export default function SavedAddressesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { userId } = useUserFromConvex();

  const addresses = useQuery(
    api.userAddresses.list,
    userId ? { userId } : "skip",
  ) as AddressRow[] | undefined;

  const addMutation = useMutation(api.userAddresses.add);
  const updateMutation = useMutation(api.userAddresses.update);
  const removeMutation = useMutation(api.userAddresses.remove);

  // ── Add/edit sheet state ───────────────────────────────────────────
  const sheetRef = useRef<FloatingSheetRef>(null);
  const [editingId, setEditingId] = useState<Id<"user_saved_addresses"> | null>(null);
  const [type, setType] = useState<AddressType>("home");
  const [label, setLabel] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [makePrimary, setMakePrimary] = useState(false);

  const isEditMode = editingId !== null;
  const canSave = address.trim().length > 0;

  const resetForm = useCallback(() => {
    setEditingId(null);
    setType("home");
    setLabel("");
    setAddress("");
    setNotes("");
    setMakePrimary(false);
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    sheetRef.current?.open();
  }, [resetForm]);

  const openEdit = useCallback((row: AddressRow) => {
    setEditingId(row._id);
    setType(row.type);
    setLabel(row.label);
    setAddress(row.address);
    setNotes(row.notes ?? "");
    setMakePrimary(row.is_primary === true);
    sheetRef.current?.open();
  }, []);

  // When the user changes the type and they haven't customized the
  // label yet, prefill the label with the type's default. Won't clobber
  // a label they've typed.
  useEffect(() => {
    if (isEditMode) return;
    setLabel((curr) => {
      if (curr.trim().length === 0) return TYPE_DEFAULT_LABEL[type];
      const isStillDefault = TYPE_LABELS.some(
        (t) => TYPE_DEFAULT_LABEL[t] === curr,
      );
      return isStillDefault ? TYPE_DEFAULT_LABEL[type] : curr;
    });
  }, [type, isEditMode]);

  const handleSave = useCallback(async () => {
    if (!userId || !canSave) return;
    try {
      if (isEditMode && editingId) {
        await updateMutation({
          id: editingId,
          type,
          label: label.trim() || TYPE_DEFAULT_LABEL[type],
          address: address.trim(),
          notes: notes.trim() || undefined,
          makePrimary: makePrimary || undefined,
        });
      } else {
        await addMutation({
          userId,
          type,
          label: label.trim() || TYPE_DEFAULT_LABEL[type],
          address: address.trim(),
          notes: notes.trim() || undefined,
          makePrimary: makePrimary || undefined,
        });
      }
      sheetRef.current?.close();
    } catch (e) {
      console.warn("Saving address failed:", e);
    }
  }, [userId, canSave, isEditMode, editingId, type, label, address, notes, makePrimary, addMutation, updateMutation]);

  const handleDelete = useCallback(() => {
    if (!isEditMode || !editingId) return;
    Alert.alert(
      "Delete address?",
      "This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await removeMutation({ id: editingId });
              sheetRef.current?.close();
            } catch (e) {
              console.warn("Deleting address failed:", e);
            }
          },
        },
      ],
    );
  }, [isEditMode, editingId, removeMutation]);

  const isFirstAddress = (addresses?.length ?? 0) === 0;
  const sheetHeight = useMemo(() => (isEditMode ? 560 : 520), [isEditMode]);

  const hasAddresses = (addresses?.length ?? 0) > 0;

  return (
    <View style={styles.screen}>
      <BlurHeaderOverlay
        title="Saved Addresses"
        titleColor="#111827"
        onBack={() => router.back()}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 80,
            paddingBottom: insets.bottom + 120, // leave room for the Add button
          },
        ]}
      >
        {hasAddresses ? (
          addresses!.map((row) => (
            <Pressable
              key={row._id}
              onPress={() => openEdit(row)}
              style={({ pressed }) => [styles.rowCard, pressed && styles.rowCardPressed]}
            >
              <View style={styles.rowIconBubble}>
                {iconForType(row.type, BrandColors.primary)}
              </View>
              <View style={styles.rowText}>
                <View style={styles.rowTitleLine}>
                  <Text weight="bold" size="md" color={BrandColors.primary} numberOfLines={1}>
                    {row.label}
                  </Text>
                  {row.is_primary ? (
                    <View style={styles.defaultBadge}>
                      <Text size="xs" weight="semiBold" color={BrandColors.secondary}>
                        Default
                      </Text>
                    </View>
                  ) : null}
                </View>
                <Text size="sm" color="#6B7280" numberOfLines={1}>
                  {row.address}
                </Text>
              </View>
              <ChevronRight size={20} color="#9CA3AF" strokeWidth={2} />
            </Pressable>
          ))
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MapPin size={48} color="#9CA3AF" strokeWidth={1.5} />
            </View>
            <Text weight="semiBold" size="lg" color="#374151" center>
              No saved addresses
            </Text>
            <Text
              weight="regular"
              size="sm"
              color="#6B7280"
              center
              style={styles.emptyText}
            >
              Add a home, work, or any other place you visit often.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom-anchored Add button */}
      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <Pressable
          onPress={openAdd}
          style={({ pressed }) => [
            styles.addButton,
            pressed && styles.addButtonPressed,
          ]}
        >
          <Plus size={20} color="#FFFFFF" strokeWidth={2.5} />
          <Text weight="semiBold" size="md" color="#FFFFFF">
            Add Address
          </Text>
        </Pressable>
      </View>

      {/* Add / edit sheet */}
      <FloatingSheet
        ref={sheetRef}
        snapHeights={[sheetHeight]}
        showBackdrop
        onClose={resetForm}
      >
        <View style={styles.sheetWrap}>
          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderSide} />
            <Text weight="bold" size="lg" color={BrandColors.primary}>
              {isEditMode ? "Edit Address" : "Add Address"}
            </Text>
            <Pressable
              onPress={() => sheetRef.current?.close()}
              style={({ pressed }) => [
                styles.sheetCloseButton,
                pressed && styles.sheetCloseButtonPressed,
              ]}
              hitSlop={12}
            >
              <X size={20} color={BrandColors.primary} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text size="sm" weight="semiBold" color="#6B7280" style={styles.fieldLabel}>
              TYPE
            </Text>
            <SegmentedControl
              values={["Home", "Work", "Other"]}
              selectedIndex={TYPE_LABELS.indexOf(type)}
              appearance="light"
              onChange={(e) => {
                const next = TYPE_LABELS[e.nativeEvent.selectedSegmentIndex];
                if (next) setType(next);
              }}
              style={styles.segmented}
            />

            <Text size="sm" weight="semiBold" color="#6B7280" style={styles.fieldLabel}>
              LABEL
            </Text>
            <TextInput
              value={label}
              onChangeText={setLabel}
              placeholder={TYPE_DEFAULT_LABEL[type]}
              placeholderTextColor="rgba(20,28,36,0.4)"
              style={styles.textInput}
              autoCapitalize="words"
              returnKeyType="next"
            />

            <Text size="sm" weight="semiBold" color="#6B7280" style={styles.fieldLabel}>
              ADDRESS
            </Text>
            <TextInput
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main St, City, State"
              placeholderTextColor="rgba(20,28,36,0.4)"
              style={[styles.textInput, styles.textInputMulti]}
              multiline
              numberOfLines={3}
            />

            <Text size="sm" weight="semiBold" color="#6B7280" style={styles.fieldLabel}>
              NOTES (OPTIONAL)
            </Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Apt #, gate code, etc."
              placeholderTextColor="rgba(20,28,36,0.4)"
              style={[styles.textInput, styles.textInputMulti]}
              multiline
              numberOfLines={2}
            />

            {!isFirstAddress && (
              <Pressable
                onPress={() => setMakePrimary((v) => !v)}
                style={({ pressed }) => [
                  styles.primaryToggle,
                  pressed && styles.primaryTogglePressed,
                ]}
              >
                <View
                  style={[
                    styles.primaryDot,
                    makePrimary && styles.primaryDotActive,
                  ]}
                />
                <Text size="md" weight="medium" color={BrandColors.primary}>
                  Set as default
                </Text>
              </Pressable>
            )}

            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.saveButton,
                !canSave && styles.saveButtonDisabled,
                pressed && canSave && styles.saveButtonPressed,
              ]}
            >
              <Text weight="bold" size="md" color="#FFFFFF">
                Save
              </Text>
            </Pressable>

            {isEditMode && (
              <Pressable
                onPress={handleDelete}
                style={({ pressed }) => [
                  styles.deleteButton,
                  pressed && styles.deleteButtonPressed,
                ]}
              >
                <Text weight="semiBold" size="md" color="#FF3B30">
                  Delete address
                </Text>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </FloatingSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: 12,
  },
  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  rowCardPressed: {
    opacity: 0.7,
  },
  rowIconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(82,153,254,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    gap: 4,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  defaultBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: "rgba(82,153,254,0.12)",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F3F4F6",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyText: {
    marginTop: 8,
    lineHeight: 22,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    backgroundColor: "rgba(248,250,252,0.95)",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 26,
    backgroundColor: BrandColors.secondary,
  },
  addButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },

  // Sheet
  sheetWrap: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.md,
  },
  sheetHeaderSide: {
    width: 32,
    height: 32,
  },
  sheetCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.05)",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetCloseButtonPressed: {
    opacity: 0.7,
  },
  sheetContent: {
    paddingBottom: Spacing.xl,
  },
  fieldLabel: {
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
    letterSpacing: 0.5,
  },
  segmented: {
    height: 36,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.08)",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 14 : 10,
    fontSize: 16,
    color: BrandColors.primary,
  },
  textInputMulti: {
    minHeight: 60,
    textAlignVertical: "top",
  },
  primaryToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: Spacing.lg,
    paddingVertical: 4,
  },
  primaryTogglePressed: {
    opacity: 0.7,
  },
  primaryDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "rgba(0,0,0,0.2)",
  },
  primaryDotActive: {
    borderColor: BrandColors.secondary,
    backgroundColor: BrandColors.secondary,
  },
  saveButton: {
    marginTop: Spacing.xl,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: BrandColors.secondary,
  },
  saveButtonDisabled: {
    backgroundColor: "rgba(82,153,254,0.4)",
  },
  saveButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  deleteButton: {
    marginTop: Spacing.md,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonPressed: {
    opacity: 0.6,
  },
});
