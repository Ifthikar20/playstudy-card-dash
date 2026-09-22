/**
 * Built-in analytics: page views, a few key actions and every error, batched to our own
 * server (playstudy-backend/app/api/analytics.py). Nothing goes to a third party.
 *
 * Each browser gets a random id (kept on this device) and each visit - one tab - another.
 * The tags of the link that opened the app (?utm_source=..., ?twclid=..., ?ref=tester-name)
 * ride along with every event of that visit, and the first campaign a browser ever came
 * from is kept too, so a campaign's visitors - or a tester's run, and anything that broke
 * in it - can be found. An admin reads it all from GET /api/analytics/issues (the
 * tracking app). No notes, questions or answers are ever sent: page paths, action names
 * and error messages only.
 */
import { API_URL, getAuthToken } from "@/services/api";

type Kind = "view" | "action" | "error";
interface AnalyticsEvent {
  kind: Kind;
  name: string;
  path: string;
  data?: Record<string, unknown>;
}

/**
 * The link tags worth keeping (the server keeps the same list): the campaign tags an ad
 * or newsletter link carries (utm_*), the click ids ad networks add (twclid from X,
 * gclid/gbraid/wbraid/dclid from Google, fbclid from Meta, msclkid from Microsoft,
 * ttclid from TikTok, li_fat_id from LinkedIn), and our own ref/tester/test for testers.
 * e.g. /?utm_source=Twitter&utm_medium=Conversion&utm_campaign=12082026-Newsletter&twclid=2djh3k...
 */
const TAG_KEYS = [
  "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_id",
  "twclid", "gclid", "gbraid", "wbraid", "dclid", "fbclid", "msclkid", "ttclid", "li_fat_id",
  "ref", "tester", "test",
];
const ENDPOINT = `${API_URL}/analytics/events`;
const FLUSH_MS = 5000;
const BATCH = 40;
/** The same error at most this often per page load: a render loop shouldn't flood the table. */
const SAME_ERROR_MAX = 5;

const randomId = (): string => {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  }
};

function kept(get: () => Storage, key: string): string {
  try {
    const store = get();
    const have = store.getItem(key);
    if (have) return have;
    const made = randomId();
    store.setItem(key, made);
    return made;
  } catch {
    return randomId(); // private mode: an id for this page load only
  }
}

/** An API or page path with its ids taken out, so the same page or call groups together. */
export function pathTemplate(url: string): string {
  let path = url;
  try {
    path = new URL(url, window.location.origin).pathname;
  } catch {
    /* already a path */
  }
  return path
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ":id")
    .replace(/\/-?\d+(?=\/|$)/g, "/:n");
}

let started = false;
let clientId = "";
let visitId = "";
let tags: Record<string, string> = {};
/** The campaign this browser first arrived from, kept for good - "where did they come from", even visits later. */
let firstTouch: Record<string, string> | null = null;
let timer: number | undefined;
const queue: AnalyticsEvent[] = [];
const errorCounts = new Map<string, number>();
let send: typeof fetch = (input, init) => fetch(input, init);

function schedule() {
  if (timer === undefined) timer = window.setTimeout(() => flush(), FLUSH_MS);
}

/** Send what's queued. `leaving`: the page is going away, so the request must outlive it. */
export function flush(leaving = false): void {
  window.clearTimeout(timer);
  timer = undefined;
  if (!started || !queue.length) return;
  const events = queue.splice(0, BATCH);
  const body = JSON.stringify({ client_id: clientId, visit_id: visitId, tags, first_touch: firstTouch, events });
  const token = getAuthToken();
  void send(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body,
    keepalive: leaving && body.length < 60_000,
  }).catch(() => undefined); // analytics never gets in anyone's way
  if (queue.length) schedule();
}

