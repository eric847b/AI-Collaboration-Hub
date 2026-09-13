/**
 * TypeScript declarations for v3/fine-tuning.js (opt-in — Q2 2027 #15).
 */

export type FineTuneFormat = 'jsonl' | 'chat' | 'messages';

export interface FineTuneEntry {
  text?: string;
  prompt?: string;
  completion: string;
}

export interface FineTuneDataset {
  id: string;
  name: string;
  entries: Array<{ text: string; completion: string }>;
  createdAt: string;
}

export interface FineTuneJob {
  id: string;
  dataset: string;
  baseModel: string;
  hyperparams: { epochs: number; learningRate: number; batchSize: number; maxTokens: number };
  status: 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  metrics: Record<string, unknown> | null;
}

export interface CostEstimate {
  tokens: number;
  totalTokens: number;
  epochs: number;
  estUsd: number;
}

export declare class FineTuningManager {
  constructor(options?: { maxDatasetEntries?: number; hyperparams?: Partial<FineTuneJob['hyperparams']> });
  createDataset(args: { id?: string; name?: string; entries: FineTuneEntry[] }): FineTuneDataset;
  getDataset(id: string): FineTuneDataset | undefined;
  listDatasets(): Array<{ id: string; name: string; count: number }>;
  exportDataset(id: string, format?: FineTuneFormat): string;
  createJob(args: { id?: string; dataset: string; baseModel: string; hyperparams?: Partial<FineTuneJob['hyperparams']> }): FineTuneJob;
  getJob(id: string): FineTuneJob | undefined;
  listJobs(): Array<{ id: string; dataset: string; baseModel: string; status: string }>;
  startJob(id: string): boolean;
  completeJob(id: string, metrics?: Record<string, unknown>): boolean;
  failJob(id: string, reason: string): boolean;
  cancelJob(id: string): boolean;
  estimateCost(jobId: string, per1kTokensUsd?: number): CostEstimate | null;
  evaluate(jobId: string, heldOut?: FineTuneEntry[]): { jobId: string; dataset: string; heldOutSamples: number; overlapRatio: number } | null;
}

export const FORMATS: readonly string[];