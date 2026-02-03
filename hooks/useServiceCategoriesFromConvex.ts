/**
 * useServiceCategoriesFromConvex
 *
 * Fetches service categories from Convex (api.service_categories.list),
 * maps to ServiceCategoryItem[] for UI tabs, and hydrates useBookingStore.
 * Uses same category-key mapping as useServicesFromConvex so filtering by category matches.
 *
 * USED IN: app/(main-tabs)/home/_layout.tsx (with useServicesFromConvex)
 */

import { useQuery } from "convex/react";
import { useEffect, useMemo } from "react";
import { api } from "@/convex/_generated/api";
import type { Doc } from "@/convex/_generated/dataModel";
import type { ServiceCategoryItem } from "@/constants/services";
import type { ServiceCategory } from "@/stores/types/store.types";
import { useBookingStore } from "@/stores/useBookingStore";

/** Map Convex category name to app ServiceCategory (must match useServicesFromConvex) */
function mapCategoryNameToKey(name: string | undefined): ServiceCategory {
  if (!name) return "basic_maintenance";
  const n = name.toLowerCase();
  if (n.includes("tire") || n.includes("wheel")) return "tires_wheels";
  if (n.includes("brake") || n.includes("suspension")) return "brakes_suspension";
  if (n.includes("diagnostic") || n.includes("system")) return "system_diagnostics";
  return "basic_maintenance";
}

/**
 * Fetches service categories from Convex and hydrates the booking store.
 * When Convex data is loaded, setServiceCategories is called (UI uses these for tabs).
 */
export function useServiceCategoriesFromConvex() {
  const convexCategories = useQuery(api.service_categories.list);
  const setServiceCategories = useBookingStore((s) => s.setServiceCategories);

  const categories: ServiceCategoryItem[] = useMemo(() => {
    if (!convexCategories || !Array.isArray(convexCategories)) return [];
    const seen = new Set<ServiceCategory>();
    return convexCategories
      .slice()
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((cat: Doc<"service_categories">) => ({
        key: mapCategoryNameToKey(cat.name),
        label: cat.name ?? "",
      }))
      .filter((item) => {
        if (seen.has(item.key)) return false;
        seen.add(item.key);
        return true;
      });
  }, [convexCategories]);

  useEffect(() => {
    if (categories.length > 0) {
      setServiceCategories(categories);
    }
  }, [categories, setServiceCategories]);

  return {
    categories,
    isLoading: convexCategories === undefined,
    error: convexCategories === null ? "Failed to load categories" : null,
  };
}