/** Record something. `name` is a short label ("teach_start", an error message, a page). */
export function track(kind: Kind, name: string, data?: Record<string, unknown>, path?: string): void {
  if (!started || !name) return;
  if (kind === "error") {
    const seen = (errorCounts.get(name) ?? 0) + 1;
    errorCounts.set(name, seen);
    if (seen > SAME_ERROR_MAX) return;
  }
  queue.push({ kind, name: name.slice(0, 160), path: path ?? window.location.pathname, data });
  if (queue.length >= BATCH) flush();
  else schedule();
}

export const trackView = (pathname: string): void => track("view", pathTemplate(pathname), undefined, pathname);
export const trackAction = (name: string, data?: Record<string, unknown>): void => track("action", name, data);

/** A caught error worth knowing about (the error boundary uses this). */
export function trackError(error: unknown, data?: Record<string, unknown>): void {
  const e = error instanceof Error ? error : new Error(String(error));
  track("error", e.message || e.name || "Error", { stack: e.stack?.slice(0, 1500), ...data });
}

/** Errors that mean nothing to us: a browser extension's, or a cross-origin script's with no detail. */
const NOISE = /ResizeObserver loop|^Script error\.?$|chrome-extension:|moz-extension:/i;

/** Wrap fetch so a failing call to our own API is recorded: 5xx, 429, or no answer at all. */
function watchApi() {
  const original = window.fetch.bind(window);
  send = original;
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const ours = url.startsWith(API_URL) && !url.startsWith(ENDPOINT);
    const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
    const began = performance.now();
    try {
      const res = await original(input, init);
      if (ours && (res.status >= 500 || res.status === 429)) {
        track("error", `API ${res.status} ${method} ${pathTemplate(url)}`, { status: res.status, ms: Math.round(performance.now() - began) });
      }
      return res;
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      if (ours && !aborted) track("error", `API unreachable ${method} ${pathTemplate(url)}`, { message: String(err) });
      throw err;
    }
  };
}

/** Start once, before the app renders. */
export function initAnalytics(): void {
  if (started || typeof window === "undefined") return;
  started = true;
  clientId = kept(() => window.localStorage, "an-cid");
  visitId = kept(() => window.sessionStorage, "an-vid");
  // The link's tags, added to any this visit already had.
  try {
    tags = JSON.parse(window.sessionStorage.getItem("an-tags") || "{}") as Record<string, string>;
  } catch {
    tags = {};
  }
  const params = new URLSearchParams(window.location.search);
  let found = false;
  const fromLink: Record<string, string> = {};
  for (const key of TAG_KEYS) {
    const value = params.get(key);
    if (value) {
      fromLink[key] = value.slice(0, 120);
      found = true;
    }
  }
  if (found) tags = { ...tags, ...fromLink };
  try {
    if (found) window.sessionStorage.setItem("an-tags", JSON.stringify(tags));
    firstTouch = JSON.parse(window.localStorage.getItem("an-first-touch") || "null") as Record<string, string> | null;
    if (!firstTouch && found) {
      firstTouch = { ...fromLink, landed: window.location.pathname, at: new Date().toISOString() };
      window.localStorage.setItem("an-first-touch", JSON.stringify(firstTouch));
    }
  } catch {
    /* private mode: this visit's tags only */
  }

  watchApi();
  window.addEventListener("error", (e) => {
    const message = e.message || (e.error instanceof Error ? e.error.message : "");
    if (!message || NOISE.test(message) || NOISE.test(e.filename || "")) return;
    track("error", message, { source: pathTemplate(e.filename || ""), line: e.lineno, column: e.colno, stack: (e.error as Error | undefined)?.stack?.slice(0, 1500) });
  });
  window.addEventListener("unhandledrejection", (e) => {
    const reason = e.reason;
    const message = reason instanceof Error ? reason.message : String(reason ?? "");
    if (!message || NOISE.test(message)) return;
    track("error", message, { unhandled: true, stack: reason instanceof Error ? reason.stack?.slice(0, 1500) : undefined });
  });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush(true);
  });
  window.addEventListener("pagehide", () => flush(true));
}
