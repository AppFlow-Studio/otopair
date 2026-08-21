/**
 * offlineSessionCache
 *
 * PURPOSE: Session-scoped offline cache for Convex query payloads, so a
 * cold start with no internet can still show the bookings screen and the
 * car-health screen instead of the OfflineScreen — as long as the saved
 * Clerk session hasn't expired.
 *
 * CONTRACT:
 * - Every entry is wrapped in an envelope stamped with the Clerk user id
 *   and the session's `expireAt` (captured while ONLINE — offline we
 *   can't ask Clerk, so we trust the stored expiry + device clock).
 * - Reads validate: unexpired AND (when the caller knows the current
 *   Clerk user) same user. Expired/mismatched entries read as null.
 * - `purgeOfflineSessionCache()` runs on sign-out; a write for a
 *   different user also purges first so two accounts never interleave.
 *
 * USED IN:
 * - hooks/useMyBookingsWithDetails.ts   (bookings screen)
 * - hooks/useMaintenanceData.ts         (car health)
 * - hooks/useVehicleOwnershipFromConvex.ts (vehicles list → owner ids)
 * - components/connection/OfflineBootGate.tsx (boot decision)
 * - app/_layout.tsx sign-out watcher
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth, useSession } from "@clerk/clerk-expo";
import { useEffect, useRef, useState } from "react";

const PREFIX = "@otopair/offline_cache/";
/** Remembers which Clerk user the cache belongs to (cheap purge check). */
const OWNER_KEY = `${PREFIX}owner`;

interface CacheEnvelope<T> {
  clerkUserId: string;
  /** Clerk session expireAt, epoch ms. Validity horizon for the entry. */
  sessionExpireAt: number;
  savedAt: number;
  payload: T;
}

function isEnvelopeValid(
  env: CacheEnvelope<unknown>,
  clerkUserId?: string | null,
): boolean {
  if (Date.now() >= env.sessionExpireAt) return false;
  // When the caller knows who's signed in (Clerk hydrates from
  // SecureStore even offline), the entry must belong to them. When it
  // doesn't (very early boot), the OWNER_KEY purge discipline means
  // whatever is stored belongs to the last signed-in user.
  if (clerkUserId && env.clerkUserId !== clerkUserId) return false;
  return true;
}

export async function writeOfflineSessionCache<T>(
  key: string,
  payload: T,
  clerkUserId: string,
  sessionExpireAt: number,
): Promise<void> {
  try {
    const owner = await AsyncStorage.getItem(OWNER_KEY);
    if (owner !== null && owner !== clerkUserId) {
      // Different account signed in on this device — drop the old
      // user's data before writing the first entry for the new one.
      await purgeOfflineSessionCache();
    }
    const env: CacheEnvelope<T> = {
      clerkUserId,
      sessionExpireAt,
      savedAt: Date.now(),
      payload,
    };
    await AsyncStorage.multiSet([
      [OWNER_KEY, clerkUserId],
      [PREFIX + key, JSON.stringify(env)],
    ]);
  } catch {
    // Cache is best-effort; a failed write must never break live data.
  }
}

export async function readOfflineSessionCache<T>(
  key: string,
  clerkUserId?: string | null,
): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (raw == null) return null;
    const env = JSON.parse(raw) as CacheEnvelope<T>;
    if (!isEnvelopeValid(env, clerkUserId)) return null;
    return env.payload;
  } catch {
    return null;
  }
}

/** True when at least one unexpired entry exists — the boot gate's
 *  "we have something to show" signal. */
export async function hasValidOfflineSessionCache(): Promise<boolean> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter(
      (k) => k.startsWith(PREFIX) && k !== OWNER_KEY,
    );
    if (keys.length === 0) return false;
    const rows = await AsyncStorage.multiGet(keys);
    return rows.some(([, raw]) => {
      if (raw == null) return false;
      try {
        return isEnvelopeValid(JSON.parse(raw) as CacheEnvelope<unknown>);
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export async function purgeOfflineSessionCache(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) =>
      k.startsWith(PREFIX),
    );
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch {
    // Best-effort.
  }
}

/**
 * useSessionCachedQuery — wrap a live Convex `useQuery` result with the
 * session-scoped disk cache.
 *
 * - Live value present → write-through (keyed to the current session's
 *   expiry) and return it. `isFromCache: false`.
 * - Live value `undefined` (offline / still loading) → serve the last
 *   valid cached payload once the async read lands. `isFromCache: true`.
 *
 * `key: null` disables both directions (mirrors Convex's "skip").
 */
export function useSessionCachedQuery<T>(
  key: string | null,
  // `T` deliberately captures the WHOLE live type, `undefined` included
  // (i.e. `Row[] | undefined` from Convex's useQuery) — inferring
  // `T | undefined` instead makes TS re-derive the array type and lose
  // the element type on deep Convex return shapes.
  live: T,
): { value: T | undefined; isFromCache: boolean } {
  const { userId: clerkUserId } = useAuth();
  const { session } = useSession();
  const [cached, setCached] = useState<T | undefined>(undefined);
  // One read per key per mount — live data landing later wins anyway.
  const readForKey = useRef<string | null>(null);

  const expireAtMs = session?.expireAt ? new Date(session.expireAt).getTime() : null;

  useEffect(() => {
    if (key == null) return;
    if (live !== undefined) {
      if (clerkUserId && expireAtMs && expireAtMs > Date.now()) {
        void writeOfflineSessionCache(key, live, clerkUserId, expireAtMs);
      }
      return;
    }
    if (readForKey.current === key) return;
    readForKey.current = key;
    let cancelled = false;
    void readOfflineSessionCache<NonNullable<T>>(key, clerkUserId).then(
      (payload) => {
        if (!cancelled && payload !== null) setCached(payload);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [key, live, clerkUserId, expireAtMs]);

  if (live !== undefined) return { value: live, isFromCache: false };
  return { value: cached, isFromCache: cached !== undefined };
}
