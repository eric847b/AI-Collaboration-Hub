// Core types for the improvement system

export interface ExecutedImprovement {
  id: string;
  title: string;
  key: string;
  target: string;
  executedAt: number;
  success: boolean;
  result?: string;
  error?: string;
  metrics?: { before: number; after: number };
}

export interface ImprovementResult {
  success: boolean;
  result: string;
  metrics?: { before: number; after: number };
}

export type ExecutorFn = () => Promise<ImprovementResult>;

export interface ImprovementMapping {
  pattern: RegExp;
  key: string;
  category: ImprovementCategory;
  priority: number; // 1-10, higher = more important
}

export type ImprovementCategory = 
  | 'performance'
  | 'ux'
  | 'reliability'
  | 'security'
  | 'developer'
  | 'analytics';

export interface ExecutorStats {
  total: number;
  successful: number;
  failed: number;
  successRate: number;
  recentCount: number;
  lastExecution: string | null;
  byCategory: Record<ImprovementCategory, number>;
  averageExecutionTime: number;
}

export interface AdaptiveConfig {
  highSuccessThreshold: number;
  lowSuccessThreshold: number;
  minBatchSize: number;
  maxBatchSize: number;
  minConfidence: number;
  maxConfidence: number;
  windowSize: number;
  batchStep: number;
  confidenceStep: number;
  geneticMutationRate: number;
  explorationRate: number;
}

export interface EngineMetrics {
  cycleCount: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  rollingSuccessRate: number;
  adaptiveConfidence: number;
  adaptiveBatchSize: number;
  tuningMode: TuningMode;
  pendingCount: number;
  blacklistedCount: number;
  executedCount: number;
  executionSuccessRate: number;
  memoryUsage: number;
  cpuPressure: number;
  throughput: number;
  efficiency: number;
  // Perfected metrics
  hasConverged: boolean;
  annealingTemp: number;
  generation: number;
  bestFitness: number;
  momentumConf: number;
  momentumBatch: number;
}

export type TuningMode = 'conservative' | 'balanced' | 'aggressive' | 'maximum' | 'auto';

export type CycleSpeed = 'slow' | 'normal' | 'fast' | 'turbo' | 'ludicrous';
