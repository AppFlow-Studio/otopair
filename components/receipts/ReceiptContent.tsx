/**
 * ReceiptContent — the statement
 *
 * Body of the receipt sheet. Reads as a document rather than a UI: the amount
 * paid is the hero, line items run to dot leaders, and the totals stack ends in
 * an unmistakable Total. A footer carries the provenance a receipt is actually
 * kept for — shop, technician, vehicle, odometer.
 *
 * Matches the Service Record surfaces: type via ServiceLogFonts, hairline
 * rules, colours from ServiceLogColors. The dot
 * leaders are the one motif unique to this screen — they're what makes a
 * statement read as a statement.
 *
 * Renders as a plain View. The scroll container, grabber and sheet chrome all
 * come from the parent (ReceiptSheet / ParsedDocumentSheet), so this must never
 * introduce its own ScrollView.
 *
 * Uses RN Text rather than shared-ui <Text> — this surface needs weights and
 * tracking that component does not expose.
 *
 * USED IN: ReceiptSheet (Cars tab service history, Settings → Past Service),
 *          ParsedDocumentSheet (uploaded-document preview).
 */

import React from "react";
import { Pressable, Share, StyleSheet, Text as RNText, View } from "react-native";

import { ServiceLogColors as C, ServiceLogFonts as F } from "@/constants/theme";

export interface ReceiptPayload {
  receipt_number: string;
  service_date: string | null;
  completed_at: number | null;
  shop: {
    name: string;
    address: string | null;
    city: string | null;
    phone: string | null;
    rating: number | null;
    review_count: number | null;
    labor_rate: number | null;
  } | null;
  mechanic: {
    first_name: string;
    last_name: string;
    title: string | null;
    photo_url: string | null;
    rating: number | null;
    review_count: number | null;
  } | null;
  vehicle: {
    year: number | null;
    make: string | null;
    model: string | null;
    trim: string | null;
    plate: string | null;
    vin_last4: string | null;
    image_url: string | null;
    odometer_in: number | null;
    odometer_out: number | null;
  };
  service_notes: {
    customer_concern: string;
    mechanic_findings: string;
  };
  line_items: (
    | { type: "service"; name: string; labor_hours: number | null; labor_cost: number | null }
    | {
        type: "part";
        name: string;
        oem_number: string | null;
        quantity?: number;
        unit_cost?: number | null;
        cost: number | null;
      }
  )[];
  totals: {
    labor_subtotal: number | null;
    parts_subtotal: number;
    platform_fee: number;
    tax: number;
    total: number;
    parts_saved: number;
  };
  payment: {
    method: string | null;
    card_last4: string | null;
    amount: number;
    status: string;
    stripe_intent_id: string | null;
    charged_at: number | null;
    invoice_storage_id: string | null;
  } | null;
}

interface Props {
  payload: ReceiptPayload;
  /** When provided, renders a filled "Leave a review" pill at the bottom. The
   *  home auto-prompt passes it; the sheet routes leave it undefined. */
  onLeaveReview?: () => void;
}

/** Enough leader characters to span the widest gap at any font scale; the run
 *  is clipped by an overflow:hidden parent, so over-supplying is free. */
