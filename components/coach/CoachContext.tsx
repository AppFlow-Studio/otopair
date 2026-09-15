/**
 * CoachContext — the registry the spotlight measures against.
 *
 * A coach mark has to cut a hole exactly where a real element is. Nothing
 * in the app knows its own screen position, so each element that a step
 * points at wraps itself in <CoachTarget id="..."> and reports its rect
 * here. The overlay reads the rect for the step it is on.
 *
 * WHY A REGISTRY AND NOT REFS: the steps span four tabs. The element for
 * step 3 does not exist while step 1 is on screen, so the overlay cannot
 * hold a ref to it — it has to ask for a rect that may not have arrived
 * yet and wait. That waiting is the whole reason this file exists.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";

export interface CoachRect {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Corner radius to cut with, so the hole matches the element. */
  radius: number;
}

interface CoachRegistry {
  rects: Record<string, CoachRect>;
  report: (id: string, rect: CoachRect | null) => void;
}

const Ctx = createContext<CoachRegistry | null>(null);

export function CoachProvider({ children }: { children: React.ReactNode }) {
  const [rects, setRects] = useState<Record<string, CoachRect>>({});
  // Layout fires often and usually with the same numbers. Without this the
  // provider re-renders every tab in the app on every scroll settle.
  const last = useRef<Record<string, string>>({});

  const report = useCallback((id: string, rect: CoachRect | null) => {
    if (!rect) {
      delete last.current[id];
      setRects((p) => {
        if (!(id in p)) return p;
        const n = { ...p };
        delete n[id];
        return n;
      });
      return;
    }
    const key = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(
      rect.width,
    )},${Math.round(rect.height)},${rect.radius}`;
    if (last.current[id] === key) return;
    last.current[id] = key;
    setRects((p) => ({ ...p, [id]: rect }));
  }, []);

  const value = useMemo(() => ({ rects, report }), [rects, report]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Null outside the provider rather than throwing: <CoachTarget> is sprinkled
 * through screens that also render in tests, in Storybook-ish harnesses and
 * under the walk-in stack, none of which mount the provider. A target that
 * cannot report is simply never pointed at.
 */
export function useCoachRegistry(): CoachRegistry | null {
  return useContext(Ctx);
}
