/**
 * useTypewriterText — cycles through a list of phrases with a
 * typewriter effect (character-by-character type-in, hold, delete,
 * pause, next).
 *
 * Returns the current displayed string. Used on the Home search bar
 * to show rotating example queries ("Book an oil change", "Mechanics
 * near me", "Book an inspection", …) instead of one static
 * placeholder.
 *
 * Pure setTimeout-driven state machine — no Reanimated worklets
 * needed since this is just text-content updates on the JS thread.
 * The schedule is captured per render so an unmount or a phrase-list
 * change always clears the inflight timer.
 *
 * Phases per phrase:
 *   1. typing   — append one char every `typeMs`
 *   2. holding  — wait `holdMs` with the full phrase visible
 *   3. deleting — pop one char every `deleteMs`
 *   4. pausing  — wait `pauseMs` after empty, then advance index
 *
 * @example
 *   const text = useTypewriterText([
 *     "Book an oil change",
 *     "Mechanics near me",
 *     "Book an inspection",
 *   ]);
 *   <Text>{text}</Text>
 */

import { useEffect, useRef, useState } from "react";

export interface TypewriterOptions {
  /** Milliseconds per character while typing. Default 60. */
  typeMs?: number;
  /** Milliseconds per character while deleting. Default 30. */
  deleteMs?: number;
  /** Hold the fully-typed phrase this long before deleting.
   *  Default 1500. */
  holdMs?: number;
  /** Pause after the line goes empty, before starting the next
   *  phrase. Default 250. */
  pauseMs?: number;
}

type Phase = "typing" | "holding" | "deleting" | "pausing";

export function useTypewriterText(
  phrases: readonly string[],
  options: TypewriterOptions = {},
): string {
  const {
    typeMs = 60,
    deleteMs = 30,
    holdMs = 1500,
    pauseMs = 250,
  } = options;

  const [text, setText] = useState<string>(phrases[0] ?? "");
  // Track index + phase in refs so the scheduler reads the latest
  // values without resetting the timer chain on each render.
  const indexRef = useRef(0);
  const phaseRef = useRef<Phase>("typing");
  const textRef = useRef<string>("");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (phrases.length === 0) {
      setText("");
      return;
    }

    // Fresh start whenever the phrases array identity changes.
    indexRef.current = 0;
    phaseRef.current = "typing";
    textRef.current = "";
    setText("");

    const tick = () => {
      const current = phrases[indexRef.current % phrases.length];
      const phase = phaseRef.current;
      const buf = textRef.current;

      if (phase === "typing") {
        if (buf.length < current.length) {
          const next = current.slice(0, buf.length + 1);
          textRef.current = next;
          setText(next);
          timerRef.current = setTimeout(tick, typeMs);
        } else {
          phaseRef.current = "holding";
          timerRef.current = setTimeout(tick, holdMs);
        }
        return;
      }

      if (phase === "holding") {
        phaseRef.current = "deleting";
        timerRef.current = setTimeout(tick, deleteMs);
        return;
      }

      if (phase === "deleting") {
        if (buf.length > 0) {
          const next = buf.slice(0, -1);
          textRef.current = next;
          setText(next);
          timerRef.current = setTimeout(tick, deleteMs);
        } else {
          phaseRef.current = "pausing";
          timerRef.current = setTimeout(tick, pauseMs);
        }
        return;
      }

      if (phase === "pausing") {
        indexRef.current = (indexRef.current + 1) % phrases.length;
        phaseRef.current = "typing";
        timerRef.current = setTimeout(tick, typeMs);
        return;
      }
    };

    timerRef.current = setTimeout(tick, typeMs);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [phrases, typeMs, deleteMs, holdMs, pauseMs]);

  return text;
}
