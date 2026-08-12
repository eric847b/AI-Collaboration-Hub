import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type Prompt = { id: string; title: string; tags: string[]; body: string; versions: { ts: number; body: string }[] };
export type Script = { id: string; name: string; version: string; code: string; deps: string[]; updated: number };
export type Note = { id: string; title: string; body: string; ts: number; tag: string };
export type FileItem = { id: string; name: string; folder: string; size: number; type: string; content: string; ts: number };
export type Widget = { id: string; type: string; x: number; y: number; w: number; h: number };

type Workspace = {
  name: string;
  createdAt: number;
  prompts: Prompt[];
  scripts: Script[];
  notes: Note[];
  files: FileItem[];
  layout: Widget[];
};

type State = {
  initialized: boolean;
  activeModule: string;
  workspace: Workspace;
  setModule: (m: string) => void;
  init: () => void;
  resetWorkspace: () => void;
  importWorkspace: (w: Workspace) => void;
  // prompts
  addPrompt: (p: Prompt) => void;
  updatePrompt: (id: string, body: string) => void;
  // scripts
  addScript: (s: Script) => void;
  updateScript: (id: string, code: string) => void;
  // notes
  addNote: (n: Note) => void;
  removeNote: (id: string) => void;
  // files
  addFile: (f: FileItem) => void;
  removeFile: (id: string) => void;
  // layout
  setLayout: (l: Widget[]) => void;
};

const seed = (): Workspace => ({
  name: "Genesis Workspace",
  createdAt: Date.now(),
  prompts: [
    { id: "p1", title: "System Architect", tags: ["system", "core"], body: "You are a recursive systems architect. Decompose the user request into atomic primitives.", versions: [] },
    { id: "p2", title: "Code Compressor", tags: ["code", "minify"], body: "Compress the provided source while preserving semantic equivalence. Output irreducible form.", versions: [] },
    { id: "p3", title: "Signal Interpreter", tags: ["signal", "parse"], body: "Decode raw event streams into structured intent vectors.", versions: [] },
  ],
  scripts: [
    { id: "s1", name: "auto-scroll-infinite", version: "02.05.2026.1", code: "// ==UserScript==\n// @name        Auto Scroll Infinite\n// @match       *://*/*\n// @version     1.0\n// ==/UserScript==\n(function(){\n  let last = 0;\n  window.addEventListener('scroll', () => {\n    if (Date.now() - last < 200) return;\n    last = Date.now();\n    if (window.innerHeight + scrollY >= document.body.offsetHeight - 500) {\n      window.scrollBy(0, 800);\n    }\n  });\n})();", deps: ["dom"], updated: Date.now() },
    { id: "s2", name: "dark-mode-injector", version: "02.05.2026.3", code: "// ==UserScript==\n// @name        Universal Dark Mode\n// @version     1.3\n// ==/UserScript==\ndocument.documentElement.style.filter='invert(1) hue-rotate(180deg)';", deps: ["dom", "css"], updated: Date.now() },
  ],
  notes: [
    { id: "n1", title: "Workspace Initialized", body: "Nexus kernel boot complete. Mock systems online.", ts: Date.now(), tag: "system" },
    { id: "n2", title: "Concept: Inversion", body: "Explore binary inversion as semantic operator across script DAGs.", ts: Date.now() - 86400000, tag: "research" },
  ],
  files: [
    { id: "f1", name: "config.json", folder: "configs", size: 412, type: "json", content: '{ "kernel": "nexus-v1", "memory": "indexed" }', ts: Date.now() },
    { id: "f2", name: "boot.sh", folder: "scripts", size: 88, type: "sh", content: "#!/bin/bash\necho 'NEXUS ONLINE'", ts: Date.now() },
  ],
  layout: [
    { id: "w1", type: "kernel", x: 0, y: 0, w: 380, h: 220 },
    { id: "w2", type: "events", x: 400, y: 0, w: 420, h: 320 },
    { id: "w3", type: "signals", x: 840, y: 0, w: 360, h: 220 },
    { id: "w4", type: "memory", x: 0, y: 240, w: 380, h: 280 },
    { id: "w5", type: "remote", x: 840, y: 240, w: 360, h: 280 },
  ],
});

export const useNexus = create<State>()(
  persist(
    (set, get) => ({
      initialized: false,
      activeModule: "dashboard",
      workspace: seed(),
      setModule: (m) => set({ activeModule: m }),
      init: () => set({ initialized: true }),
      resetWorkspace: () => set({ workspace: seed() }),
      importWorkspace: (w) => set({ workspace: w }),
  addPrompt: (p) => set(s => ({ workspace: { ...s.workspace, prompts: [p, ...s.workspace.prompts] } })),
      updatePrompt: (id, body) => set(s => ({
        workspace: {
          ...s.workspace,
          prompts: s.workspace.prompts.map(p => p.id === id ? { ...p, versions: [{ ts: Date.now(), body: p.body }, ...p.versions].slice(0, 20), body } : p),
        },
      })),
      addScript: (sc) => set(s => ({ workspace: { ...s.workspace, scripts: [sc, ...s.workspace.scripts] } })),
      updateScript: (id, code) => set(s => ({
        workspace: {
          ...s.workspace,
          scripts: s.workspace.scripts.map(sc => sc.id === id ? { ...sc, code, updated: Date.now() } : sc),
        },
      })),
      addNote: (n) => set(s => ({ workspace: { ...s.workspace, notes: [n, ...s.workspace.notes] } })),
      removeNote: (id) => set(s => ({ workspace: { ...s.workspace, notes: s.workspace.notes.filter(n => n.id !== id) } })),
      addFile: (f) => set(s => ({ workspace: { ...s.workspace, files: [f, ...s.workspace.files] } })),
      removeFile: (id) => set(s => ({ workspace: { ...s.workspace, files: s.workspace.files.filter(f => f.id !== id) } })),
      setLayout: (l) => set(s => ({ workspace: { ...s.workspace, layout: l } })),
    }),
    { name: "nexus-infinity-hub", storage: createJSONStorage(() => localStorage) }
  )
);
