# Unified AI Assistant Suite — VS Code Extension

Template editing, preview, and script generation for the **Unified AI Assistant Suite**, straight from your editor.

## Features

- **Generate AI Script** — prompt-driven script generation (OpenAI / Anthropic / Gemini / Ollama)
- **Preview Template** — live HTML preview of the active template in a webview panel
- **Open Options** — jump straight to the `aiAssistant.*` settings
- **Sidebar Dashboard** — quick-action view with Generate / Preview / Settings buttons

## Requirements

- VS Code `^1.85.0`

## Setup

```sh
npm install
npm run compile
```

Press `F5` in VS Code to launch the Extension Development Host.

## Configuration

| Setting                    | Description                          |
| -------------------------- | ------------------------------------ |
| `aiAssistant.apiKey`       | Your AI provider API key             |
| `aiAssistant.defaultProvider` | `openai` / `anthropic` / `gemini` / `ollama` |
| `aiAssistant.model`        | Default model name (e.g. `gpt-4o`)   |

## Packaging

```sh
npm install -g @vscode/vsce
vsce package
```

Produces `unified-ai-assistant-suite-1.0.0.vsix` for marketplace install.

## Development

- `npm run compile` — TypeScript → `dist/extension.js`
- `npm run watch` — incremental compile while developing
- `.vscode/launch.json` — debug profile (F5)