const LEADER_RUN = 140;

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** With symbol, for the Total and the paid line. */
function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Without symbol — the column reads cleaner when only the Total carries one. */
function fmtAmount(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtMiles(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}

/** "2026-08-12" or epoch ms → "12 Aug 2026". Built by hand — Hermes ships a
 *  reduced Intl that throws on toLocaleDateString with an options bag. */
function fmtLongDate(value: string | number | null): string {
  if (value == null) return "";
  const d = typeof value === "number" ? new Date(value) : new Date(`${value}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** Ratings are raw averages (4.555555555555555). One decimal, no trailing .0 */
function fmtRating(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function fmtLaborHours(hours: number): string {
  return `${hours} ${hours === 1 ? "HR" : "HRS"}`;
}

/**
 * A run of repeated dots clipped to whatever horizontal space is left. Hidden
 * from assistive tech — without that VoiceOver reads 140 dots between every
 * label and its amount.
 */
function Leader() {
  return (
    <View
      style={styles.leaderBox}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {/* ellipsizeMode="clip" is load-bearing: the default appends an ellipsis
          to the truncated run, so every rule would end in a stray "…". */}
      <RNText numberOfLines={1} ellipsizeMode="clip" accessible={false} style={styles.leaderText}>
        {".".repeat(LEADER_RUN)}
      </RNText>
    </View>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <RNText style={styles.sectionLabel}>{children}</RNText>;
}

/** One itemised line: name → leader → amount, with an optional detail line. */
function LineItem({
  name,
  detail,
  amount,
}: {
  name: string;
  detail?: string | null;
  amount: string;
}) {
  return (
    <View style={styles.lineItem}>
      <View style={styles.lineTop}>
        <RNText numberOfLines={1} style={styles.lineName}>
          {name}
        </RNText>
        <Leader />
        <RNText style={styles.lineAmount}>{amount}</RNText>
      </View>
      {detail ? <RNText style={styles.lineDetail}>{detail}</RNText> : null}
    </View>
  );
}

/** A row in the totals stack. `hero` renders the final Total. */
function TotalRow({
  label,
  amount,
  hero,
  positive,
}: {
  label: string;
  amount: string;
  hero?: boolean;
  positive?: boolean;
}) {
  return (
    <View style={hero ? styles.totalRowHero : styles.totalRow}>
      <RNText
        style={[
          hero ? styles.totalLabelHero : styles.totalLabel,
          positive && styles.positive,
        ]}
      >
        {label}
      </RNText>
      <Leader />
      <RNText
        style={[
          hero ? styles.totalValueHero : styles.totalValue,
          positive && styles.positive,
        ]}
      >
        {amount}
      </RNText>
    </View>
  );
}

export function ReceiptContent({ payload, onLeaveReview }: Props) {
  const { receipt_number, service_date, shop, mechanic, vehicle, line_items, totals, payment } =
    payload;

  const serviceLines = line_items.filter(
    (l): l is Extract<(typeof line_items)[number], { type: "service" }> => l.type === "service",
  );
  const partLines = line_items.filter(
    (l): l is Extract<(typeof line_items)[number], { type: "part" }> => l.type === "part",
  );

  const mechanicName = mechanic
    ? `${mechanic.first_name} ${mechanic.last_name}`.trim()
    : "";

  const paidDate = fmtLongDate(payment?.charged_at ?? service_date);
  /** `card_last4` is not persisted yet (see convex/bookings.ts getReceipt), so
   *  most rows only carry a bare method string like "card". Title-case it
   *  rather than printing lowercase mid-sentence, and drop it entirely when
   *  it adds nothing over the word "Paid". */
  const method = payment?.method?.trim() ?? "";
  const tender = payment?.card_last4
    ? `Visa ···· ${payment.card_last4}`
    : method && method.toLowerCase() !== "card"
      ? method.charAt(0).toUpperCase() + method.slice(1)
      : null;
  const paidLine = [paidDate && `Paid ${paidDate}`, tender].filter(Boolean).join("  ·  ");

  const vehicleLine = [vehicle.year, vehicle.make, vehicle.model, vehicle.trim]
    .filter(Boolean)
    .join(" ")
    .toUpperCase();
  const idLine = [
    vehicle.vin_last4 && `VIN ····${vehicle.vin_last4}`,
    vehicle.plate && `PLATE ${vehicle.plate}`,
  ]
    .filter(Boolean)
    .join("  ·  ");
  const odoLine =
    vehicle.odometer_in != null && vehicle.odometer_out != null
      ? `ODOMETER ${fmtMiles(vehicle.odometer_in)} → ${fmtMiles(vehicle.odometer_out)} MI`
      : vehicle.odometer_out != null || vehicle.odometer_in != null
        ? `ODOMETER ${fmtMiles(vehicle.odometer_out ?? vehicle.odometer_in)} MI`
        : null;

  const techLine = [
    mechanicName.toUpperCase(),
    mechanic?.rating != null ? `${fmtRating(mechanic.rating)} ★` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  const handleShare = async () => {
    try {
      await Share.share({ message: `Otopair Receipt #${receipt_number}` });
    } catch {
      // User dismissed the share sheet — nothing to recover from.
    }
  };

  return (
    <View style={styles.root}>
      {/* ── masthead ─────────────────────────────────────────── */}
      <View style={styles.head}>
        <RNText style={styles.eyebrow}>RECEIPT · {receipt_number}</RNText>
        <Pressable
          onPress={handleShare}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Share receipt"
          style={({ pressed }) => (pressed ? styles.pressed : null)}
        >
          <RNText style={styles.share}>SHARE</RNText>
        </Pressable>
      </View>

      <RNText style={styles.hero}>{fmtUSD(totals.total)}</RNText>

      {paidLine ? (
        <View style={styles.paidRow}>
          <View style={styles.paidDot} />
          <RNText style={styles.paidLabel}>{paidLine}</RNText>
        </View>
      ) : null}

      <View style={styles.rule} />

      {/* ── itemised ─────────────────────────────────────────── */}
      {serviceLines.length > 0 ? (
        <>
          <SectionLabel>LABOR</SectionLabel>
          {serviceLines.map((l, i) => (
            <LineItem
              key={`svc-${i}`}
              name={l.name}
              detail={
                l.labor_hours != null
                  ? `${fmtLaborHours(l.labor_hours)}${
                      shop?.labor_rate != null ? ` @ ${fmtUSD(shop.labor_rate)}/HR` : ""
                    }`
                  : null
              }
              amount={fmtAmount(l.labor_cost)}
            />
          ))}
        </>
      ) : null}

      {partLines.length > 0 ? (
        <>
          <SectionLabel>PARTS</SectionLabel>
          {partLines.map((l, i) => (
            <LineItem
              key={`part-${i}`}
              name={l.name}
              detail={
                [
                  l.quantity != null && l.unit_cost != null
                    ? `${l.quantity} × ${fmtUSD(l.unit_cost)}`
                    : null,
                  l.oem_number ? `OEM ${l.oem_number}` : null,
                ]
                  .filter(Boolean)
                  .join("  ·  ") || null
              }
              amount={fmtAmount(l.cost)}
            />
          ))}
        </>
      ) : null}

      {/* ── totals ───────────────────────────────────────────── */}
      <View style={styles.rule} />

      {totals.labor_subtotal != null ? (
        <TotalRow label="Labor" amount={fmtAmount(totals.labor_subtotal)} />
      ) : null}
      <TotalRow label="Parts" amount={fmtAmount(totals.parts_subtotal)} />
      <TotalRow label="Service fee" amount={fmtAmount(totals.platform_fee)} />
      <TotalRow label="Tax" amount={fmtAmount(totals.tax)} />
      {totals.parts_saved > 0 ? (
        <TotalRow
          label="You saved on parts"
          amount={`−${fmtAmount(totals.parts_saved)}`}
          positive
        />
      ) : null}

      <View style={styles.ruleTight} />
      <TotalRow label="Total" amount={fmtUSD(totals.total)} hero />

      {/* ── provenance ───────────────────────────────────────── */}
      <View style={styles.rule} />
      <View style={styles.footer}>
        {shop?.name ? <RNText style={styles.footerTitle}>{shop.name}</RNText> : null}
        {techLine ? <RNText style={styles.footerMeta}>{techLine}</RNText> : null}
        {vehicleLine ? <RNText style={styles.footerMeta}>{vehicleLine}</RNText> : null}
        {idLine ? <RNText style={styles.footerMeta}>{idLine}</RNText> : null}
        {odoLine ? <RNText style={styles.footerMeta}>{odoLine}</RNText> : null}
      </View>

      {onLeaveReview ? (
        <Pressable
          onPress={onLeaveReview}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        >
          <RNText style={styles.ctaLabel}>Leave a review</RNText>
        </Pressable>
      ) : null}
    </View>
  );
}

