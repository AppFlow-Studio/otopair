/**
 * Intercepts console.error, console.warn, console.log, etc. and forwards to Convex.
 *
 * The forwarder must never be the thing that breaks: it runs inside the global
 * error handler and inside componentDidCatch, so it cannot throw, cannot
 * recurse, and cannot wedge. Three properties keep that true:
 *   - every argument is serialised inside try/catch (circular structures,
 *     BigInt and hostile toString() fall back to String(a));
 *   - a bounded queue drains one message at a time, and a send that never
 *     settles (Convex queues mutations while the socket is down) gives up
 *     its turn after SEND_TIMEOUT_MS so later messages still go out;
 *   - Convex's own client logger reports through console.warn/error with a
 *     "[CONVEX" prefix; forwarding those would log the log, so they are
 *     skipped, as is anything logged while a send is being prepared.
 */

type LogLevel = "error" | "warn" | "log" | "info" | "debug";

type LogToConvexFn = (args: {
  level: LogLevel;
  message: string;
  stack?: string;
  metadata?: unknown;
  session_id?: string;
}) => Promise<unknown>;

type QueuedLog = { level: LogLevel; args: unknown[] };

// Oldest entries drop first; a crash writes a burst of 5-20 lines and a
// runaway loop writes thousands, and neither should grow without bound.
const MAX_QUEUE = 50;
// How long one mutation may block the queue. Convex keeps the mutation
// itself queued for delivery regardless; this only frees the next message.
const SEND_TIMEOUT_MS = 10_000;

let sessionId: string | undefined;
let activeCleanup: (() => void) | null = null;

function safeString(value: unknown): string {
  try {
    if (value instanceof Error) return value.message;
    if (typeof value === "object" && value !== null) return JSON.stringify(value);
    return String(value);
  } catch {
    try {
      return Object.prototype.toString.call(value);
    } catch {
      return "[unserialisable]";
    }
  }
}

function safeStringify(value: unknown): unknown {
  if (value === undefined || value === null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return value;
  try {
    if (value instanceof Error) {
      return { name: value.name, message: value.message, stack: value.stack };
    }
    return JSON.parse(JSON.stringify(value, (_key, val) => (typeof val === "function" ? undefined : val)));
  } catch {
    return safeString(value);
  }
}

function buildMessage(args: unknown[]): string {
  return args.map(safeString).join(" ");
}

function extractStack(args: unknown[]): string | undefined {
  const err = args.find((a) => a instanceof Error);
  return err instanceof Error ? err.stack : undefined;
}

function extractMetadata(args: unknown[]): unknown {
  const rest = args.filter((a) => !(a instanceof Error));
  if (rest.length <= 1) return undefined;
  return safeStringify(rest.length > 1 ? rest.slice(1) : rest[0]);
}

/** The Convex client logs its own transport failures through console; sending
 *  those back to Convex would produce a log for every log. */
function isConvexInternal(args: unknown[]): boolean {
  const first = args[0];
  return typeof first === "string" && first.startsWith("[CONVEX");
}

function withTimeout(promise: Promise<unknown>, ms: number): Promise<unknown> {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    promise.then(
      () => {
        clearTimeout(t);
        resolve(undefined);
      },
      () => {
        clearTimeout(t);
        resolve(undefined);
      },
    );
  });
}

export function setupConsoleToConvex(logToConvex: LogToConvexFn): () => void {
  activeCleanup?.();

  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  const originals = {
    error: console.error,
    warn: console.warn,
    log: console.log,
    info: console.info,
    debug: console.debug,
  };

  const queue: QueuedLog[] = [];
  let draining = false;
  let preparing = false;
  let disposed = false;

  const drain = async () => {
    if (draining) return;
    draining = true;
    try {
      while (queue.length > 0 && !disposed) {
        const next = queue.shift()!;
        let payload: Parameters<LogToConvexFn>[0];
        try {
          preparing = true;
          payload = {
            level: next.level,
            message: buildMessage(next.args).slice(0, 10_000),
            stack: extractStack(next.args)?.slice(0, 20_000),
            metadata: extractMetadata(next.args),
            session_id: sessionId,
          };
        } catch {
          continue;
        } finally {
          preparing = false;
        }
        try {
          await withTimeout(logToConvex(payload), SEND_TIMEOUT_MS);
        } catch {
          // Suppressed: the line already reached the console.
        }
      }
    } finally {
      draining = false;
    }
  };

  const intercept =
    (level: LogLevel, original: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      original.apply(console, args);
      try {
        if (disposed || preparing || isConvexInternal(args)) return;
        if (queue.length >= MAX_QUEUE) queue.shift();
        queue.push({ level, args });
        void drain();
      } catch {
        // Never let the forwarder become the error.
      }
    };

  const patched = {
    error: intercept("error", originals.error),
    warn: intercept("warn", originals.warn),
    log: intercept("log", originals.log),
    info: intercept("info", originals.info),
    debug: intercept("debug", originals.debug),
  };

  console.error = patched.error;
  console.warn = patched.warn;
  console.log = patched.log;
  console.info = patched.info;
  console.debug = patched.debug;

  const cleanup = () => {
    disposed = true;
    if (console.error === patched.error) console.error = originals.error;
    if (console.warn === patched.warn) console.warn = originals.warn;
    if (console.log === patched.log) console.log = originals.log;
    if (console.info === patched.info) console.info = originals.info;
    if (console.debug === patched.debug) console.debug = originals.debug;
    if (activeCleanup === cleanup) activeCleanup = null;
  };
  activeCleanup = cleanup;

  // Return this install's own cleanup, not whatever is active later.
  return cleanup;
}
