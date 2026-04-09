/**
 * ReferralUtils
 *
 * PURPOSE: Shared utilities for referral codes and share messages. Builds a stable
 *          referral code from profile data (email, firstName, lastName) and provides
 *          a memoized hook for use in settings screens.
 *
 * USED IN: app/(main-tabs)/settings/about.tsx, app/(main-tabs)/settings/refer-a-friend.tsx
 *
 * PROPS:
 *   - ReferralProfile (type): Profile shape with email, firstName, lastName
 *   - buildReferralCode (ReferralProfile): Returns referral code string (e.g. otopair-...)
 *   - useReferralCode (ReferralProfile): Hook returning memoized referral code
 *   - buildReferralShareMessage (string): Share message text including code
 *
 * EXAMPLE:
 *   // ReferralProfile
 *   const profile: ReferralProfile = { email: 'u@x.com', firstName: 'Jane', lastName: 'Doe' };
 *   // buildReferralCode
 *   const code = buildReferralCode(profile);
 *   // useReferralCode
 *   const referralCode = useReferralCode(data);
 *   // buildReferralShareMessage
 *   const message = buildReferralShareMessage('OTOPAIR-JANEDOE123456');
 *
 * OWNER: Daniel Chelala
 * TICKET: OTO-XXX
 */

import { useMemo } from 'react';

export type ReferralProfile = {
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
};

function stableShortHash(input: string): string {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return String(h % 1000000).padStart(6, '0');
}

export function buildReferralCode(profile: ReferralProfile): string {
  const base =
    (profile.email ?? '').split('@')[0]?.trim() ||
    `${(profile.firstName ?? '').trim()}${(profile.lastName ?? '').trim()}`.trim() ||
    'user';

  const normalized = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'user';
  return `otopair-${normalized}${stableShortHash(normalized)}`;
}

/**
 * Hook to get a memoized referral code for a profile.
 */
export function useReferralCode(profile: ReferralProfile) {
  return useMemo(
    () => buildReferralCode(profile),
    [profile.email, profile.firstName, profile.lastName]
  );
}

export function buildReferralShareMessage(displayCode: string): string {
  return (
    `Join Otopair and get $15 credit for your first booking!\n\n` +
    `Use my referral code: ${displayCode}\n`
  );
}
