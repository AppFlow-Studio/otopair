/**
 * ReceiptContent — Shop-style receipt body (v2).
 *
 * Flat, hairline-separated layout matching the Shopify Shop receipt
 * sheet (Image #3/#4). Lives inside the formSheet route at
 * `app/settings/receipt/[bookingId].tsx` and inside the legacy
 * `<ReceiptSheet />` (home auto-prompt + Cars tab service history).
 *
 * Order:
 *   1. Receipt title + share pill
 *   2. Order # · short date
 *   3. Line items (services + parts), icon tile left, price right
 *   4. Pricing stack (Labor / Parts / Platform fee / Tax)
 *   5. Total (bold, top hairline)
 *   6. Service location — shop address block
 *   7. Mechanic — avatar + name (+ optional title)
 *   8. Email address — Clerk-sourced
 *   9. Shop — placeholder logo tile + name
 *  10. Leave a review pill (only when `onLeaveReview` prop is set)
 */

import React from "react";
import { Pressable, Share, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { useUser } from "@clerk/clerk-expo";
import {
  Settings as Cog,
  Share as ShareIcon,
  Star,
  Store,
  Wrench,
} from "lucide-react-native";

import { Text } from "@/components/shared-ui";
import { CardShadow } from "@/constants/theme";
import { getServiceIcon } from "@/utils/serviceIcons";

const ACCENT = "#5299FE";
const INK = "#0F172A";
const SUB = "#6B7280";
const MUTED = "#94A3B8";
const HAIRLINE = "#E5E7EB";

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
  line_items: Array<
    | { type: "service"; name: string; labor_hours: number | null; labor_cost: number | null }
    | {
        type: "part";
        name: string;
        oem_number: string | null;
        quantity?: number;
        unit_cost?: number | null;
        cost: number | null;
      }
  >;
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
  /** When provided, renders a filled "Leave a review" pill at the
   *  bottom. Home auto-prompt passes it; formSheet route + Cars-tab
   *  service history leave it undefined. */
  onLeaveReview?: () => void;
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export function ReceiptContent({ payload, onLeaveReview }: Props) {
  const { receipt_number, service_date, shop, mechanic, line_items, totals } = payload;
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress ?? "—";

  const serviceLines = line_items.filter(
    (l): l is Extract<typeof line_items[number], { type: "service" }> => l.type === "service",
  );
  const partLines = line_items.filter(
    (l): l is Extract<typeof line_items[number], { type: "part" }> => l.type === "part",
  );

  const mechanicName = mechanic
    ? `${mechanic.first_name} ${mechanic.last_name}`.trim()
    : "";

  const handleShare = async () => {
    try {
      await Share.share({ message: `Otopair Receipt #${receipt_number}` });
    } catch {
      // user dismissed
    }
  };

  return (
    <View style={styles.wrap}>
      {/* 1 · Title + share */}
      <View style={styles.titleRow}>
        <Text weight="bold" color={INK} style={styles.title}>
          Receipt
        </Text>
        <Pressable
          onPress={handleShare}
          style={({ pressed }) => [styles.sharePill, pressed && { opacity: 0.7 }]}
          hitSlop={8}
        >
          <ShareIcon size={18} color={INK} strokeWidth={2} />
        </Pressable>
      </View>

      {/* 2 · Order # · date */}
      <Text size="sm" color={MUTED} style={styles.subtitle}>
        Order #{receipt_number}
        {service_date ? ` · ${fmtShortDate(service_date)}` : ""}
      </Text>

      {/* 3 · Line items */}
      {[...serviceLines, ...partLines].length > 0 && (
        <View style={styles.itemsBlock}>
          {serviceLines.map((line, i) => {
            const isLast = i === serviceLines.length - 1 && partLines.length === 0;
            const iconAsset = getServiceIcon(line.name);
            return (
              <LineItemRow
                key={`s-${i}`}
                icon={
                  iconAsset ? (
                    <Image
                      source={iconAsset}
                      style={styles.serviceIconImage}
                      contentFit="contain"
                    />
                  ) : (
                    <Wrench size={18} color={ACCENT} strokeWidth={1.8} />
                  )
                }
                iconBg="rgba(82,153,254,0.10)"
                name={line.name}
                subtitle={
                  line.labor_hours != null && shop?.labor_rate != null
                    ? `${line.labor_hours} hr · ${fmtUSD(shop.labor_rate)}/hr`
                    : null
                }
                price={fmtUSD(line.labor_cost)}
                isLast={isLast}
              />
            );
          })}
          {partLines.map((line, i) => {
            const isLast = i === partLines.length - 1;
            return (
              <LineItemRow
                key={`p-${i}`}
                icon={<Cog size={18} color="#475569" strokeWidth={1.8} />}
                iconBg="rgba(100,116,139,0.10)"
                name={line.name}
                subtitle={
                  line.quantity != null && line.quantity > 1 && line.unit_cost != null
                    ? `${line.oem_number ? `${line.oem_number} · ` : ""}${line.quantity} × ${fmtUSD(line.unit_cost)}`
                    : line.oem_number ?? null
                }
                price={fmtUSD(line.cost)}
                isLast={isLast}
              />
            );
          })}
        </View>
      )}

      {/* 4 · Pricing stack */}
      <View style={styles.pricingStack}>
        <PricingRow label="Labor" value={totals.labor_subtotal} />
        <PricingRow label="Parts" value={totals.parts_subtotal} />
        <PricingRow label="Platform fee" value={totals.platform_fee} />
        <PricingRow label="Tax" value={totals.tax} />
      </View>

      {/* 5 · Total */}
      <View style={styles.totalRow}>
        <Text weight="bold" size="md" color={INK}>
          Total
        </Text>
        <Text weight="bold" size="md" color={INK}>
          {fmtUSD(totals.total)}
        </Text>
      </View>

      {/* Sections divider */}
      <View style={styles.sectionDivider} />

      {/* 6 · Service location */}
      <Section title="Service location">
        {shop ? (
          <>
            <Text size="sm" color={INK}>
              {shop.name}
            </Text>
            {shop.address ? (
              <Text size="sm" color={INK} style={{ marginTop: 4 }}>
                {shop.address}
              </Text>
            ) : null}
            {shop.city ? (
              <Text size="sm" color={INK} style={{ marginTop: 4 }}>
                {shop.city}
              </Text>
            ) : null}
          </>
        ) : (
          <Text size="sm" color={SUB}>
            —
          </Text>
        )}
      </Section>

      {/* 7 · Mechanic */}
      {mechanic && (
        <Section title="Mechanic">
          <View style={styles.iconRow}>
            {mechanic.photo_url ? (
              <Image
                source={{ uri: mechanic.photo_url }}
                style={styles.smallAvatar}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.smallAvatar, styles.avatarFallback]}>
                <Text weight="bold" size="xs" color="#FFFFFF">
                  {initials(mechanicName) || "M"}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text size="sm" color={INK}>
                {mechanicName}
              </Text>
              {mechanic.title ? (
                <Text size="sm" color={SUB} style={{ marginTop: 2 }}>
                  {mechanic.title}
                </Text>
              ) : null}
            </View>
          </View>
        </Section>
      )}

      {/* 8 · Email address */}
      <Section title="Email address">
        <Text size="sm" color={INK}>
          {email}
        </Text>
      </Section>

      {/* 9 · Shop */}
      {shop && (
        <Section title="Shop">
          <View style={styles.iconRow}>
            <View style={styles.shopTile}>
              <Store size={16} color="#475569" strokeWidth={1.8} />
            </View>
            <Text weight="semiBold" size="sm" color={INK}>
              {shop.name}
            </Text>
          </View>
        </Section>
      )}

      {/* 10 · Leave a review (home auto-prompt only) */}
      {onLeaveReview && (
        <Pressable
          onPress={onLeaveReview}
          style={({ pressed }) => [styles.reviewBtn, pressed && { opacity: 0.9 }]}
        >
          <Star size={16} color="#FFFFFF" fill="#FFFFFF" />
          <Text weight="semiBold" size="sm" color="#FFFFFF">
            Leave a review
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function LineItemRow({
  icon,
  iconBg,
  name,
  subtitle,
  price,
  isLast,
}: {
  icon: React.ReactNode;
  iconBg: string;
  name: string;
  subtitle: string | null;
  price: string;
  isLast: boolean;
}) {
  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemIcon, { backgroundColor: iconBg }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text weight="bold" size="sm" color={INK} numberOfLines={2}>
          {name}
        </Text>
      </View>
      <Text size="sm" color={INK}>
        {price}
      </Text>
    </View>
  );
}

function PricingRow({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={styles.pricingRow}>
      <Text size="sm" color={SUB}>
        {label}
      </Text>
      <Text size="sm" color={INK}>
        {fmtUSD(value)}
      </Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text weight="bold" size="md" color={INK} style={styles.sectionTitle}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  sharePill: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: HAIRLINE,
    alignItems: "center",
    justifyContent: "center",
  },
  subtitle: {
    marginBottom: 18,
    letterSpacing: 0.1,
  },
  itemsBlock: {
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 14,
  },
  itemRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: HAIRLINE,
  },
  itemIcon: {
    width: 50,
    height: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    boxShadow: CardShadow.default,
  },
  serviceIconImage: {
    width: 70,
    height: 70,
  },
  pricingStack: {
    paddingTop: 14,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    marginTop: 12,
  },
  pricingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    paddingBottom: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HAIRLINE,
    marginTop: 8,
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: HAIRLINE,
    marginTop: 4,
    marginBottom: 18,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    marginBottom: 8,
  },
  iconRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#E5E7EB",
  },
  avatarFallback: {
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  shopTile: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: 8,
    marginBottom: 4,
  },
});

export default ReceiptContent;
