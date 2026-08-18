# AI-Collaboration-Hub (nexus-core)

Unified AI agent workspace. All modules registered in `nexus-core/registry.json`.

## Quick
```bash
cd AI-Collaboration-Hub/nexus-core
python orchestrator.py
python orchestrator.py graph
```

See root README for full workspace bootstrap.

## Free AI Rotator

This workspace includes the **FreeAI Seamless Rotator** (`collabhub-modules`). From the root:

```powershell
npm run ai -- "your prompt"
```

Delegates to `collabhub-modules/run-ai.js`: rotates through permanent‑free local providers (Ollama/LM Studio/LocalAI) then cloud free tiers (Groq, Gemini, Together, OpenRouter, HF). Instant failover on `429`/`5xx`/throw, step accumulation, no pause.

The rotator also runs as a Tampermonkey script (`FreeAIRotator.module.user.js`) that injects a `💬 FreeAI` button on any webpage; prompts auto‑fill from page title + selection; results dock inline with Copy.

