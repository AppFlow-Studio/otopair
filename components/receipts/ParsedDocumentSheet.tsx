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
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
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
import { CheckCircle } from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { FloatingSheet, type FloatingSheetRef } from "@/components/shared-ui/FloatingSheet";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

import { ReceiptContent, type ReceiptPayload } from "./ReceiptContent";
import type { VehicleDocumentRow } from "@/hooks/useVehicleDocumentsFromConvex";

// ───────────────────────────────────────────────────────────────────────────
// Input validators — pure, return { ok, value?, error? }
// ───────────────────────────────────────────────────────────────────────────

const ODOMETER_RE = /^\d{1,6}$/;
const SERVICE_DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
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

function validateServiceDate(raw: string): V<string> {
  const v = raw.trim();
  if (!v) return { ok: true };
  if (!SERVICE_DATE_RE.test(v)) return { ok: false, error: "Use format YYYY-MM-DD" };
  const t = Date.parse(v);
  if (Number.isNaN(t)) return { ok: false, error: "Not a real calendar date" };
  if (t > Date.now() + 86_400_000) return { ok: false, error: "Date can't be in the future" };
  if (t < EARLIEST_SERVICE_MS) return { ok: false, error: "Date is too far in the past" };
  return { ok: true, value: v };
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
    const restingHeight = Math.max(0, screenHeight * 0.73);
    const expandedHeight = Math.max(restingHeight, screenHeight - insets.top - 4);

    useImperativeHandle(ref, () => ({
      present: () => sheetRef.current?.open(),
      dismiss: () => sheetRef.current?.close(),
    }));

    useEffect(() => {
      if (row) sheetRef.current?.open();
    }, [row]);

    let body: React.ReactNode = null;
    if (row) {
      const status = row.doc.parse_status;
      if (status === "queued" || status === "parsing") {
        body = <SheetSpinner label="Parsing your receipt…" />;
      } else if (status === "failed") {
        body = (
          <SheetMessage
            title="We couldn't parse this receipt"
            body={row.doc.parse_error ?? "Try uploading a clearer scan."}
          />
        );
      } else if (status === "needs_review") {
        body = <ReviewForm row={row} onClose={onClose} />;
      } else {
        body = (
          <ReceiptContent
            payload={extractionToReceiptPayload(row)}
          />
        );
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
        onClose={onClose}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          bounces
        >
          {body}
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

function SheetMessage({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.centered}>
      <Text weight="bold" size="md" color="#0F172A" center>
        {title}
      </Text>
      <Text size="sm" color="#6B7280" center style={{ marginTop: 8 }}>
        {body}
      </Text>
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

  const initialOdometer = typeof vehicle?.odometer_in === "number" ? String(vehicle.odometer_in) : "";
  const initialDate = typeof payload.service_date === "string" ? payload.service_date : "";
  const initialTotalDollars =
    typeof payload.total_cents === "number" ? (payload.total_cents / 100).toFixed(2) : "";

  const [odometer, setOdometer] = useState(initialOdometer);
  const [serviceDate, setServiceDate] = useState(initialDate);
  const [totalDollars, setTotalDollars] = useState(initialTotalDollars);
  const [touched, setTouched] = useState<{ odometer: boolean; serviceDate: boolean; total: boolean }>({
    odometer: false,
    serviceDate: false,
    total: false,
  });
  const [mode, setMode] = useState<FormMode>("form");

  const confirm = useMutation(api.vehicleDocuments.confirmExtraction);

  const odometerCheck = useMemo(() => validateOdometer(odometer), [odometer]);
  const dateCheck = useMemo(() => validateServiceDate(serviceDate), [serviceDate]);
  const totalCheck = useMemo(() => validateTotal(totalDollars), [totalDollars]);
  const formValid = odometerCheck.ok && dateCheck.ok && totalCheck.ok;
  const submitDisabled = mode !== "form" || !formValid;

  const onConfirm = async () => {
    if (submitDisabled) return;
    setMode("submitting");
    try {
      const edits: Record<string, unknown> = {};
      if (dateCheck.ok && dateCheck.value !== undefined) edits.service_date = dateCheck.value;
      if (totalCheck.ok && totalCheck.value !== undefined) edits.total_cents = totalCheck.value;
      if (odometerCheck.ok && odometerCheck.value !== undefined) {
        edits.vehicle = { ...(vehicle ?? {}), odometer_in: odometerCheck.value };
      }
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
        Confirm receipt details
      </Text>
      <Text size="sm" color="#6B7280" style={{ marginTop: 6, marginBottom: 20 }}>
        We couldn&apos;t read everything off the upload. Fill in what&apos;s missing —
        we&apos;ll use it to update your health score.
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
      <FormField
        label="Service date"
        value={serviceDate}
        onChangeText={(v) => {
          setServiceDate(v);
          if (!touched.serviceDate) setTouched((t) => ({ ...t, serviceDate: true }));
        }}
        placeholder="YYYY-MM-DD"
        error={touched.serviceDate && !dateCheck.ok ? dateCheck.error : undefined}
      />
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
          {mode === "submitting" ? "Saving…" : "Confirm & update health score"}
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
    fontSize: 16,
    color: "#0F172A",
    backgroundColor: "#FFFFFF",
  },
  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2",
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
