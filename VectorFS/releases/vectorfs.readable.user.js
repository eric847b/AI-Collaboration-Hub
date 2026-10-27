//==UserScript==
//@name VectorFS Readable
//@namespace vectorfs.ai
//@version 10.27.2026.1
//@description Readable reference that exactly mirrors VectorFS Max capabilities and API surface
//@match *://*/*
//@grant GM_getValue
//@grant GM_setValue
//@grant GM_getValues
//@grant navigator.storage.getDirectory
//@run-at document-start
//==/UserScript==

/**
 * VectorFS Max — Readable Reference
 * Version: 10.27.2026.1
 *
 * Voltage levels: [0 = off, 0.3 = low, 0.7 = mid, 1.0 = high]
 * Capabilities detected: indexedDB, Worker, BroadcastChannel, OPFS, GPU, WebAssembly
 *
 * This file is a direct, expanded, documented mirror of vectorfs.max.user.js.
 * No feature is omitted. No extra feature is added.
 */

(() => {
  'use strict';

  // Voltage signal table
  const Voltage = Object.freeze([0, 0.3, 0.7, 1.0]);

  // Capability detection (identical to Max)
  const Caps = {
    i: !!indexedDB,                    // indexedDB
    w: !!Worker,                       // Worker
    b: !!BroadcastChannel,             // BroadcastChannel
    o: !!navigator.storage?.getDirectory, // OPFS
    g: !!navigator.gpu,                // WebGPU
    m: !!WebAssembly                   // WebAssembly
  };

  // Core stores
  const Roots     = new Map(); // id → frozen state
  const Refs      = new Map(); // ref → current root id
  const Blobs     = new Map(); // blob store
  const Txns      = [];        // transaction log
  const Lineage   = [];        // ordered root ids
  const Watchers  = [];        // change listeners
  const Signals   = new Map(); // reactive signals
  const LazyCache = new Map(); // lazy-load cache
  const History   = [];        // history of hashes / ids

  // Fast non-crypto hash (FNV-1a style, BigInt)
  const fastHash = (value, offset = 0n) => {
    let h = 0xcbf29ce48dd0e300n;
    const bytes = new TextEncoder().encode(
      typeof value === 'string' ? value : JSON.stringify(value)
    );
    for (const byte of bytes) {
      h = (h ^ BigInt(byte)) * 0x100000001b3n;
    }
    return h ^ offset;
  };

  // Cryptographic identity (SHA-256)
  const sha256 = async (value) => {
    const data = new TextEncoder().encode(JSON.stringify(value));
    const digest = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(digest)]
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  };

  // Deep freeze + clone
  const freeze = (obj) => Object.freeze(structuredClone(obj));

  // Snapshot → immutable root
  const snapshot = async (state) => {
    const root = freeze(state);
    const id = await sha256(root);
    Roots.set(id, root);
    Lineage.push(id);
    History.push(id);
    return id;
  };

  // Swap a live reference to a new root id
  const swap = (ref, id) => {
    if (!Roots.has(id)) throw new Error('root');
    Refs.set(ref, id);
    return id;
  };

  // Current state for a reference
  const current = (ref) => Roots.get(Refs.get(ref));

  // Lazy load / memoize
  const lazy = async (key, materializer) => {
    const id = fastHash(key);
    if (LazyCache.has(id)) return LazyCache.get(id);
    const result = freeze(materializer);
    LazyCache.set(id, result);
    History.push(id);
    return id;
  };

  // Path hash helper
  const path = (a, b) => fastHash('' + a + b);

  // Reactive signal update
  const exec = (root, fn) => {
    if (!Signals.has(root)) {
      Signals.set(root, fn);
      History.push(root);
      return root;
    }
    const prev = Signals.get(root);
    const next = fn(prev);
    Signals.set(root, next);
    return next;
  };

  // Transactional mutation
  const txn = async (ref, mutator) => {
    const base = current(ref) || {};
    const next = structuredClone(base);
    const record = { r: ref, t: Date.now(), v: Voltage[3] };
    Txns.push(record);

    try {
      await mutator(next);
      const id = await snapshot(next);
      swap(ref, id);
      record.o = 1;
      record.id = id;
      Watchers.forEach(fn => fn(ref, id, next));
      return id;
    } catch (err) {
      record.o = 0;
      record.e = '' + err;
      throw err;
    }
  };

  // Persistence
  const persist = {
    save: (key) => {
      try {
        GM_setValue(key, JSON.stringify({
          r: [...Refs],
          l: Lineage,
          s: [...Signals],
          z: History,
          b: [...Blobs]
        }));
      } catch {}
    },
    load: (key) => {
      try {
        const data = JSON.parse(GM_getValue(key, '{}'));
        data.r?.forEach(v => Refs.set(v[0], v[1]));
        data.l?.forEach(v => Lineage.push(v));
        data.s?.forEach(v => Signals.set(v[0], v[1]));
        data.z?.forEach(v => History.push(v));
        data.b?.forEach(v => Blobs.set(v[0], v[1]));
      } catch {}
    }
  };

  // Public API — exact surface of Max
  const API = {
    Ver: '10.27.2026.1',
    V: Voltage,
    C: Caps,
    R: Roots,
    F: Refs,
    B: Blobs,
    T: Txns,
    L: Lineage,
    W: Watchers,
    S: Signals,
    Q: LazyCache,
    Z: History,

    h: fastHash,
    H: sha256,
    fz: freeze,
    sn: snapshot,
    sw: swap,
    cu: current,
    ld: lazy,
    pf: path,
    ex: txn,
    xv: exec,
    txn,
    current,
    snapshot,
    swap,
    hash: sha256,
    fastHash,
    load: lazy,
    exec,
    path,
    persist
  };

  Object.defineProperty(globalThis, 'VectorFS', {
    value: API,
    configurable: false,
    writable: false
  });

  persist.load('vectorfs');
  addEventListener('beforeunload', () => persist.save('vectorfs'));
})();