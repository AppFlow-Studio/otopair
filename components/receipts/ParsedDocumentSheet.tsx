/**
 * ParsedDocumentSheet — view + confirm a Reducto-parsed shop receipt.
 *
 * Three modes:
 *   - parse_status === "parsed" + auto_accepted / user_confirmed
 *       → renders <ReceiptContent /> with a payload mapped from the
 *         extraction. Read-only display alongside Otopair receipts.
 *   - parse_status === "needs_review" (overall_confidence < 0.85)
 *       → editable review form: odometer, service_date, total. "Confirm"
 *         flips the doc to user_confirmed via `confirmExtraction` and
 *         triggers `internalDeriveMaintenance` server-side.
 *   - parse_status ∈ "queued" | "parsing" → spinner. "failed" → error.
 *
 * Caller (VehicleServiceHistory) passes the selected VehicleDocumentRow;
 * we avoid a second query by reading directly from the listByVin result.
 */

import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import DateTimePicker, {
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation } from "convex/react";
import { CheckCircle, Info, Trash2 } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { FontFamily } from "@/constants/theme";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { ReceiptContent, type ReceiptPayload } from "./ReceiptContent";
import type { VehicleDocumentRow } from "@/hooks/useVehicleDocumentsFromConvex";

// ───────────────────────────────────────────────────────────────────────────
// Input validators — pure, return { ok, value?, error? }
// ───────────────────────────────────────────────────────────────────────────

const ODOMETER_RE = /^\d{1,6}$/;
const TOTAL_RE = /^\d{1,5}(\.\d{1,2})?$/;
const EARLIEST_SERVICE_MS = Date.parse("1980-01-01");

type V<T> = { ok: true; value?: T; error?: undefined } | { ok: false; error: string };

function validateOdometer(raw: string): V<number> {
  const v = raw.trim();
  if (!v) return { ok: true };
  if (!ODOMETER_RE.test(v)) return { ok: false, error: "Whole number only (max 6 digits)" };
  const n = parseInt(v, 10);
  if (n > 999_999) return { ok: false, error: "Must be 999,999 or less" };
  return { ok: true, value: n };
}

// Service date is now picked with a native calendar (no free-text format to
// get wrong). These convert between the stored `YYYY-MM-DD` string and a Date.
function dateToYMD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function ymdToDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const t = Date.parse(raw);
  return Number.isNaN(t) ? null : new Date(t);
}

function validateTotal(raw: string): V<number> {
  const v = raw.trim();
  if (!v) return { ok: true };
  if (!TOTAL_RE.test(v)) return { ok: false, error: "Numbers only, up to 2 decimals" };
  const dollars = parseFloat(v);
  if (dollars < 0 || dollars > 99_999.99) {
    return { ok: false, error: "Must be between $0 and $99,999.99" };
  }
  return { ok: true, value: Math.round(dollars * 100) };
}

interface Props {
  row: VehicleDocumentRow | null;
  onClose?: () => void;
}

// ───────────────────────────────────────────────────────────────────────────
// Extraction → ReceiptPayload mapping
// ───────────────────────────────────────────────────────────────────────────

