import { createUuid } from "./uuid";
import { safeFields } from "../shared/diagnostics.mjs";

type Entry = Record<string, string | number | boolean>;
const key = "doto.diagnostics.v1";
const capacity = 1000;
const clientId = createUuid();
export const diagnosticClientId = clientId;
let sequence = 0;
let history: Entry[] = [];
let pending: Entry[] = [];
let sending = false;
let started = false;
let retryAt = 0;
let failures = 0;
let dropped = 0;
let persistTimer: ReturnType<typeof setTimeout> | undefined;
try {
  const saved = JSON.parse(sessionStorage.getItem(key) || "null");
  if (saved) {
    history = Array.isArray(saved.history)
      ? saved.history.slice(-capacity)
      : [];
    pending = Array.isArray(saved.pending)
      ? saved.pending.slice(-capacity)
      : [];
    dropped = typeof saved.dropped === "number" ? saved.dropped : 0;
  }
} catch {
  /* Logging must remain usable when browser storage is unavailable. */
}
function persist() {
  clearTimeout(persistTimer);
  persistTimer = undefined;
  try {
    sessionStorage.setItem(key, JSON.stringify({ history, pending, dropped }));
  } catch {
    /* Keep the memory buffer. */
  }
}
export function diagnostic(
  event: string,
  fields: Record<string, unknown> = {},
) {
  const entry: Entry = {
    ...safeFields(fields),
    event,
    time: new Date().toISOString(),
    clientId,
    eventId: createUuid(),
    sequence: ++sequence,
    online: navigator.onLine,
    visible: document.visibilityState === "visible",
    secure: window.isSecureContext,
  };
  history.push(entry);
  history = history.slice(-capacity);
  pending.push(entry);
  if (pending.length > capacity) {
    dropped += pending.length - capacity;
    pending = pending.slice(-capacity);
  }
  // Coalesce storage writes during classroom-wide ICE bursts.
  if (!persistTimer) persistTimer = setTimeout(persist, 100);
  if (pending.length >= 40) void flushDiagnostics();
}
export function errorFields(error: unknown) {
  return {
    errorName:
      error instanceof Error || error instanceof DOMException
        ? error.name
        : "Error",
  };
}
export async function flushDiagnostics() {
  if (sending || !pending.length || Date.now() < retryAt) return;
  sending = true;
  const batch = pending.slice(0, 40);
  try {
    const response = await fetch("/api/diagnostics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ events: batch }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw Error("diagnostics upload");
    const sent = new Set(batch.map((entry) => entry.eventId));
    pending = pending.filter((entry) => !sent.has(entry.eventId));
    failures = 0;
    retryAt = 0;
    persist();
  } catch {
    retryAt = Date.now() + Math.min(60000, 2000 * 2 ** Math.min(++failures, 5));
  } finally {
    sending = false;
    if (pending.length >= 40 && !retryAt) void flushDiagnostics();
  }
}
export function downloadDiagnostics() {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          pending: pending.length,
          dropped,
          events: history,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `doto-diagnostics-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function startDiagnostics() {
  if (started) return;
  started = true;
  diagnostic("page.ready");
  persist();
  setInterval(() => void flushDiagnostics(), 2000);
  window.addEventListener("online", () => {
    diagnostic("network.online");
    retryAt = 0;
    void flushDiagnostics();
  });
  window.addEventListener("offline", () => diagnostic("network.offline"));
  const beacon = () => {
    persist();
    try {
      // A queued beacon is not an acknowledgement: retain events for retry after reload.
      if (pending.length)
        navigator.sendBeacon(
          "/api/diagnostics",
          new Blob([JSON.stringify({ events: pending.slice(0, 40) })], {
            type: "application/json",
          }),
        );
    } catch {
      /* Retry on next load/online. */
    }
  };
  document.addEventListener("visibilitychange", () => {
    diagnostic(document.hidden ? "page.hidden" : "page.visible");
    if (document.hidden) beacon();
    else void flushDiagnostics();
  });
  window.addEventListener("pagehide", () => {
    diagnostic("page.leave");
    beacon();
  });
  window.addEventListener("error", (event) =>
    diagnostic("browser.error", {
      ...errorFields(event.error),
      line: event.lineno,
      column: event.colno,
    }),
  );
  window.addEventListener("unhandledrejection", (event) =>
    diagnostic("browser.rejection", errorFields(event.reason)),
  );
}
