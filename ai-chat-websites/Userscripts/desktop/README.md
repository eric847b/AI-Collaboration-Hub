# Desktop App (Tauri) — Evaluation Scaffold

Q2 2027 #14 "Desktop app via Tauri or Electron (evaluate)". This is the
**evaluation scaffold** — it wires the v3 build (`../build/dist`) into a Tauri
shell. No native binaries are committed.

## Why Tauri over Electron

- ~10× smaller binary and lower memory footprint.
- Uses the OS webview (WebView2/WKWebView), matching our CSP-first posture.
- Rust backend pairs with the Node API server for local automation.

## Structure

```
desktop/
  package.json          # @tauri-apps/cli dev dep
  src-tauri/
    tauri.conf.json     # window, CSP, bundle targets
```

## Run

```sh
cd Userscripts/build && npm install && npm run build   # produces dist/
cd ../desktop
npm install
npx tauri dev
```

## Evaluation notes

- CSP in `tauri.conf.json` mirrors `v3/csp-validator.js` expectations.
- The `frontendDist` points at the Vite `dist/` output, so the desktop shell
  reuses the exact same web assets as the PWA.
- Remaining native work (system tray, auto-update, file dialogs) is
  out-of-scope until this scaffold is approved.