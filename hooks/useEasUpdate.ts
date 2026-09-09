/**
 * useEasUpdate
 *
 * Drives the global "Update available" banner. Wraps `Updates.useUpdates()`
 * from expo-updates and adds:
 *   - foreground-triggered `checkForUpdateAsync()` (cold start is already
 *     handled by the default `checkAutomatically: "ON_LOAD"` in app.json)
 *   - auto-`fetchUpdateAsync()` once a newer manifest is detected
 *   - per-updateId dismiss state persisted via expo-secure-store, so a
 *     dismissed banner re-appears only when a NEWER update arrives
 *
 * Banner is suppressed in dev (Expo Go / dev client) where
 * `Updates.isEnabled` is false.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";
import * as SecureStore from "expo-secure-store";

const DISMISSED_UPDATE_KEY = "eas_dismissed_update_id_v1";

interface UseEasUpdateResult {
  /** True when banner should be visible (download complete, not dismissed). */
  show: boolean;
  /** True while a background fetch is in flight. */
  isDownloading: boolean;
  /** Reload the app into the freshly downloaded update. */
  reload: () => Promise<void>;
  /** Dismiss the banner for the currently pending update. */
  dismiss: () => Promise<void>;
}

export function useEasUpdate(): UseEasUpdateResult {
  const {
    isUpdateAvailable,
    isUpdatePending,
    isDownloading,
    downloadedUpdate,
  } = Updates.useUpdates();

  const [dismissedUpdateId, setDismissedUpdateId] = useState<string | null>(null);
  const fetchInFlight = useRef(false);

  useEffect(() => {
    SecureStore.getItemAsync(DISMISSED_UPDATE_KEY)
      .then((value) => setDismissedUpdateId(value ?? null))
      .catch(() => setDismissedUpdateId(null));
  }, []);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
      if (state === "active") {
        Updates.checkForUpdateAsync().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    if (!isUpdateAvailable || isUpdatePending || fetchInFlight.current) return;
    fetchInFlight.current = true;
    Updates.fetchUpdateAsync()
      .catch(() => {})
      .finally(() => {
        fetchInFlight.current = false;
      });
  }, [isUpdateAvailable, isUpdatePending]);

  const pendingId = downloadedUpdate?.updateId ?? null;
  const show =
    !__DEV__ &&
    Updates.isEnabled &&
    isUpdatePending &&
    pendingId !== null &&
    pendingId !== dismissedUpdateId;

  const reload = useCallback(async () => {
    try {
      await Updates.reloadAsync();
    } catch {
      // reloadAsync rejects only in dev / when updates are disabled — both
      // already gated above. Swallow to keep the Reload button responsive.
    }
  }, []);

  const dismiss = useCallback(async () => {
    if (!pendingId) return;
    setDismissedUpdateId(pendingId);
    try {
      await SecureStore.setItemAsync(DISMISSED_UPDATE_KEY, pendingId);
    } catch {
      // Best-effort: if SecureStore fails the in-memory dismiss still
      // hides the banner for this session.
    }
  }, [pendingId]);

  return { show, isDownloading, reload, dismiss };
}
