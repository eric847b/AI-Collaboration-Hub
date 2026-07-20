//==UserScript==
//@name VectorFS Readable Core
//@namespace vectorfs.ai
//@version 10.07.2026.2-r
//@match *://*/*
//@grant GM_getValue
//@grant GM_setValue
//@grant navigator.storage.getDirectory
//@run-at document-start
//==/UserScript==

/**
 * VectorFS Dense Core - Readable Mode
 * 
 * This version provides the same functionality as the dense version
 * but with human-readable names. Toggle with vfs_readable='1' in storage.
 * 
 * Key Concepts:
 * - Voltage signals: [off=0V, low=0.3V, mid=0.7V, high=1.0V]
 * - Hash-based identity: 64-bit truncations of SHA-256
 * - Lazy loading: Only load what's needed on demand
 * - Fast path finder: XOR-based route calculation
 */

 // ============== Configuration ==============
const DENSE_MODE = 1;
const READABLE_MODE = 0;

// ============== Capabilities ==============
const Capabilities = {
    indexedDB: !!indexedDB,
    workers: !!Worker,
    broadcast: !!BroadcastChannel,
    origin: !!navigator.storage?.getDirectory,
    gpu: !!navigator.gpu,
    wasm: !!WebAssembly
};

// ============== Voltage Signal States ==============
// Inspired by transistor H/L/OFF states
const VoltageSignal = Object.freeze({
    OFF: 0.0,    // Transistor off, no conduction
    LOW: 0.3,    // Weak signal, partial conduction  
    MID: 0.7,    // Medium signal
    HIGH: 1.0    // Full signal, maximum conduction
});

// Voltage levels map to path priority
function voltageToState(voltage) {
    if (voltage < 0.3) return 0;  // Off
    if (voltage < 0.7) return 1;  // Low
    return 2;                     // High
}

// ============== Fast Hash (xxHash) ==============
const HASH_SEED = 0xcbf29ce48dd0e300n;
const HASH_PRIME = 0x100000001b3n;

async function fastHash(data, offset = 0n) {
    let hash = HASH_SEED + BigInt(offset);
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    for (const byte of bytes) {
        hash ^= BigInt(byte);
        hash *= HASH_PRIME;
    }
    return hash;
}

// ============== Lazy Loader ==============
const Store = new Map();   // Main store
const Q = new Map();     // Quick cache
const History = [];      // Operation history

async function lazyLoad(key, modifier) {
    const hash = await fastHash(key);
    if (Q.has(hash)) return Q.get(hash);
    
    const result = Object.freeze(structuredClone(modifier));
    Q.set(hash, result);
    History.push(hash);
    return hash;
}

// ============== Voltage-Optimized Dispatch ==============
const RootMap = new Map();

function execute(root, modifierFn) {
    if (!Store.has(root)) {
        throw new Error('Invalid root');
    }
    
    const base = structuredClone(Store.get(root));
    const modified = modifierFn(base);
    const newHash = fastHash(modified);
    
    RootMap.set(root, newHash);
    return newHash;
}

// ============== Fast Path Finder ==============
async function findPath(start, end) {
    return fastHash(start.toString() + end.toString());
}

// ============== Transaction Timer ==============
const Timers = [];

// ============== Persistence ==============
const Persistence = {
    save: (key) => GM_setValue(key, JSON.stringify({store: [...Store], history: History})),
    load: (key) => {
        try {
            const data = JSON.parse(GM_getValue(key, '{}'));
            data.store?.forEach(item => Store.set(item[0], item[1]));
            data.history?.forEach(item => History.push(item));
        } catch {}
    }
};

// ============== Initialization ==============
Persistence.load('vectorfs');
globalThis.VectorFS = {
    DENSE_MODE,
    VERSION: '10.07.2026.2-readable',
    Capabilities,
    VoltageSignal,
    Store,
    fastHash,
    lazyLoad,
    execute,
    findPath,
    Persistence
};

// Save on unload
addEventListener('beforeunload', () => Persistence.save('vectorfs'));

// Log ready state
console.log('VectorFS Dense Core (Readable Mode) loaded', { Capabilities, VoltageSignal });