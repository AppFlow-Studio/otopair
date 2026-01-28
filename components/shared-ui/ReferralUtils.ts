export type ReferralProfile = {
  username?: string | null;
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
    (profile.username ?? '').trim() ||
    (profile.email ?? '').split('@')[0]?.trim() ||
    `${(profile.firstName ?? '').trim()}${(profile.lastName ?? '').trim()}`.trim() ||
    'user';

  const normalized = base.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14) || 'user';
  return `otopair-${normalized}${stableShortHash(normalized)}`;
}

export function buildReferralShareMessage(displayCode: string): string {
  return (
    `Join Otopair and get 250 points for your first booking!\n\n` +
    `Use my referral code: ${displayCode}\n`
  );
}
