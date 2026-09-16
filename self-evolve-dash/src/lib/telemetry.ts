/**
 * Runtime error-telemetry hook (dependency-free).
 *
 * Captures three error classes in the browser: uncaught `error` events,
 * unhandled promise rejections, and `console.error` calls (React render
 * errors reach this via ErrorBoundary). Entries live in a bounded in-memory
 * ring buffer, persist to localStorage (best-effort) and — ONLY when an
 * endpoint is configured via `installTelemetry({ endpoint })` or
 * `window.TELEMETRY_ENDPOINT` — batch-flush as JSON through
 * sendBeacon/fetch-keepalive. Without an endpoint the hook stays fully
 * local: it never touches the network.
 *
 * Privacy: entries contain kind/message/stack/path only, length-capped.
 * Mirrors nexus-infinity-hub/src/lib/telemetry.ts (quote style differs).
 */

export type TelemetryKind = 'error' | 'unhandledrejection' | 'console' | 'react' | 'manual';

export interface TelemetryEntry {
  ts: string;
  kind: TelemetryKind;
  message: string;
  stack?: string;
  path: string;
}

export interface TelemetryOptions {
  appId: string;
  version?: string;
  /** POST target for batched flushes. Default: `window.TELEMETRY_ENDPOINT`, else local-only. */
  endpoint?: string | null;
  /** Ring-buffer size (default 50). */
  capacity?: number;
  /** localStorage key (default 'telemetry:errors'). */
  storageKey?: string;
  /** Flush once N entries are unflushed (default 10). */
  batchAfter?: number;
  /** Injectable network transport (tests); `null` disables flushing. */
  transport?: ((url: string, body: string) => void) | null;
}

export interface TelemetrySnapshot {
  appId: string | null;
  version: string | null;
  installed: boolean;
  endpoint: string | null;
  entries: TelemetryEntry[];
}

export type TelemetryDisposer = () => void;

/** Structural event shapes. */
export interface ErrorEventLike {
  message?: string;
  error?: unknown;
}
export interface RejectionEventLike {
  reason?: unknown;
}

const DEFAULT_CAPACITY = 50;
const DEFAULT_STORAGE_KEY = 'telemetry:errors';
const DEFAULT_BATCH_AFTER = 10;
const MESSAGE_CAP = 300;
const STACK_CAP = 1200;

declare global {
  interface Window {
    TELEMETRY_ENDPOINT?: string;
    __telemetry?: {
      snapshot(): TelemetrySnapshot;
      clear(): void;
      flush(): void;
    };
  }
}

let installed = false;
let disposer: TelemetryDisposer | null = null;
let appId: string | null = null;
let version: string | null = null;
let endpoint: string | null = null;
let capacity = DEFAULT_CAPACITY;
let storageKey = DEFAULT_STORAGE_KEY;
let batchAfter = DEFAULT_BATCH_AFTER;
let entries: TelemetryEntry[] = [];
let lastFlushed = 0;
let transport: ((url: string, body: string) => void) | null = null;

function nowIso(): string {
  return new Date().toISOString();
}

function currentPage(): string {
  try {
    return typeof location !== 'undefined' ? location.pathname || '/' : '/';
  } catch {
    return '/';
  }
}

function capText(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

function capStack(stack: string | undefined): string | undefined {
  return stack === undefined ? undefined : capText(stack, STACK_CAP);
}

function stringifyArg(value: unknown): string {
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

function messageFrom(value: unknown): string {
  if (value instanceof Error) return capText(value.message, MESSAGE_CAP);
  if (typeof value === 'string') return capText(value, MESSAGE_CAP);
  try {
    return capText(String(value), MESSAGE_CAP);
  } catch {
    return '<unserializable>';
  }
}

function stackFrom(error: unknown): string | undefined {
  if (error instanceof Error && typeof error.stack === 'string') return capStack(error.stack);
  return undefined;
}

function record(entry: TelemetryEntry): void {
  entries.push(entry);
  if (entries.length > capacity) entries = entries.slice(-capacity);
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch {
    /* storage unavailable — memory buffer still holds it */
  }
  maybeFlush();
}

function maybeFlush(): void {
  if (!endpoint || !transport) return;
  if (entries.length - lastFlushed < batchAfter) return;
  flushTelemetry();
}

/** Batch-send pending entries as `{ appId, version, sentAt, entries }`. No-op without an endpoint. */
export function flushTelemetry(): void {
  if (!endpoint || !transport) return;
  const pending = entries.slice(lastFlushed);
  if (pending.length === 0) return;
  const body = JSON.stringify({ appId, version, sentAt: nowIso(), entries: pending });
  lastFlushed = entries.length;
  try {
    transport(endpoint, body);
  } catch {
    /* transport errors are never fatal */
  }
}

function defaultTransport(url: string, body: string): void {
  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    if (navigator.sendBeacon(url, body)) return;
  }
  if (typeof fetch === 'function') {
    void fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => undefined);
  }
}

