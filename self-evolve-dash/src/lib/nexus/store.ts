// Lightweight Nexus module store (no zustand dependency).
// Persists to localStorage and notifies subscribers.
import { NexusModule, QueueJob } from "./types";

const KEY = "nexus_store_v1";

interface NexusData {
  modules: NexusModule[];
  queue: QueueJob[];
}

const seed: NexusData = {
  modules: [
    {
      id: "mod_omega",
      name: "Ω∞ Compression Core",
      slug: "omega-core",
      category: "ai",
      description: "Genetic evolution + runtime dedup pool.",
      status: "online",
      version: "1.0.0",
      pinned: true,
      tags: ["evolution", "runtime"],
      successRate: 0.95,
    },
    {
      id: "mod_router",
      name: "Smart Provider Router",
      slug: "smart-router",
      category: "ai",
      description: "Cost-biased ranking with circuit breaker fallback.",
      status: "online",
      version: "1.0.0",
      tags: ["routing", "providers"],
      successRate: 0.97,
    },
    {
      id: "mod_guardian",
      name: "Guardian Engine",
      slug: "guardian",
      category: "automation",
      description: "Event bus + provider registry watchdog.",
      status: "idle",
      version: "1.0.0",
      tags: ["events", "watchdog"],
      successRate: 0.9,
    },
  ],
  queue: [],
};

function load(): NexusData {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(seed);
    return JSON.parse(raw);
  } catch {
    return structuredClone(seed);
  }
}

let state: NexusData = load();
const listeners = new Set<() => void>();

function commit() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ }
  listeners.forEach((l) => l());
}

export const nexusStore = {
  getState: () => state,
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  },
  toggleModule(id: string) {
    state = {
      ...state,
      modules: state.modules.map((m) =>
        m.id === id
          ? { ...m, status: m.status === "offline" ? "online" : "offline" }
          : m
      ),
    };
    commit();
  },
  runModule(id: string) {
    const m = state.modules.find((x) => x.id === id);
    if (!m) return;
    const job: QueueJob = {
      id: Math.random().toString(36).slice(2, 10),
      moduleId: m.id,
      moduleName: m.name,
      label: `Run · ${m.name}`,
      status: "running",
      progress: 10,
      createdAt: new Date().toISOString(),
    };
    state = {
      modules: state.modules.map((x) =>
        x.id === id ? { ...x, status: "running", lastRun: job.createdAt } : x
      ),
      queue: [job, ...state.queue].slice(0, 50),
    };
    commit();
  },
  completeJob(jobId: string) {
    state = {
      ...state,
      queue: state.queue.map((j) =>
        j.id === jobId ? { ...j, status: "done", progress: 100 } : j
      ),
    };
    commit();
  },
  clearDone() {
    state = { ...state, queue: state.queue.filter((j) => j.status !== "done") };
    commit();
  },
  reset() { state = structuredClone(seed); commit(); },
};

import { useEffect, useState } from "react";
export function useNexusStore() {
  const [snap, setSnap] = useState(nexusStore.getState());
  useEffect(() => {
    const unsub = nexusStore.subscribe(() => setSnap(nexusStore.getState()));
    return () => { unsub(); };
  }, []);
  return snap;
}