const G = 24;

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: G,
    paddingBottom: 8,
  },
  pressed: {
    opacity: 0.6,
  },

  // ── masthead ──────────────────────────────────────────────
  head: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  eyebrow: {
    fontFamily: F.micro,
    fontSize: 9,
    letterSpacing: 2,
    color: C.low,
  },
  share: {
    fontFamily: F.micro,
    fontSize: 10,
    letterSpacing: 1.4,
    color: C.accent,
  },
  hero: {
    fontFamily: F.display,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -1.6,
    color: C.ink,
    marginTop: 4,
  },
  paidRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  paidDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.positive,
  },
  paidLabel: {
    fontFamily: F.medium,
    fontSize: 12,
    color: C.mid,
  },

  // ── rules ─────────────────────────────────────────────────
  rule: {
    height: 1,
    backgroundColor: C.hairline,
    marginTop: 20,
  },
  ruleTight: {
    height: 1,
    backgroundColor: C.hairline,
    marginTop: 12,
  },

  // ── sections + line items ─────────────────────────────────
  sectionLabel: {
    fontFamily: F.micro,
    fontSize: 9,
    letterSpacing: 2,
    color: C.low,
    marginTop: 16,
    marginBottom: 4,
  },
  lineItem: {
    paddingVertical: 8,
  },
  lineTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  lineName: {
    fontFamily: F.medium,
    fontSize: 14,
    color: C.ink,
    flexShrink: 1,
  },
  lineAmount: {
    fontFamily: F.micro,
    fontSize: 13,
    letterSpacing: 0.2,
    color: C.ink,
  },
  lineDetail: {
    fontFamily: F.microRegular,
    fontSize: 9,
    letterSpacing: 0.9,
    color: C.low,
    marginTop: 2,
  },

  // ── leaders ───────────────────────────────────────────────
  leaderBox: {
    flex: 1,
    overflow: "hidden",
    marginHorizontal: 7,
  },
  leaderText: {
    fontFamily: F.microRegular,
    fontSize: 11,
    letterSpacing: 1,
    color: C.leader,
  },

  // ── totals ────────────────────────────────────────────────
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 5,
  },
  totalLabel: {
    fontFamily: F.regular,
    fontSize: 13,
    color: C.mid,
  },
  totalValue: {
    fontFamily: F.microRegular,
    fontSize: 12,
    letterSpacing: 0.2,
    color: C.mid,
  },
  totalRowHero: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 12,
  },
  totalLabelHero: {
    fontFamily: F.display,
    fontSize: 17,
    letterSpacing: -0.3,
    color: C.ink,
  },
  totalValueHero: {
    fontFamily: F.display,
    fontSize: 22,
    letterSpacing: -0.6,
    color: C.ink,
  },
  positive: {
    color: C.positive,
  },

  // ── provenance footer ─────────────────────────────────────
  footer: {
    marginTop: 16,
    gap: 3,
  },
  footerTitle: {
    fontFamily: F.semi,
    fontSize: 14,
    color: C.ink,
  },
  footerMeta: {
    fontFamily: F.microRegular,
    fontSize: 9,
    letterSpacing: 1,
    color: C.low,
  },

  // ── cta ───────────────────────────────────────────────────
  cta: {
    marginTop: 22,
    paddingVertical: 15,
    borderRadius: 999,
    backgroundColor: C.accent,
    alignItems: "center",
  },
  ctaLabel: {
    fontFamily: F.semi,
    fontSize: 15,
    color: C.onAccent,
  },
});

export default ReceiptContent;
