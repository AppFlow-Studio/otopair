/**
 * PrivacyPolicyScreen
 *
 * PURPOSE: Full Privacy Policy, readable anytime from Settings → Legal and from
 *          the signup consent links. Content lives in constants/legal/privacyPolicy.
 *
 * USED IN: Settings → Legal, and the signup consent checkbox links.
 */

import React from "react";

import { LegalDocument } from "@/components/legal/LegalDocument";
import { PRIVACY_POLICY } from "@/constants/legal/privacyPolicy";

export default function PrivacyPolicyScreen() {
  return <LegalDocument data={PRIVACY_POLICY} headerTitle="Privacy Policy" />;
}
