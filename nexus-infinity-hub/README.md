# Nexus Infinity Hub

Nexus Infinity Hub is a Vite-powered React workspace for coordinating AI prompts, userscripts, memory notes, file vault items, event streams, and visual system graphs from a single cyberpunk-style dashboard.

## Features

- Modular dashboard with draggable kernel, event, signal, memory, and remote widgets.
- Prompt lab with version history for iterative prompt refinement.
- Userscript lab, file vault, memory vault, event bus, and graph visualizer modules.
- Persistent workspace state backed by local storage.
- Import and export support for portable workspace JSON files.

## Getting Started

Install dependencies and start the local development server:

```sh
npm install
npm run dev
```

## Quality Checks

```sh
npm run lint
npm test
npm run build
```

## Project Structure

- `src/components/nexus/` — Nexus application modules and dashboard widgets.
- `src/components/ui/` — Reusable UI primitives.
- `src/store/nexus.ts` — Workspace state and persistence actions.
- `modules/` — Standalone userscript module experiments.