function splitName(full: string): { first: string; last: string } {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

function extractionToReceiptPayload(row: VehicleDocumentRow): ReceiptPayload {
  const p = (row.extraction?.payload ?? {}) as Record<string, any>;
  const shop = p.shop as Record<string, any> | undefined;
  const tech = p.technician as Record<string, any> | undefined;
  const vehicle = p.vehicle as Record<string, any> | undefined;
  const lineItems = Array.isArray(p.line_items) ? (p.line_items as Array<Record<string, any>>) : [];

  const tech_name = typeof tech?.name === "string" ? tech.name : "";
  const techParts = tech_name ? splitName(tech_name) : { first: "", last: "" };

  return {
    receipt_number: typeof p.invoice_number === "string" ? p.invoice_number : "",
    service_date: typeof p.service_date === "string" ? p.service_date : null,
    completed_at: null,
    shop: shop?.name
      ? {
          name: String(shop.name),
          address: typeof shop.street === "string" ? shop.street : null,
          city: [shop.city, shop.state, shop.zip].filter(Boolean).join(", ") || null,
          phone: typeof shop.phone === "string" ? shop.phone : null,
          rating: null,
          review_count: null,
          labor_rate: typeof shop.labor_rate_hourly === "number" ? shop.labor_rate_hourly : null,
        }
      : null,
    mechanic: tech_name
      ? {
          first_name: techParts.first,
          last_name: techParts.last,
          title: typeof tech?.cert === "string" ? tech.cert : null,
          photo_url: null,
          rating: null,
          review_count: null,
        }
      : null,
    vehicle: {
      year: typeof vehicle?.year === "number" ? vehicle.year : null,
      make: typeof vehicle?.make === "string" ? vehicle.make : null,
      model: typeof vehicle?.model === "string" ? vehicle.model : null,
      trim: typeof vehicle?.trim === "string" ? vehicle.trim : null,
      plate: typeof vehicle?.license_plate === "string" ? vehicle.license_plate : null,
      vin_last4:
        typeof vehicle?.vin === "string" && vehicle.vin.length >= 4
          ? vehicle.vin.slice(-4)
          : null,
      image_url: null,
      odometer_in: typeof vehicle?.odometer_in === "number" ? vehicle.odometer_in : null,
      odometer_out: typeof vehicle?.odometer_out === "number" ? vehicle.odometer_out : null,
    },
    service_notes: {
      customer_concern: typeof p.customer_concern === "string" ? p.customer_concern : "",
      mechanic_findings: typeof p.technician_findings === "string" ? p.technician_findings : "",
    },
    line_items: lineItems
      .map((li): ReceiptPayload["line_items"][number] | null => {
        const cost =
          typeof li.line_total_cents === "number" ? li.line_total_cents / 100 : null;
        if (li.kind === "service") {
          return {
            type: "service",
            name: String(li.description ?? ""),
            labor_hours: typeof li.labor_hours === "number" ? li.labor_hours : null,
            labor_cost: cost,
          };
        }
        if (li.kind === "part") {
          return {
            type: "part",
            name: String(li.description ?? ""),
            oem_number: typeof li.oem_number === "string" ? li.oem_number : null,
            cost,
          };
        }
        return null;
      })
      .filter(Boolean) as ReceiptPayload["line_items"],
    totals: {
      labor_subtotal:
        typeof p.labor_subtotal_cents === "number" ? p.labor_subtotal_cents / 100 : null,
      parts_subtotal:
        typeof p.parts_subtotal_cents === "number" ? p.parts_subtotal_cents / 100 : 0,
      platform_fee: 0,
      tax: typeof p.tax_cents === "number" ? p.tax_cents / 100 : 0,
      total: typeof p.total_cents === "number" ? p.total_cents / 100 : 0,
      parts_saved: 0,
    },
    payment: null,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Sheet
// ───────────────────────────────────────────────────────────────────────────

export interface ParsedDocumentSheetRef {
  present: () => void;
  dismiss: () => void;
}

export const ParsedDocumentSheet = forwardRef<ParsedDocumentSheetRef, Props>(
  ({ row, onClose }, ref) => {
    const sheetRef = useRef<FloatingSheetRef>(null);
    const insets = useSafeAreaInsets();
    const { height: screenHeight } = useWindowDimensions();
    // A receipt with real itemized line items renders the full breakdown;
    // anything else (manual entry / sparse parse) is just a short summary.
    const status = row?.doc.parse_status;
    const payload = (row?.extraction?.payload ?? {}) as Record<string, any>;
    const hasLineItems =
      Array.isArray(payload.line_items) && payload.line_items.length > 0;
    const hasNotes =
      typeof payload.notes === "string" && payload.notes.trim().length > 0;
    // Body sizes: the sparse no-notes summary is the shortest; the
    // manual-entry form (now with a notes box) and a notes-bearing summary
    // are taller; the full itemized receipt is tallest.
    const isForm = status === "needs_review" || status === "failed";
    const isSummary = status === "parsed" && !hasLineItems;
    const heightFraction = isForm
      ? 0.8
      : isSummary
        ? hasNotes
          ? 0.64
          : 0.52
        : 0.73;
    const restingHeight = Math.max(0, screenHeight * heightFraction);
    // Only the short no-notes summary is guaranteed to fit — everything else
    // (the form + keyboard, notes, long receipts) can scroll.
    const bodyScrolls = !(isSummary && !hasNotes);
    const expandedHeight = Math.max(restingHeight, screenHeight - insets.top - 4);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.open(),
      dismiss: () => sheetRef.current?.close(),
    }));

    const deleteDocument = useMutation(api.vehicleDocuments.deleteDocument);
    const [deleting, setDeleting] = useState(false);

    // The sheet is mounted once and reused as `row` changes, so reset the
    // delete state each time a new receipt opens — otherwise a prior
    // successful delete would leave the button stuck on "Removing…".
    useEffect(() => {
      if (row) {
        setDeleting(false);
        sheetRef.current?.open();
      }
    }, [row]);

    const handleDelete = () => {
      if (!row || deleting) return;
      Alert.alert(
        "Remove this receipt?",
        "It’ll be permanently removed from your service history.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Remove",
            style: "destructive",
            onPress: async () => {
              try {
                setDeleting(true);
                await deleteDocument({
                  documentId: row.doc._id as Id<"vehicle_documents">,
                });
                sheetRef.current?.close();
              } catch {
                setDeleting(false);
              }
            },
          },
        ],
      );
    };

    let body: React.ReactNode = null;
    if (row && status) {
      if (status === "queued" || status === "parsing") {
        body = <SheetSpinner label="Reading your receipt…" />;
      } else if (status === "needs_review" || status === "failed") {
        // Failed auto-read is NOT a dead end — drop the user straight into
        // the same manual-entry form so they can add the details by hand.
        body = <ReviewForm row={row} onClose={onClose} />;
      } else if (hasLineItems) {
        // Real itemized receipt → full labor/parts/tax breakdown.
        body = <ReceiptContent payload={extractionToReceiptPayload(row)} />;
      } else {
        // Manually-added / sparse record → just show what we actually have
        // (date, mileage, total), not a fake itemized template full of $0.00s.
        body = <ManualRecordSummary payload={payload} />;
      }
    }

    return (
      <FloatingSheet
        ref={sheetRef}
        snapHeights={[restingHeight, expandedHeight]}
        initialSnapIndex={0}
        cornerRadius={20}
        bottomCornerRadius={0}
        sideInset={0}
        floatBottomInset={0}
        showBackdrop
        backdropMode="dim"
        liftWithKeyboard
        onClose={onClose}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
          // The short no-notes summary fits; everything else can scroll
          // (form + keyboard, notes, long receipts).
          scrollEnabled={bodyScrolls}
          bounces={bodyScrolls}
        >
          {body}
          {/* Remove receipt — hidden while it's still reading (transient
              state). Confirms before deleting the doc + file. */}
          {row &&
          row.doc.parse_status !== "parsing" &&
          row.doc.parse_status !== "queued" ? (
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={({ pressed }) => [
                styles.deleteBtn,
                (pressed || deleting) && { opacity: 0.6 },
              ]}
            >
              <Trash2 size={16} color="#DC2626" />
              <Text weight="semiBold" size="sm" color="#DC2626">
                {deleting ? "Removing…" : "Remove receipt"}
              </Text>
            </Pressable>
          ) : null}
        </ScrollView>
      </FloatingSheet>
    );
  },
);

