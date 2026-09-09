/**
 * useYmmtCatalog
 *
 * Hooks for the Year/Make/Model/Trim cascade backed by `convex/ymmtCatalog.ts`.
 * Mirrors the pattern used by otopair-web's VehicleYMMTPicker — name-based
 * inputs, ID lookups handled internally, ensure-actions fired on cache miss.
 *
 * Hooks:
 *   - `useMakes()`                          → all makes, year-agnostic
 *   - `useModels(makeName, yearStr)`        → models for a make+year (lazy fetch)
 *   - `useTrims(makeName, modelName, year)` → trims for a model+year (lazy fetch)
 *
 * Note: the underlying `ensureTrimsForModelYear` action caches an empty list
 * for most (model, year) pairs because NHTSA vPIC doesn't expose trims without
 * VIN context. UIs consuming `useTrims` should support free-text entry.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAction, useQuery } from "convex/react";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const MIN_YEAR = 1981;

/** Newest year first, going back to MIN_YEAR. Matches web's `buildYearOptions`. */
export function buildYearOptions(): string[] {
  const max = new Date().getFullYear() + 1;
  const opts: string[] = [];
  for (let y = max; y >= MIN_YEAR; y--) opts.push(String(y));
  return opts;
}

function normalizeYear(year: string | number | undefined | null): number | null {
  if (year == null) return null;
  const s = String(year);
  return /^\d{4}$/.test(s) ? Number(s) : null;
}

function findIdByName<TId>(
  rows: ReadonlyArray<{ _id: TId; name: string }> | null | undefined,
  name: string,
): TId | null {
  if (!rows || !name) return null;
  const norm = name.trim().toLowerCase();
  return rows.find((r) => r.name.trim().toLowerCase() === norm)?._id ?? null;
}

/* ────────────────────────────── Makes ────────────────────────────── */

export function useMakes() {
  return useQuery(api.ymmtCatalog.listMakes);
}

/* ────────────────────────────── Models ────────────────────────────── */

export function useModels(makeName: string, year: string | number | null | undefined) {
  const makes = useMakes();
  const yearNum = normalizeYear(year);
  const makeId = useMemo<Id<"makes"> | null>(
    () => findIdByName<Id<"makes">>(makes, makeName),
    [makes, makeName],
  );

  const models = useQuery(
    api.ymmtCatalog.listModelsForMakeYear,
    makeId && yearNum ? { makeId, year: yearNum } : "skip",
  );

  const ensureModels = useAction(api.ymmtCatalog.ensureModelsForMakeYear);
  const [fetching, setFetching] = useState(false);
  const lastFetch = useRef<string>("");

  // ensure-fetch: query returns `null` when no cache row exists for this
  // (make, year). We fire the action once per pair, set a ref so we don't
  // re-fire while the action is in flight.
  useEffect(() => {
    if (!makeId || !yearNum) return;
    if (models !== null) return;
    const key = `${makeId}:${yearNum}`;
    if (lastFetch.current === key) return;
    lastFetch.current = key;
    setFetching(true);
    ensureModels({ makeId, year: yearNum }).finally(() => setFetching(false));
  }, [makeId, yearNum, models, ensureModels]);

  return {
    models,                       // [] | array | null (cache miss) | undefined (loading)
    makeId,
    loading: fetching || (!!makeId && !!yearNum && models === undefined),
  };
}

/* ────────────────────────────── Trims ────────────────────────────── */

export function useTrims(
  makeName: string,
  modelName: string,
  year: string | number | null | undefined,
) {
  const { models } = useModels(makeName, year);
  const yearNum = normalizeYear(year);
  const modelId = useMemo<Id<"models"> | null>(
    () => findIdByName<Id<"models">>(models, modelName),
    [models, modelName],
  );

  const trims = useQuery(
    api.ymmtCatalog.listTrimsForModelYear,
    modelId && yearNum ? { modelId, year: yearNum } : "skip",
  );

  const ensureTrims = useAction(api.ymmtCatalog.ensureTrimsForModelYear);
  const [fetching, setFetching] = useState(false);
  const lastFetch = useRef<string>("");

  useEffect(() => {
    if (!modelId || !yearNum) return;
    if (trims !== null) return;
    const key = `${modelId}:${yearNum}`;
    if (lastFetch.current === key) return;
    lastFetch.current = key;
    setFetching(true);
    ensureTrims({ modelId, year: yearNum }).finally(() => setFetching(false));
  }, [modelId, yearNum, trims, ensureTrims]);

  return {
    trims,
    modelId,
    loading: fetching || (!!modelId && !!yearNum && trims === undefined),
  };
}
