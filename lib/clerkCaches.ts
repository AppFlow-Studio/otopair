/**
 * Clerk's on-device caches, hardened against two ways they signed people out
 * (#188). Both wrap the stores Clerk ships; neither changes where or how the
 * data is kept, so existing sessions carry over.
 *
 * 1. TOKEN CACHE. Clerk reads its client token ("__clerk_client_jwt") before
 *    every request to its servers. The stock cache (@clerk/clerk-expo/
 *    token-cache) DELETES the token on any read error and returns null; the
 *    request then goes out with no credentials, Clerk answers with a brand-new
 *    signed-out client, and that is saved over the old one — a permanent
 *    sign-out from a single failed read. Reads do fail: on iOS the keychain is
 *    unreadable before the first unlock after a restart (an app woken in the
 *    background by a push, overnight after an update), and on Android a
 *    Keystore decrypt error throws. This cache retries, falls back to the last
 *    token it saw in this run, and otherwise throws — a failed request, which
 *    Clerk retries, instead of a new signed-out client.
 *
 * 2. RESOURCE CACHE (offline start, added in 96320c58). When Clerk cannot
 *    reach its servers and has nothing cached, it runs on a placeholder client
 *    with no sessions — and then saves whatever it holds, placeholder
 *    included. The next launch without a network loaded that placeholder and
 *    came up signed out, with no retry. This store never saves a placeholder,
 *    nor lets one clear the cached session token.
 */

/** The expo-secure-store calls the token cache needs (injectable for tests). */
export interface SecureKeyValueStore {
  getItemAsync(key: string, options?: object): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: object): Promise<void>;
  deleteItemAsync(key: string, options?: object): Promise<void>;
}

/** Clerk's TokenCache contract (@clerk/clerk-expo). */
export interface ClerkTokenCache {
  getToken: (key: string) => Promise<string | undefined | null>;
  saveToken: (key: string, token: string) => Promise<void>;
  clearToken?: (key: string) => void;
}

/** Clerk's resource-cache storage contract (IStorage). */
export interface ClerkResourceStorage {
  set: (key: string, value: string) => Promise<void>;
  get: (key: string) => Promise<string | null>;
}

const READ_ATTEMPTS = 3;
const RETRY_DELAY_MS = 200;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSafeTokenCache(
  store: SecureKeyValueStore,
  // Must match what the stock cache wrote with, so saved tokens stay readable.
  options: object,
  retryDelayMs = RETRY_DELAY_MS,
): ClerkTokenCache {
  const lastSeen = new Map<string, string>();
  return {
    async getToken(key) {
      let lastError: unknown;
      for (let attempt = 1; attempt <= READ_ATTEMPTS; attempt++) {
        try {
          const value = await store.getItemAsync(key, options);
          if (value != null) {
            lastSeen.set(key, value);
            return value;
          }
          // Nothing stored. Trust that unless this run already saw a token —
          // Clerk clears it through clearToken, which also forgets it here.
          return lastSeen.get(key) ?? null;
        } catch (error) {
          lastError = error;
          if (attempt < READ_ATTEMPTS) await sleep(retryDelayMs * attempt);
        }
      }
      const known = lastSeen.get(key);
      if (known != null) return known;
      // Never null here: null means "no client", and Clerk would start a new,
      // signed-out one and save it over the real token.
      throw lastError;
    },
    async saveToken(key, token) {
      lastSeen.set(key, token);
      await store.setItemAsync(key, token, options);
    },
    clearToken(key) {
      lastSeen.delete(key);
      void store.deleteItemAsync(key, options).catch(() => {});
    },
  };
}

/** Clerk's placeholder client (client_DUMMY_ID) and environment
 *  (display_config_DUMMY_ID) both carry this. */
const PLACEHOLDER_MARKER = '_DUMMY_ID"';

export function guardClerkResourceStorage(
  createStorage: () => ClerkResourceStorage,
): () => ClerkResourceStorage {
  // Clerk opens one storage per cached resource (environment, client, session
  // token) from this factory, so the flag lives out here, shared by all three.
  let holdingPlaceholder = false;
  return () => {
    const storage = createStorage();
    return {
      get: (key) => storage.get(key),
      set: (key, value) => {
        if (value.includes(PLACEHOLDER_MARKER)) {
          if (key.startsWith("__clerk_cache_client")) holdingPlaceholder = true;
          return Promise.resolve();
        }
        if (key.startsWith("__clerk_cache_client")) holdingPlaceholder = false;
        // The placeholder has no session, so Clerk clears the cached session
        // token next — keep the real one.
        if (key.startsWith("__clerk_cache_session_jwt") && value === "" && holdingPlaceholder) {
          return Promise.resolve();
        }
        return storage.set(key, value);
      },
    };
  };
}
