import { expect, test } from '@playwright/test';

// Browser-level runtime telemetry contract.
//
// Exercises the *installed* hook in a real Chromium page: install with an
// injectable transport, emit the channels the module captures, and assert the
// in-memory ring buffer + flush contract.
//
// Inert on main / normal runs: skipped unless TELEEMETRY_E2E=1.

const TELE_ENABLED = process.env.TELEEMETRY_E2E === '1';

let injectTransport = null;

test.describe('runtime telemetry (browser)', () => {
  test.beforeEach(async ({ page }) => {
    const chan = { body: null, url: null };
    await page.exposeFunction('__telemetryTransport', (url, body) => {
      chan.url = url;
      chan.body = body;
    });
    await page.evaluate(async () => {
      const mod = await import('../src/lib/telemetry');
      window.__telemetryMod = mod;
      mod.installTelemetry({
        appId: 'nexus-infinity-hub',
        version: '0.0.0-e2e',
        transport: (url, body) => window.__telemetryTransport?.(url, body),
        batchAfter: 1,
      });
    });
    injectTransport = chan;
  });

  test.afterEach(async ({ page }) => {
    await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      if (mod) {
        mod.resetTelemetryForTests();
        window.__telemetryMod = undefined;
        window.__telemetry = undefined;
      }
    });
  });

  test.skip(!TELE_ENABLED, 'inert unless TELEEMETRY_E2E=1');

  test('captures an uncaught error via window error event', async ({ page }) => {
    await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      window.dispatchEvent(
        new window.ErrorEvent('error', {
          message: 'boom',
          filename: 'test.js',
          lineno: 1,
          colno: 1,
          error: new Error('boom'),
        }),
      );
    });
    const snap = await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      return mod.getTelemetrySnapshot();
    });
    expect(snap.installed).toBe(true);
    expect(snap.appId).toBe('nexus-infinity-hub');
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0]).toMatchObject({
      kind: 'error',
      message: 'boom',
      path: '/',
    });
  });

  test('captures an unhandled rejection', async ({ page }) => {
    await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      window.dispatchEvent(
        new window.PromiseRejectionEvent('unhandledrejection', {
          promise: Promise.reject(new Error('rejected')),
          reason: new Error('rejected'),
        }),
      );
    });
    const snap = await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      return mod.getTelemetrySnapshot();
    });
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].kind).toBe('unhandledrejection');
    expect(snap.entries[0].message).toBe('rejected');
  });

  test('captures console.error', async ({ page }) => {
    await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      console.error('consoled', 'bad things');
    });
    const snap = await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      return mod.getTelemetrySnapshot();
    });
    expect(snap.entries).toHaveLength(1);
    expect(snap.entries[0].kind).toBe('console');
    expect(snap.entries[0].message).toContain('consoled');
  });

  test('reportError writes a manual entry', async ({ page }) => {
    await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      mod.reportError('boundary caught something', 'react', new Error('render'));
    });
    const snap = await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      return mod.getTelemetrySnapshot();
    });
    expect(snap.entries[0].kind).toBe('react');
    expect(snap.entries[0].message).toBe('boundary caught something');
    expect(snap.entries[0].stack).toMatch(/render/);
  });

  test('flush sends batched JSON body to the configured endpoint', async ({ page }) => {
    await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      // endpoint is read at install time from window.TELEMETRY_ENDPOINT or the
      // installTelemetry() option; set it on the window so the module picks it up.
      window.TELEMETRY_ENDPOINT = 'https://example.invalid/telemetry';
      mod.installTelemetry({
        appId: 'nexus-infinity-hub',
        version: '0.0.0-e2e',
        transport: (url, body) => window.__telemetryTransport?.(url, body),
        batchAfter: 1,
      });
      mod.reportError('flushed', 'manual');
      mod.flushTelemetry();
    });
    const body = injectTransport.body;
    expect(body).not.toBeNull();
    const json = JSON.parse(body);
    expect(json.appId).toBe('nexus-infinity-hub');
    expect(json.version).toBe('0.0.0-e2e');
    expect(json.sentAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(Array.isArray(json.entries)).toBe(true);
    expect(json.entries).toHaveLength(1);
    expect(json.entries[0].kind).toBe('manual');
    expect(json.entries[0].message).toBe('flushed');
  });

  test('disposer removes listeners and clears state', async ({ page }) => {
    await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      mod.reportError('before dispose', 'manual');
      const disposer = mod.installTelemetry({ appId: 'nexus-infinity-hub' });
      disposer();
    });
    const snap = await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      return mod.getTelemetrySnapshot();
    });
    expect(snap.installed).toBe(false);
    expect(snap.entries).toHaveLength(0);
  });

  test('capture and replay does not leak into subsequent tests', async ({ page }) => {
    // Smoke-test the snapshot clear+flush + replay path without touching the
    // module's internal ring buffer in a way that would corrupt the following
    // tests. Verifies getTelemetrySnapshot/isTelemetryInstalled are wired and
    // the public __telemetry handle is reachable.
    const snap = await page.evaluate(async () => {
      const mod = window.__telemetryMod;
      const before = mod.getTelemetrySnapshot();
      window.__telemetry?.clear?.();
      const afterClear = mod.getTelemetrySnapshot();
      window.__telemetry?.flush?.();
      const afterFlush = mod.getTelemetrySnapshot();
      return {
        installed: before.installed,
        hasHandle: typeof window.__telemetry?.snapshot === 'function',
        cleared: afterClear.entries.length === 0 && afterClear.entries.length === afterFlush.entries.length,
      };
    });
    expect(snap.installed).toBe(true);
    expect(snap.hasHandle).toBe(true);
    expect(snap.cleared).toBe(true);
  });

});