/** Window `error` listener body. */
export function __handleErrorEvent(evt: ErrorEventLike): void {
  if (!installed) return;
  const error = evt.error;
  record({
    ts: nowIso(),
    kind: 'error',
    message: messageFrom(error ?? evt.message ?? '<no message>'),
    stack: stackFrom(error),
    path: currentPage(),
  });
}

/** Window `unhandledrejection` listener body. */
export function __handleRejectionEvent(evt: RejectionEventLike): void {
  if (!installed) return;
  record({
    ts: nowIso(),
    kind: 'unhandledrejection',
    message: messageFrom(evt.reason ?? '<no rejection reason>'),
    stack: stackFrom(evt.reason),
    path: currentPage(),
  });
}

function recordConsole(args: unknown[]): void {
  if (!installed) return;
  record({
    ts: nowIso(),
    kind: 'console',
    message: capText(args.map(stringifyArg).join(' ') || '<empty>', MESSAGE_CAP),
    stack: capStack(new Error().stack),
    path: currentPage(),
  });
}

/** Manual report (ErrorBoundary and app code). `kind` defaults to 'manual'. */
export function reportError(message: string, kind: TelemetryKind = 'manual', error?: unknown): void {
  record({
    ts: nowIso(),
    kind,
    message: messageFrom(message),
    stack: stackFrom(error),
    path: currentPage(),
  });
}

export function getTelemetrySnapshot(): TelemetrySnapshot {
  return { appId, version, installed, endpoint, entries: entries.slice() };
}

export function clearTelemetry(): void {
  entries = [];
  lastFlushed = 0;
  try {
    localStorage.removeItem(storageKey);
  } catch {
    /* ignore */
  }
}

export function isTelemetryInstalled(): boolean {
  return installed;
}

/**
 * Install the hook. Idempotent — a second call returns the first disposer.
 * The disposer removes listeners, restores `console.error` and clears
 * in-memory state (persisted storage is left untouched).
 */
export function installTelemetry(options: TelemetryOptions): TelemetryDisposer {
  if (installed && disposer) return disposer;

  appId = options.appId;
  version = options.version ?? null;
  capacity = options.capacity && options.capacity > 0 ? options.capacity : DEFAULT_CAPACITY;
  storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
  batchAfter = options.batchAfter && options.batchAfter > 0 ? options.batchAfter : DEFAULT_BATCH_AFTER;
  endpoint =
    options.endpoint !== undefined
      ? options.endpoint
      : typeof window !== 'undefined'
        ? (window.TELEMETRY_ENDPOINT ?? null)
        : null;
  transport = options.transport !== undefined ? options.transport : defaultTransport;

  // Restore persisted entries from a previous session; they are not re-sent.
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(storageKey) : null;
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) entries = (parsed as TelemetryEntry[]).slice(-capacity);
    }
  } catch {
    /* corrupt or unavailable storage — start clean */
  }
  lastFlushed = entries.length;

  const onError = (e: ErrorEvent): void => __handleErrorEvent(e);
  const onRejection = (e: PromiseRejectionEvent): void => __handleRejectionEvent(e);
  const onPageHide = (): void => flushTelemetry();
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  window.addEventListener('pagehide', onPageHide);

  const originalError = console.error;
  const wrappedError: typeof console.error = (...args) => {
    recordConsole(args as unknown[]);
    originalError(...args);
  };
  console.error = wrappedError;

  installed = true;
  window.__telemetry = { snapshot: getTelemetrySnapshot, clear: clearTelemetry, flush: flushTelemetry };

  disposer = () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
    window.removeEventListener('pagehide', onPageHide);
    console.error = originalError;
    installed = false;
    disposer = null;
    appId = null;
    version = null;
    endpoint = null;
    transport = null;
    entries = [];
    lastFlushed = 0;
  };
  return disposer;
}

/** Test helper: full uninstall + state reset (persists nothing). */
export function resetTelemetryForTests(): void {
  if (disposer) disposer();
  installed = false;
  disposer = null;
  appId = null;
  version = null;
  endpoint = null;
  transport = null;
  capacity = DEFAULT_CAPACITY;
  storageKey = DEFAULT_STORAGE_KEY;
  batchAfter = DEFAULT_BATCH_AFTER;
  entries = [];
  lastFlushed = 0;
}