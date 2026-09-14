# Cross-Training Matrix — how unified-core was built

"Cross-train the repos with each other" = each repo's best idea was extracted,
generalized, and re-homed here; the origin repos now consume the unified
version instead of maintaining private forks of the same logic.

| Upstream pattern | Origin | What was kept | Where it lives now |
|---|---|---|---|
| Cap-aware FREE-provider rotation + today-scoped usage ledger | `Documents/Cline/Hooks/model-governor.ps1` | ladder order, daily caps, `date`-keyed counts, rollover | `orchestrator.mjs` (`MODEL_LADDER`, `UsageLedger`) |
| Offline-fallback result contract (`response` always present, never raises) | `singularity-operator/singularity_operator/groq_wrapper.py` | `{response, provider, model, latency_s, error, ok}` shape | `orchestrator.mjs` / `unified_orchestrator.py` (`callAI`/`call_ai`) |
| Swarm fan-out (`node_i` keyed results) | `singularity-operator/multi_ai_orchestrator.py` | sequential fan-out over prompts | `swarm()` |
| Module manifest + role grouping | `nexus-core/registry.json` | `modules[]`, `roles{}` view | `manifest.json` (**mirror only** — registry stays canonical) |
| Analytics/provider-comparison shapes | `ai-chat-websites/Userscripts/modules/analytics.js` | provider/latency/result fields for later dashboards | result contract fields |

## Direction of dependency (enforced)

```
model-governor.ps1 (policy reference, stays authoritative for caps/keys)
        │  mirrors ladder
        ▼
unified-core/orchestrator.mjs  ◄──── the ONE implementation
        ▲            ▲            ▲
        │            │            │
unified_bridge.py  unified-bridge.cjs  unified-bridge.mjs
(singularity-      (ai-chat-websites) (collabhub-modules)
 operator)
```

- **Bridges are additive**: they only import/re-export; they never redefine
  ladder order, caps, or the result contract.
- **nexus-core registry stays the single canonical registry**; this folder's
  `manifest.json` is a human/twin-readable mirror and says so explicitly.
- **model-governor.ps1 stays the runtime enforcer** for quota status; unified
  core is the *embeddable policy engine* repos call in-process.

## Re-train loop (how to update)

1. Change the ladder/contract **only** in `orchestrator.mjs`.
2. Mirror the same change in `unified_orchestrator.py` (twin) and `manifest.json`.
3. Run both selftests (`node test-orchestrator.mjs`, `python unified_orchestrator.py --selftest`) — the parity assertions will fail if the mirror drifted.
4. Bridges need no changes (they re-export).

Updated: 2026-09-27
