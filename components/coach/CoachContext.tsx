/**
 * CoachContext — the registry the spotlight measures against.
 *
 * A coach mark has to cut a hole exactly where a real element is. Nothing in
 * the app knows its own screen position, so each element a step points at
 * registers here, and the overlay reads the rect for the step it is on.
 *
 * WHY A REGISTRY AND NOT REFS: the steps span four tabs. The element for
 * step 4 does not exist while step 1 is on screen, so the overlay cannot hold
 * a ref to it — it has to ask for a rect that may not have arrived yet.
 *
 * WHY RECTS ARE KEYED BY INSTANCE: the obvious design — one rect per id —
 * is wrong, because the elements worth pointing at are the ones rendered in a
 * list. Home draws a maintenance card per vehicle and Cars draws a health
 * ring per vehicle, so several live components legitimately claim the same
 * target id, and with a flat map the LAST one to report won. On Home that was
 * the bottom card, measured at y=863 on an 874pt screen: registered, entirely
 * below the fold, and therefore silently un-spotlightable. `resolve` picks the
 * best visible candidate instead — see the rule there.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { Dimensions } from "react-native";

const { height: SCREEN_H } = Dimensions.get("window");

export interface CoachRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius to cut with, so the hole matches the element. */
  radius: number;
}

type RectsById = Record<string, Record<string, CoachRect>>;

interface CoachRegistry {
  rects: RectsById;
  report: (id: string, instance: string, rect: CoachRect | null) => void;
  /** The rect a coach mark should actually point at for `id`. */
  resolve: (id: string | null | undefined) => CoachRect | null;
  /**
   * Bumped to make every target measure itself again.
   *
   * onLayout fires when a view is laid out, NOT when it scrolls — so a rect
   * captured at mount is measured against a scroll offset of zero and goes
   * stale the instant anything moves. Every maintenance card on Home reported
   * y=1289 on an 874pt screen for exactly this reason: correct at mount,
   * meaningless by the time the tour asked. The tour bumps this when a step
   * begins, and again as the screen settles.
   */
  nudge: number;
  remeasure: () => void;
}

const Ctx = createContext<CoachRegistry | null>(null);

/**
 * Of every component claiming this id, the one a driver can actually see —
 * and when several are visible, the topmost, because that is the one a list
 * leads with and the one the copy is about ("the job at the top of this
 * list"). Ties and total misses fall back to nothing, which makes the step
 * skip rather than point somewhere arbitrary.
 */
export function pickBestRect(
  candidates: Record<string, CoachRect> | undefined,
  screenHeight = SCREEN_H,
): CoachRect | null {
  if (!candidates) return null;
  let best: CoachRect | null = null;
  for (const r of Object.values(candidates)) {
    if (!r.width || !r.height) continue;
    const visible = Math.min(screenHeight, r.y + r.height) - Math.max(0, r.y);
    if (visible < 44) continue;
    if (!best || r.y < best.y) best = r;
  }
  return best;
}

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [rects, setRects] = useState<RectsById>({});
  const [nudge, setNudge] = useState(0);
  const remeasure = useCallback(() => setNudge((n) => n + 1), []);
  // Layout fires often and usually with the same numbers. Without this the
  // provider re-renders every tab in the app on every scroll settle.
  const last = useRef<Record<string, string>>({});

  const report = useCallback((id: string, instance: string, rect: CoachRect | null) => {
    const memo = `${id}#${instance}`;
    if (!rect) {
      delete last.current[memo];
      setRects((p) => {
        if (!p[id]?.[instance]) return p;
        const forId = { ...p[id] };
        delete forId[instance];
        const next = { ...p };
        if (Object.keys(forId).length === 0) delete next[id];
        else next[id] = forId;
        return next;
      });
      return;
    }
    const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(
      rect.width,
    )},${Math.round(rect.height)},${rect.radius}`;
    if (last.current[memo] === key) return;
    last.current[memo] = key;
    setRects((p) => ({ ...p, [id]: { ...(p[id] ?? {}), [instance]: rect } }));
  }, []);

  const resolve = useCallback(
    (id: string | null | undefined) => (id ? pickBestRect(rects[id]) : null),
    [rects],
  );

  const value = useMemo(
    () => ({ rects, report, resolve, nudge, remeasure }),
    [rects, report, resolve, nudge, remeasure],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Null outside the provider rather than throwing: targets are sprinkled
 * through screens that also render under the walk-in stack and in tests,
 * neither of which mounts the provider. A target that cannot report is simply
 * never pointed at.
 */
export function useCoachRegistry(): CoachRegistry | null {
  return useContext(Ctx);
}

let instanceSeq = 0;
/** A stable per-mount id, so two cards claiming one target stay distinct. */
export function useCoachInstanceId(): string {
  const ref = useRef<string | null>(null);
  if (ref.current === null) ref.current = `i${++instanceSeq}`;
  return ref.current;
}
