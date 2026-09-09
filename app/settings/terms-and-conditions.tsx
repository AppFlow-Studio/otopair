/**
 * TermsAndConditionsScreen
 *
 * PURPOSE: Full Terms of Use, readable anytime from Settings → Legal and from
 *          the signup consent links. Content lives in constants/legal/termsOfUse.
 *
 * USED IN: Settings → Legal, and the signup consent checkbox links.
 */

import React from "react";

import { LegalDocument } from "@/components/legal/LegalDocument";
import { TERMS_OF_USE } from "@/constants/legal/termsOfUse";

export default function TermsAndConditionsScreen() {
  return <LegalDocument data={TERMS_OF_USE} headerTitle="Terms of Use" />;
}
