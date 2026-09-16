import { afterEach, describe, expect, it, vi } from "vitest";
import {
  __handleErrorEvent,
  __handleRejectionEvent,
  clearTelemetry,
  flushTelemetry,
  getTelemetrySnapshot,
  installTelemetry,
  isTelemetryInstalled,
  reportError,
  resetTelemetryForTests,
  type TelemetryEntry,
} from "./telemetry";

const STORAGE_KEY = "telemetry:errors";

afterEach(() => {
  resetTelemetryForTests();
  vi.restoreAllMocks();
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
});

describe("telemetry", () => {
  it("starts uninstalled with an empty snapshot", () => {
    expect(isTelemetryInstalled()).toBe(false);
    const snap = getTelemetrySnapshot();
    expect(snap.installed).toBe(false);
    expect(snap.entries).toEqual([]);
  });

  it("captures window error events with kind, message and stack", () => {
    installTelemetry({ appId: "test-app" });
    const err = new Error("render blew up");
    __handleErrorEvent({ message: "Uncaught Error: render blew up", error: err });
    const [entry] = getTelemetrySnapshot().entries;
    expect(entry.kind).toBe("error");
    expect(entry.message).toBe("render blew up");
    expect(entry.stack).toContain("Error: render blew up");
    expect(typeof entry.path).toBe("string");
  });

  it("captures unhandled promise rejections", () => {
    installTelemetry({ appId: "test-app" });
    __handleRejectionEvent({ reason: "network down" });
    const [entry] = getTelemetrySnapshot().entries;
    expect(entry.kind).toBe("unhandledrejection");
    expect(entry.message).toBe("network down");
  });

  it("wraps console.error, records the entry and still calls the original", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    installTelemetry({ appId: "test-app" });
    console.error("boom", { code: 42 });
    expect(spy).toHaveBeenCalledTimes(1);
    const [entry] = getTelemetrySnapshot().entries;
    expect(entry.kind).toBe("console");
    expect(entry.message).toContain("boom");
    expect(entry.message).toContain("42");
  });

  it("caps message length at 300 chars", () => {
    installTelemetry({ appId: "test-app" });
    __handleErrorEvent({ message: "x".repeat(400) });
    const [entry] = getTelemetrySnapshot().entries;
    expect(entry.message.length).toBe(300);
  });

  it("keeps the ring buffer bounded by capacity, dropping oldest first", () => {
    installTelemetry({ appId: "test-app", capacity: 3 });
    for (let i = 1; i <= 4; i++) __handleErrorEvent({ message: `err-${i}` });
    const entries = getTelemetrySnapshot().entries;
    expect(entries.length).toBe(3);
    expect(entries[0].message).toBe("err-2");
    expect(entries[2].message).toBe("err-4");
  });

  it("persists entries to localStorage and clearTelemetry removes them", () => {
    installTelemetry({ appId: "test-app" });
    reportError("manual oops");
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw!) as TelemetryEntry[];
    expect(parsed[0].kind).toBe("manual");
    clearTelemetry();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(getTelemetrySnapshot().entries).toEqual([]);
  });

  it("restores persisted entries from a previous session on install", () => {
    const seeded: TelemetryEntry[] = [
      { ts: "2026-09-15T00:00:00.000Z", kind: "error", message: "old crash", path: "/" },
    ];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
    installTelemetry({ appId: "test-app" });
    const entries = getTelemetrySnapshot().entries;
    expect(entries.length).toBe(1);
    expect(entries[0].message).toBe("old crash");
  });

  it("flushes batched JSON to the endpoint through the injected transport", () => {
    const sent: Array<{ url: string; body: string }> = [];
    installTelemetry({
      appId: "test-app",
      version: "9.9.9",
      endpoint: "https://telemetry.example.test/collect",
      transport: (url, body) => sent.push({ url, body }),
      batchAfter: 2,
    });
    __handleErrorEvent({ message: "one" });
    expect(sent.length).toBe(0); // below batchAfter
    __handleErrorEvent({ message: "two" });
    expect(sent.length).toBe(1);
    expect(sent[0].url).toBe("https://telemetry.example.test/collect");
    const payload = JSON.parse(sent[0].body) as { appId: string; version: string; entries: TelemetryEntry[] };
    expect(payload.appId).toBe("test-app");
    expect(payload.version).toBe("9.9.9");
    expect(payload.entries.length).toBe(2);
  });

  it("flushes pending entries on pagehide even below the batch threshold", () => {
    const sent: string[] = [];
    installTelemetry({
      appId: "test-app",
      endpoint: "https://telemetry.example.test/collect",
      transport: (_url, body) => sent.push(body),
      batchAfter: 100,
    });
    reportError("last gasp");
    expect(sent.length).toBe(0);
    window.dispatchEvent(new Event("pagehide"));
    expect(sent.length).toBe(1);
    const payload = JSON.parse(sent[0]) as { entries: TelemetryEntry[] };
    expect(payload.entries[0].message).toBe("last gasp");
  });

  it("never sends anything without an endpoint", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response());
    installTelemetry({ appId: "test-app" });
    for (let i = 0; i < 30; i++) __handleErrorEvent({ message: `e${i}` });
    flushTelemetry();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("is idempotent: second install returns the same disposer and does not duplicate", () => {
    const d1 = installTelemetry({ appId: "test-app" });
    const d2 = installTelemetry({ appId: "test-app" });
    expect(d2).toBe(d1);
    __handleErrorEvent({ message: "once" });
    expect(getTelemetrySnapshot().entries.length).toBe(1);
    d1();
    expect(isTelemetryInstalled()).toBe(false);
  });

  it("reportError defaults to kind manual and carries the stack of a passed Error", () => {
    installTelemetry({ appId: "test-app" });
    reportError("explicit failure", undefined, new Error("cause"));
    const [entry] = getTelemetrySnapshot().entries;
    expect(entry.kind).toBe("manual");
    expect(entry.stack).toContain("Error: cause");
  });
});