ParsedDocumentSheet.displayName = "ParsedDocumentSheet";

// ───────────────────────────────────────────────────────────────────────────
// Sub-views
// ───────────────────────────────────────────────────────────────────────────

function SheetSpinner({ label }: { label: string }) {
  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color="#5299FE" />
      <Text size="sm" color="#6B7280" style={{ marginTop: 12 }}>
        {label}
      </Text>
    </View>
  );
}

function formatNiceDate(ymd: string): string {
  const d = ymdToDate(ymd);
  if (!d) return ymd;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Compact view for a manually-added / sparse record — shows only the
 *  details the user actually provided (date, mileage, total), instead of
 *  the full itemized receipt template with empty $0.00 rows. */
function ManualRecordSummary({ payload }: { payload: Record<string, any> }) {
  const vehicle = payload.vehicle as Record<string, any> | undefined;
  const dateStr =
    typeof payload.service_date === "string" ? formatNiceDate(payload.service_date) : null;
  const odometer = typeof vehicle?.odometer_in === "number" ? vehicle.odometer_in : null;
  const totalDollars =
    typeof payload.total_cents === "number" ? payload.total_cents / 100 : null;

  const rows: { label: string; value: string }[] = [];
  if (dateStr) rows.push({ label: "Service date", value: dateStr });
  if (odometer != null) rows.push({ label: "Odometer", value: `${odometer.toLocaleString()} mi` });

  return (
    <View style={styles.formWrap}>
      <Text weight="bold" size="lg" color="#0F172A">
        Service record
      </Text>
      <Text size="sm" color="#6B7280" style={{ marginTop: 6, marginBottom: 20 }}>
        Added manually
      </Text>

      {rows.map((r) => (
        <View key={r.label} style={styles.summaryRow}>
          <Text size="md" color="#6B7280">
            {r.label}
          </Text>
          <Text size="md" weight="semiBold" color="#0F172A">
            {r.value}
          </Text>
        </View>
      ))}

      {totalDollars != null ? (
        <View style={[styles.summaryRow, styles.summaryTotalRow]}>
          <Text size="md" weight="bold" color="#0F172A">
            Total paid
          </Text>
          <Text size="lg" weight="bold" color="#0F172A">
            ${totalDollars.toFixed(2)}
          </Text>
        </View>
      ) : null}

      {typeof payload.notes === "string" && payload.notes.trim() ? (
        <View style={styles.notesBlock}>
          <Text weight="semiBold" size="xs" color="#6B7280" style={{ marginBottom: 6 }}>
            NOTES
          </Text>
          <Text size="md" color="#0F172A" style={{ lineHeight: 22 }}>
            {payload.notes.trim()}
          </Text>
        </View>
      ) : null}

      {/* Honesty note: a manual record has no itemized service data, so it's
          kept for the user's own history but can't move the health score. */}
      <View style={styles.disclaimer}>
        <Info size={16} color="#6B7280" style={{ marginTop: 1 }} />
        <Text size="xs" color="#6B7280" style={styles.disclaimerText}>
          We couldn’t read what service was done, so this record is kept for
          your history but won’t change your health score.
        </Text>
      </View>
    </View>
  );
}


interface ReviewFormProps {
  row: VehicleDocumentRow;
  onClose?: () => void;
}

type FormMode = "form" | "submitting" | "success";

function ReviewForm({ row, onClose }: ReviewFormProps) {
  const payload = (row.extraction?.payload ?? {}) as Record<string, any>;
  const vehicle = payload.vehicle as Record<string, any> | undefined;
  // No extraction at all = auto-read failed, so the user is adding the
  // details from scratch (vs. confirming a low-confidence draft).
  const isManualEntry = !row.extraction;

  const initialOdometer = typeof vehicle?.odometer_in === "number" ? String(vehicle.odometer_in) : "";
  const initialTotalDollars =
    typeof payload.total_cents === "number" ? (payload.total_cents / 100).toFixed(2) : "";

  const [odometer, setOdometer] = useState(initialOdometer);
  // Native calendar picker instead of a typed YYYY-MM-DD string, so there's
  // no format for the user to get wrong. Defaults to the parsed date, or
  // today, so the chip and the value always agree.
  const [serviceDate, setServiceDate] = useState<Date>(
    ymdToDate(payload.service_date as string | undefined) ?? new Date(),
  );
  const [totalDollars, setTotalDollars] = useState(initialTotalDollars);
  // Free-text note — the user's own record of what was done + where. Only
  // shown on the manual-entry path (no auto-read data), so Otopair can still
  // serve as a home for their receipts.
  const [notes, setNotes] = useState(
    typeof payload.notes === "string" ? payload.notes : "",
  );
  const [touched, setTouched] = useState<{ odometer: boolean; total: boolean }>({
    odometer: false,
    total: false,
  });
  const [mode, setMode] = useState<FormMode>("form");

  const confirm = useMutation(api.vehicleDocuments.confirmExtraction);

  const odometerCheck = useMemo(() => validateOdometer(odometer), [odometer]);
  const totalCheck = useMemo(() => validateTotal(totalDollars), [totalDollars]);
  const formValid = odometerCheck.ok && totalCheck.ok;
  const submitDisabled = mode !== "form" || !formValid;

  const onConfirm = async () => {
    if (submitDisabled) return;
    setMode("submitting");
    try {
      const edits: Record<string, unknown> = {};
      edits.service_date = dateToYMD(serviceDate);
      if (totalCheck.ok && totalCheck.value !== undefined) edits.total_cents = totalCheck.value;
      if (odometerCheck.ok && odometerCheck.value !== undefined) {
        edits.vehicle = { ...(vehicle ?? {}), odometer_in: odometerCheck.value };
      }
      const trimmedNotes = notes.trim();
      if (trimmedNotes) edits.notes = trimmedNotes;
      await confirm({
        documentId: row.doc._id as Id<"vehicle_documents">,
        edits,
      });
      setMode("success");
    } catch (err) {
      setMode("form");
      throw err;
    }
  };

  if (mode === "success") {
    return <SuccessState onDone={() => onClose?.()} />;
  }

  return (
    <View style={styles.formWrap}>
      <Text weight="bold" size="lg" color="#0F172A">
        {isManualEntry ? "Add receipt details" : "Confirm receipt details"}
      </Text>
      <Text size="sm" color="#6B7280" style={{ marginTop: 6, marginBottom: 20 }}>
        {isManualEntry
          ? "Your receipt is saved. Add the mileage, date, and amount to keep it in your history."
          : "We couldn’t read everything off the upload. Fill in what’s missing — we’ll use it to update your health score."}
      </Text>

      <FormField
        label="Odometer (miles)"
        value={odometer}
        onChangeText={(v) => {
          setOdometer(v);
          if (!touched.odometer) setTouched((t) => ({ ...t, odometer: true }));
        }}
        placeholder="e.g. 84200"
        keyboardType="number-pad"
        error={touched.odometer && !odometerCheck.ok ? odometerCheck.error : undefined}
      />
      <View style={styles.fieldWrap}>
        <Text weight="semiBold" size="xs" color="#6B7280" style={styles.fieldLabel}>
          SERVICE DATE
        </Text>
        <View style={styles.dateRow}>
          <DateTimePicker
            value={serviceDate}
            mode="date"
            display={Platform.OS === "ios" ? "compact" : "default"}
            maximumDate={new Date()}
            minimumDate={new Date(EARLIEST_SERVICE_MS)}
            themeVariant="light"
            accentColor="#5299FE"
            onChange={(_e: DateTimePickerEvent, date?: Date) => {
              if (date) setServiceDate(date);
            }}
          />
        </View>
      </View>
      <FormField
        label="Total ($)"
        value={totalDollars}
        onChangeText={(v) => {
          setTotalDollars(v);
          if (!touched.total) setTouched((t) => ({ ...t, total: true }));
        }}
        placeholder="e.g. 103.59"
        keyboardType="decimal-pad"
        error={touched.total && !totalCheck.ok ? totalCheck.error : undefined}
      />

      {/* Notes — manual path only. Their own record of what was done + shop. */}
      {isManualEntry ? (
        <View style={styles.fieldWrap}>
          <Text weight="semiBold" size="xs" color="#6B7280" style={styles.fieldLabel}>
            NOTES
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="What was done, and where? e.g. Oil change + tire rotation at Joe’s Auto"
            placeholderTextColor="#C7C7CC"
            multiline
            style={[styles.input, styles.notesInput]}
            textAlignVertical="top"
          />
        </View>
      ) : null}

      <Pressable
        onPress={onConfirm}
        disabled={submitDisabled}
        style={({ pressed }) => [
          styles.confirmBtn,
          pressed && { opacity: 0.85 },
          submitDisabled && { opacity: 0.45 },
        ]}
      >
        <Text weight="semiBold" size="sm" color="#FFFFFF">
          {mode === "submitting"
            ? "Saving…"
            : isManualEntry
              ? "Save to history"
              : "Confirm & update health score"}
        </Text>
      </Pressable>
    </View>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
  error?: string;
}

function FormField({ label, value, onChangeText, placeholder, keyboardType, error }: FormFieldProps) {
  const hasError = !!error;
  return (
    <View style={{ marginBottom: 14 }}>
      <Text size="xs" weight="semiBold" color="#6B7280" style={{ marginBottom: 6 }}>
        {label.toUpperCase()}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#C7C7CC"
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, hasError && styles.inputError]}
      />
      {hasError && (
        <Text size="xs" color="#DC2626" style={{ marginTop: 6 }}>
          {error}
        </Text>
      )}
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Success state — Reanimated checkmark, auto-dismisses
// ───────────────────────────────────────────────────────────────────────────

const SUCCESS_HOLD_MS = 1600;

function SuccessState({ onDone }: { onDone: () => void }) {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  const pulseScale = useSharedValue(0);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 160 });
    opacity.value = withTiming(1, { duration: 220 });
    pulseScale.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1.8, { duration: 700 }),
    );
    pulseOpacity.value = withSequence(
      withTiming(0.35, { duration: 0 }),
      withTiming(0, { duration: 700 }),
    );
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 220 }, () => {});
      // schedule dismiss after the fade
      setTimeout(onDone, 220);
    }, SUCCESS_HOLD_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));
  const copyStyle = useAnimatedStyle(() => ({
    opacity: withDelay(120, withTiming(opacity.value, { duration: 200 })),
  }));

  return (
    <View style={styles.successWrap}>
      <View style={styles.successIconWrap}>
        <Animated.View style={[styles.pulse, pulseStyle]} />
        <Animated.View style={checkStyle}>
          <CheckCircle size={84} color="#10B981" strokeWidth={1.75} />
        </Animated.View>
      </View>
      <Animated.View style={copyStyle}>
        <Text weight="bold" size="lg" color="#0F172A" center style={{ marginTop: 20 }}>
          Health score updated
        </Text>
        <Text size="sm" color="#6B7280" center style={{ marginTop: 6 }}>
          We saved your receipt and refreshed the ring on the Cars tab.
        </Text>
      </Animated.View>
    </View>
  );
}

// ───────────────────────────────────────────────────────────────────────────
// Styles
// ───────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 64,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  deleteBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    marginHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: "rgba(220, 38, 38, 0.06)",
  },
  formWrap: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  summaryTotalRow: {
    borderTopWidth: 1,
    borderTopColor: "#EEF1F4",
    marginTop: 4,
  },
  notesInput: {
    minHeight: 84,
    paddingTop: 12,
    lineHeight: 22,
  },
  notesBlock: {
    marginTop: 18,
  },
  disclaimer: {
    flexDirection: "row",
    gap: 8,
    marginTop: 18,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#F3F4F6",
  },
  disclaimerText: {
    flex: 1,
    lineHeight: 17,
  },
  fieldWrap: {
    marginBottom: 14,
  },
  fieldLabel: {
    marginBottom: 6,
  },
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  confirmBtn: {
    marginTop: 12,
    backgroundColor: "#5299FE",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },
  successWrap: {
    paddingTop: 64,
    paddingBottom: 48,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  successIconWrap: {
    width: 120,
    height: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#10B981",
  },
});

export default ParsedDocumentSheet;
