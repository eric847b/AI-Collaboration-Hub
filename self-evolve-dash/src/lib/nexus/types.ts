// Unified types merged from Smart Route AI, AI Guardian Engine, AI Nexus Hub
export type CostType = "free" | "limited" | "paid";

export interface AIProvider {
  id: string;
  name: string;
  costType: CostType;
  available: boolean;
  latencyMs: number;
  successRate: number; // 0-1
}

export interface ScoredProvider {
  provider: AIProvider;
  providerScore: number;
  costBias: number;
  finalScore: number;
}

export type ModuleStatus = "online" | "idle" | "running" | "error" | "offline";
export type ModuleCategory = "automation" | "ai" | "tools" | "finance" | "mobile";

export interface NexusModule {
  id: string;
  name: string;
  slug: string;
  category: ModuleCategory;
  description: string;
  status: ModuleStatus;
  version: string;
  pinned?: boolean;
  tags: string[];
  endpoint?: string;
  lastRun?: string;
  successRate?: number;
}

export interface QueueJob {
  id: string;
  moduleId: string;
  moduleName: string;
  label: string;
  status: "queued" | "running" | "done" | "failed";
  progress: number;
  createdAt: string;
}