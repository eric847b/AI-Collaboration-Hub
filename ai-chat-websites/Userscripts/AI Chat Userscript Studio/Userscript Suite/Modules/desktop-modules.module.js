// desktop-modules.module.js
// ============================================================
// Desktop Application Sovereign Modules
// Registers VS Code, File Explorer, and Substrate as sovereign
// state observers within the Sovereign Merge Engine (Δ → Ω → Π).
//
// These modules passively observe desktop application state
// deltas and react when stable state snapshots are computed.
//
// Integration Points:
//   - VS Code extension IPC / webview messages
//   - Windows File Explorer shell extension events
//   - Substrate (merged-userscript) state bridge
// ============================================================

(function() {
    

    // ------------------------------------------------------------------
    // Guard: SovereignEngine must be available
    // ------------------------------------------------------------------
    if (typeof SovereignEngine === 'undefined') {
        console.info('[desktop-modules] SovereignEngine not found — skipping registration');
        return;
    }

    /**
     * @typedef {Object} Delta
     * @property {string}   source    - Module source identifier
     * @property {string}   [type]    - Delta type (e.g. 'fileChanged', 'stateUpdate')
     * @property {*}        [payload] - Arbitrary payload data
     */

    /**
     * @typedef {Object} PerfectState
     * @property {Delta}          delta     - The originating delta
     * @property {Array<*>}       combo     - Collected combo results from all onDelta handlers
     * @property {number}         timestamp - UNIX timestamp when the stable state was computed
     */

    // ================================================================
    // Module: Visual Studio Code (editor IPC bridge)
    // ================================================================
    /**
     * Handles state updates originating from VS Code.
     * Filters out non-VSCode deltas and acknowledges receipt.
     *
     * @param {Delta} delta - The incoming delta snapshot
     * @returns {{ vscodeHandled: boolean, delta: Delta }|null} Combo result or null
     */
    SovereignEngine.register("vscode", {
        onDelta(delta) {
            if (!delta || delta.source !== "vscode") return null;
            console.info('[desktop-modules:vscode] Δ received:', delta.type || 'unknown');
            return { vscodeHandled: true, delta };
        },
        onCombo(results) {
            // Called with the aggregated combo array from all modules
            if (results && results.length > 0) {
                console.info(`[desktop-modules:vscode] combo Ω (${results.length} items)`);
            }
        },
        onPerfect(stableState) {
            // VS Code stabilization is observed passively.
            // Future: Could trigger editor integrations here.
            if (stableState && stableState.delta && stableState.delta.source === "vscode") {
                console.info('[desktop-modules:vscode] Π stable state @', stableState.timestamp);
            }
        }
    });

    // ================================================================
    // Module: File Explorer (shell namespace bridge)
    // ================================================================
    /**
     * Handles file/directory state updates from the OS File Explorer.
     * Filters out non-explorer deltas and acknowledges indexing events.
     *
     * @param {Delta} delta - The incoming delta snapshot
     * @returns {{ explorerIndexed: boolean, delta: Delta }|null} Combo result or null
     */
    SovereignEngine.register("explorer", {
        onDelta(delta) {
            if (!delta || delta.source !== "explorer") return null;
            console.info('[desktop-modules:explorer] Δ received:', delta.type || 'unknown');
            return { explorerIndexed: true, delta };
        },
        onCombo(results) {
            if (results && results.length > 0) {
                console.info(`[desktop-modules:explorer] combo Ω (${results.length} items)`);
            }
        },
        onPerfect(stableState) {
            // Explorer state updates are acknowledged without side effects.
            if (stableState && stableState.delta && stableState.delta.source === "explorer") {
                console.info('[desktop-modules:explorer] Π stable state @', stableState.timestamp);
            }
        }
    });

    // ================================================================
    // Module: Substrate (merged-userscript state bridge)
    // ================================================================
    /**
     * Observes ALL state deltas (source-agnostic) for general substrate
     * awareness. This module acts as a system-wide state monitor.
     *
     * @param {Delta} delta - The incoming delta snapshot
     * @returns {{ substrateObserved: string }|null} Combo result or null
     */
    SovereignEngine.register("substrate", {
        onDelta(delta) {
            if (!delta || !delta.type) return null;
            console.info('[desktop-modules:substrate] Δ observed:', delta.type);
            return { substrateObserved: delta.type };
        },
        onCombo(results) {
            if (results && results.length > 0) {
                console.info(`[desktop-modules:substrate] combo Ω (${results.length} items) timed to be processed`);
            }
        },
        onPerfect(stableState) {
            // Substrate holds the state silently but logs stable state arrival.
            if (stableState) {
                console.info('[desktop-modules:substrate] Π stable state @', stableState.timestamp, 'Ω count:', (stableState.combo || []).length);
            }
        }
    });

    console.info('[desktop-modules] Registered 3 sovereign modules: vscode, explorer, substrate');
})();