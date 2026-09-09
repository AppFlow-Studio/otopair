/**
 * useYmmTrims — trim list for a year/make/model, sourced from the premium Car
 * API + MarketCheck via `convex/ymmtCatalog.resolveTrimsForYmm` (cached in the
 * shared trims catalog). Replaces the old client-side VDB `useVdbVariants` trim
 * lookup in the "add vehicle" flow.
 *
 * Vehicle IMAGES + paint colors stay on VDB (see utils/vehicleImage.ts) — this
 * hook only supplies the selectable/stored trim tokens. Mirrors the
 * useVdbVariants contract: `{ trims, isLoading }`, re-fetching when inputs
 * change, so it drops into the existing picker UIs.
 */

import { useEffect, useState } from 'react';
import { useAction } from 'convex/react';
import { api } from '@/convex/_generated/api';

export function useYmmTrims(
  year: number | undefined,
  make: string,
  model: string,
): { trims: string[]; isLoading: boolean } {
  const resolveTrims = useAction(api.ymmtCatalog.resolveTrimsForYmm);
  const [trims, setTrims] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!year || !make?.trim() || !model?.trim()) {
      setTrims([]);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    resolveTrims({ year, make, model })
      .then((res) => {
        if (cancelled) return;
        setTrims(res?.trims ?? []);
        setIsLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setTrims([]);
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, make, model, resolveTrims]);

  return { trims, isLoading };
}
