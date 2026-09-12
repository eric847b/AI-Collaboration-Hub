# Quick Start — Unified AI Assistant Suite

Get up and running in minutes. This guide covers the three ways to use the suite.

## 1. Browser extension (Chrome / Edge / Firefox)

1. Open `chrome://extensions` (or Edge `edge://extensions`).
2. Enable **Developer mode** (top-right).
3. Click **Load unpacked** and select the `Userscripts/extension/` folder.
4. Click the toolbar icon to open the popup.
5. Choose a provider — or **Auto (cheapest capable)** to let the router pick the
   best model for each prompt.

## 2. Userscript (Tampermonkey / Violentmonkey)

1. Install Tampermonkey and create a new script.
2. Copy the module files from `Userscripts/modules/` (or the prebuilt
   `build/dist/unified-suite-v3.js` for the full v3 bundle).
3. Set `// @grant` and `// @match` per the minimal set the script uses.
4. Reload any matched page.

## 3. Local API server (external tools / CI)

```sh
node Userscripts/v3/api-server.js 3210
curl http://127.0.0.1:3210/health
```

Endpoints:
- `GET  /health` — liveness + uptime
- `GET  /api/templates` — list templates
- `GET  /api/templates/:id` — get one template
- `POST /api/validate` — score a script (`{ "source": "..." }`)
- `POST /api/webhooks` — receive automation events

## Verification

```sh
node Userscripts/v3/index.js --selftest   # 13 module smoke tests
node Userscripts/tests/regression.mjs     # full regression pass
```

## Next steps

- **Plugin marketplace**: open `Userscripts/plugins/marketplace/index.html` to
  browse and install first-party plugins.
- **Team collaboration**: `Userscripts/extension/collab.js` exposes
  `CollabManager` for real-time session sync.
- **Advanced**: see [PLUGIN-DEV.md](PLUGIN-DEV.md) and [MIGRATION.md](MIGRATION.md).