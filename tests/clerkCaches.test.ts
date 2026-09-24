import { describe, expect, it, vi } from "vitest";

import {
  createSafeTokenCache,
  guardClerkResourceStorage,
  type SecureKeyValueStore,
} from "@/lib/clerkCaches";

const KEY = "__clerk_client_jwt";
const OPTS = { keychainAccessible: 1 };

function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  const store: SecureKeyValueStore & { data: Map<string, string> } = {
    data,
    getItemAsync: vi.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    deleteItemAsync: vi.fn(async (key: string) => {
      data.delete(key);
    }),
  };
  return store;
}

describe("createSafeTokenCache (#188)", () => {
  it("reads the saved token with the stock cache's options", async () => {
    const store = memoryStore({ [KEY]: "jwt-1" });
    const cache = createSafeTokenCache(store, OPTS, 0);
    expect(await cache.getToken(KEY)).toBe("jwt-1");
    expect(store.getItemAsync).toHaveBeenCalledWith(KEY, OPTS);
  });

  it("THE BUG: a failed read never deletes the token or answers null", async () => {
    const store = memoryStore({ [KEY]: "jwt-1" });
    store.getItemAsync = vi.fn(async () => {
      throw new Error("errSecInteractionNotAllowed");
    });
    const cache = createSafeTokenCache(store, OPTS, 0);
    await expect(cache.getToken(KEY)).rejects.toThrow("errSecInteractionNotAllowed");
    expect(store.deleteItemAsync).not.toHaveBeenCalled();
    expect(store.data.get(KEY)).toBe("jwt-1");
  });

  it("retries a read that fails once", async () => {
    const store = memoryStore({ [KEY]: "jwt-1" });
    const real = store.getItemAsync;
    store.getItemAsync = vi.fn().mockRejectedValueOnce(new Error("busy")).mockImplementation(real);
    const cache = createSafeTokenCache(store, OPTS, 0);
    expect(await cache.getToken(KEY)).toBe("jwt-1");
  });

  it("falls back to the last token seen this run when reads keep failing", async () => {
    const store = memoryStore({ [KEY]: "jwt-1" });
    const cache = createSafeTokenCache(store, OPTS, 0);
    await cache.getToken(KEY);
    store.getItemAsync = vi.fn(async () => {
      throw new Error("keystore");
    });
    expect(await cache.getToken(KEY)).toBe("jwt-1");
  });

  it("returns what it saved even if the store briefly reports nothing", async () => {
    const store = memoryStore();
    const cache = createSafeTokenCache(store, OPTS, 0);
    await cache.saveToken(KEY, "jwt-2");
    store.data.delete(KEY);
    expect(await cache.getToken(KEY)).toBe("jwt-2");
  });

  it("a real sign-out (clearToken) is honoured", async () => {
    const store = memoryStore({ [KEY]: "jwt-1" });
    const cache = createSafeTokenCache(store, OPTS, 0);
    await cache.getToken(KEY);
    cache.clearToken?.(KEY);
    await Promise.resolve();
    expect(await cache.getToken(KEY)).toBeNull();
  });

  it("a fresh install with nothing stored reads as no token", async () => {
    const cache = createSafeTokenCache(memoryStore(), OPTS, 0);
    expect(await cache.getToken(KEY)).toBeNull();
  });
});

describe("guardClerkResourceStorage (#188)", () => {
  function setup() {
    const writes: [string, string][] = [];
    const factory = guardClerkResourceStorage(() => ({
      get: async () => null,
      set: async (key: string, value: string) => {
        writes.push([key, value]);
      },
    }));
    // Clerk opens one storage per resource from the same factory.
    return { writes, env: factory(), client: factory(), jwt: factory() };
  }

  it("THE BUG: the offline placeholder is never saved over the real cache", async () => {
    const { writes, env, client, jwt } = setup();
    await env.set("__clerk_cache_environment_ab12c", '{"display_config":{"id":"display_config_DUMMY_ID"}}');
    await client.set("__clerk_cache_client_ab12c", '{"id":"client_DUMMY_ID","sessions":[]}');
    await jwt.set("__clerk_cache_session_jwt_ab12c", "");
    expect(writes).toEqual([]);
  });

  it("real resources are saved, and a real sign-out still clears the session token", async () => {
    const { writes, env, client, jwt } = setup();
    await env.set("__clerk_cache_environment_ab12c", '{"id":"env_1"}');
    await client.set("__clerk_cache_client_ab12c", '{"id":"client_real","sessions":[]}');
    await jwt.set("__clerk_cache_session_jwt_ab12c", "");
    expect(writes.map(([k]) => k)).toEqual([
      "__clerk_cache_environment_ab12c",
      "__clerk_cache_client_ab12c",
      "__clerk_cache_session_jwt_ab12c",
    ]);
  });

  it("once the real client loads after a placeholder, saving resumes", async () => {
    const { writes, client, jwt } = setup();
    await client.set("__clerk_cache_client_ab12c", '{"id":"client_DUMMY_ID"}');
    await client.set("__clerk_cache_client_ab12c", '{"id":"client_real"}');
    await jwt.set("__clerk_cache_session_jwt_ab12c", "eyJ.real");
    expect(writes).toEqual([
      ["__clerk_cache_client_ab12c", '{"id":"client_real"}'],
      ["__clerk_cache_session_jwt_ab12c", "eyJ.real"],
    ]);
  });
});
