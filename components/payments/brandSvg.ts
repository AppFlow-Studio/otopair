/**
 * brandSvg
 *
 * Maps a normalized card brand to its full-card brand SVG asset. Imported
 * everywhere we need to show the brand visually (carousel cards, live add-card
 * preview, booking review saved-card row).
 *
 * Brands without an asset entry (diners, jcb, generic) fall back to a text
 * label or nothing at the call site.
 */

import type React from "react";
import type { SvgProps } from "react-native-svg";

import Visa from "@/assets/images/VISA.svg";
import Mastercard from "@/assets/images/MASTERCARD.svg";
import Amex from "@/assets/images/AMEX.svg";
import Discover from "@/assets/images/DISCOVER.svg";
import UnionPay from "@/assets/images/UNIONPAY.svg";

import type { Brand } from "./BrandedCardVisual";

export const BRAND_SVG: Partial<Record<Brand, React.FC<SvgProps>>> = {
  visa: Visa,
  mastercard: Mastercard,
  amex: Amex,
  discover: Discover,
  unionpay: UnionPay,
};
