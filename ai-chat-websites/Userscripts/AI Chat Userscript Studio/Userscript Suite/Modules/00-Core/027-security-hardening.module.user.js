// ==UserScript==
// @name         security-hardening
// @namespace    AI-Chat-Userscript-Studio
// @version      2026.09.26.1
// @description  Security hardening: CSP, SRI, E2EE, PFS, KDF, pinning, DoH (ROADMAP 141-170)
// @author       AI Chat Userscript Studio
// @match        *://*/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_log
// @run-at       document-end
// ==/UserScript==

/**
 * Security Hardening v1.0 - ROADMAP items 141-170 (144 XSS and 145 CSRF already
 * covered by 05-Security/023-xss-sanitizer, 015-content-sanitizer, 005-csrf-helper).
 * 141 CSP builder, 142 nonces, 143 SRI hashes, 146 clickjacking, 147 MIME sniffing,
 * 148 referrer policy, 149 permissions policy, 150 Permissions API, 151 secure
 * context, 152 certificate pinning, 153 TLS enforcement, 154 mixed content,
 * 155 HSTS preload, 156 certificate transparency, 157 OCSP staleness,
 * 158 DNS-over-HTTPS, 159 encrypted SNI, 160 post-quantum readiness,
 * 161 zero-knowledge commitments, 162 E2EE (AES-GCM), 163 key rotation,
 * 164 PFS (ECDH P-256 ephemeral), 165 PBKDF2 KDF, 166 password hashing,
 * 167 salting, 168 pepper, 169/170 algorithm capability report.
 */
