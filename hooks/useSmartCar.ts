/**
 * useSmartcar Hook
 * Connects the OAuth flow to Convex actions.
 */

import { useState, useCallback } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { openSmartcarConnect } from "../lib/smartcar";

export function useSmartcar() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exchangeCode = useAction(api.smartcar.exchangeCodeAndConnect);
  const fetchData = useAction(api.smartcar.fetchVehicleData);
  const disconnectAction = useAction(api.smartcar.disconnectVehicle);
  const compatCheck = useAction(api.smartcar.checkCompatibility);

  /**
   * Full connect flow: OAuth → exchange code → VIN pipeline → AI enrichment
   * @param userId - Current user's Convex ID
   * @param vin - Optional VIN for deterministic matching (from Add Vehicle flow)
   */
  const connect = useCallback(
    async (userId: Id<"users">, vin?: string) => {
      setIsConnecting(true);
      setError(null);

      try {
        // Step 1: OAuth flow
        const oauth = await openSmartcarConnect(userId);
        if (!oauth.success || !oauth.code) {
          if (oauth.error === "Cancelled") {
            // User cancelled — not an error
            return { success: false, error: "Cancelled" };
          }
          setError(oauth.error || "Connection failed");
          return { success: false, error: oauth.error };
        }

        // Step 2: Exchange code → pipeline runs server-side
        // Pass VIN for deterministic matching when available
        const result = await exchangeCode({
          code: oauth.code,
          userId,
          vin: vin || undefined,
        });

        if (!result.success) setError(result.error || "Connection failed");
        return result;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Connection failed";
        setError(msg);
        return { success: false, error: msg };
      } finally {
        setIsConnecting(false);
      }
    },
    [exchangeCode]
  );

  const fetchVehicleData = useCallback(
    async (vehicleOwnerId: Id<"vehicle_owners">) => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await fetchData({ vehicleOwnerId });
        if (data.error) setError(data.error);
        return data;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Fetch failed";
        setError(msg);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [fetchData]
  );

  const disconnect = useCallback(
    async (vehicleOwnerId: Id<"vehicle_owners">) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await disconnectAction({ vehicleOwnerId });
        if (!result.success) setError(result.error || "Disconnect failed");
        return result.success;
      } catch (err) {
        setError("Disconnect failed");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [disconnectAction]
  );

  const checkCompatibility = useCallback(
    async (vin: string) => {
      try {
        return await compatCheck({ vin });
      } catch {
        return { compatible: false, reason: "Check failed" };
      }
    },
    [compatCheck]
  );

  return {
    isConnecting,
    isLoading,
    error,
    connect,
    fetchVehicleData,
    disconnect,
    checkCompatibility,
    clearError: () => setError(null),
  };
}

/**
 * Reactive query: Smartcar connection status for a vehicle
 */
export function useSmartcarStatus(vehicleOwnerId: Id<"vehicle_owners"> | undefined) {
  return useQuery(
    api.smartcar.getConnectionStatus,
    vehicleOwnerId ? { vehicleOwnerId } : "skip"
  );
}

/**
 * Reactive query: All user vehicles with Smartcar status
 */
export function useConnectedVehicles(userId: Id<"users"> | undefined) {
  return useQuery(
    api.smartcar.getUserConnectedVehicles,
    userId ? { userId } : "skip"
  );
}