(() => {
    "use strict";
    const MODULE_NAME = "security-hardening";
    const CONFIG_KEY = "security_hardening_config";
    const metadata = {
        name: MODULE_NAME,
        version: "2026.09.26.1",
        dependencies: [],
        critical: false,
        category: "00-Core",
    };
    const state = {
        initialized: false,
        pins: {}, // 152 domain -> [fingerprintHex]
        keyring: { active: 0, keys: {} }, // 163 version -> keyHex
        pepper: null, // 168
        scts: [], // 156 recorded SCTs
        settings: { kdfIterations: 150000, dohEndpoint: "https://cloudflare-dns.com/dns-query" },
    };
    const PERSISTED_KEYS = ["pins", "keyring", "pepper", "scts", "settings"];

    function load() {
        try {
            const raw = JSON.parse(GM_getValue(CONFIG_KEY, "{}")) || {};
            for (const key of PERSISTED_KEYS) if (raw[key] !== undefined) state[key] = raw[key];
        } catch (e) {
            /* corrupt storage -> start fresh */
        }
    }
    function save() {
        try {
            const out = {};
            for (const key of PERSISTED_KEYS) out[key] = state[key];
            GM_setValue(CONFIG_KEY, JSON.stringify(out));
        } catch (e) {
            /* storage unavailable -> keep in memory */
        }
    }
    function getInternalState() {
        return state;
    }
    function configureSecurity(patch) {
        Object.assign(state.settings, patch || {});
        save();
        return { ...state.settings };
    }

    // --- byte/string helpers ---
    function webcrypto() {
        if (typeof crypto !== "undefined" && crypto.subtle) return crypto;
        if (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) {
            return globalThis.crypto;
        }
        throw new Error("WebCrypto unavailable");
    }
    function randomBytes(n) {
        const out = new Uint8Array(n);
        webcrypto().getRandomValues(out);
        return out;
    }
    function bytesToHex(bytes) {
        return Array.from(bytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    }
    function hexToBytes(hex) {
        const out = new Uint8Array(hex.length / 2);
        for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
        return out;
    }
    function bytesToB64(bytes) {
        let s = "";
        for (const b of bytes) s += String.fromCharCode(b);
        return btoa(s);
    }
    function b64ToBytes(b64) {
        const s = atob(b64);
        const out = new Uint8Array(s.length);
        for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
        return out;
    }
    function textBytes(str) {
        return new TextEncoder().encode(str);
    }

    // --- digests / SRI (143) ---
    async function shaHex(algo, data) {
        const buf = await webcrypto().subtle.digest(algo, data);
        return bytesToHex(new Uint8Array(buf));
    }
    async function computeSri(content, algo) {
        const a = algo || "SHA-384";
        const buf = await webcrypto().subtle.digest(a, textBytes(String(content)));
        const prefix = a.toLowerCase().replace("-", "");
        return prefix + "-" + bytesToB64(new Uint8Array(buf));
    }

    // --- KDF (165) / password hashing (166) / salting (167) / pepper (168) ---
    function generateSalt(bytes) {
        return bytesToHex(randomBytes(bytes || 16));
    }
    function setPepper(pepper) {
        state.pepper = pepper === "" ? null : pepper;
        save();
        return !!state.pepper;
    }
    async function deriveKeyBits(password, saltHex, iterations, bits) {
        const iters = iterations || state.settings.kdfIterations;
        const bitsWanted = bits || 256;
        const base = await webcrypto().subtle.importKey("raw", textBytes(String(password)), "PBKDF2", false, [
            "deriveBits",
        ]);
        const params = { name: "PBKDF2", salt: hexToBytes(saltHex), iterations: iters, hash: "SHA-256" };
        const derived = await webcrypto().subtle.deriveBits(params, base, bitsWanted);
        return bytesToHex(new Uint8Array(derived));
    }
    async function hashPassword(password, opts) {
        const o = opts || {};
        const salt = o.salt || generateSalt(16);
        const iters = o.iterations || state.settings.kdfIterations;
        const peppered = state.pepper ? String(password) + state.pepper : String(password);
        const hash = await deriveKeyBits(peppered, salt, iters, 256);
        return "pbkdf2-sha256$" + iters + "$" + salt + "$" + hash;
    }
    async function verifyPassword(password, stored) {
        const parts = String(stored).split("$");
        if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") return false;
        const check = await hashPassword(password, { salt: parts[2], iterations: parseInt(parts[1], 10) });
        const want = hexToBytes(parts[3]);
        const got = hexToBytes(check.split("$")[3]);
        if (want.length !== got.length) return false;
        let diff = 0;
        for (let i = 0; i < want.length; i++) diff |= want[i] ^ got[i];
        return diff === 0;
    }

    // --- AES-GCM core / E2EE (162) ---
    async function importAesKey(rawBytes) {
        return webcrypto().subtle.importKey("raw", rawBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
    }
    async function encryptWithKey(key, value) {
        const iv = randomBytes(12);
        const plain = typeof value === "string" ? textBytes(value) : value;
        const ct = await webcrypto().subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
        return { iv: bytesToHex(iv), ct: bytesToB64(new Uint8Array(ct)) };
    }
    async function decryptWithKey(key, envelope) {
        const pt = await webcrypto().subtle.decrypt(
            { name: "AES-GCM", iv: hexToBytes(envelope.iv) },
            key,
            b64ToBytes(envelope.ct)
        );
        return new Uint8Array(pt);
    }
    async function e2eeEncrypt(obj, keyHex) {
        const key = await importAesKey(hexToBytes(keyHex));
        return encryptWithKey(key, textBytes(JSON.stringify(obj)));
    }
    async function e2eeDecrypt(envelope, keyHex) {
        const key = await importAesKey(hexToBytes(keyHex));
        return JSON.parse(new TextDecoder().decode(await decryptWithKey(key, envelope)));
    }

    // --- key rotation (163): versioned keyring, envelopes carry their key version ---
    function configureKeyring(initialKeyHex) {
        state.keyring = { active: 1, keys: { 1: initialKeyHex } };
        save();
        return { active: state.keyring.active, versions: 1 };
    }
    function rotateKey(newKeyHex) {
        const version = state.keyring.active + 1;
        state.keyring.keys[version] = newKeyHex;
        state.keyring.active = version;
        save();
        return version;
    }
    async function sealedEncrypt(obj) {
        const keyHex = state.keyring.keys[state.keyring.active];
        if (!keyHex) throw new Error("keyring not configured");
        const envelope = await e2eeEncrypt(obj, keyHex);
        return { ...envelope, keyVersion: state.keyring.active };
    }
    async function sealedDecrypt(sealed) {
        const keyHex = state.keyring.keys[sealed.keyVersion];
        if (!keyHex) throw new Error("key version not found: " + sealed.keyVersion);
        return e2eeDecrypt(sealed, keyHex);
    }

    // --- perfect forward secrecy (164): per-session ECDH P-256, never persisted ---
    async function createEphemeralSession() {
        const kp = await webcrypto().subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, [
            "deriveKey",
        ]);
        const raw = await webcrypto().subtle.exportKey("raw", kp.publicKey);
        return { keypair: kp, publicKeyHex: bytesToHex(new Uint8Array(raw)) };
    }
    async function deriveSharedKey(session, theirPublicKeyHex) {
        const their = await webcrypto().subtle.importKey(
            "raw",
            hexToBytes(theirPublicKeyHex),
            { name: "ECDH", namedCurve: "P-256" },
            false,
            []
        );
        return webcrypto().subtle.deriveKey(
            { name: "ECDH", public: their },
            session.keypair.privateKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    }

    // --- zero-knowledge commitments (161): salted digest, secret never stored ---
    async function createCommitment(secret) {
        const blinding = bytesToHex(randomBytes(16));
        const commit = await shaHex("SHA-256", textBytes(String(secret) + blinding));
        return { commit, blinding };
    }
    async function verifyCommitment(secret, blinding, commit) {
        const check = await shaHex("SHA-256", textBytes(String(secret) + blinding));
        return check === commit;
    }

    // --- browser security builders & checks ---
    function buildCsp(directives) {
        const parts = [];
        for (const [dir, value] of Object.entries(directives || {})) {
            const v = value && value.length ? (Array.isArray(value) ? value.join(" ") : value) : "";
            parts.push(dir + (v ? " " + v : ""));
        }
        return parts.join("; ");
    }
    function generateNonce() {
        return bytesToB64(randomBytes(16));
    }
    function referrerPolicy(policy) {
        const allowed = [
            "no-referrer",
            "no-referrer-when-downgrade",
            "origin",
            "origin-when-cross-origin",
            "same-origin",
            "strict-origin",
            "strict-origin-when-cross-origin",
            "unsafe-url",
        ];
        if (allowed.indexOf(policy) < 0) throw new Error("invalid referrer policy: " + policy);
        return { policy, meta: '<meta name="referrer" content="' + policy + '">' };
    }
    function permissionsPolicy(features) {
        const parts = [];
        for (const [feature, allow] of Object.entries(features || {})) {
            const list = Array.isArray(allow) ? allow : [allow];
            parts.push(feature + "=(" + list.join(" ") + ")");
        }
        return parts.join(", ");
    }
    function mimeSniffingHeaders() {
        return { "X-Content-Type-Options": "nosniff" };
    }
    function validateResponseHeaders(headers, opts) {
        const o = opts || {};
        const h = {};
        for (const [k, v] of Object.entries(headers || {})) h[String(k).toLowerCase()] = v;
        const issues = [];
        if (!h["x-content-type-options"]) issues.push("missing X-Content-Type-Options: nosniff");
        if (!h["content-security-policy"]) issues.push("missing Content-Security-Policy");
        if (o.https && !h["strict-transport-security"]) issues.push("missing Strict-Transport-Security");
        if (o.iframeRisk && !h["x-frame-options"] && !h["content-security-policy"]) {
            issues.push("missing X-Frame-Options / frame-ancestors");
        }
        return { ok: issues.length === 0, issues };
    }
    function framebustScript() {
        return "if (window.top !== window.self) { window.top.location = window.self.location; }";
    }
    function clickjackingDefense() {
        const framed =
            typeof window !== "undefined" && window.top && window.self && window.top !== window.self;
        return {
            framed,
            script: framebustScript(),
            recommendation: "send X-Frame-Options: DENY or CSP frame-ancestors 'none'",
        };
    }
    function hstsPreloadCheck(maxAge, includeSubdomains, preload) {
        const header =
            "max-age=" + maxAge + (includeSubdomains ? "; includeSubDomains" : "") + (preload ? "; preload" : "");
        return {
            maxAge,
            includeSubdomains: !!includeSubdomains,
            preload: !!preload,
            header,
            eligible: maxAge >= 31536000 && !!includeSubdomains && !!preload,
        };
    }

    // --- pinning (152) / TLS (153) / mixed content (154) ---
    function configurePins(domain, pins) {
        state.pins[domain] = pins.map((p) => String(p).toLowerCase());
        save();
        return state.pins[domain];
    }
    function validatePin(domain, fingerprintHex) {
        const pins = state.pins[domain] || [];
        return {
            domain,
            pinned: pins.length > 0,
            valid: pins.indexOf(String(fingerprintHex).toLowerCase()) >= 0,
        };
    }
    function enforceHttps(url) {
        const u = String(url || "");
        if (u.indexOf("http://") === 0) return { redirected: true, url: "https://" + u.slice(7) };
        return { redirected: false, url: u };
    }
    function scanMixedContent(resources) {
        const insecure = [];
        for (const r of resources || []) {
            if (typeof r.src === "string" && r.src.indexOf("http://") === 0) {
                insecure.push({ tag: r.tag, src: r.src });
            }
        }
        return { insecure, count: insecure.length };
    }
    function scanDomMixedContent(root) {
        const doc = root || (typeof document !== "undefined" ? document : null);
        if (!doc || !doc.querySelectorAll) return { insecure: [], count: 0, skipped: true };
        const els = doc.querySelectorAll(
            'img[src^="http://"], script[src^="http://"], iframe[src^="http://"], link[href^="http://"]'
        );
        const insecure = [];
        for (const el of els) insecure.push({ tag: el.tagName ? el.tagName.toLowerCase() : "element", src: el.src || el.href });
        return { insecure, count: insecure.length };
    }

    // --- secure context (151) / Permissions API (150) ---
    function secureContextReport() {
        const w = typeof window !== "undefined" ? window : null;
        return {
            secure: !!(w && w.isSecureContext),
            protocol: typeof location !== "undefined" && location.protocol ? location.protocol : null,
        };
    }
    async function queryPermission(name) {
        if (typeof navigator === "undefined" || !navigator.permissions || !navigator.permissions.query) {
            return { name, state: "unsupported" };
        }
        const status = await navigator.permissions.query({ name });
        return { name, state: status.state };
    }

    // --- CT (156) / OCSP (157) / DoH (158) / ECH (159) / PQ (160) / capabilities (169/170) ---
    function certificateTransparencyRecord(sct) {
        state.scts.push({ sct, t: Date.now() });
        save();
        return state.scts.length;
    }
    function certificateTransparencyCheck() {
        return { sctsRecorded: state.scts.length, compliant: state.scts.length > 0 };
    }
    function ocspStalenessCheck(lastCheckTs, maxAgeDays) {
        const ageDays = (Date.now() - lastCheckTs) / 86400000;
        return { ageDays: Math.round(ageDays * 100) / 100, fresh: ageDays <= (maxAgeDays || 7) };
    }
    async function resolveDoH(domain, type) {
        if (typeof fetch === "undefined") throw new Error("fetch unavailable");
        const q = type || "A";
        const url = state.settings.dohEndpoint + "?name=" + encodeURIComponent(domain) + "&type=" + q;
        const res = await fetch(url, { headers: { accept: "application/dns-json" } });
        if (!res.ok) throw new Error("DoH query failed: " + res.status);
        const json = await res.json();
        return {
            domain,
            type: q,
            answers: (json.Answer || []).map((a) => ({ name: a.name, type: a.type, data: a.data, ttl: a.TTL })),
        };
    }
    function encryptedSniSupport() {
        const w = typeof window !== "undefined" ? window : {};
        return {
            ech: !!w.echAvailable,
            esni: !!w.esniAvailable,
            note: "capability flag; browsers rarely expose ECH/ESNI to scripts",
        };
    }
    function postQuantumReadiness() {
        return {
            hybridKxDetected: false,
            checklist: [
                "prefer TLS 1.3 endpoints",
                "enable X25519Kyber768 hybrid when the browser exposes it",
                "inventory long-lived signatures for PQ migration",
            ],
            ready: false,
        };
    }
    function hashingAlgorithmCapabilities() {
        const g = typeof globalThis !== "undefined" ? globalThis : {};
        return {
            argon2: !!(g.Argon2 || g.argon2),
            bcrypt: !!(g.bcrypt || (g.dcodeIO && g.dcodeIO.bcrypt)),
            scrypt: !!g.scrypt,
            pbkdf2: typeof crypto !== "undefined" && !!crypto.subtle,
            recommendation: "prefer Argon2id server-side; PBKDF2-SHA256 is the dependency-free fallback here",
        };
    }

    function init() {
        if (state.initialized) return;
        load();
        state.initialized = true;
        console.log(`[${MODULE_NAME}] Initialized - ROADMAP 141-170 coverage active`);
    }
    function getHealth() {
        return {
            healthy: state.initialized,
            details:
                `${Object.keys(state.pins).length} pinned domains, ` +
                `keyring v${state.keyring.active}, pepper ${state.pepper ? "set" : "off"}`,
        };
    }
    if (typeof window !== "undefined") {
        window.__NEXUS_SECURITY__ = {
            init,
            getHealth,
            metadata,
            getInternalState,
            configureSecurity,
            shaHex,
            computeSri,
            generateSalt,
            setPepper,
            deriveKeyBits,
            hashPassword,
            verifyPassword,
            importAesKey,
            encryptWithKey,
            decryptWithKey,
            e2eeEncrypt,
            e2eeDecrypt,
            configureKeyring,
            rotateKey,
            sealedEncrypt,
            sealedDecrypt,
            createEphemeralSession,
            deriveSharedKey,
            createCommitment,
            verifyCommitment,
            buildCsp,
            generateNonce,
            referrerPolicy,
            permissionsPolicy,
            mimeSniffingHeaders,
            validateResponseHeaders,
            framebustScript,
            clickjackingDefense,
            hstsPreloadCheck,
            configurePins,
            validatePin,
            enforceHttps,
            scanMixedContent,
            scanDomMixedContent,
            secureContextReport,
            queryPermission,
            certificateTransparencyRecord,
            certificateTransparencyCheck,
            ocspStalenessCheck,
            resolveDoH,
            encryptedSniSupport,
            postQuantumReadiness,
            hashingAlgorithmCapabilities,
        };
        window[`${MODULE_NAME}Module`] = { init, getHealth, metadata };
    }
    if (typeof document !== "undefined" && document.readyState === "complete") {
        init();
    } else if (typeof window !== "undefined") {
        window.addEventListener("load", init);
    }





})();
